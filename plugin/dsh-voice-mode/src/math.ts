/**
 * 数学朗读（确定性规则）：把 LaTeX 片段转成中文口播文字。
 *
 * 数学零容错，故逐符号朗读不走模型；本模块提供可扩展的规则实现。
 * 输入是 remark-math 的 math / inlineMath 节点 value（不含 $ 定界符）。
 * 设置项 mathMode 决定运行期是否使用本模块（rules）/ 交给模型（model）/ 原样（verbatim）。
 */

const GREEK: Record<string, string> = {
  alpha: '阿尔法', beta: '贝塔', gamma: '伽马', delta: '德尔塔', epsilon: '伊普西龙',
  zeta: '泽塔', eta: '伊塔', theta: '西塔', iota: '约塔', kappa: '卡帕', lambda: '兰姆达',
  mu: '缪', nu: '纽', xi: '克西', pi: '派', rho: '柔', sigma: '西格玛', tau: '陶',
  upsilon: '宇普西龙', phi: '斐', chi: '凯', psi: '普西', omega: '欧米伽',
  Gamma: '伽马', Delta: '德尔塔', Theta: '西塔', Lambda: '兰姆达', Xi: '克西',
  Pi: '派', Sigma: '西格玛', Phi: '斐', Psi: '普西', Omega: '欧米伽',
}

const FUNCS: Record<string, string> = {
  sin: '正弦', cos: '余弦', tan: '正切', cot: '余切', sec: '正割', csc: '余割',
  arcsin: '反正弦', arccos: '反余弦', arctan: '反正切',
  log: '对数', ln: '自然对数', lg: '常用对数', exp: '指数函数', lim: '极限',
  max: '最大值', min: '最小值', det: '行列式', dim: '维数', mod: '模',
}

const OPERATORS: Record<string, string> = {
  times: '乘', div: '除以', cdot: '乘', ast: '乘', pm: '正负', mp: '负正',
  le: '小于等于', leq: '小于等于', ge: '大于等于', geq: '大于等于',
  ne: '不等于', neq: '不等于', approx: '约等于', equiv: '恒等于', sim: '相似于',
  infty: '无穷', sum: '求和', prod: '连乘', int: '积分', iint: '二重积分',
  oint: '环路积分', partial: '偏导', nabla: '梯度', to: '趋于', rightarrow: '趋于',
  in: '属于', notin: '不属于', forall: '任意', exists: '存在', propto: '正比于',
  subset: '包含于', supset: '包含', cup: '并', cap: '交', emptyset: '空集',
  subseteq: '包含于', supseteq: '包含',
  lesssim: '小于等于', gtrsim: '大于等于', leqslant: '小于等于', geqslant: '大于等于',
  ll: '远小于', gg: '远大于', Rightarrow: '推出', Leftrightarrow: '等价于', leftrightarrow: '等价于',
  mapsto: '映射到', circ: '复合', odot: '点乘', oplus: '直和',
  therefore: '所以', because: '因为', angle: '角', degree: '度',
}

const SYMBOLS: Record<string, string> = {
  '+': '加', '-': '减', '=': '等于', '<': '小于', '>': '大于', '*': '乘', '/': '除以',
  '±': '正负', '×': '乘', '÷': '除以', '≤': '小于等于', '≥': '大于等于', '≠': '不等于',
  '∞': '无穷', 'π': '派', 'θ': '西塔', 'α': '阿尔法', 'β': '贝塔', 'γ': '伽马',
  'δ': '德尔塔', 'λ': '兰姆达', 'μ': '缪', 'σ': '西格玛', 'ω': '欧米伽',
  '(': '左括号', ')': '右括号', '[': '左方括号', ']': '右方括号',
  '{': '左花括号', '}': '右花括号', ',': '', '.': '点', '%': '百分号', '|': '竖线',
}

const ESCAPED: Record<string, string> = {
  '\\{': '左花括号', '\\}': '右花括号', '\\%': '百分号', '\\&': '和', '\\$': '美元',
  // 排版性空白命令：读音上直接忽略（否则 \sim\!32 会念出感叹号）
  '\\,': '', '\\;': '', '\\!': '', '\\:': '',
}

/** 元素符号 → 中文名（\ce 化学式朗读用；未收录的符号按原字母念出）。 */
const CHEM_ELEMENTS: Record<string, string> = {
  H: '氢', He: '氦', Li: '锂', Be: '铍', B: '硼', C: '碳', N: '氮', O: '氧', F: '氟', Ne: '氖',
  Na: '钠', Mg: '镁', Al: '铝', Si: '硅', P: '磷', S: '硫', Cl: '氯', Ar: '氩', K: '钾', Ca: '钙',
  Sc: '钪', Ti: '钛', V: '钒', Cr: '铬', Mn: '锰', Fe: '铁', Co: '钴', Ni: '镍', Cu: '铜', Zn: '锌',
  Ga: '镓', Ge: '锗', As: '砷', Se: '硒', Br: '溴', Kr: '氪', Rb: '铷', Sr: '锶', Y: '钇', Zr: '锆',
  Nb: '铌', Mo: '钼', Tc: '锝', Ru: '钌', Rh: '铑', Pd: '钯', Ag: '银', Cd: '镉', In: '铟', Sn: '锡',
  Sb: '锑', Te: '碲', I: '碘', Xe: '氙', Cs: '铯', Ba: '钡', La: '镧', Ce: '铈', Pr: '镨', Nd: '钕',
  Pm: '钷', Sm: '钐', Eu: '铕', Gd: '钆', Tb: '铽', Dy: '镝', Ho: '钬', Er: '铒', Tm: '铥', Yb: '镱',
  Lu: '镥', Hf: '铪', Ta: '钽', W: '钨', Re: '铼', Os: '锇', Ir: '铱', Pt: '铂', Au: '金', Hg: '汞',
  Tl: '铊', Pb: '铅', Bi: '铋', Po: '钋', At: '砹', Rn: '氡', Fr: '钫', Ra: '镭', Ac: '锕', Th: '钍',
  Pa: '镤', U: '铀', Np: '镎', Pu: '钚', Am: '镅', Cm: '锔',
}

/** 物质状态记号（\ce 里的 (aq)/(s)/(l)/(g)）。 */
const CHEM_STATES: Record<string, string> = {
  aq: '水溶液', s: '固态', l: '液态', g: '气态', v: '气态',
}

/** 反应记号 → 中文（长记号在前，避免 <-> 被 <- 抢先匹配）。 */
const CHEM_ARROWS: Array<[string, string]> = [
  ['<=>>', '可逆生成'], ['<<=>', '可逆生成'], ['<=>', '可逆生成'], ['<->', '可逆生成'],
  ['->', '生成'], ['<-', '生成'], ['⇌', '可逆生成'], ['→', '生成'], ['←', '生成'],
]

/** 物理单位（\pu 朗读用）。 */
const PU_UNITS: Record<string, string> = {
  kJ: '千焦', J: '焦', mol: '摩尔', mmol: '毫摩尔', g: '克', kg: '千克', mg: '毫克',
  L: '升', mL: '毫升', s: '秒', ms: '毫秒', min: '分钟', h: '小时', K: '开尔文',
  Pa: '帕', kPa: '千帕', MPa: '兆帕', atm: '标准大气压', M: '摩尔每升',
  nm: '纳米', µm: '微米', mm: '毫米', cm: '厘米', km: '千米', m: '米',
  W: '瓦', kW: '千瓦', V: '伏', mV: '毫伏', A: '安', mA: '毫安', Hz: '赫兹',
  N: '牛', C: '库仑', '°C': '摄氏度', Å: '埃',
}

function skipWs(s: string, i: number): number {
  let j = i
  while (j < s.length && /\s/.test(s[j])) j++
  return j
}

/** 读一个 {…} 组（支持嵌套），或单个命令 / 单字符参数。 */
function readArg(s: string, i: number): { text: string; next: number } {
  i = skipWs(s, i)
  if (s[i] === '{') {
    let depth = 0
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++
      else if (s[j] === '}') {
        depth--
        if (depth === 0) return { text: s.slice(i + 1, j), next: j + 1 }
      }
    }
    return { text: s.slice(i + 1), next: s.length }
  }
  if (s[i] === '\\') {
    let j = i + 1
    if (j < s.length && /[a-zA-Z]/.test(s[j])) {
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++
      return { text: s.slice(i, j), next: j }
    }
    return { text: s.slice(i, j + 1), next: j + 1 }
  }
  return { text: s[i] ?? '', next: i + 1 }
}

/** 读一个圆括号组 (…)（支持嵌套）；不是括号时退回 readArg。 */
function readParen(s: string, i: number): { text: string; next: number } {
  i = skipWs(s, i)
  if (s[i] !== '(') return readArg(s, i)
  let depth = 0
  for (let j = i; j < s.length; j++) {
    if (s[j] === '(') depth++
    else if (s[j] === ')') {
      depth--
      if (depth === 0) return { text: s.slice(i + 1, j), next: j + 1 }
    }
  }
  return { text: s.slice(i + 1), next: s.length }
}

function joinParts(parts: string[]): string {
  return parts.filter((p) => p !== '').join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * 复杂度表达式内部：log 直接读英文（不读「对数」），给隐式乘法补「乘」，
 * 并去掉成对括号的读法——O(n log n) 读「大 O，n 乘 log n」而不是「左括号…右括号」。
 */
/** 离子电荷：把 "3+" / "2-" / "+" / "-" 读成「正 3 价 / 负 2 价 / 正 1 价」。 */
function chargeWord(body: string): string {
  const digits = /[0-9]+/.exec(body)?.[0] ?? '1'
  const sign = body.includes('-') ? '负' : '正'
  return sign + ' ' + digits + ' 价'
}

/**
 * 化学式（\ce{...}）朗读：元素读中文名，计数/电荷/状态/反应记号读中文。
 * 不追求命名化合物（那属于语义，交给 model 模式），只保证「不逐字母念、不丢内容」。
 */
function renderChem(src: string): string {
  const s = src.replace(/\s+/g, ' ').trim()
  const parts: string[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === ' ') {
      i++
      continue
    }
    const arrow = CHEM_ARROWS.find(([token]) => s.startsWith(token, i))
    if (arrow) {
      parts.push(arrow[1])
      i += arrow[0].length
      continue
    }
    const state = /^\((aq|s|l|g|v)\)/.exec(s.slice(i))
    if (state) {
      parts.push(CHEM_STATES[state[1]] ?? '')
      i += state[0].length
      continue
    }
    if (c === '^') {
      let j = i + 1
      let body = ''
      if (s[j] === '{') {
        const a = readArg(s, j)
        body = a.text
        j = a.next
      } else {
        const m = /^[0-9+\-]+/.exec(s.slice(j))
        body = m ? m[0] : ''
        j += body.length
      }
      if (/[+\-]/.test(body)) {
        parts.push(chargeWord(body))
        i = j
        continue
      }
      parts.push('气体')
      i++
      continue
    }
    if (c === 'v' && !/[a-zA-Z]/.test(s[i + 1] ?? '')) {
      parts.push('沉淀')
      i++
      continue
    }
    if (c === '_' || c === '{') {
      const a = readArg(s, c === '_' ? i + 1 : i)
      parts.push(renderChem(a.text))
      i = a.next
      continue
    }
    if (c === '}') {
      i++
      continue
    }
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+)/.exec(s.slice(i))
      if (m) {
        const n = m[1]
        if (n === 'text' || n === 'mathrm' || n === 'mathit' || n === 'mathbf' || n === 'mathsf') {
          const a = readArg(s, i + m[0].length)
          parts.push(a.text.trim())
          i = a.next
          continue
        }
        if (n === 'to' || n === 'rightarrow' || n === 'longrightarrow' || n === 'leftarrow' || n === 'longleftarrow') {
          parts.push('生成')
        } else if (n === 'rightleftharpoons' || n === 'leftrightharpoons') {
          parts.push('可逆生成')
        } else {
          parts.push(OPERATORS[n] ?? n)
        }
        i += m[0].length
        continue
      }
      i++
      continue
    }
    const el = /^[A-Z][a-z]?/.exec(s.slice(i))
    if (el) {
      parts.push(CHEM_ELEMENTS[el[0]] ?? el[0])
      i += el[0].length
      continue
    }
    if (c === '+') {
      parts.push('加')
      i++
      continue
    }
    if (c === '=') {
      parts.push('等于')
      i++
      continue
    }
    if (c === '.') {
      parts.push('点')
      i++
      continue
    }
    if (c === '*') {
      parts.push('乘')
      i++
      continue
    }
    if (c === '~') {
      parts.push('约')
      i++
      continue
    }
    if (c === ',' || c === ';') {
      parts.push('，')
      i++
      continue
    }
    const num = /^[0-9]+/.exec(s.slice(i))
    if (num) {
      parts.push(num[0])
      i += num[0].length
      continue
    }
    parts.push(c)
    i++
  }
  return joinParts(parts)
}

/** 物理单位（\pu{...}）朗读：数值原样、单位读中文、"/" 读「每」、^ 读「的 N 次方」。 */
function renderUnit(src: string): string {
  const s = src
  const parts: string[] = []
  const unitKeys = Object.keys(PU_UNITS).sort((a, b) => b.length - a.length)
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    const num = /^[+\-]?[0-9]+(?:\.[0-9]+)?(?:[eE][+\-]?[0-9]+)?/.exec(s.slice(i))
    if (num) {
      parts.push(num[0])
      i += num[0].length
      continue
    }
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+)/.exec(s.slice(i))
      if (m) {
        parts.push(OPERATORS[m[1]] ?? m[1])
        i += m[0].length
        continue
      }
      i++
      continue
    }
    if (c === '/') {
      parts.push('每')
      i++
      continue
    }
    if (c === '^') {
      const a = readArg(s, i + 1)
      parts.push('的 ' + renderUnit(a.text) + ' 次方')
      i = a.next
      continue
    }
    if (c === '*') {
      parts.push('乘')
      i++
      continue
    }
    if (c === '.') {
      parts.push('点')
      i++
      continue
    }
    const unit = /^[A-Za-zµΩÅ°]+/.exec(s.slice(i))
    if (unit) {
      const hit = unitKeys.find((k) => s.startsWith(k, i))
      if (hit) {
        parts.push(PU_UNITS[hit])
        i += hit.length
      } else {
        parts.push(unit[0])
        i += unit[0].length
      }
      continue
    }
    parts.push(c)
    i++
  }
  return joinParts(parts)
}

function renderComplexity(tex: string): string {
  const s = tex
    .replace(/\\(log|lg|ln)\b/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .replace(/([A-Za-z0-9])\s+(?=(?:log|lg|ln)\b)/g, '$1 \\cdot ')
  return render(s)
    .replace(/左括号|右括号|左方括号|右方括号|左花括号|右花括号/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function render(s: string): string {
  const parts: string[] = []
  let buf = ''
  const flush = (): void => {
    if (buf) {
      parts.push(buf)
      buf = ''
    }
  }
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '\\') {
      let j = i + 1
      if (j < s.length && /[a-zA-Z]/.test(s[j])) {
        while (j < s.length && /[a-zA-Z]/.test(s[j])) j++
        const name = s.slice(i + 1, j)
        if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
          flush()
          const a1 = readArg(s, j)
          const a2 = readArg(s, a1.next)
          parts.push(render(a2.text) + ' 分之 ' + render(a1.text))
          i = a2.next
          continue
        }
        if (name === 'sqrt') {
          flush()
          const a = readArg(s, j)
          parts.push('根号 ' + render(a.text))
          i = a.next
          continue
        }
        if (name === 'quad' || name === 'qquad') {
          flush()
          i = j
          continue
        }
        // 渐近记号：\Omega(...) / \Theta(...) 读「大 Omega，…」「大 Theta，…」
        if ((name === 'Omega' || name === 'omega' || name === 'Theta' || name === 'theta') && s[skipWs(s, j)] === '(') {
          flush()
          const a = readParen(s, skipWs(s, j))
          const label = name === 'Omega' || name === 'omega' ? '大 Omega，' : '大 Theta，'
          parts.push(label + (a.text.replace(/\s+/g, '') === '1' ? '常数' : renderComplexity(a.text)))
          i = a.next
          continue
        }
        if (
          name === 'text' || name === 'mathrm' || name === 'operatorname' || name === 'mbox' ||
          name === 'mathbb' || name === 'mathcal' || name === 'mathbf' || name === 'mathsf' || name === 'mathtt'
        ) {
          flush()
          const a = readArg(s, j)
          parts.push(a.text.trim())
          i = a.next
          continue
        }
        if (name === 'ce') {
          flush()
          const a = readArg(s, j)
          parts.push(renderChem(a.text))
          i = a.next
          continue
        }
        if (name === 'pu') {
          flush()
          const a = readArg(s, j)
          parts.push(renderUnit(a.text))
          i = a.next
          continue
        }
        const word = FUNCS[name] ?? GREEK[name] ?? OPERATORS[name]
        flush()
        if (word !== undefined) parts.push(word)
        else parts.push(name)
        i = j
        continue
      }
      const ch = s[j] ?? ''
      flush()
      if (ch === ' ') {
        i = j + 1
        continue
      }
      parts.push(ESCAPED['\\' + ch] ?? ch)
      i = j + 1
      continue
    }
    if (c === '^' || c === '_') {
      flush()
      const a = readArg(s, i + 1)
      const inner = render(a.text)
      if (c === '^') {
        if (inner === '2') parts.push('的平方')
        else if (inner === '3') parts.push('的立方')
        else parts.push('的 ' + inner + ' 次方')
      } else {
        parts.push('下标 ' + inner)
      }
      i = a.next
      continue
    }
    if (c === '{' || c === '}') {
      flush()
      i++
      continue
    }
    if (/\s/.test(c)) {
      flush()
      i++
      continue
    }
    // 渐近记号：O(...) / o(...) 读「大 O，…」「小 o，…」
    if ((c === 'O' || c === 'o') && s[skipWs(s, i + 1)] === '(') {
      flush()
      const a = readParen(s, skipWs(s, i + 1))
      const inner = a.text.replace(/\s+/g, '') === '1' ? '常数' : renderComplexity(a.text)
      parts.push((c === 'O' ? '大 O，' : '小 o，') + inner)
      i = a.next
      continue
    }
    const sym = SYMBOLS[c]
    if (sym !== undefined) {
      flush()
      if (sym) parts.push(sym)
      i++
      continue
    }
    buf += c
    i++
  }
  flush()
  return joinParts(parts)
}

/** LaTeX → 中文口播文字。空输入返回空串；绝不清空内容（未知命令按字母念出）。 */
export function latexToSpeech(tex: string): string {
  if (!tex || !tex.trim()) return ''
  try {
    return render(tex)
  } catch {
    return tex.replace(/[\\{}]/g, ' ').replace(/\s+/g, ' ').trim()
  }
}
