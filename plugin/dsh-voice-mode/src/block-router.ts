/**
 * 语音改编站 · Markdown 块解析 + 流式路由（block-router）。
 *
 * 目标：用 DSH 渲染器**同款解析库**（remark-parse + remark-gfm + remark-math）把
 * Markdown 流拆成带类型的语音片段，保证「屏幕上被渲染成公式/表格/代码的部分」与
 * 「语音侧单独适配的部分」完全一致（所见即所送）。
 *
 * 设计要点：
 *  - 结构块（围栏代码 / 展示公式 $$）可能内含空行，必须攒到闭合再解析；
 *  - 其余文本（段落/标题/列表/表格）按空行分块后整体交给 remark 解析——
 *    表格因此天然被识别，路由器无需自己用竖线猜（单竖线不会误判成表格）；
 *  - 未闭合的结构块在流结束 flush() 时才解析，避免把没写完的代码提前送模型。
 *
 * 注：parseSpeechSegments 与 DSH 渲染器保持同一套库与选项（remark-math 默认
 * singleDollarTextMath=true），因此 \$..\$ 行内公式、\$\$..\$\$ 展示公式、GFM
 * 表格、脚注的识别结果与屏幕一致；\[ x \]、\( y \) 会被当作普通文字。
 */
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { toString } from 'mdast-util-to-string'

export type SpeechKind =
  | 'prose'
  | 'inline-math'
  | 'display-math'
  | 'code'
  | 'inline-code'
  | 'table'
  | 'footnote-ref'
  | 'footnote-def'

export interface SpeechSegment {
  kind: SpeechKind
  text: string
  meta?: {
    /** code：围栏语言标识（可能为空）。 */
    lang?: string
    /** table：结构化行列文本。 */
    rows?: string[][]
    rowCount?: number
    colCount?: number
  }
}

/** 内部临时片段：带 block 序号，用于合并同一块内相邻的 prose。 */
type RawSegment = SpeechSegment & { block: number }

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath)

function cellText(cell: unknown): string {
  return toString(cell as never).replace(/\s+/g, ' ').trim()
}

function tableData(node: any): string[][] {
  const rows: string[][] = []
  for (const row of node.children) rows.push(row.children.map(cellText))
  return rows
}

function pushInline(node: any, out: RawSegment[], block: number): void {
  switch (node.type) {
    case 'text':
      if (node.value) out.push({ kind: 'prose', text: node.value, block })
      return
    case 'inlineCode':
      out.push({ kind: 'inline-code', text: node.value, block })
      return
    case 'inlineMath':
      out.push({ kind: 'inline-math', text: node.value, block })
      return
    case 'image':
      if (node.alt) out.push({ kind: 'prose', text: '图片：' + node.alt, block })
      return
    case 'footnoteReference':
      out.push({ kind: 'footnote-ref', text: '[' + node.identifier + ']', block })
      return
    case 'break':
    case 'html':
      return
    default:
      if (Array.isArray(node.children)) {
        for (const c of node.children) pushInline(c, out, block)
      } else {
        const s = toString(node)
        if (s) out.push({ kind: 'prose', text: s, block })
      }
  }
}

function walkBlocks(nodes: any[], out: RawSegment[], ctx: { n: number }): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'code':
        out.push({ kind: 'code', text: node.value, meta: { lang: node.lang || '' }, block: ctx.n++ })
        break
      case 'math':
        out.push({ kind: 'display-math', text: node.value, block: ctx.n++ })
        break
      case 'table': {
        const rows = tableData(node)
        out.push({
          kind: 'table',
          text: rows.map((r) => r.join(' | ')).join('\n'),
          meta: { rows, rowCount: rows.length, colCount: rows[0] ? rows[0].length : 0 },
          block: ctx.n++,
        })
        break
      }
      case 'paragraph':
      case 'heading':
        pushInline(node, out, ctx.n++)
        break
      case 'list':
      case 'listItem':
      case 'blockquote':
        walkBlocks(node.children ?? [], out, ctx)
        break
      case 'footnoteDefinition':
        out.push({ kind: 'footnote-def', text: toString(node), block: ctx.n++ })
        break
      case 'thematicBreak':
      case 'html':
        break
      default:
        if (Array.isArray(node.children)) walkBlocks(node.children, out, ctx)
        else {
          const s = toString(node)
          if (s) out.push({ kind: 'prose', text: s, block: ctx.n++ })
        }
    }
  }
}

/**
 * 把一段**完整** Markdown 解析为语音片段。
 * 行内公式与中文紧贴时也能精确切分；相邻 prose 合并；空片段被丢弃。
 */
export function parseSpeechSegments(markdown: string): SpeechSegment[] {
  if (!markdown || !markdown.trim()) return []
  let tree: any
  try {
    tree = processor.parse(markdown)
  } catch {
    // 解析器异常时保底当普通文字，绝不丢内容。
    return [{ kind: 'prose', text: markdown }]
  }
  const raw: RawSegment[] = []
  walkBlocks(tree.children ?? [], raw, { n: 0 })
  const merged: RawSegment[] = []
  for (const seg of raw) {
    const last = merged[merged.length - 1]
    if (seg.kind === 'prose' && last && last.kind === 'prose' && last.block === seg.block) {
      last.text += seg.text
    } else {
      merged.push({ ...seg })
    }
  }
  const out: SpeechSegment[] = []
  for (const s of merged) {
    if (!s.text || !s.text.trim()) continue
    out.push(s.meta ? { kind: s.kind, text: s.text, meta: s.meta } : { kind: s.kind, text: s.text })
  }
  return out
}

export interface BlockRouterOptions {
  /**
   * 正文（非结构块）攒到多少字符后，在行边界强制冲刷，避免长段落久等。
   * 0 / 未设 = 只在空行或 flush() 时冲刷（表格识别最稳）。
   */
  maxProseChars?: number
}

type StructState =
  | { kind: 'code'; open: { char: string; len: number }; lines: string[] }
  | { kind: 'math'; lines: string[] }

const FENCE_OPEN = /^ {0,3}(\x60{3,}|~{3,})/

function fenceOpenInfo(line: string): { char: string; len: number } | null {
  const m = FENCE_OPEN.exec(line)
  if (!m) return null
  const marker = m[1]
  return { char: marker[0], len: marker.length }
}

function isFenceClose(line: string, open: { char: string; len: number }): boolean {
  const m = /^ {0,3}(\x60+|~+)\s*$/.exec(line.replace(/\r?\n$/, ''))
  if (!m) return false
  const marker = m[1]
  return marker[0] === open.char && marker.length >= open.len
}

/** 行首（≤3 空格）以 $$ 开头视为展示公式开启。 */
function mathOpen(line: string): boolean {
  return /^ {0,3}\$\$/.test(line)
}

/** 已累积行中出现成对的 $$ 即视为闭合（覆盖单行 $$x$$ 与多行 $$..$$）。 */
function mathClosed(lines: string[]): boolean {
  const joined = lines.join('')
  const first = joined.indexOf('$$')
  if (first < 0) return false
  return joined.indexOf('$$', first + 2) >= 0
}

/**
 * 流式块路由：feed(delta) 返回本次已闭合的片段；flush() 处理残余。
 */
export class BlockRouter {
  private buf = ''
  private struct: StructState | null = null
  private prose = ''
  private readonly maxProseChars: number

  constructor(opts: BlockRouterOptions = {}) {
    this.maxProseChars = opts.maxProseChars ?? 0
  }

  feed(delta: string): SpeechSegment[] {
    if (!delta) return []
    const out: SpeechSegment[] = []
    this.buf += delta
    for (;;) {
      const idx = this.buf.indexOf('\n')
      if (idx < 0) break
      const line = this.buf.slice(0, idx + 1)
      this.buf = this.buf.slice(idx + 1)
      this.consumeLine(line, out)
    }
    return out
  }

  flush(): SpeechSegment[] {
    const out: SpeechSegment[] = []
    if (this.struct) {
      if (this.buf) {
        this.struct.lines.push(this.buf)
        this.buf = ''
      }
      out.push(...parseSpeechSegments(this.struct.lines.join('')))
      this.struct = null
    } else {
      if (this.buf) {
        this.prose += this.buf
        this.buf = ''
      }
      this.flushProse(out)
    }
    return out
  }

  private consumeLine(line: string, out: SpeechSegment[]): void {
    if (this.struct) {
      this.struct.lines.push(line)
      if (this.struct.kind === 'code' && isFenceClose(line, this.struct.open)) {
        out.push(...parseSpeechSegments(this.struct.lines.join('')))
        this.struct = null
      } else if (this.struct.kind === 'math' && mathClosed(this.struct.lines)) {
        out.push(...parseSpeechSegments(this.struct.lines.join('')))
        this.struct = null
      }
      return
    }
    const open = fenceOpenInfo(line)
    if (open) {
      this.flushProse(out)
      this.struct = { kind: 'code', open, lines: [line] }
      return
    }
    if (mathOpen(line)) {
      this.flushProse(out)
      this.struct = { kind: 'math', lines: [line] }
      if (mathClosed(this.struct.lines)) {
        out.push(...parseSpeechSegments(this.struct.lines.join('')))
        this.struct = null
      }
      return
    }
    if (line.trim() === '') {
      this.flushProse(out)
      return
    }
    this.prose += line
    if (this.maxProseChars > 0 && this.prose.length >= this.maxProseChars) {
      this.flushProse(out)
    }
  }

  private flushProse(out: SpeechSegment[]): void {
    if (!this.prose.trim()) {
      this.prose = ''
      return
    }
    out.push(...parseSpeechSegments(this.prose))
    this.prose = ''
  }
}
