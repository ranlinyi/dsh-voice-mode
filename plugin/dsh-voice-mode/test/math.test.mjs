/**
 * math.ts 单元测试：确定性 LaTeX→中文规则。
 */
import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const tmp = mkdtempSync(join(tmpdir(), 'dsh-vm-math-'))
const out = join(tmp, 'math.mjs')
await build({
  entryPoints: [join(here, '..', 'src', 'math.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
})
const { latexToSpeech } = await import(pathToFileURL(out).href)

let passed = 0
const t = (name, fn) => { fn(); passed++; console.log('  ✓ ' + name) }

t('上下标与四则运算', () => {
  const s = latexToSpeech('a^2 + b^2 = c^2')
  assert.ok(s.includes('平方'), s)
  assert.ok(s.includes('等于'), s)
  assert.ok(s.includes('加'), s)
  assert.ok(s.includes('的 3 次方') === false)
})

t('分式：分母在前（中文习惯）', () => {
  assert.equal(latexToSpeech('\\frac{a}{b}'), 'b 分之 a')
  assert.equal(latexToSpeech('\\frac{x+1}{y-1}'), 'y 减 1 分之 x 加 1')
})

t('根号与下标', () => {
  assert.equal(latexToSpeech('\\sqrt{x}'), '根号 x')
  assert.ok(latexToSpeech('a_{n+1}').includes('下标'))
  assert.ok(latexToSpeech('a_{n+1}').includes('n 加 1'))
})

t('希腊字母与函数名', () => {
  const s = latexToSpeech('\\alpha + \\beta = \\sin x')
  assert.ok(s.includes('阿尔法'), s)
  assert.ok(s.includes('贝塔'), s)
  assert.ok(s.includes('正弦'), s)
})

t('求和/积分/无穷等算子', () => {
  assert.ok(latexToSpeech('\\sum_{i=1}^{n} x_i').includes('求和'))
  assert.ok(latexToSpeech('\\int_0^1 x dx').includes('积分'))
  assert.ok(latexToSpeech('\\infty').includes('无穷'))
})

t('未知命令按字母念出，绝不清空', () => {
  assert.equal(latexToSpeech('\\foo'), 'foo')
})

t('空输入返回空串', () => {
  assert.equal(latexToSpeech(''), '')
  assert.equal(latexToSpeech('   '), '')
})

t('text{} 原样保留', () => {
  assert.equal(latexToSpeech('\\text{速度}'), '速度')
})

console.log('\nmath：' + passed + ' 项通过')
rmSync(tmp, { recursive: true, force: true })
