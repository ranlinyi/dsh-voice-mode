/**
 * SentenceSegmenter 单元测试（纯函数，无网络、无 dsh 依赖）。
 * 运行：node test/segmenter.test.mjs（或 npm test）
 */
import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 用 esbuild 把 TS 原样转译到临时文件再导入（引擎 >=18 无 type-strip 依赖）。
const here = fileURLToPath(new URL('.', import.meta.url))
const tmp = mkdtempSync(join(tmpdir(), 'dsh-vm-seg-'))
const out = join(tmp, 'segmenter.mjs')
await build({
  entryPoints: [join(here, '..', 'src', 'segmenter.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
})
const { SentenceSegmenter, plainText, splitSentences, sanitizeForTts, applyPronunciationFixes, parsePronunciationFixes } = await import(pathToFileURL(out).href)

let passed = 0
const t = (name, fn) => {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('plainText')
t('剥离代码块/行内代码/链接/行首标题/行首列表', () => {
  assert.equal(
    plainText('**你好** `code` [链接](https://x) # 标题'),
    '你好 code 链接 # 标题',
  )
  assert.equal(plainText('# 标题\n- item'), '标题\nitem')
})
t('剥离图片与 HTML', () => {
  const out = plainText('![图](a.png) <b>粗</b>').replace(/\s+/g, ' ').trim()
  assert.equal(out, '粗')
})

console.log('sanitizeForTts')
t('剔除会被英文念出的 markdown 噪声字符', () => {
  assert.equal(sanitizeForTts('**加粗** _斜体_ ~~删除~~ > 引用 | 表格'), '加粗斜体删除引用表格')
  assert.equal(sanitizeForTts('a*b#c`d~e^f=g+h'), 'a b c d e f g h')
  assert.equal(sanitizeForTts('你好，世界。'), '你好，世界。')
  assert.equal(sanitizeForTts('你好 world 世界'), '你好 world 世界')
})
t('流式截断的配对符经分句器后不再残留', () => {
  const s = new SentenceSegmenter()
  s.feed('**这是')
  const out = s.feed('加粗**的内容。')
  assert.deepEqual(out, ['这是加粗的内容。'])
  assert.equal(s.flush().join('').includes('*'), false)
})

console.log('多音字替代表（内置为空 + 等字数硬校验）')
t('内置为空：默认不改任何词（最速降线原样保留）', () => {
  assert.equal(applyPronunciationFixes('最速降线问题'), '最速降线问题')
  const s = new SentenceSegmenter()
  assert.deepEqual(s.feed('这就是最速降线。'), ['这就是最速降线。'])
})
t('解析替代表：忽略注释/空行，接受 => / -> / →', () => {
  const { fixes, errors } = parsePronunciationFixes('# 注释\n\n最速降线 => 最速酱线\nabc -> abd\nx → y\n')
  assert.equal(errors.length, 0)
  assert.deepEqual(fixes, [
    { term: '最速降线', spoken: '最速酱线' },
    { term: 'abc', spoken: 'abd' },
    { term: 'x', spoken: 'y' },
  ])
})
t('拒绝增音节改名：最速降线 => 最速下降线 被忽略并报错', () => {
  const { fixes, errors } = parsePronunciationFixes('最速降线 => 最速下降线')
  assert.deepEqual(fixes, [])
  assert.equal(errors.length, 1)
  assert.ok(errors[0].includes('字数不等'), errors[0])
})
t('缺分隔符/字段为空的行走 errors，不生效', () => {
  const { fixes, errors } = parsePronunciationFixes('没有箭头的一行\n词 => ')
  assert.deepEqual(fixes, [])
  assert.equal(errors.length, 2)
})
t('同词同替身（term === spoken）直接跳过，不算错', () => {
  const { fixes, errors } = parsePronunciationFixes('最速降线 => 最速降线')
  assert.deepEqual(fixes, [])
  assert.equal(errors.length, 0)
})
t('分句器按注入的替代表替换朗读文本', () => {
  const s = new SentenceSegmenter({ fixes: () => [{ term: '最速降线', spoken: '最速酱线' }] })
  assert.deepEqual(s.feed('这就是最速降线。'), ['这就是最速酱线。'])
})
t('替代表是实时 getter：改回空表即不再替换', () => {
  let fixes = [{ term: '最速降线', spoken: '最速酱线' }]
  const s = new SentenceSegmenter({ fixes: () => fixes })
  assert.deepEqual(s.feed('最速降线。'), ['最速酱线。'])
  fixes = []
  assert.deepEqual(s.feed('最速降线。'), ['最速降线。'])
})
t('getter 抛错时退化为不替换，不打断朗读', () => {
  const s = new SentenceSegmenter({ fixes: () => { throw new Error('boom') } })
  assert.deepEqual(s.feed('最速降线。'), ['最速降线。'])
})

console.log('splitSentences')
t('中文终止标点切分', () => {
  const { sentences, tail } = splitSentences('你好。世界！如何？')
  assert.deepEqual(sentences, ['你好。', '世界！', '如何？'])
  assert.equal(tail, '')
})
t('小数与 URL 不被拆散', () => {
  const { sentences, tail } = splitSentences('圆周率 3.14 是。请看 https://a.b/c')
  assert.deepEqual(sentences, ['圆周率 3.14 是。'])
  assert.equal(tail, '请看 https://a.b/c')
})
t('英文句点仅在空白后终止', () => {
  const { sentences } = splitSentences('Hello world. Next')
  assert.deepEqual(sentences, ['Hello world.'])
})
t('省略号与换行终止', () => {
  const { sentences, tail } = splitSentences('等等…\n继续')
  assert.deepEqual(sentences, ['等等…\n'])
  assert.equal(tail, '继续')
})

console.log('SentenceSegmenter')
t('跨 chunk 累积成句', () => {
  const s = new SentenceSegmenter()
  assert.deepEqual(s.feed('你好，'), [])
  assert.deepEqual(s.feed('世界。'), ['你好，世界。'])
  assert.deepEqual(s.flush(), [])
})
t('flush 输出剩余缓冲', () => {
  const s = new SentenceSegmenter()
  s.feed('没有标点的一段话')
  assert.deepEqual(s.flush(), ['没有标点的一段话'])
  assert.deepEqual(s.flush(), [])
})
t('纯标点尾巴不输出', () => {
  const s = new SentenceSegmenter()
  s.feed('好。…')
  assert.deepEqual(s.feed('好。…')[0], '好。…')
})
t('无标点长墙按安全阀切分', () => {
  const s = new SentenceSegmenter({ maxSentenceChars: 10 })
  const out = s.feed('一二三四五六七八九十甲乙丙丁')
  assert.ok(out.length >= 1 && out[0].length <= 10)
})

console.log(`\nsegmenter：${passed} 项通过`)
rmSync(tmp, { recursive: true, force: true })