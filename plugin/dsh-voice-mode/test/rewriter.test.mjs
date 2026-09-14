/**
 * rewriter.ts 单元测试：JSON 信封协议 / token 校验 / 上下文 / 三道守卫 / 缓存 / 超时 / HTTP 失败。
 * 全部用注入的 fetchImpl，绝不走真实网络。
 */
import { build } from 'esbuild'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const tmp = mkdtempSync(join(tmpdir(), 'dsh-vm-rw-'))
const out = join(tmp, 'rewriter.mjs')
await build({
  entryPoints: [join(here, '..', 'src', 'rewriter.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
})
const {
  SpeechRewriter, extractNumbers, verifyNumbers, parseSpeechResponse, contextHash,
  withinLengthLimit, contextEchoRatio,
} = await import(pathToFileURL(out).href)

let passed = 0
const t = async (name, fn) => { await fn(); passed++; console.log('  ✓ ' + name) }

const J = (obj) => JSON.stringify(obj)
const okFetch = (content) => async () => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) })
const badFetch = async () => ({ ok: false, status: 401, json: async () => ({}) })
const hangingFetch = (_url, init) => new Promise((_resolve, reject) => {
  if (init && init.signal) init.signal.addEventListener('abort', () => reject(new Error('aborted')))
})
const mk = (content, extra = {}) => new SpeechRewriter({
  baseUrl: 'https://x.test/v1', apiKey: '', model: 'm', fetchImpl: okFetch(content), ...extra,
})

await t('extractNumbers 抽取数字 token', () => {
  assert.deepEqual(extractNumbers('a 1 b 2.5 c -3'), ['1', '2.5', '-3'])
})

await t('verifyNumbers：数字缺失即失败，念成中文也算保留', () => {
  assert.equal(verifyNumbers('共 12 项', '一共 12 项'), true)
  assert.equal(verifyNumbers('共 12 项', '一共十二项'), true)
  assert.equal(verifyNumbers('共 12 项', '一共很多项'), false)
  assert.equal(verifyNumbers('没有数字', '随便写'), true)
})

await t('verifyNumbers：数学公式的分数/下标/平方念成中文也算保留', () => {
  assert.equal(verifyNumbers('W = \\frac{1}{2} m v_2^2', '功等于二分之一乘以质量乘以末速度的平方'), true)
  assert.equal(verifyNumbers('v^2', 'v 的平方'), true)
  assert.equal(verifyNumbers('W = \\frac{1}{2} m v_2^2', '功等于质量乘以速度'), false)
})

await t('parseSpeechResponse：只取 speech，容忍围栏与前后噪声', () => {
  const p = parseSpeechResponse('好的：\n{"speech":"十二"}\n结束')
  assert.equal(p.speech, '十二')
  assert.deepEqual(p.symbols, [])
  const fenced = parseSpeechResponse('\x60\x60\x60json\n{"speech":"十二"}\n\x60\x60\x60')
  assert.equal(fenced.speech, '十二')
})

await t('parseSpeechResponse：缺 speech / 非对象 → null', () => {
  assert.equal(parseSpeechResponse('{"symbols":[]}'), null)
  assert.equal(parseSpeechResponse('[1,2]'), null)
  assert.equal(parseSpeechResponse('随便一段话'), null)
})

await t('contextHash：空上下文为空串，不同上下文不同', () => {
  assert.equal(contextHash(undefined), '')
  assert.equal(contextHash({}), '')
  assert.notEqual(contextHash({ before: 'a' }), contextHash({ before: 'b' }))
  assert.notEqual(
    contextHash({ symbols: [{ sym: 'g', meaning: '重力加速度' }] }),
    contextHash({ symbols: [{ sym: 'g', meaning: '质量' }] }),
  )
})

await t('withinLengthLimit：3 倍与 +60 取宽者', () => {
  assert.equal(withinLengthLimit('abc', 'x'.repeat(63)), true)
  assert.equal(withinLengthLimit('abc', 'x'.repeat(64)), false)
})

await t('contextEchoRatio：整段照抄=1，无关≈0', () => {
  assert.equal(contextEchoRatio('一二三四五六七八', '一二三四五六七八'), 1)
  assert.equal(contextEchoRatio('ABCDEFGH', '一二三四五六七八'), 0)
})

await t('未配置时完全不走网络', async () => {
  const r = new SpeechRewriter({ baseUrl: '', apiKey: '', model: '' })
  assert.equal(r.configured, false)
  assert.equal(await r.rewrite({ kind: 'code', text: 'const x = 1' }), null)
})

await t('成功改写 + 命中缓存', async () => {
  const r = mk(J({ speech: '这段代码创建了 12 个变量' }))
  const a = await r.rewrite({ kind: 'code', text: 'const n = 12' })
  assert.ok(a)
  assert.equal(a.cached, false)
  assert.equal(a.text, '这段代码创建了 12 个变量')
  const b = await r.rewrite({ kind: 'code', text: 'const n = 12' })
  assert.ok(b)
  assert.equal(b.cached, true)
})

await t('响应只取 speech；symbols 回传并被去重/截断', async () => {
  const r = mk(J({
    speech: '功等于二分之一 12',
    symbols: [{ sym: 'W', meaning: '功' }, { sym: 'W', meaning: '重复' }, { sym: '', meaning: 'x' }],
  }))
  const res = await r.rewrite({ kind: 'display-math', text: 'W = \\frac{1}{2} mv^2' })
  assert.ok(res)
  assert.equal(res.text, '功等于二分之一 12')
  assert.deepEqual(res.symbols, [{ sym: 'W', meaning: '功' }])
})

await t('token 校验不过 → 回退 null', async () => {
  const r = mk(J({ speech: '这段代码创建了若干变量' }))
  assert.equal(await r.rewrite({ kind: 'code', text: 'const n = 12' }), null)
})

await t('HTTP 非 2xx → null（原始报错不重试）', async () => {
  const r = new SpeechRewriter({ baseUrl: 'https://x.test/v1', apiKey: '', model: 'm', fetchImpl: badFetch })
  assert.equal(await r.rewrite({ kind: 'table', text: 'a | b', meta: { rows: [['a', 'b']] } }), null)
})

await t('超时中止 → null', async () => {
  const r = new SpeechRewriter({
    baseUrl: 'https://x.test/v1', apiKey: '', model: 'm', timeoutMs: 20, fetchImpl: hangingFetch,
  })
  assert.equal(await r.rewrite({ kind: 'code', text: 'const n = 12' }), null)
})

await t('响应不是 JSON → null（协议失败即回退）', async () => {
  const r = mk('v 的 2 次方')
  assert.equal(await r.rewrite({ kind: 'inline-math', text: 'v^2' }), null)
})

await t('请求体：JSON 信封 + response_format + 禁用思考，上下文只读', async () => {
  let captured = null
  const capture = async (_url, init) => {
    captured = JSON.parse(init.body)
    return { ok: true, json: async () => ({ choices: [{ message: { content: J({ speech: 'v 的 2 次方' }) } }] }) }
  }
  const r = new SpeechRewriter({ baseUrl: 'https://x.test/v1', apiKey: '', model: 'm', fetchImpl: capture })
  await r.rewrite({
    kind: 'inline-math',
    text: 'v^2',
    context: { before: '前文内容', symbols: [{ sym: 'v', meaning: '速度' }] },
  })
  assert.equal(captured.thinking.type, 'disabled')
  assert.equal(captured.response_format.type, 'json_object')
  const user = JSON.parse(captured.messages[1].content)
  assert.ok(user.task.includes('行内公式'), user.task)
  assert.equal(user.segment.type, 'inline-math')
  assert.equal(user.segment.text, 'v^2')
  assert.equal(user.context.before, '前文内容')
  assert.deepEqual(user.context.symbols, [{ sym: 'v', meaning: '速度' }])
})

await t('端点不认 response_format（400）：去掉后重试一次', async () => {
  let calls = 0
  const f = async (_url, init) => {
    calls++
    const body = JSON.parse(init.body)
    if (body.response_format) return { ok: false, status: 400, json: async () => ({}) }
    return { ok: true, json: async () => ({ choices: [{ message: { content: J({ speech: 'v 的 2 次方' }) } }] }) }
  }
  const r = new SpeechRewriter({ baseUrl: 'https://x.test/v1', apiKey: '', model: 'm', fetchImpl: f })
  const res = await r.rewrite({ kind: 'inline-math', text: 'v^2' })
  assert.ok(res, '应去掉 response_format 后成功')
  assert.equal(calls, 2)
})

await t('输出预算动态上调：长片段自动放大 max_tokens（封顶 2048）', async () => {
  let captured = null
  const capture = async (_url, init) => {
    captured = JSON.parse(init.body)
    return { ok: true, json: async () => ({ choices: [{ message: { content: J({ speech: 'x'.repeat(50) }) } }] }) }
  }
  const r = new SpeechRewriter({ baseUrl: 'https://x.test/v1', apiKey: '', model: 'm', fetchImpl: capture })
  await r.rewrite({ kind: 'code', text: 'const x = 1' })
  const small = captured.max_tokens
  await r.rewrite({ kind: 'code', text: 'x'.repeat(1000) })
  const big = captured.max_tokens
  assert.equal(small, 400)
  assert.ok(big > 400, String(big))
  assert.ok(big <= 2048, String(big))
})

await t('提示词回显输出被丢弃（防把指令当正文朗读）', async () => {
  const echoes = [
    '前文（仅供参考）：前面已经说明 v 是速度',
    '这是句子中的行内公式。只把它念成通顺的中文短语',
    '口播稿>v 的 2 次方',
  ]
  for (const e of echoes) {
    const r = mk(J({ speech: e }))
    assert.equal(await r.rewrite({ kind: 'inline-math', text: 'v^2' }), null, e)
  }
})

await t('长度守卫：超长输出被丢弃', async () => {
  const r = mk(J({ speech: '2' + '啊'.repeat(400) }))
  assert.equal(await r.rewrite({ kind: 'inline-math', text: 'v^2' }), null)
})

await t('前文重合率守卫：整段照抄前文被丢弃', async () => {
  const before = '这是已经朗读过的很长的前文内容包含数字 12 和别的说明。'.repeat(3)
  const r = mk(J({ speech: before }))
  assert.equal(await r.rewrite({ kind: 'code', text: 'const n = 12', context: { before } }), null)
})

await t('与前文少量重合不会被误杀', async () => {
  const before = '这是已经朗读过的很长的前文内容包含数字 12 和别的说明。'.repeat(3)
  const r = mk(J({ speech: '这段代码创建了 12 个变量并返回结果' }))
  const res = await r.rewrite({ kind: 'code', text: 'const n = 12', context: { before } })
  assert.ok(res, '正常改写不应被前文守卫拒绝')
})

await t('缓存：相同片段命中，不重复请求', async () => {
  let calls = 0
  const f = async () => { calls++; return { ok: true, json: async () => ({ choices: [{ message: { content: J({ speech: 'v 的 2 次方' }) } }] }) } }
  const r = new SpeechRewriter({ baseUrl: 'https://x.test/v1', apiKey: '', model: 'm', fetchImpl: f })
  await r.rewrite({ kind: 'inline-math', text: 'v^2' })
  await r.rewrite({ kind: 'inline-math', text: 'v^2' })
  assert.equal(calls, 1)
})

await t('缓存键含上下文：不同前文不误复用，相同前文可复用', async () => {
  let calls = 0
  const f = async () => { calls++; return { ok: true, json: async () => ({ choices: [{ message: { content: J({ speech: '这段代码创建了 12 个变量' }) } }] }) } }
  const r = new SpeechRewriter({ baseUrl: 'https://x.test/v1', apiKey: '', model: 'm', fetchImpl: f })
  await r.rewrite({ kind: 'code', text: 'const n = 12', context: { before: '甲'.repeat(50) } })
  await r.rewrite({ kind: 'code', text: 'const n = 12', context: { before: '乙'.repeat(50) } })
  await r.rewrite({ kind: 'code', text: 'const n = 12', context: { before: '甲'.repeat(50) } })
  assert.equal(calls, 2)
})

console.log('\nrewriter：' + passed + ' 项通过')
rmSync(tmp, { recursive: true, force: true })
