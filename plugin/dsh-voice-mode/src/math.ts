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

function joinParts(parts: string[]): string {
  return parts.filter((p) => p !== '').join(' ').replace(/\s+/g, ' ').trim()
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
        if (name === 'text' || name === 'mathrm' || name === 'operatorname' || name === 'mbox') {
          flush()
          const a = readArg(s, j)
          parts.push(a.text.trim())
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
