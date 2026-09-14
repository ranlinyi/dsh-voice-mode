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

t('渐近复杂度：O/Ω/Θ 读「大 O…」，不再逐符号念括号', () => {
  assert.equal(latexToSpeech('O(n^2)'), '大 O，n 的平方')
  assert.equal(latexToSpeech('O(n)'), '大 O，n')
  assert.equal(latexToSpeech('O(n\\log n)'), '大 O，n 乘 log n')
  assert.equal(latexToSpeech('O(1)'), '大 O，常数')
  assert.equal(latexToSpeech('O(n\\log k)'), '大 O，n 乘 log k')
  assert.equal(latexToSpeech('\\Omega(n\\log n)'), '大 Omega，n 乘 log n')
  assert.equal(latexToSpeech('\\Theta(n^2)'), '大 Theta，n 的平方')
  for (const s of ['O(n^2)', 'O(n\\log n)', '\\Omega(n\\log n)']) {
    const out = latexToSpeech(s)
    assert.ok(!out.includes('左括号') && !out.includes('右括号'), s + ' -> ' + out)
  }
})

t('复杂度里的 log 读英文，不读「对数」', () => {
  assert.ok(latexToSpeech('O(n\\log n)').includes('log n'))
  // 非复杂度语境仍是「对数」
  assert.ok(latexToSpeech('\\log x').includes('对数'))
})

t('排版性空白命令被忽略（少念出感叹号/反斜杠）', () => {
  const out = latexToSpeech('n \\lesssim 16\\!\\sim\\!32')
  assert.ok(out.includes('小于等于'), out)
  assert.ok(!out.includes('!'), out)
  assert.ok(!out.includes('lesssim'), out)
})

t('化学式 \\ce：元素读中文名，计数/状态/反应记号读中文', () => {
  assert.equal(latexToSpeech('\\ce{H2O}'), '氢 2 氧')
  assert.equal(latexToSpeech('\\ce{H2SO4}'), '氢 2 硫 氧 4')
  assert.equal(latexToSpeech('\\ce{2H2 + O2 -> 2H2O}'), '2 氢 2 加 氧 2 生成 2 氢 2 氧')
  assert.equal(latexToSpeech('\\ce{NaCl(aq)}'), '钠 氯 水溶液')
  assert.equal(latexToSpeech('\\ce{Fe^{3+}}'), '铁 正 3 价')
  // 不再逐字母念命令与元素符号
  const out = latexToSpeech('\\ce{CO2}')
  assert.equal(out, '碳 氧 2')
})

t('物理单位 \\pu：数值原样，单位读中文', () => {
  const s = latexToSpeech('\\pu{123 kJ/mol}')
  assert.ok(s.includes('123'), s)
  assert.ok(s.includes('千焦'), s)
  assert.ok(s.includes('摩尔'), s)
  assert.ok(s.includes('每'), s)
})

console.log('\nmath：' + passed + ' 项通过')
rmSync(tmp, { recursive: true, force: true })
