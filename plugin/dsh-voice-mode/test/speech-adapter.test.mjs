/**
 * speech-adapter 单元测试：开关退化、数学模式、结构片段回退与顺序、
 * 上下文（前文 + 符号表）与读音替代表透传。
 * 用 esbuild 转译，注入假 rewriter，绝不走真实网络。
 */
import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const tmp = mkdtempSync(join(tmpdir(), 'dsh-vm-adapter-'))
const out = join(tmp, 'speech-adapter.mjs')
await build({
  entryPoints: [join(here, '..', 'src', 'speech-adapter.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
})
const { SpeechAdapter, contextBudget, trimContext } = await import(pathToFileURL(out).href)

let passed = 0
const t = async (name, fn) => { await fn(); passed++; console.log('  ✓ ' + name) }

const run = async (cfg, deltas) => {
  const seen = []
  const adapter = new SpeechAdapter({ config: () => cfg, onSentence: (s) => seen.push(s) })
  for (const d of deltas) adapter.feed(d)
  adapter.flush()
  await adapter.whenIdle()
  return seen
}

const CODE = '\x60\x60\x60\nconst n = 12\n\x60\x60\x60\n'

await t('关闭改编站：完全退化为原路径', async () => {
  const seen = await run({ enabled: false, mathMode: 'rules', rewriter: null }, ['你好，世界。'])
  assert.deepEqual(seen, ['你好，世界。'])
})

await t('行内公式 rules 模式：确定性读法拼回句子', async () => {
  const seen = await run({ enabled: true, mathMode: 'rules', rewriter: null }, ['设 $a_n$ 为数列。\n'])
  const text = seen.join('')
  assert.ok(text.includes('下标'), text)
  assert.ok(text.includes('为数列'), text)
})

await t('行内公式 verbatim 模式：原样念出', async () => {
  const seen = await run({ enabled: true, mathMode: 'verbatim', rewriter: null }, ['设 $a_n$ 为数列。\n'])
  assert.ok(!seen.join('').includes('下标'), seen.join(''))
  assert.ok(seen.join('').includes('为数列'), seen.join(''))
})

await t('代码块：无改写器时回退确定性简述（不逐行念）', async () => {
  const seen = await run({ enabled: true, mathMode: 'rules', rewriter: null }, [CODE])
  const text = seen.join('')
  assert.ok(text.includes('代码块'), text)
  assert.ok(text.includes('1 行'), text)
  assert.ok(!text.includes('const n = 12'), '不应逐行念出代码')
})

await t('代码块：改写成功后念口播稿', async () => {
  const fake = { rewrite: async () => ({ text: '这段代码创建了 12 个变量。', cached: false }) }
  const seen = await run({ enabled: true, mathMode: 'rules', rewriter: fake }, [CODE])
  assert.ok(seen.join('').includes('创建了 12 个变量'), seen.join(''))
})

await t('表格：无改写器时回退行列/列名简述', async () => {
  const seen = await run({ enabled: true, mathMode: 'rules', rewriter: null }, ['| 名称 | 值 |\n| --- | --- |\n| 甲 | 1 |\n\n'])
  const text = seen.join('')
  assert.ok(text.includes('表格'), text)
  assert.ok(text.includes('列名'), text)
  assert.ok(text.includes('名称'), text)
})

await t('顺序：正文 → 结构片段 → 后续正文，入队顺序与原文一致', async () => {
  const fake = { rewrite: async () => ({ text: '这段代码创建了 12 个变量。', cached: false }) }
  const seen = await run(
    { enabled: true, mathMode: 'rules', rewriter: fake },
    ['第一句。\n\n' + CODE + '\n第二句。\n'],
  )
  assert.ok(seen[0].includes('第一句'), seen.join('|'))
  assert.ok(seen[1].includes('创建了 12 个变量'), seen.join('|'))
  assert.ok(seen[2].includes('第二句'), seen.join('|'))
})

await t('上下文：改写请求带上前文与从正文抽取的符号表', async () => {
  const calls = []
  const fake = { rewrite: async (req) => { calls.push(req); return { text: '口播稿 12', cached: false } } }
  await run({ enabled: true, mathMode: 'rules', rewriter: fake, contextChars: 300 }, [
    '这里 g 表示重力加速度。\n\n',
    CODE,
  ])
  assert.equal(calls.length, 1)
  assert.ok(calls[0].context.before.includes('重力加速度'), JSON.stringify(calls[0].context))
  assert.deepEqual(calls[0].context.symbols, [{ sym: 'g', meaning: '重力加速度' }])
})

await t('contextChars=0：不传前文，但符号表仍传', async () => {
  const calls = []
  const fake = { rewrite: async (req) => { calls.push(req); return { text: '口播稿 12', cached: false } } }
  await run({ enabled: true, mathMode: 'rules', rewriter: fake, contextChars: 0 }, [
    '这里 g 表示重力加速度。\n\n',
    CODE,
  ])
  assert.equal(calls[0].context.before, undefined)
  assert.deepEqual(calls[0].context.symbols, [{ sym: 'g', meaning: '重力加速度' }])
})

await t('符号回传：模型确认的符号进入后续片段上下文', async () => {
  const calls = []
  const fake = {
    rewrite: async (req) => {
      calls.push(req.context)
      return { text: '口播稿 12', cached: false, symbols: [{ sym: 'W', meaning: '功' }] }
    },
  }
  await run({ enabled: true, mathMode: 'rules', rewriter: fake }, [
    '第一段没有符号定义。\n\n',
    CODE,
    '\n' + CODE,
  ])
  assert.equal(calls.length, 2)
  assert.equal(calls[0].symbols, undefined)
  assert.deepEqual(calls[1].symbols, [{ sym: 'W', meaning: '功' }])
})

await t('contextBudget：随片段长度伸缩、受上限约束、0/非法=关', () => {
  assert.equal(contextBudget(3, undefined), 132)   // 短片段：120 下限之上
  assert.equal(contextBudget(0, undefined), 120)    // 下限
  assert.equal(contextBudget(1000, undefined), 800) // 上限
  assert.equal(contextBudget(1000, 300), 300)
  assert.equal(contextBudget(10, 0), 0)
  assert.equal(contextBudget(10, -1), 0)
})

await t('trimContext：不在句中截断，总是从整句开始', () => {
  const text = '第一句。第二句。第三句。'
  assert.equal(trimContext(text, 6), '第三句。')
  assert.equal(trimContext(text, 4), '第三句。')     // 切到句首为空时退回整段截取
  assert.equal(trimContext(text, 100), text)
  assert.equal(trimContext('没有标点的一整段', 3), '一整段')
  assert.equal(trimContext('任意', 0), '')
})

await t('动态前文：短片段少给、大片段多给（同一段前文）', async () => {
  const calls = []
  const fake = { rewrite: async (req) => { calls.push(req.context); return { text: '口播稿 12', cached: false } } }
  const prose = '这是一句大概二十来个字符的说明文字。'.repeat(20) + '\n\n'
  const bigCode = '\x60\x60\x60\n' + 'const value = 12;\n'.repeat(40) + '\x60\x60\x60\n'
  await run({ enabled: true, mathMode: 'model', rewriter: fake, contextChars: 800 }, [
    prose,
    '其中 $v^2$ 的含义。\n\n',
    bigCode,
  ])
  const small = calls.find((c) => c.before && c.before.length <= 140)
  const large = calls.reduce((a, b) => (b.before && (!a.before || b.before.length > a.before.length) ? b : a), {})
  assert.ok(small, '短片段应拿到较短前文：' + JSON.stringify(calls.map((c) => (c.before || '').length)))
  assert.ok(large.before.length > small.before.length, JSON.stringify(calls.map((c) => (c.before || '').length)))
  assert.ok(large.before.length <= 800, String(large.before.length))
})

await t('整句原文：行内公式带上所在整句（消歧用）', async () => {
  const calls = []
  const fake = { rewrite: async (req) => { calls.push(req); return { text: 'v 的 2 次方', cached: false } } }
  await run({ enabled: true, mathMode: 'model', rewriter: fake }, ['设 $f: A \\to B$ 是一个映射。\n'])
  assert.equal(calls.length, 1)
  const meta = calls[0].meta
  assert.ok(meta && typeof meta.sentence === 'string', JSON.stringify(meta))
  assert.ok(meta.sentence.includes('是一个映射'), meta.sentence)
})

await t('读音替代表：透传到分句器（只影响朗读文本）', async () => {
  const seen = await run(
    { enabled: true, mathMode: 'rules', rewriter: null, pronunciation: [{ term: '最速降线', spoken: '最速酱线' }] },
    ['这就是最速降线。'],
  )
  assert.ok(seen.join('').includes('最速酱线'), seen.join(''))
})

await t('未配置替代表：朗读文本原样（默认不改任何词）', async () => {
  const seen = await run({ enabled: true, mathMode: 'rules', rewriter: null }, ['这就是最速降线。'])
  assert.ok(seen.join('').includes('最速降线'), seen.join(''))
  assert.ok(!seen.join('').includes('最速酱线'), seen.join(''))
})

console.log('\nspeech-adapter：' + passed + ' 项通过')
rmSync(tmp, { recursive: true, force: true })
