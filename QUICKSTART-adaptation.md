# 语音改编站 · Quick Start

> 本仓库是 [dsh-voice-mode](https://github.com/qishuilalala/dsh-voice-mode)（作者 qishuilalala，MIT 许可）的 fork，
> 包名 `dsh-voice-mode-adaptation`，新增「**语音改编站**」。
> 它让 DSH 朗读回复时**正确口述公式、表格与代码**，而不是跳过、逐字母念或逐行念；
> 屏幕上的 Markdown / LaTeX 完整保留，只对语音侧单独适配。

| 项 | 值 |
|---|---|
| 仓库 | https://github.com/ranlinyi/dsh-voice-mode-adaptation |
| 分支 | `feat/speech-adaptation` |
| 实测基线 | DSH `0.1.5-rc.1` · Node `v24.21.0` · Arch Linux + PipeWire |
| 许可 | MIT（继承上游） |

---

## 0. 它会怎么处理各类内容

开启「改编站」后，朗读管线会先按渲染器同款规则把流式 Markdown 拆成片段，再分类处理：

| 内容 | 处理方式 |
|---|---|
| 正文 | 走原有「清洗 → 分句 → TTS」路径（几乎零额外延迟） |
| 行内公式 | 按「数学模式」：`rules` 确定性规则 / `model` 交给改写模型 / `verbatim` 原样 |
| 展示公式、代码块、表格 | 攒到闭合后交给改写模型写「口播稿」，失败则回退到确定性读法 |
| 含行内公式的整句 | 整句一起出稿，避免「公式念一遍、正文再念一遍」 |

设计原则：**屏幕所见与送模型的内容一致**；屏幕阅读不受影响。

---

## 1. 前置条件

1. 已安装 **DSH**（`0.1.5-rc.1` 或更新），使用 `web` profile；
2. **Node.js ≥ 18**（实测 v24）；
3. 一个 **OpenAI 兼容的改写端点 + API Key**。本项目实测用的是智谱：
   - 端点 `https://open.bigmodel.cn/api/paas/v4`
   - 模型 `glm-4.5-air`
   - **不配 Key 也能装**，但「改编站」会静默回退，听感等于没开（详见第 5 节）；
4. 首次启动会下载约 **950 MB** 语音模型（ASR zipformer + SenseVoice + VAD + Kokoro），国内网络请设镜像；
5. 浏览器需支持 Web Audio（Chrome / Edge 等 Chromium 系最佳）。

---

## 2. 获取并安装插件

`lib/` 构建产物**随仓库提供**，普通用户无需自己构建：

```bash
git clone https://github.com/ranlinyi/dsh-voice-mode-adaptation.git
cd dsh-voice-mode

# 用本地路径装入 web profile（推荐，最不易出错）
dsh plugin --profile web add "$PWD/plugin/dsh-voice-mode"
```

> `dsh plugin` 也接受「包名 / git 仓库地址」，但本插件的源码位于仓库子目录
> `plugin/dsh-voice-mode`，用 clone 后加本地绝对路径最稳妥。

只有**要改源码**时才需要构建（见第 9 节）。

---

## 3. 重启 dsh web

插件源码变更后必须**重启进程**才生效：

```bash
pgrep -f 'bin/dsh web'     # 先看旧实例 PID
pkill -f 'bin/dsh web'     # 停掉旧实例
dsh web                    # 重新启动
```

注意：

- 旧实例没停干净就起新实例，会报 `EADDRINUSE`（端口 3080 被占）；
- **这一步会中断正在进行的语音会话**，请在空闲时操作。

---

## 4. 强刷浏览器

设置面板的客户端 bundle 已更新，**必须强刷**：

    Ctrl + Shift + R

---

## 5. 首次配置

1. 进入**语音模式**（默认快捷键 `Ctrl+Shift+V`）；
2. 打开 **设置 → 语音改编站** 分组；
3. 打开 **「启用语音改编站」**（默认关闭）；
4. 依次填写：

   | 设置项 | 建议值 |
   |---|---|
   | 数学模式 | 模型（`model`） |
   | 改写端点 | `https://open.bigmodel.cn/api/paas/v4` |
   | 改写模型 | `glm-4.5-air` |
   | 密钥凭据引用 | `GLM_API_KEY` |
   | 模型镜像（ASR 下载源） | `https://hf-mirror.com`（国内） |

5. 点设置面板里的 **「写入密钥」**，把真实 API Key 存进 **DSH 凭据库**
   —— 明文**不会**写进 `settings.yaml`；

> ⚠️ **绝对不要把真实密钥填进 YAML。** 设置项 `rewriteApiKeyRef` 只放「引用名」。
> 未配置可用 Key 时，改写器**静默失败并回退**，外观上等同于「改编站关闭」。

---

## 6. 推荐设置（可直接粘贴）

把下面这段并入 `~/.dsh/settings.yaml`。
标「★」的 13 项与插件默认值不同，是与完整体验相关的关键项；其余列出只为便于核对。

```yaml
voice-mode-adaptation:
  # ── ★ 与默认不同的关键项 ──
  rewriteEnabled: true            # 默认 false：不开就没有改编站
  mathMode: model                 # 默认 rules：公式不会走模型
  rewriteApiKeyRef: GLM_API_KEY   # 默认空；只写引用名，真实密钥走凭据库
  rate: 1.3                       # 默认 1.0
  mode: hold                      # 默认 toggle
  bargeInMode: manual             # 默认 auto：外放会被自己的回声打断
  spokenFormat: true              # 默认 false：注入「保留 Markdown/LaTeX」提示词
  autoResume: true                # 默认 false
  kokoroModel: fp32               # 默认 int8（音质更好、体积更大）
  guardMode: standard             # 默认 standard；见下方说明
  blockPauseMs: 200               # 默认 350
  rewriteMaxTokens: 600           # 默认 400（这是「基线」，实际按片段动态上调）
  rewriteCache: false             # 默认 true
  # ── 以下保持默认，列出以便核对 ──
  ttsEngine: edge
  voice: zh-CN-XiaoxiaoNeural
  rewriteBaseUrl: https://open.bigmodel.cn/api/paas/v4
  rewriteModel: glm-4.5-air
  rewriteTimeoutMs: 8000
  rewriteContextChars: 800
  wholeSentenceMath: true
  pronunciationEnabled: true
  toolBeep: false
  # pronunciationFixes 不写则使用插件默认的「行(háng)」同音词表
```

关于 `guardMode`（改写守卫档位）：

- `standard`（默认）：长度、回显、复述三道校验齐全，**推荐给新用户**；
- `lenient`：更难被判回退，适合模型听话的场景；
- `strict`：更容易回退到确定性读法；
- `off`：**只保留 JSON 协议解析，连数字保全校验都跳过**，可能读到指令文本、复述重复而不被拦截，风险自负。

关于 `blockPauseMs`、`kokoroModel`、`rewriteCache`、`rewriteMaxTokens`：均属个人偏好，可按需调整。

---

## 7. 验证安装

```bash
curl -s http://127.0.0.1:3080/voice-mode-adaptation/
```

期望返回形如：

```json
{"ok":true,"name":"dsh-voice-mode-adaptation","enabled":true,"active":null,
 "pronunciationErrors":[],"guardErrors":[]}
```

- `ok:true` = 插件已加载；
- `pronunciationErrors` / `guardErrors` 非空 = 你写的多音字表或守卫放行规则有语法错误，会在这里回报（不会静默）；
- `active` 为会话 id 时表示当前有活跃语音会话。

---

## 8. 常见问题（均为实测踩过的坑）

1. **装了没反应 / 改了源码不生效** → 必须重启 `dsh web`；前端还要强刷（Ctrl+Shift+R）。
2. **界面显示在念但没声音** → 浏览器 SSE 断开超过 8 秒，服务端会清空活跃会话。强刷页面并重新进入语音模式；使用中别刷新/切标签。
3. **外放时总被自己打断** → 把 `bargeInMode` 改成 `manual`，或戴耳机。
4. **公式没走模型** → 检查 `mathMode` 是否为 `model`、`rewriteEnabled` 是否开、Key 是否可用。
5. **模型下载慢** → 把「模型镜像」（`modelHost`）设为 `https://hf-mirror.com`。
6. **多音字读错治不了** → 免费 Edge 端点**不支持任何音素级 SSML**（`<break>`/`<phoneme>`/`<say-as>` 会导致直接断流），只能用文本替换表 `pronunciationFixes`；要根治需换本地 Kokoro 或付费 Azure SSML。
7. **纯文字句子没有额外走模型** → 这是设计如此：「整句出稿」只对**含行内公式**的句子生效。
8. **单行 `$$x$$` 被当成行内公式** → 与渲染器行为一致；只有**多行 `$$` 块**才是行间公式。
9. **长文有多个结构片段会多次调用外部模型** → 每个展示公式/代码/表格各一次，有延迟与费用，属预期。
10. **化学式 `\ce{...}` / `\pu{...}` 显示成红色报错** → DSH 自带的 KaTeX（0.16.47）没有加载 mhchem 扩展，公式渲染失败；这与本插件无关，朗读侧不受影响（`math.ts` 已支持化学式与物理单位）。根治办法是在 DSH 的 `packages/client/ui-primitives/src/markdown/katex.tsx` 加一行 `import 'katex/contrib/mhchem'`——上游同样是这个缺口，且目前不收外部 PR。

---

## 9. 关闭、卸载与开发

**临时关闭**：设置里关掉「启用语音改编站」。此时完全退化为上游原行为，不外发、不改写。

**卸载**：

```bash
dsh plugin --profile web remove dsh-voice-mode-adaptation
```

**要改源码**（必须带工作区 npm 缓存，避免只读 `~/.npm` 报 `EROFS`）：

```bash
cd plugin/dsh-voice-mode
npm_config_cache="$PWD/../../../.npm-cache" npm install
npm_config_cache="$PWD/../../../.npm-cache" npm run typecheck
npm_config_cache="$PWD/../../../.npm-cache" npm run build
npm_config_cache="$PWD/../../../.npm-cache" npm test
```

> `lib/*.js` 是**纳入版本管理**的构建产物：每次 `npm run build` 都会更新，
> 且客户端的 `BUILD_TAG` 等于构建时的 git 短哈希。仓库惯例是「源码改动 + 重建产物」两个提交。
> `npm pack` / `npm publish` 会触发 `prepack`，同样会重建 `lib/client.js`。

**模型缓存**：`~/.cache/dsh-voice-mode-adaptation`（约 950 MB，不在仓库内，新环境需重下）。

---

*本教程随 `feat/speech-adaptation` 分支提供。上游功能与完整调试史见仓库根目录的交接文档。*
