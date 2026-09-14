/**
 * 语音改编站 · 朗读适配器（SpeechAdapter）。
 *
 * 把 text-delta 流经 BlockRouter 拆成带类型的片段：
 *  - 正文 / 行内代码 / 脚注 → 原有 SentenceSegmenter（清洗→分句→TTS）；
 *  - 行内公式 → 按 mathMode（rules 确定性规则 / model 交给改写器 / verbatim 原样）；
 *  - 展示公式 / 代码 / 表格 → 改写器口播稿，失败回退确定性读法。
 *
 * 上下文（sp3）：适配器顺手维护两条**格式化后**的上下文，交给改写器：
 *  1. before —— 最近已朗读正文的尾部（字符上限由 contextChars 控制，0 = 不给）；
 *  2. symbols —— 本回合已确认的符号含义（正文中「g 表示重力加速度」这类显式定义，
 *     加上改写模型在 JSON 响应里回传的 symbols）。
 * 上下文只在请求 JSON 的 context 字段里出现，模型只被允许改写 segment。
 *
 * 顺序保证：所有片段进入一条串行 promise 链，保证 TTS 入队顺序与原文一致
 * （结构片段要等模型返回，会短暂延后其后的正文；这是「顺序正确」换「零等待」的取舍）。
 * 总开关关闭时完全退化为原有路径，行为与未接入前一致。
 */
import { BlockRouter, type SpeechSegment } from './block-router.ts'
import { SentenceSegmenter, type PronunciationFix } from './segmenter.ts'
import { latexToSpeech } from './math.ts'
import type { RewriteContext, RewriteSymbol, SpeechRewriter } from './rewriter.ts'

export type MathMode = 'rules' | 'model' | 'verbatim'

export interface SpeechAdapterConfig {
  /** 改编站总开关。关 = 完全保持原有「原文→清洗→分句」路径。 */
  enabled: boolean
  mathMode: MathMode
  rewriter: SpeechRewriter | null
  /** 用户维护的读音替代表（空 = 不改任何词，也不纠音）。 */
  pronunciation?: readonly PronunciationFix[]
  /** 传给改写模型的前文字符**上限**（0 = 不给前文；未设 = 800）。实际长度按片段动态伸缩。 */
  contextChars?: number
  /** 段落之间的停顿毫秒（0 = 关；未设 = 350）。标题之后用 1.6 倍。 */
  blockPauseMs?: number
  /**
   * 含行内公式的整句交给模型出稿（默认开）。
   * 关掉则退回"公式片段单独改写 + 正文单独念"，容易重复朗读。
   */
  wholeSentenceMath?: boolean
}

export interface SpeechAdapterOptions {
  config: () => SpeechAdapterConfig
  /** pauseBeforeMs：本句起播前应插入的静音毫秒（段落/标题边界；0/未给 = 无缝）。 */
  onSentence: (sentence: string, pauseBeforeMs?: number) => void
}

/** 段落停顿默认值（毫秒）；标题之后按 1.6 倍。 */
const DEFAULT_BLOCK_PAUSE_MS = 350

/** 前文上限默认值（字符）：动态预算不会超过它。 */
const DEFAULT_CONTEXT_CAP = 800
/** 动态预算下限：再短的片段也至少给这么多字的前文。 */
const MIN_CONTEXT_CHARS = 120
/** 动态预算 = 片段长度 × 4 + 120，再被上限截断：片段越长、结构越复杂，越需要语境。 */
const CONTEXT_GROWTH = 4
const CONTEXT_BASE = 120
/** 内部保留的正文上限（防长回复内存膨胀；实际按动态预算截取）。 */
const KEEP_PROSE_CHARS = 4000
/** 符号表上限。 */
const MAX_SYMBOLS = 24

/**
 * 动态上下文预算：随待改写片段长度伸缩——短的行内公式只需要一点点前文，
 * 大代码块/大表格才需要更多语境。cap <= 0 或非法 = 关闭（返回 0）。
 */
export function contextBudget(segmentChars: number, cap: number | undefined): number {
  const limit = cap === undefined ? DEFAULT_CONTEXT_CAP : cap
  if (!Number.isFinite(limit) || limit <= 0) return 0
  const n = Number.isFinite(segmentChars) && segmentChars > 0 ? segmentChars : 0
  const want = Math.max(MIN_CONTEXT_CHARS, Math.round(n * CONTEXT_GROWTH + CONTEXT_BASE))
  return Math.min(limit, want)
}

/** 取文本尾部 budget 个字符，并前移到句子起点，避免从句中截断（半句造成误读）。 */
export function trimContext(text: string, budget: number): string {
  if (!text || !Number.isFinite(budget) || budget <= 0) return ''
  if (text.length <= budget) return text
  const cut = text.slice(text.length - budget)
  const idx = cut.search(/[。！？!?；;…\n]/)
  // 切到句首；若切完为空（末尾本就是终止符），退回整段截取，避免上下文变空。
  const body = idx >= 0 ? cut.slice(idx + 1) : cut
  return body.trim() || cut.trim()
}

function codeFallback(seg: SpeechSegment): string {
  const lang = seg.meta && seg.meta.lang ? '（' + seg.meta.lang + '）' : ''
  const lines = seg.text ? seg.text.split('\n').length : 0
  return '代码块' + lang + '，共 ' + lines + ' 行。'
}

function tableFallback(seg: SpeechSegment): string {
  const rows = seg.meta && seg.meta.rows ? seg.meta.rows : []
  const headers = rows[0] ? rows[0].join('、') : ''
  const rowCount = seg.meta && seg.meta.rowCount !== undefined ? seg.meta.rowCount : rows.length
  const colCount = seg.meta && seg.meta.colCount !== undefined ? seg.meta.colCount : 0
  const head = '表格：' + rowCount + ' 行 ' + colCount + ' 列。列名：' + headers + '。'
  // 改写失败时的兜底：至少把首列（通常是条目名）念出来，不然整张表只剩行列数。
  const names = rows
    .slice(1)
    .map((r) => (r[0] ? r[0].trim() : ''))
    .filter((v) => v)
  return names.length ? head + '行名：' + names.slice(0, 12).join('、') + '。' : head
}

/** 正文里的显式符号定义（如「g 表示重力加速度」）；匹配不到就不猜。 */
const SYMBOL_DEF_RE = /([A-Za-z])\s*(?:表示|代表|意为|指的是)\s*([\u4e00-\u9fff]{2,10})/g

/**
 * 把同一个块内的片段按终止标点切成"句"（用于整句改写）。
 * prose 片段可能含多句，按「。！？!?；;…换行」切；行内公式/行内代码等片段附着在当前句里。
 */
export function splitSegmentSentences(group: SpeechSegment[]): SpeechSegment[][] {
  const out: SpeechSegment[][] = []
  let cur: SpeechSegment[] = []
  for (const seg of group) {
    if (seg.kind !== 'prose') {
      cur.push(seg)
      continue
    }
    const text = seg.text
    const re = /[。！？!?；;…\n]+/g
    let start = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const end = m.index + m[0].length
      cur.push({ kind: 'prose', text: text.slice(start, end) })
      out.push(cur)
      cur = []
      start = end
    }
    if (start < text.length) cur.push({ kind: 'prose', text: text.slice(start) })
  }
  if (cur.length) out.push(cur)
  return out
}

export class SpeechAdapter {
  private readonly router = new BlockRouter()
  private readonly segmenter: SentenceSegmenter
  private chain: Promise<void> = Promise.resolve()
  /** 最近正文（原文，未加标点处理）。 */
  private recent: string[] = []
  /** 本回合已确认的符号含义。 */
  private readonly symbols = new Map<string, string>()
  /** 待兑现的停顿：下一个成句起播前插入（段落/标题边界）。 */
  private pendingPauseMs = 0

  constructor(private readonly opts: SpeechAdapterOptions) {
    // 用 getter 实时读取替代表：设置改动即时生效，且字段初始化期不触碰 this.opts。
    this.segmenter = new SentenceSegmenter({ fixes: () => this.opts.config().pronunciation ?? [] })
  }

  /** 喂入一个 text-delta。关闭改编站时退化为原路径（同步，无异步链）。 */
  feed(delta: string): void {
    if (!delta) return
    if (!this.opts.config().enabled) {
      for (const s of this.segmenter.feed(delta)) this.opts.onSentence(s)
      return
    }
    this.consume(this.router.feed(delta))
  }

  /** 流结束：处理未闭合结构块，并冲刷残余句子。 */
  flush(): void {
    if (this.opts.config().enabled) {
      this.consume(this.router.flush())
    }
    this.run(() => {
      for (const s of this.segmenter.flush()) this.opts.onSentence(s, this.takePause())
    })
  }

  /** 等待链上所有异步改写完成（收尾/测试用）。 */
  whenIdle(): Promise<void> {
    return this.chain
  }

  /** 当前上下文快照（只含非空字段）；segmentChars 决定动态前文预算。 */
  context(segmentChars: number): RewriteContext {
    const ctx: RewriteContext = {}
    const before = this.beforeContext(segmentChars)
    if (before) ctx.before = before
    const symbols = [...this.symbols.entries()].map(([sym, meaning]) => ({ sym, meaning })).slice(-12)
    if (symbols.length) ctx.symbols = symbols
    return ctx
  }

  /** 把一个块内的片段按 pause 分组，再按句处理。 */
  private consume(segs: SpeechSegment[]): void {
    let group: SpeechSegment[] = []
    const flushGroup = (): void => {
      if (group.length) {
        this.handleGroup(group)
        group = []
      }
    }
    for (const seg of segs) {
      if (seg.kind === 'pause') {
        flushGroup()
        this.schedule(seg)
      } else {
        group.push(seg)
      }
    }
    flushGroup()
  }

  /**
   * 一个块内的片段：含行内公式时按"整句"交给模型（正文不再单独念，根治重复朗读），
   * 不含公式的句子仍走原来的片段路径（不产生额外请求）。
   */
  private handleGroup(group: SpeechSegment[]): void {
    const cfg = this.opts.config()
    const wholeSentence = cfg.wholeSentenceMath !== false && cfg.mathMode === 'model' && cfg.rewriter !== null
    if (!wholeSentence || !group.some((s) => s.kind === 'inline-math')) {
      for (const seg of group) this.schedule(seg)
      return
    }
    for (const sent of splitSegmentSentences(group)) {
      if (sent.some((s) => s.kind === 'inline-math')) this.scheduleSentence(sent)
      else for (const seg of sent) this.schedule(seg)
    }
  }

  /** 整句（含行内公式）交给改写器：模型返回整句口播稿，失败则回退逐片段原路径。 */
  private scheduleSentence(sent: SpeechSegment[]): void {
    this.run(async () => {
      const cfg = this.opts.config()
      const raw = sent.map((s) => (s.kind === 'inline-math' ? '$' + s.text + '$' : s.text)).join('')
      const text = raw.replace(/\s+/g, ' ').trim()
      if (!text) return
      const r = cfg.rewriter
        ? await cfg.rewriter.rewrite({
            kind: 'sentence',
            text,
            meta: { sentence: text },
            context: this.context(text.length),
          })
        : null
      if (r) {
        for (const s of sent) if (s.kind === 'prose') this.rememberProse(s.text)
        if (r.symbols) this.learnSymbols(r.symbols)
        this.emit(r.text)
        return
      }
      // 回退：按片段走原路径（行内公式走确定性读法），handle 内部自己记前文。
      for (const seg of sent) await this.handle(seg)
    })
  }

  private schedule(seg: SpeechSegment): void {
    this.run(() => this.handle(seg))
  }

  private run(task: () => void | Promise<void>): void {
    this.chain = this.chain.then(task).catch(() => undefined)
  }

  private async handle(seg: SpeechSegment): Promise<void> {
    const cfg = this.opts.config()
    switch (seg.kind) {
      case 'pause': {
        // 先冲刷尚未成句的累积（标题通常没有终止标点，否则会和正文并成一句，
        // 边界直接消失）；停顿再挂到下一句。
        for (const s of this.segmenter.flush()) this.opts.onSentence(s)
        const base = cfg.blockPauseMs === undefined ? DEFAULT_BLOCK_PAUSE_MS : cfg.blockPauseMs
        if (base > 0) {
          const factor = seg.meta && seg.meta.pauseLevel === 'heading' ? 1.6 : 1
          this.pendingPauseMs = Math.max(this.pendingPauseMs, Math.round(base * factor))
        }
        return
      }
      case 'prose':
        this.rememberProse(seg.text)
        this.emit(seg.text)
        return
      case 'inline-code':
      case 'footnote-ref':
      case 'footnote-def':
        this.emit(seg.text)
        return
      case 'inline-math':
        if (cfg.mathMode === 'model') {
          const r = cfg.rewriter
            ? await cfg.rewriter.rewrite({
                kind: 'inline-math',
                text: seg.text,
                meta: seg.meta,
                context: this.context(seg.text.length),
              })
            : null
          if (r && r.symbols) this.learnSymbols(r.symbols)
          this.emit(r ? r.text : latexToSpeech(seg.text))
        } else if (cfg.mathMode === 'verbatim') {
          this.emit(seg.text)
        } else {
          this.emit(latexToSpeech(seg.text))
        }
        return
      case 'display-math':
        if (cfg.mathMode === 'verbatim') this.emit(seg.text)
        else if (cfg.mathMode === 'rules') this.emit(latexToSpeech(seg.text))
        else await this.rewriteOrFallback(seg, latexToSpeech(seg.text))
        return
      case 'code':
        await this.rewriteOrFallback(seg, codeFallback(seg))
        return
      case 'table':
        await this.rewriteOrFallback(seg, tableFallback(seg))
        return
      default:
        return
    }
  }

  private async rewriteOrFallback(seg: SpeechSegment, fallback: string): Promise<void> {
    const cfg = this.opts.config()
    const kind = seg.kind as 'display-math' | 'code' | 'table'
    const r = cfg.rewriter
      ? await cfg.rewriter.rewrite({ kind, text: seg.text, meta: seg.meta, context: this.context(seg.text.length) })
      : null
    if (r && r.symbols) this.learnSymbols(r.symbols)
    this.emit(r ? r.text : fallback)
  }

  private emit(text: string): void {
    if (!text || !text.trim()) return
    // 停顿只兑现给"这一段产生的第一句"：段落正文可能被分成多句，句间仍保持无缝。
    for (const s of this.segmenter.feed(text)) this.opts.onSentence(s, this.takePause())
  }

  private takePause(): number {
    const ms = this.pendingPauseMs
    this.pendingPauseMs = 0
    return ms
  }

  /** 记入前文（只收正文；超上限时丢最旧的）。 */
  private rememberProse(text: string): void {
    const t = String(text).trim()
    if (!t) return
    this.recent.push(t)
    this.extractSymbolDefs(t)
    let total = this.recent.reduce((n, s) => n + s.length, 0)
    while (this.recent.length > 1 && total > KEEP_PROSE_CHARS) {
      const dropped = this.recent.shift()
      total -= dropped ? dropped.length : 0
    }
  }

  /** 前文 = 最近正文的尾部，长度由动态预算决定；上限 <= 0 时关闭。 */
  private beforeContext(segmentChars: number): string {
    const budget = contextBudget(segmentChars, this.opts.config().contextChars)
    if (budget <= 0) return ''
    return trimContext(this.recent.join(''), budget)
  }

  /** 从正文抽取显式符号定义（宁可漏，不可猜）。 */
  private extractSymbolDefs(text: string): void {
    SYMBOL_DEF_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = SYMBOL_DEF_RE.exec(text)) !== null) {
      this.putSymbol(m[1], m[2])
    }
  }

  /** 吸收改写模型回传的符号含义。 */
  private learnSymbols(symbols: readonly RewriteSymbol[]): void {
    for (const s of symbols) this.putSymbol(s.sym, s.meaning)
  }

  private putSymbol(sym: string, meaning: string): void {
    const s = String(sym).trim()
    const m = String(meaning).trim()
    if (!s || !m) return
    if (this.symbols.has(s)) this.symbols.delete(s)
    this.symbols.set(s, m)
    while (this.symbols.size > MAX_SYMBOLS) {
      const oldest = this.symbols.keys().next().value
      if (oldest === undefined) break
      this.symbols.delete(oldest)
    }
  }
}
