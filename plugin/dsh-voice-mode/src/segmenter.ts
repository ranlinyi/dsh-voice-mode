/**
 * 句子切分器：累积 raw text-delta，按终止标点输出完整句子（供 TTS 朗读）。
 * 与参照 dsh-voice 同源：markdown 剥离 + 中英日终止标点切分 + 强制上限。
 */

export interface SegmenterOptions {
  /** 无标点文本的强制切分上限（防 markdown 墙）。 */
  maxSentenceChars?: number
  /** 实时读取的多音字替代表（空 = 不改任何词）。 */
  fixes?: () => readonly PronunciationFix[]
}

const TERMINAL = /[。！？!?；;…\n]/

const SKIP_PREFIX = /^[\s.,，、:：;；!?！？)\]）"'”’〉》】]+$/

/** 剥离 markdown 噪声后再合成（与 dsh-tts 的 plainText 滤镜同源）。 */
export function plainText(text: string): string {
  return String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
}

/**
 * 单字符级 TTS 消毒：剔除会被 espeak 按英文念出的噪声字符
 * （asterisk/underscore/greater than/vertical bar…）。
 * plainText 是配对式剥离，流式增量下配对符可能被 chunk 截断（如 `**` 劈成
 * 两半），残留字符会被逐字念出——故对成句文本再做一遍单字符兜底。
 */
export function sanitizeForTts(text: string): string {
  return String(text)
    .replace(/[*_#>`|^=+~]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    // 汉字之间的空格对中文合成无意义（噪声字符剔除的副产品），塌掉避免怪停顿。
    .replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1')
    .trim()
}

/**
 * TTS 多音字/易错词纠正：只作用于朗读文本，不影响屏幕显示。
 *
 * 设计约束（重要）：替身必须与原词**等字数**。
 * 免费 Edge 端点不支持任何音素级 SSML 标签（实测 <break> / <phoneme>(sapi|ipa) /
 * <say-as> 一律 no turn.end），唯一可用的手段就是文本层的同音替换；而一旦允许
 * 增删音节，「纠音」就变成了「改词」——历史实现把「最速降线」换成「最速下降线」，
 * 4 音节词被念成 5 音节，听感上等于换了个术语名。因此本表：
 *  - 内置条目为空（默认不改任何字，也不纠音）；
 *  - 只接受用户显式维护的「原词 => 同音替身」；
 *  - 字数不等的条目被忽略并回报错误，绝不静默改名。
 */
export interface PronunciationFix {
  /** 原文中会被读错的写法。 */
  term: string
  /** 朗读替身：必须与 term 等字数且逐字同音（同音由维护者负责，插件只强制等字数）。 */
  spoken: string
}

export interface PronunciationFixesResult {
  fixes: PronunciationFix[]
  /** 被拒绝的行（人类可读原因），供设置页/状态接口提示。 */
  errors: string[]
}

const codePoints = (s: string): string[] => Array.from(s)

/**
 * 解析用户维护的替代表：每行「原词 => 替身」（也接受 `->` / `→`）；
 * 空行与 `#` 注释忽略；字段为空或字数不等的条目进 errors 且不生效。
 */
export function parsePronunciationFixes(raw: string): PronunciationFixesResult {
  const fixes: PronunciationFix[] = []
  const errors: string[] = []
  const lines = String(raw ?? '').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    const m = /^(.*?)\s*(?:=>|->|→)\s*(.*)$/.exec(line)
    if (!m) {
      errors.push('第 ' + (i + 1) + ' 行缺少 “=>”：' + line)
      continue
    }
    const term = m[1].trim()
    const spoken = m[2].trim()
    if (!term || !spoken) {
      errors.push('第 ' + (i + 1) + ' 行原词或替身为空：' + line)
      continue
    }
    const a = codePoints(term).length
    const b = codePoints(spoken).length
    if (a !== b) {
      errors.push('第 ' + (i + 1) + ' 行字数不等（' + a + ' vs ' + b + '）：只允许同音替换，不允许增删字：' + line)
      continue
    }
    if (term === spoken) continue
    fixes.push({ term, spoken })
  }
  return { fixes, errors }
}

/** 对朗读文本应用替代表（空表 = 原样返回；只作用于朗读，不影响屏幕）。 */
export function applyPronunciationFixes(text: string, fixes: readonly PronunciationFix[] = []): string {
  if (fixes.length === 0) return String(text)
  let out = String(text)
  for (const fix of fixes) out = out.split(fix.term).join(fix.spoken)
  return out
}

/** 按终止标点切分一段文本，保留句尾在句子内、尾部悬挂在 tail。 */
export function splitSentences(chunk: string): { sentences: string[]; tail: string } {
  const sentences: string[] = []
  let start = 0
  // CJK 终止符 + ASCII 终止符；孤立的英文句点仅在空白/文末后算终止
  // （避免拆散 "3.14"、URL）。
  const re = /[。！？!?；;…\n]+|\.(?=\s|$)/g
  let m: RegExpExecArray | null
  let lastEnd = 0
  while ((m = re.exec(chunk)) !== null) {
    const end = m.index + m[0].length
    sentences.push(chunk.slice(start, end))
    start = end
    lastEnd = end
  }
  return { sentences, tail: chunk.slice(lastEnd) }
}

export class SentenceSegmenter {
  private buffer = ''
  private readonly maxChars: number
  private readonly fixes?: () => readonly PronunciationFix[]

  constructor(options: SegmenterOptions = {}) {
    this.maxChars = options.maxSentenceChars ?? 200
    this.fixes = options.fixes
  }

  /** 实时读取替代表（getter 抛错时退化为「不替换」，不影响朗读）。 */
  private fixList(): readonly PronunciationFix[] {
    if (!this.fixes) return []
    try {
      return this.fixes() ?? []
    } catch {
      return []
    }
  }

  /** 喂入一段 raw delta，返回它补全的完整句子。 */
  feed(chunk: string): string[] {
    const cleaned = plainText(chunk)
    if (!cleaned) return []
    this.buffer += cleaned
    const { sentences, tail } = splitSentences(this.buffer)
    this.buffer = tail
    const out: string[] = []
    const fixes = this.fixList()
    for (const s of sentences) {
      const t = applyPronunciationFixes(sanitizeForTts(s), fixes).trim()
      if (t && !SKIP_PREFIX.test(t)) out.push(t)
    }
    // 安全阀：一堵没有标点的文字墙。
    if (this.buffer.length > this.maxChars) {
      const cut = this.buffer.search(/[，,、\s]/)
      const idx = cut > 0 ? cut : Math.floor(this.maxChars / 2)
      const head = applyPronunciationFixes(sanitizeForTts(this.buffer.slice(0, idx)), this.fixList()).trim()
      this.buffer = this.buffer.slice(idx)
      if (head) out.push(head)
    }
    return out
  }

  /** 收尾：flush 剩余缓冲（流结束）。 */
  flush(): string[] {
    const t = applyPronunciationFixes(sanitizeForTts(this.buffer), this.fixList()).trim()
    this.buffer = ''
    if (t && !SKIP_PREFIX.test(t)) return [t]
    return []
  }
}