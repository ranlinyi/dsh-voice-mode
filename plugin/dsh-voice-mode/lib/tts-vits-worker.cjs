"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/tts-vits-worker.ts
var import_sherpa_onnx = __toESM(require("sherpa-onnx"), 1);
var import_sherpa_onnx_node = __toESM(require("sherpa-onnx-node"), 1);

// src/segmenter.ts
function sanitizeForTts(text) {
  return String(text).replace(/[*_#>`|^=+~]/g, " ").replace(/\s{2,}/g, " ").replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, "$1").trim();
}
var DEFAULT_PRONUNCIATION_TABLE = String.raw`
# 多音字：行(háng)。注意不要写单字「行 => 航」，那会让"进行/不行"变成"进航/不航"。
行业 => 航业
行列 => 航列
行内 => 航内
行间 => 航间
行号 => 航号
行数 => 航数
行距 => 航距
行高 => 航高
行宽 => 航宽
行首 => 航首
行末 => 航末
行尾 => 航尾
行会 => 航会
行情 => 航情
行家 => 航家
银行 => 银航
内行 => 内航
外行 => 外航
逐行 => 逐航
多行 => 多航
单行 => 单航
跨行 => 跨航
首行 => 首航
末行 => 末航
该行 => 该航
本行 => 本航
每行 => 每航
几行 => 几航
一行 => 一航
两行 => 两航
# 正则：带数字/量词的行号（第 3 行 / 第 12 行）
/第\s*([0-9一二三四五六七八九十百千万]+)\s*行/ => 第$1航
/([0-9]+\s*)行/ => $1航
`.trim();

// src/tts-vits-worker.ts
var { createOfflineTts } = import_sherpa_onnx.default;
var { OfflineTts, GenerationConfig } = import_sherpa_onnx_node.default;
var send = (msg) => {
  if (typeof process.send === "function") process.send(msg);
};
var wasmTts = null;
var nativeTts = null;
var initKind = "vits";
var initPaths = {};
function createEngine() {
  if (initKind === "kokoro") {
    nativeTts = new OfflineTts({
      model: {
        kokoro: {
          model: initPaths.model,
          voices: initPaths.voices,
          tokens: initPaths.tokens,
          dataDir: initPaths.dataDir,
          lexicon: initPaths.lexicon
        },
        // 2 线程：留核给主进程的 ASR 解码（4 线程满核会饿死识别，
        // 打断后定稿等待分钟级；2 线程 RTF≈1 仍实时）。
        numThreads: 2,
        debug: 0,
        provider: "cpu"
      },
      // 中文数字/日期/电话规范化（与 VITS 同源 FST）：阿拉伯数字按中文读。
      ruleFsts: [initPaths.date, initPaths.phone, initPaths.number].filter(Boolean).join(","),
      maxNumSentences: 1
    });
    return;
  }
  wasmTts = createOfflineTts({
    model: {
      vits: {
        model: initPaths.model,
        lexicon: initPaths.lexicon,
        tokens: initPaths.tokens
      },
      numThreads: 1,
      debug: 0,
      provider: "cpu"
    },
    ruleFsts: [initPaths.date, initPaths.phone, initPaths.number].join(","),
    ruleFars: "",
    maxNumSentences: 1
  });
}
function reply(id, payload) {
  send({ id: typeof id === "number" ? id : 0, ...payload });
}
process.on("message", (msg) => {
  try {
    if (msg.type === "init") {
      initKind = msg.kind === "kokoro" ? "kokoro" : "vits";
      initPaths = msg.paths;
      createEngine();
      reply(msg.id, { ok: true });
      return;
    }
    if (msg.type === "synth") {
      const text = sanitizeForTts(
        String(msg.text ?? "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, " ").replace(/(\d)[.．]\s*/g, "$1\u3001")
      );
      if (!text.trim()) {
        const sr = 24e3;
        reply(msg.id, {
          ok: true,
          sampleRate: sr,
          samples: Buffer.alloc(Math.floor(sr * 0.2) * 4).toString("base64")
        });
        return;
      }
      const sid = Number(msg.sid ?? 0);
      const speed = Number(msg.speed ?? 1);
      let audio;
      if (initKind === "kokoro") {
        if (!nativeTts) {
          reply(msg.id, { ok: false, error: "tts child not initialized" });
          return;
        }
        const gc = new GenerationConfig({ sid, speed, silenceScale: 0.2 });
        audio = nativeTts.generate({ text, generationConfig: gc });
      } else {
        if (!wasmTts) {
          reply(msg.id, { ok: false, error: "tts child not initialized" });
          return;
        }
        audio = wasmTts.generate({ text, sid, speed });
      }
      const buf = Buffer.from(audio.samples.buffer, audio.samples.byteOffset, audio.samples.byteLength);
      reply(msg.id, { ok: true, sampleRate: audio.sampleRate, samples: buf.toString("base64") });
      return;
    }
    if (msg.type === "close") {
      try {
        wasmTts?.free();
      } catch {
      }
      try {
        nativeTts?.free();
      } catch {
      }
      wasmTts = null;
      nativeTts = null;
      reply(msg.id, { ok: true });
      return;
    }
    reply(msg.id, { ok: false, error: `unknown message type: ${String(msg.type)}` });
  } catch (e) {
    reply(typeof msg?.id === "number" ? msg.id : 0, { ok: false, error: String(e) });
  }
});
