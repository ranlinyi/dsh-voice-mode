/**
 * 语音改编站 · 口播稿改写器（rewriter）。
 *
 * 职责：把结构片段（表格/代码/展示公式）连同**格式化后的上下文**交给一个
 * OpenAI 兼容的聊天补全端点，换回适合 TTS 朗读的口播稿。
 *
 * 协议（sp3，全 JSON 信封）：
 *  请求 user 消息 = {"task":..., "context":{"before":...,"symbols":[...]}, "segment":{...}}
 *  响应只接受    = {"speech":"...","symbols":[{"sym":"g","meaning":"重力加速度"}]}
 * 之所以改成信封：旧版把「前文（仅供参考）」直接塞进提示词，模型会把说明文字
 * 原样复述回来，TTS 于是读到一半回到开头、循环。结构化信封 + 只取 speech 字段
 * 从协议上杜绝复述，另配三道守卫（回显黑名单 / 长度上限 / 前文重合率）兜底。
 *
 * 设计约束（交接文档）：
 *  - 请求从宿主发出，密钥不上浏览器；
 *  - 密钥不落 YAML 明文：设置里存「环境变量名（凭据引用）」，由凭据机制解析；
 *  - 超时、限流、可取消；相同片段 + 相同上下文可缓存复用；
 *  - 任何失败返回 null，由调用方回退到确定性读法。
 */
export type RewriteKind =
  | 'display-math'
  | 'inline-math'
  /** 含行内公式的完整一句：整句交给模型出稿，正文不再单独念（根治重复朗读）。 */
  | 'sentence'
  | 'code'
  | 'table'

export interface RewriteSymbol {
  /** 符号本身，如 g、T。 */
  sym: string
  /** 该符号在本语境下的中文含义，如「重力加速度」。 */
  meaning: string
}

export interface RewriteContext {
  /** 最近已朗读的正文（确定性清洗 + 限长），仅供模型理解语境。 */
  before?: string
  /** 已确认的符号含义（本回合累积），供后续片段复用。 */
  symbols?: RewriteSymbol[]
}

export interface RewriteRequest {
  kind: RewriteKind
  /** 原片段文本（公式 TeX / 代码 / 表格行列拼接）。 */
  text: string
  meta?: {
    lang?: string
    rows?: string[][]
    rowCount?: number
    colCount?: number
    /** 片段所在整句/整段的原文（block-router 提供）：消歧最关键的依据。 */
    sentence?: string
  }
  /** 格式化后的上下文（缺省 = 无上下文）。 */
  context?: RewriteContext
}

/** 守卫强度：off 全关 / lenient 放宽 / standard 默认 / strict 收紧。 */
export type GuardMode = 'off' | 'lenient' | 'standard' | 'strict'

/** 用户自定义放行规则（命中即跳过全部守卫，直接采用模型输出）。 */
export interface GuardAllowRules {
  /** 正则命中「改写稿」即放行。 */
  speech: RegExp[]
  /** 正则命中「原始片段」即放行（这一类片段完全跳过守卫）。 */
  segment: RegExp[]
  /** 被拒绝的行（供设置页/状态接口提示）。 */
  errors: string[]
}

/** 各档位的具体阈值（长度上限、回显重合率、复述判定阈值）。 */
interface GuardProfile {
  lengthFactor: number
  lengthBase: number
  echoRatio: number
  prefixEcho: boolean
  sentenceEchoRatio: number
}

const GUARD_PROFILES: Record<Exclude<GuardMode, 'off'>, GuardProfile> = {
  // 放宽：只拦最明显的失控/照抄
  lenient: { lengthFactor: 4, lengthBase: 80, echoRatio: 0.85, prefixEcho: false, sentenceEchoRatio: 0.9 },
  standard: { lengthFactor: 3, lengthBase: 60, echoRatio: 0.6, prefixEcho: true, sentenceEchoRatio: 0.7 },
  // 收紧：宁可回退也不放行可疑输出
  strict: { lengthFactor: 2, lengthBase: 30, echoRatio: 0.5, prefixEcho: true, sentenceEchoRatio: 0.5 },
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 解析放行规则（每行一条；空行与 # 注释忽略）：
 *  - 整行是 /pattern/flags → 对「改写稿」跑正则
 *  - seg: 前缀          → 改为对「原始片段」跑正则（该片段跳过全部守卫）
 *  - 其它               → 当作字面文字，对「改写稿」做子串匹配
 */
export function parseGuardAllow(raw: string): GuardAllowRules {
  const speech: RegExp[] = []
  const segment: RegExp[] = []
  const errors: string[] = []
  const lines = String(raw ?? '').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    let target: 'speech' | 'segment' = 'speech'
    if (line.startsWith('seg:')) {
      target = 'segment'
      line = line.slice(4).trim()
    }
    if (!line) continue
    const m = /^\/(.+)\/([a-z]*)$/.exec(line)
    let re: RegExp
    try {
      if (m) {
        const flags = m[2].includes('g') ? m[2] : m[2] + 'g'
        re = new RegExp(m[1], flags)
      } else {
        re = new RegExp(escapeRegExp(line), 'g')
      }
    } catch (e) {
      errors.push('第 ' + (i + 1) + ' 行规则不合法（' + (e instanceof Error ? e.message : String(e)) + '）：' + lines[i].trim())
      continue
    }
    ;(target === 'segment' ? segment : speech).push(re)
  }
  return { speech, segment, errors }
}

function anyMatch(rules: RegExp[], text: string): boolean {
  for (const re of rules) {
    re.lastIndex = 0
    if (re.test(text)) return true
  }
  return false
}

export interface RewriteOptions {
  baseUrl: string
  /** 密钥字面量，或逐次解析的提供函数（凭据引用优先，明文不落配置）。 */
  apiKey: string | (() => string | Promise<string>)
  model: string
  timeoutMs?: number
  maxTokens?: number
  temperature?: number
  cache?: boolean
  /** 关闭思考链（思考型模型如 GLM-4.5 不关思考会只产出 reasoning_content、正文为空）；默认 true。 */
  disableThinking?: boolean
  /** 请求体带 response_format: json_object（端点不支持时自动去掉重试一次）；默认 true。 */
  jsonMode?: boolean
  /** 守卫强度（默认 standard）。off = 完全不跑守卫，只保留 JSON 协议解析。 */
  guardMode?: GuardMode
  /** 自定义放行规则（默认空）。 */
  guardAllow?: GuardAllowRules
  /** 注入点：便于测试替换；默认用全局 fetch。 */
  fetchImpl?: typeof fetch
}

export interface RewriteResult {
  text: string
  cached: boolean
  /** 本次改写顺带确认的符号含义（供后续片段复用）。 */
  symbols?: RewriteSymbol[]
}

/** 提示词/行为版本：改变提示词、协议或后处理时递增；缓存键含它，避免跨版本复用旧讲稿。 */
const PROMPT_VERSION = 'sp6'

/** 各片段类型的任务说明（放进请求 JSON 的 task 字段）。 */
const KIND_INSTRUCTIONS: Record<RewriteKind, string> = {
  'display-math':
    '这是独立展示的数学公式。用一两句话说明它表达的关系（某个量等于什么、随什么变化）；只有在含义确实不明显时才简要提到关键符号，不要逐个罗列符号含义，也不要展开推导。',
  'inline-math':
    '这是句子中的行内公式。只把它念成通顺的中文短语（例如「二分之一 m v 平方」「v 等于 v 零加 a t」），不要展开解释，不要补充定义，不要加推导。',
  sentence:
    '这是含行内公式的完整一句正文。请输出**整句**的口播稿：句中的公式按读法规则念成中文，其余文字保持原意与顺序；不要概括、不要增删内容、不要重复任何部分。',
  code:
    '这是代码片段。用一两句话概括它的作用与关键步骤；不要逐行朗读，也不要念出整段代码；变量名与关键数字要保留。',
  table:
    '这是表格。先用一句话概括整张表表达的内容，再用自然口语转述关键列名与数值，数字必须准确。',
}

/**
 * 系统提示词：分节 + 编号，明确「context 只读」「符号表权威」「只输出 JSON」
 * 三条最高优先规则，并按「符号表 → 学科通用含义 → 字母 X」给出跨学科回退顺序。
 * 不放具体条目的示例（避免锚定模型吐回示例符号），只给占位符。
 */
const SYSTEM_PROMPT = [
  '你是语音朗读稿改写器，把 Markdown 片段改写成适合 TTS 逐句朗读的口播稿。',
  '',
  '一、输入是一个 JSON 对象：task 是本次改写要求；context.before 是最近已朗读的正文；',
  'context.symbols 是已确认的符号含义（sym 符号 / meaning 中文含义）；',
  'segment 是待改写片段（type / text / sentence 所在整句原文 / 可选 lang、rows）。',
  '',
  '二、最高优先规则：',
  '1. context 只供理解语境：不要朗读它、不要翻译它、不要复述它、不要把它写进输出；你只改写 segment。',
  '2. context.symbols 给出的符号含义是权威结论：一律照用，不要再自行推断或更改。',
  '3. 只输出一个 JSON 对象：{"speech":"<口播稿>","symbols":[{"sym":"<符号>","meaning":"<中文含义>"}]}；',
  '除它以外不要输出任何字符（不要 Markdown 围栏、不要解释、不要前后缀）。',
  '4. 严禁在 speech 里出现 task、context、before、symbols、segment、speech 这些字段名，也不要复述上面的说明文字。',
  '5. symbols 可选：只列本片段中新确认含义的符号（最多 6 个，meaning 用简短中文），没有就省略该字段。',
  '',
  '三、speech 的写法：',
  '6. 纯文本；不要 Markdown 符号或代码围栏；不要出现 LaTeX/TeX 记号与数学排版符号',
  '（反斜杠命令、下划线、花括号、尖括号、^、$、竖线），数学关系用自然语言表达。',
  '7. 与 segment 同语言，不翻译；保留其中的数字与变量名。',
  '8. 按类型处理：展示公式用一两句话说明它表达的关系；行内公式只念成通顺的中文短语；',
  '代码概括作用与关键步骤，不逐行念；表格先概括内容，再转述关键列名与数值。',
  '9. 不展开推导，不逐个罗列符号含义，不加解释、标题或前后缀。',
  '',
  '四、符号与算式读法（按 2 → 10 → 11 → 12 的顺序回退，前面的优先）：',
  '10. 以 context.symbols 为准。',
  '11. 其次按常见学科的通用含义读：',
  '数学：Σ 求和、∫ 积分、√ 平方根、π 圆周率、∞ 无穷、Δ 增量、∂ 偏导、lim 极限、∈ 属于、',
  '≤ 小于等于、≥ 大于等于、≈ 约等于、a 的 n 次方、a 下标 n、n 分之一。',
  '物理：g 重力加速度、m 质量、v 速度、a 加速度、t 时间、s 位移或弧长、E 能量、T 周期、F 力、',
  'x 横坐标、y 纵坐标、ω 角速度、λ 波长、f 频率、R 电阻或半径、C 电容、L 电感、V 电压、I 电流、',
  'P 功率、p 压强、ρ 密度、θ 角度、μ 摩擦系数、c 光速。',
  '化学、生物、统计、经济等其它学科同理，按该领域最常见的含义读。',
  '12. 都无法判断时读「字母 X」（例如「字母 q」），不要留裸字母。',
  '13. 绝不能把字母读成计量单位：g 不读克、m 不读米、s 不读秒、t 不读吨。',
  '14. 算式读法：分数读「二分之一」；a 的平方、a 的立方；a 下标 n；百分数读「百分之…」；',
  '区间读「a 到 b」；不等式读「大于等于 a 小于等于 b」。',
  '',
  '五、消歧优先用 segment.sentence（片段所在整句的原文，最可靠），其次 context.before：',
  '15. 箭头：极限语境（lim、趋于、趋近、n 趋于无穷）读「趋向于」；函数或映射的定义处',
  '（f: A → B、映射、定义域、值域）读「从 A 到 B 的映射」；命题逻辑读「蕴含」；',
  '序列或变换读「变换为」；判断不了就读「到」。',
  '16. 括号：在取值范围、定义域、不等式语境，(a, b) 读「开区间 a 到 b」，[a, b] 读「闭区间 a 到 b」，',
  '(a, b] 读「左开右闭区间 a 到 b」，[a, b) 读「左闭右开区间 a 到 b」；在坐标或有序对语境读「点 a b」；',
  'f(x) 读「f 在 x 处的值」或「f x」；组合数 (n k) 读「n 选 k」。不要一律读成「点」。',
  '17. 其它易混记号：· 点乘；× 乘或叉乘；∘ 复合；∈ 属于；⊂ 包含于；∪ 并集；∩ 交集；∅ 空集；',
  '∀ 任意；∃ 存在；∑ 求和；∏ 连乘；∫ 积分；∂ 偏导；∇ 梯度；≡ 恒等于；≅ 同构；≈ 约等于；',
  '≠ 不等于；! 阶乘；|a| 绝对值；P(A|B) 在 B 发生的条件下 A 的概率。',
  '18. 同一符号在不同语境含义不同（s 秒或位移、T 周期或温度、R 电阻或半径），',
  '一律以 segment.sentence 与 context.symbols 为准，不要只按默认含义念。',
  '',
  '六、渐近复杂度，以及行内公式的边界：',
  '19. O(...) 读「大 O，…」：O(n^2) 读「大 O，n 的平方」，O(n) 读「大 O，n」，',
  'O(n log n) 读「大 O，n 乘 log n」（log 读英文单词，不要拆成字母），O(1) 读「大 O，常数」，',
  'O(n log k) 读「大 O，n 乘 log k」。Ω(...) 读「大 Omega，…」，Θ(...) 读「大 Theta，…」。',
  '20. 不要输出「左括号」「右括号」「左方括号」「右方括号」这类逐符号读法；括号里的内容直接连着念。',
  '21. 当 task 是「行内公式」时：只念公式本身，绝不要复述 segment.sentence（整句的其余部分',
  '已经在正文里念过了），也不要带上公式前后的说明词（例如「平均/最坏」「最好」「如果」）。',
  '22. 当 task 是「含行内公式的完整一句」时：输出整句的朗读稿——公式按上面的读法念成中文，',
  '其余文字保持原意与顺序，不要概括、不要增删、不要重复任何部分。',
].join('\n')

/** 抽取需要保安全的数字 token。 */
export function extractNumbers(text: string): string[] {
  const out: string[] = []
  const re = /-?\d+(?:\.\d+)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) out.push(m[0])
  return out
}

const CN_DIGIT: Record<string, number> = {
  '零': 0, '〇': 0, '一': 1, '壹': 1, '二': 2, '两': 2, '贰': 2, '三': 3, '叁': 3,
  '四': 4, '肆': 4, '五': 5, '伍': 5, '六': 6, '陆': 6, '七': 7, '柒': 7, '八': 8, '捌': 8,
  '九': 9, '玖': 9,
}
const CN_UNIT: Record<string, number> = { '十': 10, '拾': 10, '百': 100, '佰': 100, '千': 1000, '仟': 1000 }

function cnRunToAscii(run: string): string {
  const hasUnit = [...run].some((c) => CN_UNIT[c] !== undefined)
  if (!hasUnit) {
    let out = ''
    for (const c of run) {
      const d = CN_DIGIT[c]
      if (d === undefined) return run
      out += String(d)
    }
    return out
  }
  let section = 0
  let current = 0
  for (const c of run) {
    const d = CN_DIGIT[c]
    if (d !== undefined) {
      current = d
      continue
    }
    const u = CN_UNIT[c]
    if (u === undefined) return run
    section += (current === 0 ? 1 : current) * u
    current = 0
  }
  return String(section + current)
}

/** 把中文数字读法归一化成阿拉伯数字（"二分之一" -> "2分之1"，"十二" -> "12"，"平方" -> "2"）。 */
export function normalizeNumerals(text: string): string {
  return text
    .replace(/平方/g, '2')
    .replace(/立方/g, '3')
    .replace(/[零〇一二两三四五六七八九十百千壹贰叁肆伍陆柒捌玖拾佰仟]+/g, (run) => cnRunToAscii(run))
}

/**
 * token 保全校验：原文每个数字都必须出现在改写稿里。
 * 语音改写会把数字念成中文（1/2 -> 二分之一、12 -> 十二），这也算保留：
 * 先按原样比对，不中再按中文数字归一化后比对。
 */
export function verifyNumbers(original: string, rewritten: string): boolean {
  const need = extractNumbers(original)
  if (need.length === 0) return true
  const hay = rewritten.replace(/\s+/g, '')
  if (need.every((n) => hay.includes(n.replace(/\s+/g, '')))) return true
  const norm = normalizeNumerals(hay)
  return need.every((n) => norm.includes(n.replace(/\s+/g, '')))
}

/** 组装请求 JSON（上下文只在非空时出现）。 */
export function buildUserPayload(req: RewriteRequest): string {
  const context: Record<string, unknown> = {}
  const before = req.context && req.context.before ? req.context.before.trim() : ''
  if (before) context.before = before
  const symbols = (req.context && req.context.symbols ? req.context.symbols : [])
    .filter((s) => s && s.sym && s.meaning)
    .slice(0, 12)
  if (symbols.length) context.symbols = symbols
  const segment: Record<string, unknown> = { type: req.kind, text: req.text }
  const sentence = req.meta && req.meta.sentence ? req.meta.sentence.trim().slice(0, 400) : ''
  if (sentence) segment.sentence = sentence
  if (req.meta && req.meta.lang) segment.lang = req.meta.lang
  if (req.kind === 'table' && req.meta && req.meta.rows) segment.rows = req.meta.rows
  // 顺序固定为 task → context → segment：先交代任务与背景，再给待改写片段。
  const payload: Record<string, unknown> = { task: KIND_INSTRUCTIONS[req.kind] }
  if (Object.keys(context).length) payload.context = context
  payload.segment = segment
  return JSON.stringify(payload)
}

/**
 * 提示词回显检测：第一道守卫。协议已改成 JSON 信封（只取 speech 字段），
 * 但模型仍可能把说明文字/分隔标记写进 speech；含这些标记即丢弃。
 */
const ECHO_MARKERS = [
  '前文（仅供参考）', '待改写片段', '这是句子中的行内公式', '这是独立展示的数学公式',
  '这是代码片段', '这是表格', '只把它念成', '不要输出', '不要复述', '<' + '<' + '<', '>' + '>' + '>',
  'context.before', 'context.symbols', '"speech"', '{"speech"', '口播稿>',
]

export function looksLikePromptEcho(text: string): boolean {
  return ECHO_MARKERS.some((m) => text.includes(m))
}

/** 第二道守卫：长度上限（防模型失控/循环输出）。 */
export function withinLengthLimit(original: string, speech: string, factor = 3, base = 60): boolean {
  return speech.length <= Math.max(original.length * factor, original.length + base)
}

function shingles(s: string, n = 6): Set<string> {
  const t = s.replace(/\s+/g, '')
  const out = new Set<string>()
  for (let i = 0; i + n <= t.length; i++) out.add(t.slice(i, i + n))
  return out
}

/** 第三道守卫：改写稿与前文的重合率（整段照抄前文即为复述）。 */
export function contextEchoRatio(speech: string, before: string): number {
  const a = shingles(speech)
  const b = shingles(before)
  if (a.size === 0 || b.size === 0) return 0
  let hit = 0
  for (const g of a) if (b.has(g)) hit++
  return hit / a.size
}

/** 回显比对归一化：去掉空白与常见标点，只留下字母/数字/汉字。 */
function normalizeForEcho(s: string): string {
  return String(s).replace(/[\s，。、；：？！…—·,.!?;:'"()（）\[\]【】《》<>「」『』""''+\-=*/\\|^_~`]/g, '')
}

/**
 * 行内公式的「复述整句」判定：把整句里属于该公式的文本剥掉，剩下的散文骨架与
 * 改写稿做最长公共子序列，覆盖率越高越像"把整句念了一遍"。
 * 用 LCS 而不是 n-gram：公式改写成中文字形后 n-gram 会对不上（O(n^2) → O(n 平方)），
 * 但「平均/最坏…最好…」这类散文骨架仍会被 LCS 抓住。
 */
export function sentenceEchoRatio(speech: string, sentence: string, formula: string): number {
  const sentenceNorm = normalizeForEcho(sentence)
  if (!sentenceNorm) return 0
  const formulaNorm = normalizeForEcho(formula)
  const prose = formulaNorm ? sentenceNorm.split(formulaNorm).join('') : sentenceNorm
  if (prose.length < 6) return 0
  const hayRaw = normalizeForEcho(speech)
  if (!hayRaw) return 0
  const a = prose
  const b = hayRaw.length > 400 ? hayRaw.slice(0, 400) : hayRaw
  let prev = new Uint16Array(b.length + 1)
  let cur = new Uint16Array(b.length + 1)
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      cur[j + 1] = a[i] === b[j] ? prev[j] + 1 : Math.max(prev[j + 1], cur[j])
    }
    const t = prev
    prev = cur
    cur = t
    cur.fill(0)
  }
  return prev[b.length] / a.length
}

/** 复述了公式前面那段说明词（例如把「平均/最坏」也念了出来）——短句也适用。 */
export function prefixEcho(speech: string, sentence: string, formula: string): boolean {
  const sentenceNorm = normalizeForEcho(sentence)
  const formulaNorm = normalizeForEcho(formula)
  if (!sentenceNorm || !formulaNorm) return false
  const idx = sentenceNorm.indexOf(formulaNorm)
  if (idx < 3) return false
  const pre = sentenceNorm.slice(0, idx)
  const hay = normalizeForEcho(speech)
  if (pre.length < 3 || !hay) return false
  for (let i = 0; i + 3 <= pre.length; i++) {
    if (hay.includes(pre.slice(i, i + 3))) return true
  }
  return false
}

export interface ParsedSpeech {
  speech: string
  symbols: RewriteSymbol[]
}

/** 解析模型输出：剥围栏 → JSON.parse（含兜底截取）→ 只取 speech / symbols。 */
export function parseSpeechResponse(raw: string): ParsedSpeech | null {
  const text = String(raw)
    .replace(/^\s*\x60\x60\x60[^\n]*\n?/, '')
    .replace(/\n?\x60\x60\x60\s*$/, '')
    .trim()
  const candidates = [text]
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1))
  for (const c of candidates) {
    let obj: any
    try {
      obj = JSON.parse(c)
    } catch {
      continue
    }
    if (!obj || typeof obj !== 'object') continue
    const speech = typeof obj.speech === 'string' ? obj.speech.trim() : ''
    if (!speech) continue
    return { speech: speech.replace(/\s+/g, ' ').trim(), symbols: normalizeSymbols(obj.symbols) }
  }
  return null
}

function normalizeSymbols(v: unknown): RewriteSymbol[] {
  if (!Array.isArray(v)) return []
  const out: RewriteSymbol[] = []
  for (const it of v) {
    if (!it || typeof it !== 'object') continue
    const sym = typeof (it as any).sym === 'string' ? (it as any).sym.trim() : ''
    const meaning = typeof (it as any).meaning === 'string' ? (it as any).meaning.trim() : ''
    if (!sym || !meaning) continue
    if (out.some((s) => s.sym === sym)) continue
    out.push({ sym: sym.slice(0, 8), meaning: meaning.slice(0, 24) })
    if (out.length >= 6) break
  }
  return out
}

/** 上下文指纹：参与缓存键，避免不同上下文下错误复用同一片段的讲稿。 */
export function contextHash(context?: RewriteContext, sentence?: string): string {
  const before = context && context.before ? context.before : ''
  const symbols = context && context.symbols ? context.symbols : []
  const local = sentence ? sentence : ''
  if (!local && !before && symbols.length === 0) return ''
  const s = local + '\u0000' + before + '|' + symbols.map((x) => x.sym + ':' + x.meaning).join(',')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

interface RawCallResult {
  status: number
  content: string | null
}

export class SpeechRewriter {
  private readonly opts: Required<Omit<RewriteOptions, 'fetchImpl'>> & { fetchImpl: typeof fetch }
  private readonly cache = new Map<string, { text: string; symbols?: RewriteSymbol[] }>()
  private static readonly MAX_CACHE = 200

  constructor(opts: RewriteOptions) {
    this.opts = {
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      model: opts.model,
      timeoutMs: opts.timeoutMs ?? 8000,
      maxTokens: opts.maxTokens ?? 400,
      temperature: opts.temperature ?? 0,
      cache: opts.cache ?? true,
      disableThinking: opts.disableThinking ?? true,
      jsonMode: opts.jsonMode ?? true,
      guardMode: opts.guardMode ?? 'standard',
      guardAllow: opts.guardAllow ?? { speech: [], segment: [], errors: [] },
      fetchImpl: opts.fetchImpl ?? fetch,
    }
  }

  /** 是否具备可用配置（未配置则完全不走网络）。 */
  get configured(): boolean {
    return Boolean(this.opts.baseUrl && this.opts.model)
  }

  /**
   * 改写一个片段。成功返回 { text, cached, symbols? }；任何失败（未配置 / 超时 /
   * HTTP 错 / 空输出 / 协议解析失败 / 任一守卫不过）返回 null，由调用方回退。
   */
  async rewrite(req: RewriteRequest): Promise<RewriteResult | null> {
    const text = req.text ?? ''
    if (!text.trim()) return null
    if (!this.configured) return null

    const ctxHash = contextHash(req.context, req.meta && req.meta.sentence)
    const key =
      PROMPT_VERSION + '|' + req.kind + '|' + (req.meta && req.meta.lang ? req.meta.lang : '') +
      '|' + ctxHash + '|' + text
    if (this.opts.cache) {
      const hit = this.cache.get(key)
      if (hit !== undefined) {
        return hit.symbols ? { text: hit.text, cached: true, symbols: hit.symbols } : { text: hit.text, cached: true }
      }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs)
    try {
      const url = this.opts.baseUrl.replace(/\/+$/, '') + '/chat/completions'
      const apiKey = typeof this.opts.apiKey === 'function' ? await this.opts.apiKey() : this.opts.apiKey
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      if (apiKey) headers.authorization = 'Bearer ' + apiKey
      const user = buildUserPayload(req)
      const maxTokens = this.maxTokensFor(text)

      let call = await this.callModel(url, headers, user, maxTokens, controller.signal, this.opts.jsonMode)
      // 端点不认 response_format（400/422）时：去掉它重试一次，兼容只支持纯提示词的端点。
      if (call.content === null && this.opts.jsonMode && call.status !== 200) {
        call = await this.callModel(url, headers, user, maxTokens, controller.signal, false)
      }
      if (call.content === null) return null

      const parsed = parseSpeechResponse(call.content)
      if (!parsed) return null

      // --- 守卫：档位可调 + 用户放行规则（guardMode=off 或任一规则命中即全部跳过）---
      const mode = this.opts.guardMode
      const allowRules = this.opts.guardAllow
      const modeOff = mode === 'off' || mode === undefined
      const allowSeg = anyMatch(allowRules.segment, text)
      const allowSpeech = anyMatch(allowRules.speech, parsed.speech)
      if (!modeOff && !allowSeg && !allowSpeech) {
        const profile = GUARD_PROFILES[mode]
        if (looksLikePromptEcho(parsed.speech)) return null
        if (!withinLengthLimit(text, parsed.speech, profile.lengthFactor, profile.lengthBase)) return null
        // kind='sentence' 是"整句出稿"：模型本来就该贴近整句，复述判定会全部误杀，故跳过。
        if (req.kind !== 'sentence') {
          // 回显守卫：取「整句原文」与「前文」里更长的那个作为参照（两者都可能被模型照抄）。
          const before = req.context && req.context.before ? req.context.before : ''
          const sentence = req.meta && req.meta.sentence ? req.meta.sentence : ''
          const echoRef = sentence.length > before.length ? sentence : before
          if (echoRef.length >= 40 && parsed.speech.length >= 40 && contextEchoRatio(parsed.speech, echoRef) >= profile.echoRatio) {
            return null
          }
          // 行内公式的复述守卫：模型会把整句原样吐回来（"平均/最坏 O(n 平方)，最好 O(n)。"），
          // 导致朗读重复；短句同样要保护（旧实现被 echoRef.length >= 40 短路）。
          if (profile.prefixEcho && req.kind === 'inline-math' && sentence) {
            if (prefixEcho(parsed.speech, sentence, text)) return null
          }
          if (req.kind === 'inline-math' && sentence) {
            if (sentenceEchoRatio(parsed.speech, sentence, text) >= profile.sentenceEchoRatio) return null
          }
        }
        if (!verifyNumbers(text, parsed.speech)) return null
      }

      const stored = parsed.symbols.length
        ? { text: parsed.speech, symbols: parsed.symbols }
        : { text: parsed.speech }
      if (this.opts.cache) this.remember(key, stored)
      return stored.symbols
        ? { text: stored.text, cached: false, symbols: stored.symbols }
        : { text: stored.text, cached: false }
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * 动态输出预算：要同时装下 JSON 外壳与口播稿。以设置值为基线，按片段长度上调，
   * 上限 2048；避免长表格/多符号时 JSON 被截断、解析失败而白白回退。
   */
  private maxTokensFor(text: string): number {
    return Math.min(2048, Math.max(this.opts.maxTokens, Math.ceil(text.length * 1.5) + 160))
  }

  private async callModel(
    url: string,
    headers: Record<string, string>,
    user: string,
    maxTokens: number,
    signal: AbortSignal,
    jsonMode: boolean,
  ): Promise<RawCallResult> {
    const body: Record<string, unknown> = {
      model: this.opts.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature: this.opts.temperature,
      ...(this.opts.disableThinking ? { thinking: { type: 'disabled' } } : {}),
      stream: false,
    }
    if (jsonMode) body.response_format = { type: 'json_object' }
    const res = await this.opts.fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) return { status: res.status, content: null }
    const data: any = await res.json()
    const content =
      data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : undefined
    return { status: res.status, content: typeof content === 'string' ? content : null }
  }

  private remember(key: string, value: { text: string; symbols?: RewriteSymbol[] }): void {
    this.cache.set(key, value)
    if (this.cache.size > SpeechRewriter.MAX_CACHE) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
  }

  clearCache(): void {
    this.cache.clear()
  }
}
