/**
 * BlockRouter / parseSpeechSegments 单元测试。
 * 用 esbuild 把 TS 原样转译到临时文件再导入（与 segmenter.test.mjs 同款约定）。
 * 运行：node test/block-router.test.mjs（或 npm test）
 */
import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const tmp = mkdtempSync(join(tmpdir(), 'dsh-vm-block-'))
const out = join(tmp, 'block-router.mjs')
await build({
  entryPoints: [join(here, '..', 'src', 'block-router.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
})
const { parseSpeechSegments, BlockRouter } = await import(pathToFileURL(out).href)

let passed = 0
const t = (name, fn) => { fn(); passed++; console.log('  ✓ ' + name) }
const kinds = (segs) => segs.map((s) => s.kind)
const allText = (segs) => segs.map((s) => s.text).join('')

console.log('parseSpeechSegments')
t('完整 Markdown：正文/行内公式/展示公式/代码/表格全部正确分离', () => {
  const md = [
    '设 $a_n$ 为数列。',
    '',
    '$$',
    'a_{n+1} = a_n + 1',
    '$$',
    '',
    '\x60\x60\x60js',
    'const x = 1',
    '\x60\x60\x60',
    '',
    '| 名称 | 值 |',
    '| --- | --- |',
    '| 甲 | 1 |',
    '| 乙 | 2 |',
  ].join('\n')
  const segs = parseSpeechSegments(md)
  assert.ok(kinds(segs).includes('prose'), 'has prose')
  assert.ok(kinds(segs).includes('inline-math'), 'has inline-math')
  assert.ok(kinds(segs).includes('display-math'), 'has display-math')
  assert.ok(kinds(segs).includes('code'), 'has code')
  assert.ok(kinds(segs).includes('table'), 'has table')
  const code = segs.find((s) => s.kind === 'code')
  assert.equal(code.meta.lang, 'js')
  assert.ok(code.text.includes('const x = 1'))
  const table = segs.find((s) => s.kind === 'table')
  assert.equal(table.meta.rowCount, 3)
  assert.equal(table.meta.colCount, 2)
  assert.deepEqual(table.meta.rows[2], ['乙', '2'])
})

t('行内公式与中文紧贴时能精确切分', () => {
  const segs = parseSpeechSegments('设 $a_n$ 为数列。')
  assert.deepEqual(kinds(segs), ['prose', 'inline-math', 'prose'])
  assert.equal(segs[0].text, '设 ')
  assert.equal(segs[1].text, 'a_n')
  assert.equal(segs[2].text, ' 为数列。')
})
t('行内公式带上所在整句原文（含公式后面的解释词，供消歧）', () => {
  const segs = parseSpeechSegments('设 $f: A \\to B$ 是一个映射。')
  const m = segs.find((s) => s.kind === 'inline-math')
  assert.ok(m.meta && typeof m.meta.sentence === 'string', 'inline-math 应带 meta.sentence')
  assert.ok(m.meta.sentence.includes('是一个映射'), m.meta.sentence)
  assert.ok(m.meta.sentence.includes('A \\to B'), m.meta.sentence)
})

t('展示公式/代码/表格不带 sentence（它们的语境来自前文）', () => {
  const segs = parseSpeechSegments('$$\na_n + 1\n$$\n')
  const d = segs.find((s) => s.kind === 'display-math')
  assert.equal(d.meta, undefined)
})

t('\\[ x^2 \\] 与 \\( y \\) 被当作普通文字（与 DSH 渲染器一致）', () => {
  const segs = parseSpeechSegments('\\[ x^2 \\] 与 \\( y \\)')
  assert.deepEqual(kinds(segs), ['prose'])
  assert.ok(allText(segs).includes('x^2'))
  assert.ok(allText(segs).includes('y'))
})

t('单竖线不误判成表格', () => {
  const segs = parseSpeechSegments('a | b')
  assert.deepEqual(kinds(segs), ['prose'])
})

t('行内代码识别为 inline-code', () => {
  const segs = parseSpeechSegments('调用 \x60fn()\x60 即可。')
  assert.ok(kinds(segs).includes('inline-code'))
  assert.equal(segs.find((s) => s.kind === 'inline-code').text, 'fn()')
})

t('相邻 prose 合并，不同段不合并', () => {
  const segs = parseSpeechSegments('甲**乙**丙\n\n丁')
  const prose = segs.filter((s) => s.kind === 'prose')
  assert.equal(prose.length, 2)
  assert.equal(prose[0].text, '甲乙丙')
  assert.equal(prose[1].text, '丁')
})

console.log('美元符号（与渲染器一致性）')
t('转义 \\$ 保留为字面文字', () => {
  const segs = parseSpeechSegments('价格 \\$3，那本 \\$10')
  assert.deepEqual(kinds(segs), ['prose'])
  assert.ok(allText(segs).includes('$3'))
})

t('成对未转义 $ 被识别为行内公式（预期行为，靠提示词转义解决）', () => {
  const segs = parseSpeechSegments('价格 $3，那本 $10。')
  assert.ok(kinds(segs).includes('inline-math'))
})

console.log('BlockRouter 流式')
t('围栏代码：闭合前不输出，闭合后输出 code', () => {
  const r = new BlockRouter()
  assert.deepEqual(r.feed('\x60\x60\x60js\n'), [])
  assert.deepEqual(r.feed('const x = 1\n'), [])
  const segs = r.feed('\x60\x60\x60\n')
  assert.deepEqual(kinds(segs), ['code'])
  assert.ok(segs[0].text.includes('const x = 1'))
})

t('未闭合围栏：feed 不输出，flush 时才解析', () => {
  const r = new BlockRouter()
  assert.deepEqual(r.feed('\x60\x60\x60\ncode'), [])
  const segs = r.flush()
  assert.deepEqual(kinds(segs), ['code'])
  assert.ok(segs[0].text.includes('code'))
})

t('展示公式跨 chunk：闭合前不输出', () => {
  const r = new BlockRouter()
  const first = r.feed('前文。\n\n$$\n')
  assert.deepEqual(kinds(first), ['prose'])
  assert.deepEqual(r.feed('a_n + 1\n'), [])
  const segs = r.feed('$$\n')
  assert.deepEqual(kinds(segs), ['display-math'])
  assert.ok(segs[0].text.includes('a_n + 1'))
})

t('表格在空行处才整体识别', () => {
  const r = new BlockRouter()
  assert.deepEqual(r.feed('| 甲 | 乙 |\n| --- | --- |\n| 1 | 2 |\n'), [])
  const segs = r.feed('\n')
  assert.deepEqual(kinds(segs), ['table'])
  assert.equal(segs[0].meta.rowCount, 2)
})

t('段落按空行分块，标题/列表也走 prose', () => {
  const r = new BlockRouter()
  const segs = r.feed('## 标题\n- 第一项\n- 第二项\n\n开头。\n\n')
  const prose = segs.filter((s) => s.kind === 'prose')
  assert.ok(prose.length >= 2)
  assert.ok(allText(prose).includes('标题'))
  assert.ok(allText(prose).includes('第一项'))
  assert.ok(allText(prose).includes('开头。'))
})

t('flush 输出无换行结尾的残余正文', () => {
  const r = new BlockRouter()
  assert.deepEqual(r.feed('没有换行的一段'), [])
  assert.deepEqual(r.flush().map((s) => s.text), ['没有换行的一段'])
})

t('maxProseChars 安全阀在行边界冲刷长段落', () => {
  const r = new BlockRouter({ maxProseChars: 10 })
  const segs = r.feed('一二三四五六七八九十\n')
  assert.ok(segs.length >= 1)
})

console.log('\nblock-router：' + passed + ' 项通过')
rmSync(tmp, { recursive: true, force: true })
