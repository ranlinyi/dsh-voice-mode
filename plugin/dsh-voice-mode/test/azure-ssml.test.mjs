/**
 * azure-ssml.ts 单元测试：端点归一 / 拼音表 / 语速 / SSML 生成。
 */
import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const tmp = mkdtempSync(join(tmpdir(), 'dsh-vm-azure-'))
const out = join(tmp, 'azure-ssml.mjs')
await build({
  entryPoints: [join(here, '..', 'src', 'azure-ssml.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
})
const { normalizeAzureEndpoint, parsePhonemeTable, azureRate, buildAzureSsml, applyPhonemes } = await import(pathToFileURL(out).href)

let passed = 0
const t = (name, fn) => { fn(); passed++; console.log('  ✓ ' + name) }

t('端点归一：区域名 / 完整链接 / 已带路径 / 空', () => {
  assert.equal(normalizeAzureEndpoint('eastasia'), 'https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1')
  assert.equal(normalizeAzureEndpoint('https://eastasia.tts.speech.microsoft.com'), 'https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1')
  assert.equal(normalizeAzureEndpoint('https://eastasia.tts.speech.microsoft.com/'), 'https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1')
  assert.equal(normalizeAzureEndpoint('https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1'), 'https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1')
  assert.equal(normalizeAzureEndpoint('   '), '')
})

t('拼音表：解析、注释、多种箭头、错误回报、长词优先', () => {
  const r = parsePhonemeTable('# 行(háng) 词表\n行 => hang2\n银行 -> yin2 hang2\n行业 → hang2 ye4\n这一行没有箭头')
  assert.equal(r.rules.length, 3)
  assert.equal(r.errors.length, 1)
  assert.equal(r.rules[0].from, '银行') // 长度倒序：银行(2) 在 行(1) 前
  assert.equal(r.rules[r.rules.length - 1].from, '行')
})

t('拼音表：全角箭头与空行、非法字符', () => {
  const r = parsePhonemeTable('\n\n  \n行=>hang2\n坏 => a<b')
  assert.equal(r.rules.length, 1)
  assert.equal(r.errors.length, 1)
})

t('语速：1.0 不输出，1.3 / 0.8 转百分比', () => {
  assert.equal(azureRate(1), '')
  assert.equal(azureRate(undefined), '')
  assert.equal(azureRate(1.3), '+30%')
  assert.equal(azureRate(0.8), '-20%')
})

t('SSML：XML 转义、<phoneme>、长词优先、lang/voice', () => {
  const { rules } = parsePhonemeTable('行 => hang2\n银行 => yin2 hang2')
  const ssml = buildAzureSsml({ text: '银行 A&B <x> 行', voice: 'zh-CN-XiaoxiaoNeural', rate: 1.3, phonemes: rules })
  assert.ok(ssml.includes('<prosody rate="+30%">'), ssml)
  assert.ok(ssml.includes('A&amp;B'), ssml)
  assert.ok(ssml.includes('&lt;x&gt;'), ssml)
  assert.ok(ssml.includes('<phoneme alphabet="sapi" ph="yin2 hang2">银行</phoneme>'), ssml)
  assert.ok(ssml.includes('<phoneme alphabet="sapi" ph="hang2">行</phoneme>'), ssml)
  assert.ok(ssml.includes('xml:lang="zh-CN"'), ssml)
  assert.ok(ssml.includes('<voice name="zh-CN-XiaoxiaoNeural">'), ssml)
  assert.ok(!ssml.includes('<phoneme alphabet="sapi" ph="hang2">银'), ssml) // 不应把「银」单独切给「行」
})

t('SSML：无拼音表时纯文本且转义', () => {
  const ssml = buildAzureSsml({ text: 'a < b & c', voice: 'zh-CN-YunxiNeural', phonemes: [] })
  assert.ok(ssml.includes('a &lt; b &amp; c'), ssml)
  assert.ok(!ssml.includes('phoneme'), ssml)
  assert.equal(applyPhonemes('<&>', []), '&lt;&amp;&gt;')
})

console.log('\nazure-ssml：' + passed + ' 项通过')
rmSync(tmp, { recursive: true, force: true })
