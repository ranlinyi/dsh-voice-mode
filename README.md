<p align="center">
  <img src="assets/hero-logo.png" width="120" alt="dsh-voice-mode-adaptation">
</p>

<h1 align="center">dsh-voice-mode-adaptation</h1>

<p align="center">让语音朗读读懂「非普通文本」—— 数学公式 · 表格 · 代码 · 脚注</p>

<p align="center">
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/dsh--plugin-voice-brightgreen?style=flat-square" alt="dsh-plugin voice"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/ranlinyi/dsh-voice-mode-adaptation?style=flat-square" alt="License"></a>
  <a href="https://github.com/qishuilalala/dsh-voice-mode"><img src="https://img.shields.io/badge/fork%20of-dsh--voice--mode-blue?style=flat-square" alt="fork of dsh-voice-mode"></a>
</p>

> **本仓库是 [dsh-voice-mode](https://github.com/qishuilalala/dsh-voice-mode)（作者 qishuilalala，MIT 许可）的 fork。**
> 上游「零 API Key · 本地识别 · 按句朗读 · 开口即打断」的能力全部保留；本 fork 在其上新增**可选的「语音改编站」**，专攻**非普通文本的朗读**。
>
> 安装与配置见 **[语音改编站 · Quick Start](QUICKSTART-adaptation.md)**。

---

> ## ⚠️ 启用前必读：会外发数据、需要外部 API Key
>
> **语音改编站默认关闭。** 一旦在设置里**启用**它：
>
> - 被朗读的**公式 / 表格 / 代码 / 含公式的整句**会被发送到**你自己配置的外部改写端点**（默认智谱 GLM，可换任意 OpenAI 兼容端点）；
> - 因此**必须提供该端点的外部 API Key**（在设置面板「写入密钥」存进 DSH 凭据库，明文不落配置文件）；
> - 不启用、或把数学模式设为 <code>rules</code> / <code>verbatim</code> 时，**不外发、不需要任何 API Key**，行为与上游完全一致。
>
> 一句话：**「零 API Key、零外发」是默认状态；一旦开启改编站，就变成「需要外部 Key + 会把片段外发」。** 请确认可以接受后再开启。

---

## 🎯 它解决什么：让「非普通文本」被读对

普通 TTS 遇到公式、表格、代码时，要么**跳过**，要么**逐字母 / 逐行念**。语音改编站在朗读前先按与界面渲染器一致的规则拆分流式 Markdown，再分类适配：

| 内容 | 没开改编站 | 开启改编站 |
| --- | --- | --- |
| **行内公式** <code>$...$</code> | 逐字符念错 / 跳过 | 按数学模式：<code>rules</code> 确定性规则 / <code>model</code> 模型口述 |
| **行间公式** <code>$$...$$</code> | 跳过 / 念错 | 口述稿：分式分母在前、根号、上下标、希腊字母、算子… |
| **含公式的整句** | 公式与正文各念一遍 | 整句一起出稿，杜绝重复朗读 |
| **表格** | 逐行念数字 | 表意描述：行列数、列名、首列、关键数值 |
| **代码块** | 逐行念代码 | 讲思路，而不是念源码 |
| **脚注 / 行内代码** | 噪声字符 | 清洗后朗读 |
| **化学式 / 物理单位** | 逐字母念 <code>\ce</code> | <code>\ce{H2SO4}</code> → 「氢 2 硫 氧 4」；<code>\pu{123 kJ/mol}</code> → 「123 千焦 每 摩尔」（内置确定性读法） |

> **屏幕阅读不受影响**：Markdown / LaTeX 原样保留，只对语音侧单独适配（所见即所送——拆出来的片段与界面渲染的是同一批）。

---

## 🔒 默认与上游一致：不开改编站 = 零 API Key、零外发

「语音改编站」**默认关闭**（<code>rewriteEnabled: false</code>）。不开启时：

- **不连接任何外部端点，不需要任何 API Key**；
- 行为与上游 <code>dsh-voice-mode</code> 完全一致（识别仍在本地推理）。

开启后需要一个 **OpenAI 兼容的改写端点**（默认智谱 <code>glm-4.5-air</code>，可换成任意兼容端点或本地网关），并把**待朗读的公式 / 表格 / 代码片段**发送给该端点。是否接受这种外发，由你决定。

---

## 🚀 安装

    git clone https://github.com/ranlinyi/dsh-voice-mode-adaptation.git
    cd dsh-voice-mode-adaptation

    # 装入 web profile（本地路径最稳妥；lib/ 构建产物随仓库提供，无需自行构建）
    dsh plugin --profile web add "$PWD/plugin/dsh-voice-mode"

    # 装插件 / 改源码后需重启 dsh web 才生效

> 详细步骤、推荐设置与排错见 **[语音改编站 · Quick Start](QUICKSTART-adaptation.md)**。

---

## ✨ 继承自上游的全双工对话能力

| 亮点 | 说明 |
| --- | --- |
| 🔒 **零 API Key · 识别本地** | 识别在宿主端本地推理（zipformer2 流式 + SenseVoice 定稿）；朗读默认 Edge 云端，本地 VITS / Kokoro 可选（隐私优先） |
| ⚡ **全双工对话** | 边说边出字、停顿自动发；AI 朗读时开口即打断 |
| 🗣️ **按句朗读 + 实时字幕** | 只读最终答复（跳过 reasoning / 工具调用），字幕跟随播放、可跳过 |
| 🎚️ **两种交互模式** | <code>toggle</code> 持续聆听自动断句 ｜ <code>hold</code> 按住说话、松手即发 |
| 🎧 **声学打断引擎** | 自适应阈值 barge-in + 回声门控（<code>bargeInMode</code>） |
| 🧩 **全版本兼容** | 同一份代码跑 dsh 0.1.1-rc.2 → 0.1.5-rc.2 |
| 🌐 **开箱即用** | 模型懒加载（断点续传 + 镜像回退）；界面语言随浏览器 |

![全双工语音体验（概念示意）](assets/voice-experience.png)

---

## ⚙️ 设置

**设置 → Plugins → 语音改编站**（命名空间 <code>voice-mode-adaptation</code>）。

### 语音改编站（本 fork 新增）

| 想调什么 | 键 | 默认 | 说明 |
| --- | --- | --- | --- |
| 总开关 | <code>rewriteEnabled</code> | <code>false</code> | 不开 = 不改写、不外发、不需要 Key |
| 数学模式 | <code>mathMode</code> | <code>rules</code> | <code>rules</code> 确定性规则 / <code>model</code> 交模型 / <code>verbatim</code> 原样 |
| 改写端点 | <code>rewriteBaseUrl</code> | 智谱 v4 | 任意 OpenAI 兼容端点 |
| 改写模型 | <code>rewriteModel</code> | <code>glm-4.5-air</code> | |
| 密钥引用 | <code>rewriteApiKeyRef</code> | 空 | 只填引用名；真实 Key 用「写入密钥」进 DSH 凭据库 |
| 整句出稿 | <code>wholeSentenceMath</code> | <code>true</code> | 含公式的整句整体出稿，避免重复朗读 |
| 段落停顿 | <code>blockPauseMs</code> | <code>350</code> | 段落 / 标题之间的停顿毫秒 |
| 守卫档位 | <code>guardMode</code> | <code>standard</code> | <code>standard</code> / <code>lenient</code> / <code>strict</code> / <code>off</code> |
| 多音字表 | <code>pronunciationFixes</code> | 「行 háng」词表 | 文本层同音替换（Edge 不支持 SSML） |

> 启用改编站后，设置面板还会显示**累计 token 消耗**（请求数 / 输入 / 输出 / 合计；进程内累计、可一键清零），方便估算外部模型的费用。

### 继承自上游

| 想调什么 | 键 | 默认 | 说明 |
| --- | --- | --- | --- |
| 朗读引擎 | <code>ttsEngine</code> | <code>edge</code> | <code>edge</code> 云端 / <code>vits</code> 本地中文 / <code>kokoro</code> 本地中英 / <code>azure</code> 付费云端（SSML 音素）；即时生效 |
| 模型精度 | <code>kokoroModel</code> | <code>int8</code> | <code>int8</code> 109MB / <code>fp32</code> 311MB 音质更好 |
| 音色 / 语速 | <code>voice</code> / <code>rate</code> | <code>zh-CN-XiaoxiaoNeural</code> / <code>1.0</code> | 行内可试听 |
| 打断方式 | <code>bargeInMode</code> | <code>auto</code> | 外放建议 <code>manual</code>，避免回声自打断 |
| 停顿自动发送 | <code>silenceMs</code> / <code>autoSend</code> | <code>1500</code> / <code>true</code> | |
| 交互模式 | <code>mode</code> | <code>toggle</code> | |
| 保留 Markdown 的朗读提示 | <code>spokenFormat</code> | <code>false</code> | 开启后注入「保留 Markdown/LaTeX」提示词 |
| 模型镜像 | <code>modelHost</code> | 默认源 | 国内填 <code>https://hf-mirror.com</code> |

### 可选：Azure 付费朗读引擎（音素级多音字）

Edge 免费端点**不支持任何音素级 SSML**，多音字只能靠文本替代表。需要精确纠音时，可把朗读引擎切成 **Azure 云端（付费）**（在设置里排在 Edge 之后；**只有选中它，才会出现下面这几项**）：

| 设置项 | 键 | 说明 |
| --- | --- | --- |
| Azure 端点 | <code>azureEndpoint</code> | 填区域名（如 <code>eastasia</code>），或完整链接 <code>https://&lt;region&gt;.tts.speech.microsoft.com</code> |
| Azure 密钥引用 | <code>azureKeyRef</code> | 只填引用名（如 <code>AZURE_SPEECH_KEY</code>）；真实密钥经「写入 Azure 密钥」存入 **DSH 凭据库**，不落配置文件明文 |
| Azure 多音字拼音表 | <code>azurePhonemes</code> | 每行「词 => 拼音」，如 <code>行 => hang2</code>、<code>银行 => yin2 hang2</code>；经 SSML <code>&lt;phoneme alphabet="sapi"&gt;</code> 精确发音 |

- 音色沿用上面的「音色」选择（Azure 与 Edge 使用相同的 ShortName）；
- **默认仍是 Edge**：不切 Azure 就零 API Key、零外发；
- 切到 Azure 后，被朗读文本会发送到**你自己的** Azure 语音资源。

> 完整设置、音色表与 schema 见 [插件详细文档](plugin/dsh-voice-mode/README.md)。

---

## 📦 功能全景

- **语音改编站**：公式 / 表格 / 代码 / 脚注的非普通文本适配；行内 + 行间混合公式；化学式与物理单位确定性读法
- **朗读**：Edge 云端（默认）/ 本地 VITS / Kokoro（中英混读）/ Azure 付费云端（SSML 音素），独立子进程、崩溃自愈
- **流式识别**：zipformer2 流式 + SenseVoice 定稿
- **开口即打断**：自适应阈值 + 朗读时自动超灵敏
- **模型预热 + 懒下载**：断点续传 + 镜像回退
- **安全加固**：会话校验 / 回环 + Origin 校验 / 限流 / 模型 SHA256 固定

### 架构总览

![dsh-voice-mode-adaptation 架构图](assets/architecture.png)

---

## 🛠️ 故障排查

| 现象 | 处理 |
| --- | --- |
| 点了没反应 / 改了源码不生效 | 重启 <code>dsh web</code>；前端改完要强刷（Ctrl+Shift+R） |
| 化学式显示成红色报错 | DSH 自带 KaTeX 未加载 mhchem；本 fork 朗读侧已支持，渲染侧见 Quick Start 常见问题第 10 条 |
| 状态条「正在加载模型… x%」卡住 | 检查网络；国内把 <code>modelHost</code> 配 <code>https://hf-mirror.com</code> |
| 外放时总被自己打断 | <code>bargeInMode</code> 改为 <code>manual</code>，或戴耳机 |
| 公式没走模型 | 检查 <code>mathMode</code>、<code>rewriteEnabled</code> 与 Key |
| 语音模式进不去 | 检查插件 <code>enabled</code>；多标签页确认当前为活动会话 |

> **已知限制**：Edge 免费端点不支持音素级 SSML，多音字只能走文本替代表；需要精确纠音可切 **Azure** 引擎（见上文）。Safari / iOS 需 HTTPS 或 localhost。

---

## 📚 文档

| 文档 | 说明 |
| --- | --- |
| [语音改编站 · Quick Start](QUICKSTART-adaptation.md) | 安装、首次配置、推荐设置、验证与排错 |
| [插件详细文档](plugin/dsh-voice-mode/README.md) | 上游完整功能 / 手势 / 设置 / 配置 |
| [English docs](plugin/dsh-voice-mode/README.en.md) | Same, in English |

## 来源与许可

- 上游：[qishuilalala/dsh-voice-mode](https://github.com/qishuilalala/dsh-voice-mode)（MIT）
- 本 fork：[ranlinyi/dsh-voice-mode-adaptation](https://github.com/ranlinyi/dsh-voice-mode-adaptation)
- 许可：[MIT](LICENSE) —— 保留上游版权与署名；本 fork 的改动同样以 MIT 发布。

> 部分实现借鉴 [haoku123/dsh-voice](https://github.com/haoku123/dsh-voice)。
