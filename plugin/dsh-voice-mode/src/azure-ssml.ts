/**
 * Azure Speech 合成请求的纯函数层（无网络依赖，便于单测）：
 *  - normalizeAzureEndpoint：区域名 / 完整链接 → .../cognitiveservices/v1
 *  - parsePhonemeTable：解析「词 => 拼音」多音字表（# 注释）
 *  - buildAzureSsml：生成带 <phoneme> 的 SSML（XML 转义）
 */

export interface PhonemeRule {
  /** 原文中的词（如「行」「银行」）。 */
  from: string
  /** sapi 音标（拼音 + 声调，如 hang2 / yin2 hang2）。 */
  ph: string
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 把「区域名」或「完整链接」归一成 Azure TTS REST 端点。 */
export function normalizeAzureEndpoint(raw: string): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  let base = s
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base + '.tts.speech.microsoft.com'
  base = base.replace(/\/+$/, '')
  if (/\/cognitiveservices\/v1$/i.test(base)) return base
  return base + '/cognitiveservices/v1'
}

/** 解析多音字拼音表：每行「词 => 拼音」，# 起首为注释；按词长倒序（长词优先匹配）。 */
export function parsePhonemeTable(raw: string): { rules: PhonemeRule[]; errors: string[] } {
  const rules: PhonemeRule[] = []
  const errors: string[] = []
  const lines = String(raw ?? '').split(/\r?\n/)
  lines.forEach((line, idx) => {
    const text = line.trim()
    if (!text || text.startsWith('#')) return
    const m = /^(.*?)(?:=>|->|→)(.*)$/.exec(text)
    if (!m) {
      errors.push('第 ' + (idx + 1) + ' 行缺少「=>」：' + text)
      return
    }
    const from = m[1].trim()
    const ph = m[2].trim()
    if (!from || !ph) {
      errors.push('第 ' + (idx + 1) + ' 行词或拼音为空')
      return
    }
    if (/[<>&"']/.test(from) || /[<>&"']/.test(ph)) {
      errors.push('第 ' + (idx + 1) + ' 行含非法字符（< > & 引号）')
      return
    }
    rules.push({ from, ph })
  })
  rules.sort((a, b) => b.from.length - a.from.length)
  return { rules, errors }
}

/** 语速倍率 → Azure prosody rate（百分比；1.0 不输出）。 */
export function azureRate(rate?: number): string {
  if (rate === undefined || !Number.isFinite(rate) || Math.abs(rate - 1) < 1e-6) return ''
  const pct = Math.round((rate - 1) * 100)
  return (pct >= 0 ? '+' : '') + pct + '%'
}

/** 把拼音表命中的词包成 <phoneme>，其余部分 XML 转义（长词优先、非重叠）。 */
export function applyPhonemes(text: string, rules: PhonemeRule[]): string {
  if (!rules.length) return escapeXml(text)
  let out = ''
  let i = 0
  while (i < text.length) {
    let hit: PhonemeRule | null = null
    for (const r of rules) {
      if (r.from && text.startsWith(r.from, i)) {
        hit = r
        break
      }
    }
    if (hit) {
      out += '<phoneme alphabet="sapi" ph="' + escapeXml(hit.ph) + '">' + escapeXml(hit.from) + '</phoneme>'
      i += hit.from.length
    } else {
      out += escapeXml(text[i])
      i++
    }
  }
  return out
}

export interface AzureSsmlOptions {
  text: string
  voice: string
  rate?: number
  lang?: string
  phonemes?: PhonemeRule[]
}

/** 生成 Azure TTS SSML 文档。 */
export function buildAzureSsml(o: AzureSsmlOptions): string {
  const voice = o.voice || 'zh-CN-XiaoxiaoNeural'
  const lang = o.lang || /^([a-z]{2}-[A-Z]{2})/.exec(voice)?.[1] || 'zh-CN'
  const inner = applyPhonemes(o.text, o.phonemes ?? [])
  const rate = azureRate(o.rate)
  const prosody = rate ? '<prosody rate="' + rate + '">' + inner + '</prosody>' : inner
  return (
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="' + escapeXml(lang) + '">' +
    '<voice name="' + escapeXml(voice) + '">' + prosody + '</voice></speak>'
  )
}
