var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all2) => {
  for (var name2 in all2)
    __defProp(target, name2, { get: all2[name2], enumerable: true });
};
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

// node_modules/extend/index.js
var require_extend = __commonJS({
  "node_modules/extend/index.js"(exports, module) {
    "use strict";
    var hasOwn = Object.prototype.hasOwnProperty;
    var toStr = Object.prototype.toString;
    var defineProperty = Object.defineProperty;
    var gOPD = Object.getOwnPropertyDescriptor;
    var isArray = function isArray2(arr) {
      if (typeof Array.isArray === "function") {
        return Array.isArray(arr);
      }
      return toStr.call(arr) === "[object Array]";
    };
    var isPlainObject2 = function isPlainObject3(obj) {
      if (!obj || toStr.call(obj) !== "[object Object]") {
        return false;
      }
      var hasOwnConstructor = hasOwn.call(obj, "constructor");
      var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, "isPrototypeOf");
      if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
        return false;
      }
      var key;
      for (key in obj) {
      }
      return typeof key === "undefined" || hasOwn.call(obj, key);
    };
    var setProperty = function setProperty2(target, options) {
      if (defineProperty && options.name === "__proto__") {
        defineProperty(target, options.name, {
          enumerable: true,
          configurable: true,
          value: options.newValue,
          writable: true
        });
      } else {
        target[options.name] = options.newValue;
      }
    };
    var getProperty = function getProperty2(obj, name2) {
      if (name2 === "__proto__") {
        if (!hasOwn.call(obj, name2)) {
          return void 0;
        } else if (gOPD) {
          return gOPD(obj, name2).value;
        }
      }
      return obj[name2];
    };
    module.exports = function extend2() {
      var options, name2, src, copy, copyIsArray, clone;
      var target = arguments[0];
      var i = 1;
      var length = arguments.length;
      var deep = false;
      if (typeof target === "boolean") {
        deep = target;
        target = arguments[1] || {};
        i = 2;
      }
      if (target == null || typeof target !== "object" && typeof target !== "function") {
        target = {};
      }
      for (; i < length; ++i) {
        options = arguments[i];
        if (options != null) {
          for (name2 in options) {
            src = getProperty(target, name2);
            copy = getProperty(options, name2);
            if (target !== copy) {
              if (deep && copy && (isPlainObject2(copy) || (copyIsArray = isArray(copy)))) {
                if (copyIsArray) {
                  copyIsArray = false;
                  clone = src && isArray(src) ? src : [];
                } else {
                  clone = src && isPlainObject2(src) ? src : {};
                }
                setProperty(target, { name: name2, newValue: extend2(deep, clone, copy) });
              } else if (typeof copy !== "undefined") {
                setProperty(target, { name: name2, newValue: copy });
              }
            }
          }
        }
      }
      return target;
    };
  }
});

// src/index.ts
import z from "@deepseek-ai/schemastery";
import { join as join4 } from "node:path";
import { homedir } from "node:os";
import { rm } from "node:fs/promises";

// src/asr-host.ts
import { statSync } from "node:fs";
import { stat as stat2 } from "node:fs/promises";
import { join as join2 } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

// src/sense-worker.ts
import { parentPort, workerData } from "node:worker_threads";
function createSenseWorkerClient(worker) {
  let counter = 0;
  const pending = /* @__PURE__ */ new Map();
  let dead = false;
  const deathFns = /* @__PURE__ */ new Set();
  const die = () => {
    if (dead) return;
    dead = true;
    for (const fn of deathFns) {
      try {
        fn();
      } catch {
      }
    }
  };
  worker.on?.("message", (msg) => {
    const p = pending.get(msg?.id);
    if (!p) return;
    pending.delete(msg.id);
    if (!msg.ok) {
      p.resolve(null);
      return;
    }
    p.resolve(p.op === "create" ? true : msg.text ?? "");
  });
  worker.on?.("error", (e) => {
    die();
    const err = new Error("sense worker error: " + String(e?.message ?? e));
    for (const [, p] of pending) p.reject(err);
    pending.clear();
  });
  worker.on?.("exit", () => {
    die();
    const err = new Error("sense worker exited");
    for (const [, p] of pending) p.reject(err);
    pending.clear();
  });
  const request = (op, samples) => {
    if (dead) return Promise.reject(new Error("sense worker dead"));
    const id = counter++;
    return new Promise((resolve, reject) => {
      pending.set(id, { op, resolve, reject });
      const msg = { id, op };
      if (samples) msg.samples = samples;
      try {
        worker.postMessage(msg);
      } catch (e) {
        pending.delete(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  };
  return {
    request,
    onDeath(fn) {
      deathFns.add(fn);
    },
    terminate: async () => {
      dead = true;
      const err = new Error("sense worker terminated");
      for (const [, p] of pending) p.reject(err);
      pending.clear();
      try {
        await worker.terminate?.();
      } catch {
      }
    }
  };
}
function startSenseWorker(data) {
  const port = parentPort;
  if (!port) return;
  let recognizer = null;
  let sherpa = null;
  port.on("message", async (msg) => {
    try {
      if (msg.op === "create" || msg.op === "decode") {
        if (!sherpa) {
          sherpa = await import(data.sherpaModule);
        }
        if (!recognizer) {
          recognizer = sherpa.createOfflineRecognizer({
            featConfig: { sampleRate: 16e3, featureDim: 80 },
            modelConfig: {
              senseVoice: {
                model: data.modelDir + "/model.int8.onnx",
                language: "auto",
                useInverseTextNormalization: 1
              },
              tokens: data.modelDir + "/tokens.txt",
              provider: "cpu",
              debug: 0
            }
          });
        }
        if (msg.op === "decode" && msg.samples) {
          const stream = recognizer.createStream();
          try {
            stream.acceptWaveform(16e3, msg.samples);
            recognizer.decode(stream);
            const text5 = recognizer.getResult(stream).text.trim();
            port.postMessage({ id: msg.id, ok: true, text: text5 });
          } finally {
            try {
              stream.free();
            } catch {
            }
          }
          return;
        }
        port.postMessage({ id: msg.id, ok: true, text: "" });
        return;
      }
      port.postMessage({ id: msg.id, ok: false, error: "unknown op: " + msg.op });
    } catch (e) {
      port.postMessage({ id: msg.id, ok: false, error: String(e) });
    }
  });
}
if (parentPort) {
  startSenseWorker(workerData);
}

// src/asr-host.ts
import sherpa_onnx from "sherpa-onnx";

// src/models.ts
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
var HOST_PRIMARY = "https://huggingface.co";
var HOST_FALLBACK = "https://hf-mirror.com";
var ALLOWED_MODEL_HOSTNAMES = ["huggingface.co", "hf.co", "hf-mirror.com"];
function validateModelHost(raw, allowCustomHost) {
  if (!raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const hostname = u.hostname.toLowerCase();
  if (!ALLOWED_MODEL_HOSTNAMES.includes(hostname) && !allowCustomHost) {
    return null;
  }
  return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}`;
}
function redirectHostAllowed(finalUrl, allowCustomHost) {
  try {
    const u = new URL(finalUrl);
    if (u.protocol !== "https:") return false;
    const hostname = u.hostname.toLowerCase();
    if (allowCustomHost) return true;
    return hostname === "huggingface.co" || hostname.endsWith(".huggingface.co") || hostname === "hf.co" || hostname.endsWith(".hf.co") || hostname === "hf-mirror.com" || hostname.endsWith(".hf-mirror.com");
  } catch {
    return false;
  }
}
async function sha256OfFile(path2) {
  const hash = createHash("sha256");
  const { createReadStream } = await import("node:fs");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(path2);
    stream.on("data", (c) => hash.update(c));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });
  return hash.digest("hex");
}
async function ensureModelFile(opts) {
  const { repo, repoDir, spec, primaryHost, allowCustomHost, broadcast } = opts;
  const localPath = join(repoDir, spec.file);
  const partPath = `${localPath}.part`;
  if ((await stat(localPath).catch(() => null))?.isFile()) {
    const ok3 = await sha256OfFile(localPath).catch(() => "") === spec.sha256;
    if (ok3) return true;
    await unlink(localPath).catch(() => void 0);
  }
  await mkdir(join(repoDir, spec.file.includes("/") ? spec.file.slice(0, spec.file.lastIndexOf("/")) : ""), {
    recursive: true
  }).catch(() => void 0);
  const hosts = [...new Set([primaryHost, HOST_PRIMARY, HOST_FALLBACK].filter(Boolean))];
  let lastError = "no upstream reachable";
  for (const host of hosts) {
    try {
      const done = await downloadVerified({ ...opts, host, partPath, localPath });
      if (done) return true;
    } catch (e) {
      lastError = String(e);
    }
  }
  broadcast("asr-error", { file: spec.file, reason: "checksum_or_download_failed", detail: lastError });
  return false;
}
async function downloadVerified(opts) {
  const { repo, spec, host, allowCustomHost, partPath, localPath, broadcast } = opts;
  const url = `${host}/${repo}/resolve/main/${spec.file}`;
  const partSt = await stat(partPath).catch(() => null);
  const resumeFrom = partSt?.isFile() ? partSt.size : 0;
  const headers = { "user-agent": "dsh-voice-mode-adaptation" };
  if (resumeFrom > 0) headers.range = `bytes=${resumeFrom}-`;
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!redirectHostAllowed(res.url, allowCustomHost)) return false;
  if (res.status === 416) {
    if (await sha256OfFile(partPath).catch(() => "") === spec.sha256) {
      await rename(partPath, localPath);
      return true;
    }
    await unlink(partPath).catch(() => void 0);
    return false;
  }
  if (res.status !== 200 && res.status !== 206) return false;
  const resume = res.status === 206 ? resumeFrom : 0;
  const total = Number(res.headers.get("content-length") ?? 0) + resume;
  const src = res.body;
  if (!src) return false;
  const sink = createWriteStream(partPath, resume > 0 ? { flags: "a" } : {});
  const reader = src.getReader();
  let received = resume;
  await new Promise((resolve, reject) => {
    sink.on("error", (e) => reject(e));
    sink.on("finish", () => resolve());
    void (async () => {
      try {
        for (; ; ) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (!sink.write(value)) {
            await new Promise((r) => sink.once("drain", r));
          }
          if (total > 0) {
            broadcast("asr-progress", {
              file: spec.file,
              percent: Math.min(100, Math.round(received / total * 100))
            });
          }
        }
        sink.end();
      } catch (e) {
        sink.destroy(e);
        reject(e);
      }
    })();
  });
  const actual = await sha256OfFile(partPath).catch(() => "");
  if (actual !== spec.sha256) {
    await unlink(partPath).catch(() => void 0);
    return false;
  }
  await rename(partPath, localPath);
  return true;
}
async function ensureModelTree(opts) {
  const { repo, repoDir, subdir, primaryHost, allowCustomHost, broadcast } = opts;
  const hosts = [...new Set([primaryHost, HOST_PRIMARY, HOST_FALLBACK].filter(Boolean))];
  const subRoot = join(repoDir, subdir);
  await mkdir(subRoot, { recursive: true }).catch(() => void 0);
  let tree = [];
  for (const host of hosts) {
    try {
      const res = await fetch(host + "/api/models/" + repo + "?blobs=true", { headers: { "user-agent": "dsh-voice-mode-adaptation" } });
      if (res.ok) {
        const j = await res.json();
        tree = (j.siblings ?? []).map((s) => s.rfilename ?? "").filter((f) => f.startsWith(subdir + "/") && f.length > 0);
        if (tree.length > 0) break;
      }
    } catch {
    }
  }
  if (tree.length === 0) return false;
  let allOk = true;
  let done = 0;
  const queue = [...tree];
  const worker = async () => {
    for (; ; ) {
      const rel = queue.shift();
      if (rel === void 0) return;
      const localPath = join(repoDir, rel);
      const partPath = localPath + ".part";
      if ((await stat(localPath).catch(() => null))?.isFile() && (await stat(localPath)).size > 0) {
        done++;
        continue;
      }
      await mkdir(join(repoDir, rel.slice(0, rel.lastIndexOf("/"))), { recursive: true }).catch(() => void 0);
      let ok3 = false;
      for (const host of hosts) {
        try {
          const url = host + "/" + repo + "/resolve/main/" + encodeURIComponent(rel);
          const res = await fetch(url, { headers: { "user-agent": "dsh-voice-mode-adaptation" }, redirect: "follow" });
          if (!redirectHostAllowed(res.url, allowCustomHost)) continue;
          if (res.status !== 200) continue;
          const sink = createWriteStream(partPath);
          const reader = res.body?.getReader();
          if (!reader) continue;
          let size = 0;
          await new Promise((resolve, reject) => {
            sink.on("error", reject);
            sink.on("finish", resolve);
            void (async () => {
              try {
                for (; ; ) {
                  const r = await reader.read();
                  if (r.done) break;
                  size += r.value.byteLength;
                  if (!sink.write(r.value)) await new Promise((r2) => sink.once("drain", r2));
                }
                sink.end();
              } catch (e) {
                sink.destroy(e);
                reject(e);
              }
            })();
          });
          if (size > 0) {
            await rename(partPath, localPath);
            ok3 = true;
            break;
          }
        } catch {
        }
      }
      if (ok3) {
        done++;
        broadcast("asr-progress", { file: rel, percent: Math.round(done / tree.length * 100) });
      } else {
        allOk = false;
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  return allOk;
}

// src/asr-host.ts
var { createOnlineRecognizer, createVad } = sherpa_onnx;
var MODEL_REPO = "csukuangfj/sherpa-onnx-streaming-zipformer-zh-int8-2025-06-30";
var MODEL_FILES = [
  { file: "encoder.int8.onnx", sha256: "5ac51e27981bb4dab01bb9be4958453ba50c3b61c063ddda0eab23fd3671aa4f" },
  { file: "decoder.onnx", sha256: "06522ad63cec0fdf6809f4e1db9bb4f7d710c34582e3b35db62ac60eccafac7e" },
  { file: "joiner.int8.onnx", sha256: "b34584dc6f561089e1d747fedebb3765f2caa72c927ef54d7ca55e5ae40a814b" },
  { file: "tokens.txt", sha256: "6193c7ea1c96d0d9a1e9652789b40d13a8a913b434a5451e93158f5a09fd6652" }
];
var VAD_REPO = "csukuangfj/vad";
var VAD_FILES = [
  { file: "silero_vad.onnx", sha256: "a35ebf52fd3ce5f1469b2a36158dba761bc47b973ea3382b3186ca15b1f5af28" }
];
var SENSE_REPO = "csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17";
var SENSE_FILES = [
  { file: "model.int8.onnx", sha256: "c71f0ce00bec95b07744e116345e33d8cbbe08cef896382cf907bf4b51a2cd51" },
  { file: "tokens.txt", sha256: "f449eb28dc567533d7fa59be34e2abca8784f771850c78a47fb731a31429a1dc" }
];
function pcmToSamples(buf) {
  if (buf.length % 4 !== 0) return null;
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}
var MAX_ASR_BYTES = 4 * 1024 * 1024;
var SEGMENT_IDLE_MS = 9e4;
var VAD_CONTINUE_RMS = 0.02;
var CONFIRM_CONJUNCTION_MS = 800;
var CONFIRM_LONG_SENTENCE_MS = 350;
var CONFIRM_LONG_SENTENCE_S = 8;
var CONFIRM_MIN_MS = 400;
var CONJUNCTION_TAIL = /(然后|还有|以及|并且|而且|此外|再说|接着|然后呢|比方说|比如说|比如|例如|等等|或者|或是|还有呢)$/;
function endpointConfirmMs(text5, spokenMs) {
  const tail = text5.trimEnd();
  if (CONJUNCTION_TAIL.test(tail)) return CONFIRM_CONJUNCTION_MS;
  if (spokenMs > CONFIRM_LONG_SENTENCE_S * 1e3) return CONFIRM_LONG_SENTENCE_MS;
  return 0;
}
function rmsOf(samples) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}
function createAsrRuntime(options) {
  const { cacheDir, modelHost, broadcast, senseVoice, silenceMs, allowCustomHost } = options;
  let lastProgress = null;
  const localBroadcast = (event, payload) => {
    if (event === "asr-progress") lastProgress = payload;
    broadcast(event, payload);
  };
  const repoDir = join2(cacheDir, MODEL_REPO);
  const vadDir = join2(cacheDir, VAD_REPO);
  const senseDir = join2(cacheDir, SENSE_REPO);
  const normalizedModelHost = () => validateModelHost(modelHost(), allowCustomHost) ?? HOST_PRIMARY;
  const segments = /* @__PURE__ */ new Map();
  const finalized = /* @__PURE__ */ new Map();
  const finalizing = /* @__PURE__ */ new Map();
  const resetGen = /* @__PURE__ */ new Map();
  let recognizer = null;
  let modelsReady = false;
  let modelsLoading = null;
  let asrFailAt = 0;
  const ensureModels = async () => {
    if (modelsReady) return true;
    if (Date.now() < asrFailAt) return false;
    if (!modelsLoading) {
      modelsLoading = (async () => {
        for (const f of MODEL_FILES) {
          if (!await ensureModelFile({ repo: MODEL_REPO, repoDir, spec: f, primaryHost: normalizedModelHost(), allowCustomHost, broadcast: localBroadcast })) {
            asrFailAt = Date.now() + 6e4;
            broadcast("asr-error", { file: f.file });
            return false;
          }
        }
        modelsReady = true;
        broadcast("asr-ready", {});
        return true;
      })().finally(() => {
        modelsLoading = null;
      });
    }
    return modelsLoading;
  };
  const getRecognizer = async () => {
    if (!await ensureModels()) return null;
    if (recognizer) return recognizer;
    const t = (f) => join2(repoDir, f);
    recognizer = createOnlineRecognizer({
      modelConfig: {
        transducer: {
          encoder: t("encoder.int8.onnx"),
          decoder: t("decoder.onnx"),
          joiner: t("joiner.int8.onnx")
        },
        tokens: t("tokens.txt"),
        numThreads: 4,
        provider: "cpu",
        debug: 0
      },
      decodingMethod: "greedy_search"
    });
    return recognizer;
  };
  let vadModelReady = false;
  let vadLoading = null;
  let vadFailAt = 0;
  const ensureVadModel = async () => {
    if (vadModelReady) return join2(vadDir, VAD_FILES[0].file);
    if (Date.now() < vadFailAt) return null;
    if (!vadLoading) {
      vadLoading = (async () => {
        for (const f of VAD_FILES) {
          if (!await ensureModelFile({ repo: VAD_REPO, repoDir: vadDir, spec: f, primaryHost: normalizedModelHost(), allowCustomHost, broadcast: localBroadcast })) {
            vadFailAt = Date.now() + 6e4;
            return null;
          }
        }
        vadModelReady = true;
        return join2(vadDir, VAD_FILES[0].file);
      })().finally(() => {
        vadLoading = null;
      });
    }
    return vadLoading;
  };
  const newVad = (vadPath, threshold = 0.5, minSilenceDuration = 0.5) => createVad({
    sileroVad: {
      model: vadPath,
      threshold,
      minSilenceDuration,
      minSpeechDuration: 0.25,
      maxSpeechDuration: 20,
      windowSize: 512
    },
    sampleRate: 16e3,
    numThreads: 1,
    provider: "cpu",
    debug: 0,
    bufferSizeInSeconds: 30
  });
  const ensureSessionVad = async (seg) => {
    if (seg.vad) return seg.vad;
    const vadPath = await ensureVadModel();
    if (!vadPath) return null;
    seg.vad = newVad(vadPath, 0.5, silenceMs() / 1e3);
    return seg.vad;
  };
  const detectVads = /* @__PURE__ */ new Map();
  const detectVadLastUse = /* @__PURE__ */ new Map();
  const ensureDetectVad = async (sessionId) => {
    const existing = detectVads.get(sessionId);
    if (existing) return existing;
    const vadPath = await ensureVadModel();
    if (!vadPath) return null;
    const vad = newVad(vadPath, 0.35);
    detectVads.set(sessionId, vad);
    return vad;
  };
  let senseModelReady = false;
  let senseLoading = null;
  let senseFailAt = 0;
  const ensureSenseModel = async () => {
    if (senseModelReady) return join2(senseDir, SENSE_FILES[0].file);
    if (Date.now() < senseFailAt) return null;
    if (!senseLoading) {
      senseLoading = (async () => {
        for (const f of SENSE_FILES) {
          if (!await ensureModelFile({ repo: SENSE_REPO, repoDir: senseDir, spec: f, primaryHost: normalizedModelHost(), allowCustomHost, broadcast: localBroadcast })) {
            senseFailAt = Date.now() + 6e4;
            return null;
          }
        }
        senseModelReady = true;
        return join2(senseDir, SENSE_FILES[0].file);
      })().finally(() => {
        senseLoading = null;
      });
    }
    return senseLoading;
  };
  let senseWorker = null;
  let senseWorkerSyncing = null;
  const getSenseWorker = async () => {
    if (!senseVoice()) return null;
    if (senseWorker) return senseWorker;
    if (senseWorkerSyncing) return senseWorkerSyncing;
    senseWorkerSyncing = (async () => {
      const sensePath = await ensureSenseModel();
      if (!sensePath) return null;
      try {
        const workerPath = fileURLToPath(new URL("./sense-worker.mjs", import.meta.url));
        const w = new Worker(workerPath, {
          workerData: { sherpaModule: "sherpa-onnx", modelDir: senseDir }
        });
        const client = createSenseWorkerClient(w);
        client.onDeath(() => {
          senseWorker = null;
          senseWorkerSyncing = null;
        });
        if (!await client.request("create")) {
          await client.terminate();
          return null;
        }
        senseWorker = client;
        return client;
      } catch (e) {
        console.warn("[dsh-voice-mode-adaptation] SenseVoice worker init failed: " + String(e));
        return null;
      }
    })().finally(() => {
      if (!senseWorker) senseWorkerSyncing = null;
    });
    return senseWorkerSyncing;
  };
  const senseTranscribe = async (allSamples) => {
    try {
      const worker = await getSenseWorker();
      if (!worker) return null;
      const total = allSamples.reduce((acc, c) => acc + c.length, 0);
      if (total === 0) return null;
      const buf = new Float32Array(total);
      let off = 0;
      for (const c of allSamples) {
        buf.set(c, off);
        off += c.length;
      }
      return await worker.request("decode", buf);
    } catch (e) {
      console.warn("[dsh-voice-mode-adaptation] SenseVoice re-transcribe failed: " + String(e));
      return null;
    }
  };
  const feed = async (sessionId, samples, final, offset = 0, epoch = 0) => {
    const rec = await getRecognizer();
    if (!rec) return { text: "", loading: true };
    if (!final && senseVoice()) {
      void getSenseWorker().catch(() => {
      });
    }
    let finMap = finalized.get(sessionId);
    const myGen = resetGen.get(sessionId) ?? 0;
    const cached = finMap?.get(epoch);
    if (cached !== void 0) return { text: cached };
    let sessSegs = segments.get(sessionId);
    if (!sessSegs) {
      sessSegs = /* @__PURE__ */ new Map();
      segments.set(sessionId, sessSegs);
    }
    let seg = sessSegs.get(epoch);
    if (!seg) {
      if (samples.length === 0 && final) return { text: "" };
      seg = { stream: rec.createStream(), fed: 0, vad: null, pendingEndpoint: null, lastText: "", allSamples: [], lastActivity: Date.now() };
      sessSegs.set(epoch, seg);
    }
    seg.lastActivity = Date.now();
    let endpoint = false;
    let text5 = "";
    let isSpeech;
    if (offset + samples.length > seg.fed) {
      const skip = Math.max(seg.fed - offset, 0);
      const inc = samples.subarray(skip);
      seg.stream.acceptWaveform(rec.config.featConfig.sampleRate, inc);
      seg.fed = offset + samples.length;
      if (seg.fed <= rec.config.featConfig.sampleRate * 60) seg.allSamples.push(inc);
      while (rec.isReady(seg.stream)) rec.decode(seg.stream);
      text5 = rec.getResult(seg.stream).text;
      seg.lastText = text5;
      if (!final) {
        const vad = await ensureSessionVad(seg);
        if (vad) {
          if (seg.pendingEndpoint) {
            const now = Date.now();
            const rms = rmsOf(inc);
            if (rms > VAD_CONTINUE_RMS) {
              seg.pendingEndpoint = null;
            } else if (now - seg.pendingEndpoint.at >= CONFIRM_MIN_MS && text5 === seg.pendingEndpoint.textAtPending) {
              seg.pendingEndpoint = null;
              endpoint = true;
            } else if (now - seg.pendingEndpoint.at >= seg.pendingEndpoint.confirmMs) {
              seg.pendingEndpoint = null;
              endpoint = true;
            }
          }
          vad.acceptWaveform(inc);
          isSpeech = vad.isDetected();
          if (!vad.isEmpty()) {
            let spokenMs = 0;
            while (!vad.isEmpty()) {
              const sp = vad.front();
              spokenMs = sp.samples.length / 16e3 * 1e3;
              vad.pop();
            }
            const confirmMs = endpointConfirmMs(seg.lastText, spokenMs);
            if (confirmMs <= 0) {
              endpoint = true;
            } else {
              seg.pendingEndpoint = { at: Date.now(), confirmMs, textAtPending: seg.lastText };
            }
          }
        }
      }
    }
    if (!final) return { text: text5, endpoint, isSpeech };
    const inflightMap = finalizing.get(sessionId);
    const inflightP = inflightMap?.get(epoch);
    if (inflightP) return { text: await inflightP };
    sessSegs.delete(epoch);
    if (sessSegs.size === 0) segments.delete(sessionId);
    const finalizeP = (async () => {
      const all2 = seg.allSamples;
      const senseP = all2.length > 0 ? Promise.race([
        senseTranscribe(all2),
        new Promise((resolve) => setTimeout(() => resolve(null), 1e4))
      ]) : Promise.resolve(null);
      const pad = new Float32Array(rec.config.featConfig.sampleRate / 2);
      seg.stream.acceptWaveform(rec.config.featConfig.sampleRate, pad);
      while (rec.isReady(seg.stream)) rec.decode(seg.stream);
      const settled = rec.getResult(seg.stream).text;
      try {
        seg.vad?.free?.();
      } catch {
      }
      seg.stream.free();
      const sense = await senseP;
      return (sense && sense.trim() ? sense : settled) || "";
    })().then((finalText) => {
      if ((resetGen.get(sessionId) ?? 0) !== myGen) return finalText;
      let fm = finalized.get(sessionId);
      if (!fm) {
        fm = /* @__PURE__ */ new Map();
        finalized.set(sessionId, fm);
      }
      fm.set(epoch, finalText);
      if (fm.size > 32) {
        const first = fm.keys().next().value;
        if (first !== void 0) fm.delete(first);
      }
      const ff = finalizing.get(sessionId);
      ff?.delete(epoch);
      if (ff && ff.size === 0) finalizing.delete(sessionId);
      return finalText;
    }).catch((e) => {
      const ff = finalizing.get(sessionId);
      ff?.delete(epoch);
      if (ff && ff.size === 0) finalizing.delete(sessionId);
      console.warn("[dsh-voice-mode-adaptation] finalize failed: " + String(e));
      return "";
    });
    if (!inflightMap) {
      finalizing.set(sessionId, /* @__PURE__ */ new Map());
    }
    finalizing.get(sessionId).set(epoch, finalizeP);
    return { text: await finalizeP };
  };
  const sweep = () => {
    const now = Date.now();
    for (const [sid, sessSegs] of segments) {
      for (const [epoch, s] of sessSegs) {
        if (now - s.lastActivity > SEGMENT_IDLE_MS) {
          try {
            s.vad?.free?.();
          } catch {
          }
          try {
            s.stream.free();
          } catch {
          }
          sessSegs.delete(epoch);
        }
      }
      if (sessSegs.size === 0) {
        segments.delete(sid);
        finalized.delete(sid);
      }
    }
    for (const [sid, at] of detectVadLastUse) {
      if (now - at > SEGMENT_IDLE_MS) {
        try {
          detectVads.get(sid)?.free?.();
        } catch {
        }
        detectVads.delete(sid);
        detectVadLastUse.delete(sid);
      }
    }
  };
  const sweepTimer = setInterval(sweep, 3e4);
  return {
    feed,
    detect: async (sessionId, samples) => {
      const vad = await ensureDetectVad(sessionId);
      if (!vad) return { isSpeech: false };
      detectVadLastUse.set(sessionId, Date.now());
      if (samples.length > 0) vad.acceptWaveform(samples);
      const speech = vad.isDetected();
      while (!vad.isEmpty()) vad.pop();
      return { isSpeech: speech };
    },
    reset: (sessionId) => {
      const sessSegs = segments.get(sessionId);
      if (sessSegs) {
        for (const [, s] of sessSegs) {
          try {
            s.vad?.free?.();
          } catch {
          }
          try {
            s.stream.free();
          } catch {
          }
        }
        segments.delete(sessionId);
      }
      finalized.delete(sessionId);
      resetGen.set(sessionId, (resetGen.get(sessionId) ?? 0) + 1);
      finalizing.delete(sessionId);
      const dv = detectVads.get(sessionId);
      if (dv) {
        try {
          dv.free?.();
        } catch {
        }
        detectVads.delete(sessionId);
      }
      detectVadLastUse.delete(sessionId);
    },
    dispose: () => {
      clearInterval(sweepTimer);
      let w = senseWorker;
      senseWorker = null;
      senseWorkerSyncing = null;
      if (w) void w.terminate();
      for (const [, sessSegs] of segments) {
        for (const [, s] of sessSegs) {
          try {
            s.vad?.free?.();
          } catch {
          }
          try {
            s.stream.free();
          } catch {
          }
        }
      }
      segments.clear();
      finalized.clear();
      finalizing.clear();
      resetGen.clear();
      try {
        recognizer?.free?.();
      } catch {
      }
      recognizer = null;
      for (const [, dv] of detectVads) {
        try {
          dv.free?.();
        } catch {
        }
      }
      detectVads.clear();
      detectVadLastUse.clear();
    },
    warmup: () => {
      void getRecognizer().catch(() => void 0);
      void ensureVadModel().catch(() => void 0);
      if (senseVoice()) void getSenseWorker().catch(() => void 0);
    },
    modelStatus: () => {
      const statFile = async (dir, repo, name2) => {
        const st = await stat2(join2(dir, repo, name2)).catch(() => null);
        return { exists: !!st?.isFile(), size: st?.size ?? 0 };
      };
      const asrFiles = MODEL_FILES.map((n) => ({
        name: n.file,
        exists: (() => {
          try {
            return statSync(join2(repoDir, n.file)).isFile();
          } catch {
            return false;
          }
        })(),
        size: (() => {
          try {
            return statSync(join2(repoDir, n.file)).size;
          } catch {
            return 0;
          }
        })()
      }));
      const vadSize = (() => {
        try {
          return statSync(join2(vadDir, VAD_FILES[0].file)).size;
        } catch {
          return 0;
        }
      })();
      const senseSize = (() => {
        try {
          return statSync(join2(senseDir, SENSE_FILES[0].file)).size;
        } catch {
          return 0;
        }
      })();
      return {
        // ready 语义 = 文件可用（exists），而非进程内是否已实例化——
        // 重启后文件齐全却显示「未下载」会误导用户（体验修复）。
        asr: {
          repo: MODEL_REPO,
          ready: asrFiles.every((f) => f.exists),
          files: asrFiles,
          failLatchMs: Math.max(0, asrFailAt - Date.now())
        },
        vad: {
          repo: VAD_REPO,
          ready: vadSize > 0,
          size: vadSize,
          failLatchMs: Math.max(0, vadFailAt - Date.now())
        },
        sense: {
          repo: SENSE_REPO,
          ready: senseSize > 0,
          size: senseSize,
          failLatchMs: Math.max(0, senseFailAt - Date.now()),
          enabled: senseVoice()
        },
        progress: lastProgress
      };
    },
    retryModel: async (kind) => {
      if (kind === "vad") {
        vadFailAt = 0;
        return !!await ensureVadModel();
      }
      if (kind === "sense") {
        if (!senseVoice()) return false;
        senseFailAt = 0;
        return !!await ensureSenseModel();
      }
      if (modelsReady) return true;
      asrFailAt = 0;
      return await ensureModels();
    }
  };
}
var respondJson = (res, status, payload) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
};
function handleAsrRequest(asr, activeSessionId, req, res) {
  const chunks = [];
  let received = 0;
  let tooLarge = false;
  req.on("data", (c) => {
    if (tooLarge) return;
    received += c.length;
    if (received > MAX_ASR_BYTES) {
      tooLarge = true;
      respondJson(res, 413, { error: "pcm payload too large" });
      return;
    }
    chunks.push(c);
  });
  req.on("end", () => {
    if (tooLarge) return;
    const url = new URL(req.url ?? "/", "http://localhost");
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const final = url.searchParams.get("final") === "1";
    const reset = url.searchParams.get("reset") === "1";
    const epochParam = url.searchParams.get("epoch");
    const epochN = Number(epochParam);
    const epochOK = epochParam === null || Number.isFinite(epochN) && epochN >= 0 && Number.isInteger(epochN);
    const offsetParam = url.searchParams.get("offset");
    const offsetOK = offsetParam === null || Number.isFinite(Number(offsetParam)) && Number(offsetParam) >= 0 && Number(offsetParam) <= MAX_ASR_BYTES / 4;
    if (!offsetOK) {
      respondJson(res, 400, { error: "invalid offset" });
      return;
    }
    if (!epochOK) {
      respondJson(res, 400, { error: "invalid epoch" });
      return;
    }
    const epoch = epochParam === null ? 0 : Math.floor(epochN);
    const offset = offsetParam === null ? 0 : Math.floor(Number(offsetParam));
    if (!sessionId || sessionId !== activeSessionId) {
      respondJson(res, 403, { error: "not the active voice session" });
      return;
    }
    if (reset) {
      asr.reset(sessionId);
      respondJson(res, 200, { ok: true });
      return;
    }
    const raw = Buffer.concat(chunks);
    const samples = raw.length === 0 ? final ? new Float32Array(0) : null : pcmToSamples(raw);
    if (!samples) {
      respondJson(res, 400, { error: "invalid pcm payload" });
      return;
    }
    if (url.searchParams.get("vadOnly") === "1") {
      void asr.detect(sessionId, samples).then((out) => {
        respondJson(res, 200, { isSpeech: out.isSpeech });
      }).catch((e) => {
        respondJson(res, 500, { error: String(e) });
      });
      return;
    }
    void asr.feed(sessionId, samples, final, offset, epoch).then((out) => {
      if (out.loading) {
        respondJson(res, 202, { loading: true });
        return;
      }
      const body = { text: out.text };
      if (out.endpoint) body.endpoint = true;
      if (out.isSpeech !== void 0) body.isSpeech = out.isSpeech;
      respondJson(res, 200, body);
    }).catch((e) => {
      respondJson(res, 500, { error: String(e) });
    });
  });
}

// node_modules/bail/index.js
function bail(error) {
  if (error) {
    throw error;
  }
}

// node_modules/unified/lib/index.js
var import_extend = __toESM(require_extend(), 1);

// node_modules/devlop/lib/default.js
function ok() {
}

// node_modules/is-plain-obj/index.js
function isPlainObject(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
}

// node_modules/trough/lib/index.js
function trough() {
  const fns = [];
  const pipeline = { run, use };
  return pipeline;
  function run(...values) {
    let middlewareIndex = -1;
    const callback = values.pop();
    if (typeof callback !== "function") {
      throw new TypeError("Expected function as last argument, not " + callback);
    }
    next(null, ...values);
    function next(error, ...output) {
      const fn = fns[++middlewareIndex];
      let index2 = -1;
      if (error) {
        callback(error);
        return;
      }
      while (++index2 < values.length) {
        if (output[index2] === null || output[index2] === void 0) {
          output[index2] = values[index2];
        }
      }
      values = output;
      if (fn) {
        wrap(fn, next)(...output);
      } else {
        callback(null, ...output);
      }
    }
  }
  function use(middelware) {
    if (typeof middelware !== "function") {
      throw new TypeError(
        "Expected `middelware` to be a function, not " + middelware
      );
    }
    fns.push(middelware);
    return pipeline;
  }
}
function wrap(middleware, callback) {
  let called;
  return wrapped;
  function wrapped(...parameters) {
    const fnExpectsCallback = middleware.length > parameters.length;
    let result;
    if (fnExpectsCallback) {
      parameters.push(done);
    }
    try {
      result = middleware.apply(this, parameters);
    } catch (error) {
      const exception = (
        /** @type {Error} */
        error
      );
      if (fnExpectsCallback && called) {
        throw exception;
      }
      return done(exception);
    }
    if (!fnExpectsCallback) {
      if (result && result.then && typeof result.then === "function") {
        result.then(then, done);
      } else if (result instanceof Error) {
        done(result);
      } else {
        then(result);
      }
    }
  }
  function done(error, ...output) {
    if (!called) {
      called = true;
      callback(error, ...output);
    }
  }
  function then(value) {
    done(null, value);
  }
}

// node_modules/unist-util-stringify-position/lib/index.js
function stringifyPosition(value) {
  if (!value || typeof value !== "object") {
    return "";
  }
  if ("position" in value || "type" in value) {
    return position(value.position);
  }
  if ("start" in value || "end" in value) {
    return position(value);
  }
  if ("line" in value || "column" in value) {
    return point(value);
  }
  return "";
}
function point(point3) {
  return index(point3 && point3.line) + ":" + index(point3 && point3.column);
}
function position(pos) {
  return point(pos && pos.start) + "-" + point(pos && pos.end);
}
function index(value) {
  return value && typeof value === "number" ? value : 1;
}

// node_modules/vfile-message/lib/index.js
var VFileMessage = class extends Error {
  /**
   * Create a message for `reason`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {Options | null | undefined} [options]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | Options | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns
   *   Instance of `VFileMessage`.
   */
  // eslint-disable-next-line complexity
  constructor(causeOrReason, optionsOrParentOrPlace, origin) {
    super();
    if (typeof optionsOrParentOrPlace === "string") {
      origin = optionsOrParentOrPlace;
      optionsOrParentOrPlace = void 0;
    }
    let reason = "";
    let options = {};
    let legacyCause = false;
    if (optionsOrParentOrPlace) {
      if ("line" in optionsOrParentOrPlace && "column" in optionsOrParentOrPlace) {
        options = { place: optionsOrParentOrPlace };
      } else if ("start" in optionsOrParentOrPlace && "end" in optionsOrParentOrPlace) {
        options = { place: optionsOrParentOrPlace };
      } else if ("type" in optionsOrParentOrPlace) {
        options = {
          ancestors: [optionsOrParentOrPlace],
          place: optionsOrParentOrPlace.position
        };
      } else {
        options = { ...optionsOrParentOrPlace };
      }
    }
    if (typeof causeOrReason === "string") {
      reason = causeOrReason;
    } else if (!options.cause && causeOrReason) {
      legacyCause = true;
      reason = causeOrReason.message;
      options.cause = causeOrReason;
    }
    if (!options.ruleId && !options.source && typeof origin === "string") {
      const index2 = origin.indexOf(":");
      if (index2 === -1) {
        options.ruleId = origin;
      } else {
        options.source = origin.slice(0, index2);
        options.ruleId = origin.slice(index2 + 1);
      }
    }
    if (!options.place && options.ancestors && options.ancestors) {
      const parent = options.ancestors[options.ancestors.length - 1];
      if (parent) {
        options.place = parent.position;
      }
    }
    const start = options.place && "start" in options.place ? options.place.start : options.place;
    this.ancestors = options.ancestors || void 0;
    this.cause = options.cause || void 0;
    this.column = start ? start.column : void 0;
    this.fatal = void 0;
    this.file = "";
    this.message = reason;
    this.line = start ? start.line : void 0;
    this.name = stringifyPosition(options.place) || "1:1";
    this.place = options.place || void 0;
    this.reason = this.message;
    this.ruleId = options.ruleId || void 0;
    this.source = options.source || void 0;
    this.stack = legacyCause && options.cause && typeof options.cause.stack === "string" ? options.cause.stack : "";
    this.actual = void 0;
    this.expected = void 0;
    this.note = void 0;
    this.url = void 0;
  }
};
VFileMessage.prototype.file = "";
VFileMessage.prototype.name = "";
VFileMessage.prototype.reason = "";
VFileMessage.prototype.message = "";
VFileMessage.prototype.stack = "";
VFileMessage.prototype.column = void 0;
VFileMessage.prototype.line = void 0;
VFileMessage.prototype.ancestors = void 0;
VFileMessage.prototype.cause = void 0;
VFileMessage.prototype.fatal = void 0;
VFileMessage.prototype.place = void 0;
VFileMessage.prototype.ruleId = void 0;
VFileMessage.prototype.source = void 0;

// node_modules/vfile/lib/minpath.js
import { default as default2 } from "node:path";

// node_modules/vfile/lib/minproc.js
import { default as default3 } from "node:process";

// node_modules/vfile/lib/minurl.js
import { fileURLToPath as fileURLToPath2 } from "node:url";

// node_modules/vfile/lib/minurl.shared.js
function isUrl(fileUrlOrPath) {
  return Boolean(
    fileUrlOrPath !== null && typeof fileUrlOrPath === "object" && "href" in fileUrlOrPath && fileUrlOrPath.href && "protocol" in fileUrlOrPath && fileUrlOrPath.protocol && // @ts-expect-error: indexing is fine.
    fileUrlOrPath.auth === void 0
  );
}

// node_modules/vfile/lib/index.js
var order = (
  /** @type {const} */
  [
    "history",
    "path",
    "basename",
    "stem",
    "extname",
    "dirname"
  ]
);
var VFile = class {
  /**
   * Create a new virtual file.
   *
   * `options` is treated as:
   *
   * *   `string` or `Uint8Array` — `{value: options}`
   * *   `URL` — `{path: options}`
   * *   `VFile` — shallow copies its data over to the new file
   * *   `object` — all fields are shallow copied over to the new file
   *
   * Path related fields are set in the following order (least specific to
   * most specific): `history`, `path`, `basename`, `stem`, `extname`,
   * `dirname`.
   *
   * You cannot set `dirname` or `extname` without setting either `history`,
   * `path`, `basename`, or `stem` too.
   *
   * @param {Compatible | null | undefined} [value]
   *   File value.
   * @returns
   *   New instance.
   */
  constructor(value) {
    let options;
    if (!value) {
      options = {};
    } else if (isUrl(value)) {
      options = { path: value };
    } else if (typeof value === "string" || isUint8Array(value)) {
      options = { value };
    } else {
      options = value;
    }
    this.cwd = "cwd" in options ? "" : default3.cwd();
    this.data = {};
    this.history = [];
    this.messages = [];
    this.value;
    this.map;
    this.result;
    this.stored;
    let index2 = -1;
    while (++index2 < order.length) {
      const field2 = order[index2];
      if (field2 in options && options[field2] !== void 0 && options[field2] !== null) {
        this[field2] = field2 === "history" ? [...options[field2]] : options[field2];
      }
    }
    let field;
    for (field in options) {
      if (!order.includes(field)) {
        this[field] = options[field];
      }
    }
  }
  /**
   * Get the basename (including extname) (example: `'index.min.js'`).
   *
   * @returns {string | undefined}
   *   Basename.
   */
  get basename() {
    return typeof this.path === "string" ? default2.basename(this.path) : void 0;
  }
  /**
   * Set basename (including extname) (`'index.min.js'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be nullified (use `file.path = file.dirname` instead).
   *
   * @param {string} basename
   *   Basename.
   * @returns {undefined}
   *   Nothing.
   */
  set basename(basename) {
    assertNonEmpty(basename, "basename");
    assertPart(basename, "basename");
    this.path = default2.join(this.dirname || "", basename);
  }
  /**
   * Get the parent path (example: `'~'`).
   *
   * @returns {string | undefined}
   *   Dirname.
   */
  get dirname() {
    return typeof this.path === "string" ? default2.dirname(this.path) : void 0;
  }
  /**
   * Set the parent path (example: `'~'`).
   *
   * Cannot be set if there’s no `path` yet.
   *
   * @param {string | undefined} dirname
   *   Dirname.
   * @returns {undefined}
   *   Nothing.
   */
  set dirname(dirname2) {
    assertPath(this.basename, "dirname");
    this.path = default2.join(dirname2 || "", this.basename);
  }
  /**
   * Get the extname (including dot) (example: `'.js'`).
   *
   * @returns {string | undefined}
   *   Extname.
   */
  get extname() {
    return typeof this.path === "string" ? default2.extname(this.path) : void 0;
  }
  /**
   * Set the extname (including dot) (example: `'.js'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be set if there’s no `path` yet.
   *
   * @param {string | undefined} extname
   *   Extname.
   * @returns {undefined}
   *   Nothing.
   */
  set extname(extname) {
    assertPart(extname, "extname");
    assertPath(this.dirname, "extname");
    if (extname) {
      if (extname.codePointAt(0) !== 46) {
        throw new Error("`extname` must start with `.`");
      }
      if (extname.includes(".", 1)) {
        throw new Error("`extname` cannot contain multiple dots");
      }
    }
    this.path = default2.join(this.dirname, this.stem + (extname || ""));
  }
  /**
   * Get the full path (example: `'~/index.min.js'`).
   *
   * @returns {string}
   *   Path.
   */
  get path() {
    return this.history[this.history.length - 1];
  }
  /**
   * Set the full path (example: `'~/index.min.js'`).
   *
   * Cannot be nullified.
   * You can set a file URL (a `URL` object with a `file:` protocol) which will
   * be turned into a path with `url.fileURLToPath`.
   *
   * @param {URL | string} path
   *   Path.
   * @returns {undefined}
   *   Nothing.
   */
  set path(path2) {
    if (isUrl(path2)) {
      path2 = fileURLToPath2(path2);
    }
    assertNonEmpty(path2, "path");
    if (this.path !== path2) {
      this.history.push(path2);
    }
  }
  /**
   * Get the stem (basename w/o extname) (example: `'index.min'`).
   *
   * @returns {string | undefined}
   *   Stem.
   */
  get stem() {
    return typeof this.path === "string" ? default2.basename(this.path, this.extname) : void 0;
  }
  /**
   * Set the stem (basename w/o extname) (example: `'index.min'`).
   *
   * Cannot contain path separators (`'/'` on unix, macOS, and browsers, `'\'`
   * on windows).
   * Cannot be nullified (use `file.path = file.dirname` instead).
   *
   * @param {string} stem
   *   Stem.
   * @returns {undefined}
   *   Nothing.
   */
  set stem(stem) {
    assertNonEmpty(stem, "stem");
    assertPart(stem, "stem");
    this.path = default2.join(this.dirname || "", stem + (this.extname || ""));
  }
  // Normal prototypal methods.
  /**
   * Create a fatal message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `true` (error; file not usable)
   * and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {never}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {never}
   *   Never.
   * @throws {VFileMessage}
   *   Message.
   */
  fail(causeOrReason, optionsOrParentOrPlace, origin) {
    const message = this.message(causeOrReason, optionsOrParentOrPlace, origin);
    message.fatal = true;
    throw message;
  }
  /**
   * Create an info message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `undefined` (info; change
   * likely not needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  info(causeOrReason, optionsOrParentOrPlace, origin) {
    const message = this.message(causeOrReason, optionsOrParentOrPlace, origin);
    message.fatal = void 0;
    return message;
  }
  /**
   * Create a message for `reason` associated with the file.
   *
   * The `fatal` field of the message is set to `false` (warning; change may be
   * needed) and the `file` field is set to the current file path.
   * The message is added to the `messages` field on `file`.
   *
   * > 🪦 **Note**: also has obsolete signatures.
   *
   * @overload
   * @param {string} reason
   * @param {MessageOptions | null | undefined} [options]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {string} reason
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Node | NodeLike | null | undefined} parent
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {Point | Position | null | undefined} place
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @overload
   * @param {Error | VFileMessage} cause
   * @param {string | null | undefined} [origin]
   * @returns {VFileMessage}
   *
   * @param {Error | VFileMessage | string} causeOrReason
   *   Reason for message, should use markdown.
   * @param {Node | NodeLike | MessageOptions | Point | Position | string | null | undefined} [optionsOrParentOrPlace]
   *   Configuration (optional).
   * @param {string | null | undefined} [origin]
   *   Place in code where the message originates (example:
   *   `'my-package:my-rule'` or `'my-rule'`).
   * @returns {VFileMessage}
   *   Message.
   */
  message(causeOrReason, optionsOrParentOrPlace, origin) {
    const message = new VFileMessage(
      // @ts-expect-error: the overloads are fine.
      causeOrReason,
      optionsOrParentOrPlace,
      origin
    );
    if (this.path) {
      message.name = this.path + ":" + message.name;
      message.file = this.path;
    }
    message.fatal = false;
    this.messages.push(message);
    return message;
  }
  /**
   * Serialize the file.
   *
   * > **Note**: which encodings are supported depends on the engine.
   * > For info on Node.js, see:
   * > <https://nodejs.org/api/util.html#whatwg-supported-encodings>.
   *
   * @param {string | null | undefined} [encoding='utf8']
   *   Character encoding to understand `value` as when it’s a `Uint8Array`
   *   (default: `'utf-8'`).
   * @returns {string}
   *   Serialized file.
   */
  toString(encoding) {
    if (this.value === void 0) {
      return "";
    }
    if (typeof this.value === "string") {
      return this.value;
    }
    const decoder = new TextDecoder(encoding || void 0);
    return decoder.decode(this.value);
  }
};
function assertPart(part, name2) {
  if (part && part.includes(default2.sep)) {
    throw new Error(
      "`" + name2 + "` cannot be a path: did not expect `" + default2.sep + "`"
    );
  }
}
function assertNonEmpty(part, name2) {
  if (!part) {
    throw new Error("`" + name2 + "` cannot be empty");
  }
}
function assertPath(path2, name2) {
  if (!path2) {
    throw new Error("Setting `" + name2 + "` requires `path` to be set too");
  }
}
function isUint8Array(value) {
  return Boolean(
    value && typeof value === "object" && "byteLength" in value && "byteOffset" in value
  );
}

// node_modules/unified/lib/callable-instance.js
var CallableInstance = (
  /**
   * @type {new <Parameters extends Array<unknown>, Result>(property: string | symbol) => (...parameters: Parameters) => Result}
   */
  /** @type {unknown} */
  /**
   * @this {Function}
   * @param {string | symbol} property
   * @returns {(...parameters: Array<unknown>) => unknown}
   */
  (function(property) {
    const self = this;
    const constr = self.constructor;
    const proto = (
      /** @type {Record<string | symbol, Function>} */
      // Prototypes do exist.
      // type-coverage:ignore-next-line
      constr.prototype
    );
    const value = proto[property];
    const apply2 = function() {
      return value.apply(apply2, arguments);
    };
    Object.setPrototypeOf(apply2, proto);
    return apply2;
  })
);

// node_modules/unified/lib/index.js
var own = {}.hasOwnProperty;
var Processor = class _Processor extends CallableInstance {
  /**
   * Create a processor.
   */
  constructor() {
    super("copy");
    this.Compiler = void 0;
    this.Parser = void 0;
    this.attachers = [];
    this.compiler = void 0;
    this.freezeIndex = -1;
    this.frozen = void 0;
    this.namespace = {};
    this.parser = void 0;
    this.transformers = trough();
  }
  /**
   * Copy a processor.
   *
   * @deprecated
   *   This is a private internal method and should not be used.
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   New *unfrozen* processor ({@linkcode Processor}) that is
   *   configured to work the same as its ancestor.
   *   When the descendant processor is configured in the future it does not
   *   affect the ancestral processor.
   */
  copy() {
    const destination = (
      /** @type {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>} */
      new _Processor()
    );
    let index2 = -1;
    while (++index2 < this.attachers.length) {
      const attacher = this.attachers[index2];
      destination.use(...attacher);
    }
    destination.data((0, import_extend.default)(true, {}, this.namespace));
    return destination;
  }
  /**
   * Configure the processor with info available to all plugins.
   * Information is stored in an object.
   *
   * Typically, options can be given to a specific plugin, but sometimes it
   * makes sense to have information shared with several plugins.
   * For example, a list of HTML elements that are self-closing, which is
   * needed during all phases.
   *
   * > **Note**: setting information cannot occur on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * > **Note**: to register custom data in TypeScript, augment the
   * > {@linkcode Data} interface.
   *
   * @example
   *   This example show how to get and set info:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   const processor = unified().data('alpha', 'bravo')
   *
   *   processor.data('alpha') // => 'bravo'
   *
   *   processor.data() // => {alpha: 'bravo'}
   *
   *   processor.data({charlie: 'delta'})
   *
   *   processor.data() // => {charlie: 'delta'}
   *   ```
   *
   * @template {keyof Data} Key
   *
   * @overload
   * @returns {Data}
   *
   * @overload
   * @param {Data} dataset
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Key} key
   * @returns {Data[Key]}
   *
   * @overload
   * @param {Key} key
   * @param {Data[Key]} value
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @param {Data | Key} [key]
   *   Key to get or set, or entire dataset to set, or nothing to get the
   *   entire dataset (optional).
   * @param {Data[Key]} [value]
   *   Value to set (optional).
   * @returns {unknown}
   *   The current processor when setting, the value at `key` when getting, or
   *   the entire dataset when getting without key.
   */
  data(key, value) {
    if (typeof key === "string") {
      if (arguments.length === 2) {
        assertUnfrozen("data", this.frozen);
        this.namespace[key] = value;
        return this;
      }
      return own.call(this.namespace, key) && this.namespace[key] || void 0;
    }
    if (key) {
      assertUnfrozen("data", this.frozen);
      this.namespace = key;
      return this;
    }
    return this.namespace;
  }
  /**
   * Freeze a processor.
   *
   * Frozen processors are meant to be extended and not to be configured
   * directly.
   *
   * When a processor is frozen it cannot be unfrozen.
   * New processors working the same way can be created by calling the
   * processor.
   *
   * It’s possible to freeze processors explicitly by calling `.freeze()`.
   * Processors freeze automatically when `.parse()`, `.run()`, `.runSync()`,
   * `.stringify()`, `.process()`, or `.processSync()` are called.
   *
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   The current processor.
   */
  freeze() {
    if (this.frozen) {
      return this;
    }
    const self = (
      /** @type {Processor} */
      /** @type {unknown} */
      this
    );
    while (++this.freezeIndex < this.attachers.length) {
      const [attacher, ...options] = this.attachers[this.freezeIndex];
      if (options[0] === false) {
        continue;
      }
      if (options[0] === true) {
        options[0] = void 0;
      }
      const transformer = attacher.call(self, ...options);
      if (typeof transformer === "function") {
        this.transformers.use(transformer);
      }
    }
    this.frozen = true;
    this.freezeIndex = Number.POSITIVE_INFINITY;
    return this;
  }
  /**
   * Parse text to a syntax tree.
   *
   * > **Note**: `parse` freezes the processor if not already *frozen*.
   *
   * > **Note**: `parse` performs the parse phase, not the run phase or other
   * > phases.
   *
   * @param {Compatible | undefined} [file]
   *   file to parse (optional); typically `string` or `VFile`; any value
   *   accepted as `x` in `new VFile(x)`.
   * @returns {ParseTree extends undefined ? Node : ParseTree}
   *   Syntax tree representing `file`.
   */
  parse(file) {
    this.freeze();
    const realFile = vfile(file);
    const parser = this.parser || this.Parser;
    assertParser("parse", parser);
    return parser(String(realFile), realFile);
  }
  /**
   * Process the given file as configured on the processor.
   *
   * > **Note**: `process` freezes the processor if not already *frozen*.
   *
   * > **Note**: `process` performs the parse, run, and stringify phases.
   *
   * @overload
   * @param {Compatible | undefined} file
   * @param {ProcessCallback<VFileWithOutput<CompileResult>>} done
   * @returns {undefined}
   *
   * @overload
   * @param {Compatible | undefined} [file]
   * @returns {Promise<VFileWithOutput<CompileResult>>}
   *
   * @param {Compatible | undefined} [file]
   *   File (optional); typically `string` or `VFile`]; any value accepted as
   *   `x` in `new VFile(x)`.
   * @param {ProcessCallback<VFileWithOutput<CompileResult>> | undefined} [done]
   *   Callback (optional).
   * @returns {Promise<VFile> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise a promise, rejected with a fatal error or resolved with the
   *   processed file.
   *
   *   The parsed, transformed, and compiled value is available at
   *   `file.value` (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most
   *   > compilers return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  process(file, done) {
    const self = this;
    this.freeze();
    assertParser("process", this.parser || this.Parser);
    assertCompiler("process", this.compiler || this.Compiler);
    return done ? executor(void 0, done) : new Promise(executor);
    function executor(resolve, reject) {
      const realFile = vfile(file);
      const parseTree = (
        /** @type {HeadTree extends undefined ? Node : HeadTree} */
        /** @type {unknown} */
        self.parse(realFile)
      );
      self.run(parseTree, realFile, function(error, tree, file2) {
        if (error || !tree || !file2) {
          return realDone(error);
        }
        const compileTree = (
          /** @type {CompileTree extends undefined ? Node : CompileTree} */
          /** @type {unknown} */
          tree
        );
        const compileResult = self.stringify(compileTree, file2);
        if (looksLikeAValue(compileResult)) {
          file2.value = compileResult;
        } else {
          file2.result = compileResult;
        }
        realDone(
          error,
          /** @type {VFileWithOutput<CompileResult>} */
          file2
        );
      });
      function realDone(error, file2) {
        if (error || !file2) {
          reject(error);
        } else if (resolve) {
          resolve(file2);
        } else {
          ok(done, "`done` is defined if `resolve` is not");
          done(void 0, file2);
        }
      }
    }
  }
  /**
   * Process the given file as configured on the processor.
   *
   * An error is thrown if asynchronous transforms are configured.
   *
   * > **Note**: `processSync` freezes the processor if not already *frozen*.
   *
   * > **Note**: `processSync` performs the parse, run, and stringify phases.
   *
   * @param {Compatible | undefined} [file]
   *   File (optional); typically `string` or `VFile`; any value accepted as
   *   `x` in `new VFile(x)`.
   * @returns {VFileWithOutput<CompileResult>}
   *   The processed file.
   *
   *   The parsed, transformed, and compiled value is available at
   *   `file.value` (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most
   *   > compilers return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  processSync(file) {
    let complete = false;
    let result;
    this.freeze();
    assertParser("processSync", this.parser || this.Parser);
    assertCompiler("processSync", this.compiler || this.Compiler);
    this.process(file, realDone);
    assertDone("processSync", "process", complete);
    ok(result, "we either bailed on an error or have a tree");
    return result;
    function realDone(error, file2) {
      complete = true;
      bail(error);
      result = file2;
    }
  }
  /**
   * Run *transformers* on a syntax tree.
   *
   * > **Note**: `run` freezes the processor if not already *frozen*.
   *
   * > **Note**: `run` performs the run phase, not other phases.
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} file
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} done
   * @returns {undefined}
   *
   * @overload
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   * @param {Compatible | undefined} [file]
   * @returns {Promise<TailTree extends undefined ? Node : TailTree>}
   *
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   *   Tree to transform and inspect.
   * @param {(
   *   RunCallback<TailTree extends undefined ? Node : TailTree> |
   *   Compatible
   * )} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @param {RunCallback<TailTree extends undefined ? Node : TailTree>} [done]
   *   Callback (optional).
   * @returns {Promise<TailTree extends undefined ? Node : TailTree> | undefined}
   *   Nothing if `done` is given.
   *   Otherwise, a promise rejected with a fatal error or resolved with the
   *   transformed tree.
   */
  run(tree, file, done) {
    assertNode(tree);
    this.freeze();
    const transformers = this.transformers;
    if (!done && typeof file === "function") {
      done = file;
      file = void 0;
    }
    return done ? executor(void 0, done) : new Promise(executor);
    function executor(resolve, reject) {
      ok(
        typeof file !== "function",
        "`file` can\u2019t be a `done` anymore, we checked"
      );
      const realFile = vfile(file);
      transformers.run(tree, realFile, realDone);
      function realDone(error, outputTree, file2) {
        const resultingTree = (
          /** @type {TailTree extends undefined ? Node : TailTree} */
          outputTree || tree
        );
        if (error) {
          reject(error);
        } else if (resolve) {
          resolve(resultingTree);
        } else {
          ok(done, "`done` is defined if `resolve` is not");
          done(void 0, resultingTree, file2);
        }
      }
    }
  }
  /**
   * Run *transformers* on a syntax tree.
   *
   * An error is thrown if asynchronous transforms are configured.
   *
   * > **Note**: `runSync` freezes the processor if not already *frozen*.
   *
   * > **Note**: `runSync` performs the run phase, not other phases.
   *
   * @param {HeadTree extends undefined ? Node : HeadTree} tree
   *   Tree to transform and inspect.
   * @param {Compatible | undefined} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @returns {TailTree extends undefined ? Node : TailTree}
   *   Transformed tree.
   */
  runSync(tree, file) {
    let complete = false;
    let result;
    this.run(tree, file, realDone);
    assertDone("runSync", "run", complete);
    ok(result, "we either bailed on an error or have a tree");
    return result;
    function realDone(error, tree2) {
      bail(error);
      result = tree2;
      complete = true;
    }
  }
  /**
   * Compile a syntax tree.
   *
   * > **Note**: `stringify` freezes the processor if not already *frozen*.
   *
   * > **Note**: `stringify` performs the stringify phase, not the run phase
   * > or other phases.
   *
   * @param {CompileTree extends undefined ? Node : CompileTree} tree
   *   Tree to compile.
   * @param {Compatible | undefined} [file]
   *   File associated with `node` (optional); any value accepted as `x` in
   *   `new VFile(x)`.
   * @returns {CompileResult extends undefined ? Value : CompileResult}
   *   Textual representation of the tree (see note).
   *
   *   > **Note**: unified typically compiles by serializing: most compilers
   *   > return `string` (or `Uint8Array`).
   *   > Some compilers, such as the one configured with
   *   > [`rehype-react`][rehype-react], return other values (in this case, a
   *   > React tree).
   *   > If you’re using a compiler that doesn’t serialize, expect different
   *   > result values.
   *   >
   *   > To register custom results in TypeScript, add them to
   *   > {@linkcode CompileResultMap}.
   *
   *   [rehype-react]: https://github.com/rehypejs/rehype-react
   */
  stringify(tree, file) {
    this.freeze();
    const realFile = vfile(file);
    const compiler2 = this.compiler || this.Compiler;
    assertCompiler("stringify", compiler2);
    assertNode(tree);
    return compiler2(tree, realFile);
  }
  /**
   * Configure the processor to use a plugin, a list of usable values, or a
   * preset.
   *
   * If the processor is already using a plugin, the previous plugin
   * configuration is changed based on the options that are passed in.
   * In other words, the plugin is not added a second time.
   *
   * > **Note**: `use` cannot be called on *frozen* processors.
   * > Call the processor first to create a new unfrozen processor.
   *
   * @example
   *   There are many ways to pass plugins to `.use()`.
   *   This example gives an overview:
   *
   *   ```js
   *   import {unified} from 'unified'
   *
   *   unified()
   *     // Plugin with options:
   *     .use(pluginA, {x: true, y: true})
   *     // Passing the same plugin again merges configuration (to `{x: true, y: false, z: true}`):
   *     .use(pluginA, {y: false, z: true})
   *     // Plugins:
   *     .use([pluginB, pluginC])
   *     // Two plugins, the second with options:
   *     .use([pluginD, [pluginE, {}]])
   *     // Preset with plugins and settings:
   *     .use({plugins: [pluginF, [pluginG, {}]], settings: {position: false}})
   *     // Settings only:
   *     .use({settings: {position: false}})
   *   ```
   *
   * @template {Array<unknown>} [Parameters=[]]
   * @template {Node | string | undefined} [Input=undefined]
   * @template [Output=Input]
   *
   * @overload
   * @param {Preset | null | undefined} [preset]
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {PluggableList} list
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *
   * @overload
   * @param {Plugin<Parameters, Input, Output>} plugin
   * @param {...(Parameters | [boolean])} parameters
   * @returns {UsePlugin<ParseTree, HeadTree, TailTree, CompileTree, CompileResult, Input, Output>}
   *
   * @param {PluggableList | Plugin | Preset | null | undefined} value
   *   Usable value.
   * @param {...unknown} parameters
   *   Parameters, when a plugin is given as a usable value.
   * @returns {Processor<ParseTree, HeadTree, TailTree, CompileTree, CompileResult>}
   *   Current processor.
   */
  use(value, ...parameters) {
    const attachers = this.attachers;
    const namespace = this.namespace;
    assertUnfrozen("use", this.frozen);
    if (value === null || value === void 0) {
    } else if (typeof value === "function") {
      addPlugin(value, parameters);
    } else if (typeof value === "object") {
      if (Array.isArray(value)) {
        addList(value);
      } else {
        addPreset(value);
      }
    } else {
      throw new TypeError("Expected usable value, not `" + value + "`");
    }
    return this;
    function add(value2) {
      if (typeof value2 === "function") {
        addPlugin(value2, []);
      } else if (typeof value2 === "object") {
        if (Array.isArray(value2)) {
          const [plugin, ...parameters2] = (
            /** @type {PluginTuple<Array<unknown>>} */
            value2
          );
          addPlugin(plugin, parameters2);
        } else {
          addPreset(value2);
        }
      } else {
        throw new TypeError("Expected usable value, not `" + value2 + "`");
      }
    }
    function addPreset(result) {
      if (!("plugins" in result) && !("settings" in result)) {
        throw new Error(
          "Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither"
        );
      }
      addList(result.plugins);
      if (result.settings) {
        namespace.settings = (0, import_extend.default)(true, namespace.settings, result.settings);
      }
    }
    function addList(plugins) {
      let index2 = -1;
      if (plugins === null || plugins === void 0) {
      } else if (Array.isArray(plugins)) {
        while (++index2 < plugins.length) {
          const thing = plugins[index2];
          add(thing);
        }
      } else {
        throw new TypeError("Expected a list of plugins, not `" + plugins + "`");
      }
    }
    function addPlugin(plugin, parameters2) {
      let index2 = -1;
      let entryIndex = -1;
      while (++index2 < attachers.length) {
        if (attachers[index2][0] === plugin) {
          entryIndex = index2;
          break;
        }
      }
      if (entryIndex === -1) {
        attachers.push([plugin, ...parameters2]);
      } else if (parameters2.length > 0) {
        let [primary, ...rest] = parameters2;
        const currentPrimary = attachers[entryIndex][1];
        if (isPlainObject(currentPrimary) && isPlainObject(primary)) {
          primary = (0, import_extend.default)(true, currentPrimary, primary);
        }
        attachers[entryIndex] = [plugin, primary, ...rest];
      }
    }
  }
};
var unified = new Processor().freeze();
function assertParser(name2, value) {
  if (typeof value !== "function") {
    throw new TypeError("Cannot `" + name2 + "` without `parser`");
  }
}
function assertCompiler(name2, value) {
  if (typeof value !== "function") {
    throw new TypeError("Cannot `" + name2 + "` without `compiler`");
  }
}
function assertUnfrozen(name2, frozen) {
  if (frozen) {
    throw new Error(
      "Cannot call `" + name2 + "` on a frozen processor.\nCreate a new processor first, by calling it: use `processor()` instead of `processor`."
    );
  }
}
function assertNode(node2) {
  if (!isPlainObject(node2) || typeof node2.type !== "string") {
    throw new TypeError("Expected node, got `" + node2 + "`");
  }
}
function assertDone(name2, asyncName, complete) {
  if (!complete) {
    throw new Error(
      "`" + name2 + "` finished async. Use `" + asyncName + "` instead"
    );
  }
}
function vfile(value) {
  return looksLikeAVFile(value) ? value : new VFile(value);
}
function looksLikeAVFile(value) {
  return Boolean(
    value && typeof value === "object" && "message" in value && "messages" in value
  );
}
function looksLikeAValue(value) {
  return typeof value === "string" || isUint8Array2(value);
}
function isUint8Array2(value) {
  return Boolean(
    value && typeof value === "object" && "byteLength" in value && "byteOffset" in value
  );
}

// node_modules/mdast-util-to-string/lib/index.js
var emptyOptions = {};
function toString(value, options) {
  const settings = options || emptyOptions;
  const includeImageAlt = typeof settings.includeImageAlt === "boolean" ? settings.includeImageAlt : true;
  const includeHtml = typeof settings.includeHtml === "boolean" ? settings.includeHtml : true;
  return one(value, includeImageAlt, includeHtml);
}
function one(value, includeImageAlt, includeHtml) {
  if (node(value)) {
    if ("value" in value) {
      return value.type === "html" && !includeHtml ? "" : value.value;
    }
    if (includeImageAlt && "alt" in value && value.alt) {
      return value.alt;
    }
    if ("children" in value) {
      return all(value.children, includeImageAlt, includeHtml);
    }
  }
  if (Array.isArray(value)) {
    return all(value, includeImageAlt, includeHtml);
  }
  return "";
}
function all(values, includeImageAlt, includeHtml) {
  const result = [];
  let index2 = -1;
  while (++index2 < values.length) {
    result[index2] = one(values[index2], includeImageAlt, includeHtml);
  }
  return result.join("");
}
function node(value) {
  return Boolean(value && typeof value === "object");
}

// node_modules/character-entities/index.js
var characterEntities = {
  AElig: "\xC6",
  AMP: "&",
  Aacute: "\xC1",
  Abreve: "\u0102",
  Acirc: "\xC2",
  Acy: "\u0410",
  Afr: "\u{1D504}",
  Agrave: "\xC0",
  Alpha: "\u0391",
  Amacr: "\u0100",
  And: "\u2A53",
  Aogon: "\u0104",
  Aopf: "\u{1D538}",
  ApplyFunction: "\u2061",
  Aring: "\xC5",
  Ascr: "\u{1D49C}",
  Assign: "\u2254",
  Atilde: "\xC3",
  Auml: "\xC4",
  Backslash: "\u2216",
  Barv: "\u2AE7",
  Barwed: "\u2306",
  Bcy: "\u0411",
  Because: "\u2235",
  Bernoullis: "\u212C",
  Beta: "\u0392",
  Bfr: "\u{1D505}",
  Bopf: "\u{1D539}",
  Breve: "\u02D8",
  Bscr: "\u212C",
  Bumpeq: "\u224E",
  CHcy: "\u0427",
  COPY: "\xA9",
  Cacute: "\u0106",
  Cap: "\u22D2",
  CapitalDifferentialD: "\u2145",
  Cayleys: "\u212D",
  Ccaron: "\u010C",
  Ccedil: "\xC7",
  Ccirc: "\u0108",
  Cconint: "\u2230",
  Cdot: "\u010A",
  Cedilla: "\xB8",
  CenterDot: "\xB7",
  Cfr: "\u212D",
  Chi: "\u03A7",
  CircleDot: "\u2299",
  CircleMinus: "\u2296",
  CirclePlus: "\u2295",
  CircleTimes: "\u2297",
  ClockwiseContourIntegral: "\u2232",
  CloseCurlyDoubleQuote: "\u201D",
  CloseCurlyQuote: "\u2019",
  Colon: "\u2237",
  Colone: "\u2A74",
  Congruent: "\u2261",
  Conint: "\u222F",
  ContourIntegral: "\u222E",
  Copf: "\u2102",
  Coproduct: "\u2210",
  CounterClockwiseContourIntegral: "\u2233",
  Cross: "\u2A2F",
  Cscr: "\u{1D49E}",
  Cup: "\u22D3",
  CupCap: "\u224D",
  DD: "\u2145",
  DDotrahd: "\u2911",
  DJcy: "\u0402",
  DScy: "\u0405",
  DZcy: "\u040F",
  Dagger: "\u2021",
  Darr: "\u21A1",
  Dashv: "\u2AE4",
  Dcaron: "\u010E",
  Dcy: "\u0414",
  Del: "\u2207",
  Delta: "\u0394",
  Dfr: "\u{1D507}",
  DiacriticalAcute: "\xB4",
  DiacriticalDot: "\u02D9",
  DiacriticalDoubleAcute: "\u02DD",
  DiacriticalGrave: "`",
  DiacriticalTilde: "\u02DC",
  Diamond: "\u22C4",
  DifferentialD: "\u2146",
  Dopf: "\u{1D53B}",
  Dot: "\xA8",
  DotDot: "\u20DC",
  DotEqual: "\u2250",
  DoubleContourIntegral: "\u222F",
  DoubleDot: "\xA8",
  DoubleDownArrow: "\u21D3",
  DoubleLeftArrow: "\u21D0",
  DoubleLeftRightArrow: "\u21D4",
  DoubleLeftTee: "\u2AE4",
  DoubleLongLeftArrow: "\u27F8",
  DoubleLongLeftRightArrow: "\u27FA",
  DoubleLongRightArrow: "\u27F9",
  DoubleRightArrow: "\u21D2",
  DoubleRightTee: "\u22A8",
  DoubleUpArrow: "\u21D1",
  DoubleUpDownArrow: "\u21D5",
  DoubleVerticalBar: "\u2225",
  DownArrow: "\u2193",
  DownArrowBar: "\u2913",
  DownArrowUpArrow: "\u21F5",
  DownBreve: "\u0311",
  DownLeftRightVector: "\u2950",
  DownLeftTeeVector: "\u295E",
  DownLeftVector: "\u21BD",
  DownLeftVectorBar: "\u2956",
  DownRightTeeVector: "\u295F",
  DownRightVector: "\u21C1",
  DownRightVectorBar: "\u2957",
  DownTee: "\u22A4",
  DownTeeArrow: "\u21A7",
  Downarrow: "\u21D3",
  Dscr: "\u{1D49F}",
  Dstrok: "\u0110",
  ENG: "\u014A",
  ETH: "\xD0",
  Eacute: "\xC9",
  Ecaron: "\u011A",
  Ecirc: "\xCA",
  Ecy: "\u042D",
  Edot: "\u0116",
  Efr: "\u{1D508}",
  Egrave: "\xC8",
  Element: "\u2208",
  Emacr: "\u0112",
  EmptySmallSquare: "\u25FB",
  EmptyVerySmallSquare: "\u25AB",
  Eogon: "\u0118",
  Eopf: "\u{1D53C}",
  Epsilon: "\u0395",
  Equal: "\u2A75",
  EqualTilde: "\u2242",
  Equilibrium: "\u21CC",
  Escr: "\u2130",
  Esim: "\u2A73",
  Eta: "\u0397",
  Euml: "\xCB",
  Exists: "\u2203",
  ExponentialE: "\u2147",
  Fcy: "\u0424",
  Ffr: "\u{1D509}",
  FilledSmallSquare: "\u25FC",
  FilledVerySmallSquare: "\u25AA",
  Fopf: "\u{1D53D}",
  ForAll: "\u2200",
  Fouriertrf: "\u2131",
  Fscr: "\u2131",
  GJcy: "\u0403",
  GT: ">",
  Gamma: "\u0393",
  Gammad: "\u03DC",
  Gbreve: "\u011E",
  Gcedil: "\u0122",
  Gcirc: "\u011C",
  Gcy: "\u0413",
  Gdot: "\u0120",
  Gfr: "\u{1D50A}",
  Gg: "\u22D9",
  Gopf: "\u{1D53E}",
  GreaterEqual: "\u2265",
  GreaterEqualLess: "\u22DB",
  GreaterFullEqual: "\u2267",
  GreaterGreater: "\u2AA2",
  GreaterLess: "\u2277",
  GreaterSlantEqual: "\u2A7E",
  GreaterTilde: "\u2273",
  Gscr: "\u{1D4A2}",
  Gt: "\u226B",
  HARDcy: "\u042A",
  Hacek: "\u02C7",
  Hat: "^",
  Hcirc: "\u0124",
  Hfr: "\u210C",
  HilbertSpace: "\u210B",
  Hopf: "\u210D",
  HorizontalLine: "\u2500",
  Hscr: "\u210B",
  Hstrok: "\u0126",
  HumpDownHump: "\u224E",
  HumpEqual: "\u224F",
  IEcy: "\u0415",
  IJlig: "\u0132",
  IOcy: "\u0401",
  Iacute: "\xCD",
  Icirc: "\xCE",
  Icy: "\u0418",
  Idot: "\u0130",
  Ifr: "\u2111",
  Igrave: "\xCC",
  Im: "\u2111",
  Imacr: "\u012A",
  ImaginaryI: "\u2148",
  Implies: "\u21D2",
  Int: "\u222C",
  Integral: "\u222B",
  Intersection: "\u22C2",
  InvisibleComma: "\u2063",
  InvisibleTimes: "\u2062",
  Iogon: "\u012E",
  Iopf: "\u{1D540}",
  Iota: "\u0399",
  Iscr: "\u2110",
  Itilde: "\u0128",
  Iukcy: "\u0406",
  Iuml: "\xCF",
  Jcirc: "\u0134",
  Jcy: "\u0419",
  Jfr: "\u{1D50D}",
  Jopf: "\u{1D541}",
  Jscr: "\u{1D4A5}",
  Jsercy: "\u0408",
  Jukcy: "\u0404",
  KHcy: "\u0425",
  KJcy: "\u040C",
  Kappa: "\u039A",
  Kcedil: "\u0136",
  Kcy: "\u041A",
  Kfr: "\u{1D50E}",
  Kopf: "\u{1D542}",
  Kscr: "\u{1D4A6}",
  LJcy: "\u0409",
  LT: "<",
  Lacute: "\u0139",
  Lambda: "\u039B",
  Lang: "\u27EA",
  Laplacetrf: "\u2112",
  Larr: "\u219E",
  Lcaron: "\u013D",
  Lcedil: "\u013B",
  Lcy: "\u041B",
  LeftAngleBracket: "\u27E8",
  LeftArrow: "\u2190",
  LeftArrowBar: "\u21E4",
  LeftArrowRightArrow: "\u21C6",
  LeftCeiling: "\u2308",
  LeftDoubleBracket: "\u27E6",
  LeftDownTeeVector: "\u2961",
  LeftDownVector: "\u21C3",
  LeftDownVectorBar: "\u2959",
  LeftFloor: "\u230A",
  LeftRightArrow: "\u2194",
  LeftRightVector: "\u294E",
  LeftTee: "\u22A3",
  LeftTeeArrow: "\u21A4",
  LeftTeeVector: "\u295A",
  LeftTriangle: "\u22B2",
  LeftTriangleBar: "\u29CF",
  LeftTriangleEqual: "\u22B4",
  LeftUpDownVector: "\u2951",
  LeftUpTeeVector: "\u2960",
  LeftUpVector: "\u21BF",
  LeftUpVectorBar: "\u2958",
  LeftVector: "\u21BC",
  LeftVectorBar: "\u2952",
  Leftarrow: "\u21D0",
  Leftrightarrow: "\u21D4",
  LessEqualGreater: "\u22DA",
  LessFullEqual: "\u2266",
  LessGreater: "\u2276",
  LessLess: "\u2AA1",
  LessSlantEqual: "\u2A7D",
  LessTilde: "\u2272",
  Lfr: "\u{1D50F}",
  Ll: "\u22D8",
  Lleftarrow: "\u21DA",
  Lmidot: "\u013F",
  LongLeftArrow: "\u27F5",
  LongLeftRightArrow: "\u27F7",
  LongRightArrow: "\u27F6",
  Longleftarrow: "\u27F8",
  Longleftrightarrow: "\u27FA",
  Longrightarrow: "\u27F9",
  Lopf: "\u{1D543}",
  LowerLeftArrow: "\u2199",
  LowerRightArrow: "\u2198",
  Lscr: "\u2112",
  Lsh: "\u21B0",
  Lstrok: "\u0141",
  Lt: "\u226A",
  Map: "\u2905",
  Mcy: "\u041C",
  MediumSpace: "\u205F",
  Mellintrf: "\u2133",
  Mfr: "\u{1D510}",
  MinusPlus: "\u2213",
  Mopf: "\u{1D544}",
  Mscr: "\u2133",
  Mu: "\u039C",
  NJcy: "\u040A",
  Nacute: "\u0143",
  Ncaron: "\u0147",
  Ncedil: "\u0145",
  Ncy: "\u041D",
  NegativeMediumSpace: "\u200B",
  NegativeThickSpace: "\u200B",
  NegativeThinSpace: "\u200B",
  NegativeVeryThinSpace: "\u200B",
  NestedGreaterGreater: "\u226B",
  NestedLessLess: "\u226A",
  NewLine: "\n",
  Nfr: "\u{1D511}",
  NoBreak: "\u2060",
  NonBreakingSpace: "\xA0",
  Nopf: "\u2115",
  Not: "\u2AEC",
  NotCongruent: "\u2262",
  NotCupCap: "\u226D",
  NotDoubleVerticalBar: "\u2226",
  NotElement: "\u2209",
  NotEqual: "\u2260",
  NotEqualTilde: "\u2242\u0338",
  NotExists: "\u2204",
  NotGreater: "\u226F",
  NotGreaterEqual: "\u2271",
  NotGreaterFullEqual: "\u2267\u0338",
  NotGreaterGreater: "\u226B\u0338",
  NotGreaterLess: "\u2279",
  NotGreaterSlantEqual: "\u2A7E\u0338",
  NotGreaterTilde: "\u2275",
  NotHumpDownHump: "\u224E\u0338",
  NotHumpEqual: "\u224F\u0338",
  NotLeftTriangle: "\u22EA",
  NotLeftTriangleBar: "\u29CF\u0338",
  NotLeftTriangleEqual: "\u22EC",
  NotLess: "\u226E",
  NotLessEqual: "\u2270",
  NotLessGreater: "\u2278",
  NotLessLess: "\u226A\u0338",
  NotLessSlantEqual: "\u2A7D\u0338",
  NotLessTilde: "\u2274",
  NotNestedGreaterGreater: "\u2AA2\u0338",
  NotNestedLessLess: "\u2AA1\u0338",
  NotPrecedes: "\u2280",
  NotPrecedesEqual: "\u2AAF\u0338",
  NotPrecedesSlantEqual: "\u22E0",
  NotReverseElement: "\u220C",
  NotRightTriangle: "\u22EB",
  NotRightTriangleBar: "\u29D0\u0338",
  NotRightTriangleEqual: "\u22ED",
  NotSquareSubset: "\u228F\u0338",
  NotSquareSubsetEqual: "\u22E2",
  NotSquareSuperset: "\u2290\u0338",
  NotSquareSupersetEqual: "\u22E3",
  NotSubset: "\u2282\u20D2",
  NotSubsetEqual: "\u2288",
  NotSucceeds: "\u2281",
  NotSucceedsEqual: "\u2AB0\u0338",
  NotSucceedsSlantEqual: "\u22E1",
  NotSucceedsTilde: "\u227F\u0338",
  NotSuperset: "\u2283\u20D2",
  NotSupersetEqual: "\u2289",
  NotTilde: "\u2241",
  NotTildeEqual: "\u2244",
  NotTildeFullEqual: "\u2247",
  NotTildeTilde: "\u2249",
  NotVerticalBar: "\u2224",
  Nscr: "\u{1D4A9}",
  Ntilde: "\xD1",
  Nu: "\u039D",
  OElig: "\u0152",
  Oacute: "\xD3",
  Ocirc: "\xD4",
  Ocy: "\u041E",
  Odblac: "\u0150",
  Ofr: "\u{1D512}",
  Ograve: "\xD2",
  Omacr: "\u014C",
  Omega: "\u03A9",
  Omicron: "\u039F",
  Oopf: "\u{1D546}",
  OpenCurlyDoubleQuote: "\u201C",
  OpenCurlyQuote: "\u2018",
  Or: "\u2A54",
  Oscr: "\u{1D4AA}",
  Oslash: "\xD8",
  Otilde: "\xD5",
  Otimes: "\u2A37",
  Ouml: "\xD6",
  OverBar: "\u203E",
  OverBrace: "\u23DE",
  OverBracket: "\u23B4",
  OverParenthesis: "\u23DC",
  PartialD: "\u2202",
  Pcy: "\u041F",
  Pfr: "\u{1D513}",
  Phi: "\u03A6",
  Pi: "\u03A0",
  PlusMinus: "\xB1",
  Poincareplane: "\u210C",
  Popf: "\u2119",
  Pr: "\u2ABB",
  Precedes: "\u227A",
  PrecedesEqual: "\u2AAF",
  PrecedesSlantEqual: "\u227C",
  PrecedesTilde: "\u227E",
  Prime: "\u2033",
  Product: "\u220F",
  Proportion: "\u2237",
  Proportional: "\u221D",
  Pscr: "\u{1D4AB}",
  Psi: "\u03A8",
  QUOT: '"',
  Qfr: "\u{1D514}",
  Qopf: "\u211A",
  Qscr: "\u{1D4AC}",
  RBarr: "\u2910",
  REG: "\xAE",
  Racute: "\u0154",
  Rang: "\u27EB",
  Rarr: "\u21A0",
  Rarrtl: "\u2916",
  Rcaron: "\u0158",
  Rcedil: "\u0156",
  Rcy: "\u0420",
  Re: "\u211C",
  ReverseElement: "\u220B",
  ReverseEquilibrium: "\u21CB",
  ReverseUpEquilibrium: "\u296F",
  Rfr: "\u211C",
  Rho: "\u03A1",
  RightAngleBracket: "\u27E9",
  RightArrow: "\u2192",
  RightArrowBar: "\u21E5",
  RightArrowLeftArrow: "\u21C4",
  RightCeiling: "\u2309",
  RightDoubleBracket: "\u27E7",
  RightDownTeeVector: "\u295D",
  RightDownVector: "\u21C2",
  RightDownVectorBar: "\u2955",
  RightFloor: "\u230B",
  RightTee: "\u22A2",
  RightTeeArrow: "\u21A6",
  RightTeeVector: "\u295B",
  RightTriangle: "\u22B3",
  RightTriangleBar: "\u29D0",
  RightTriangleEqual: "\u22B5",
  RightUpDownVector: "\u294F",
  RightUpTeeVector: "\u295C",
  RightUpVector: "\u21BE",
  RightUpVectorBar: "\u2954",
  RightVector: "\u21C0",
  RightVectorBar: "\u2953",
  Rightarrow: "\u21D2",
  Ropf: "\u211D",
  RoundImplies: "\u2970",
  Rrightarrow: "\u21DB",
  Rscr: "\u211B",
  Rsh: "\u21B1",
  RuleDelayed: "\u29F4",
  SHCHcy: "\u0429",
  SHcy: "\u0428",
  SOFTcy: "\u042C",
  Sacute: "\u015A",
  Sc: "\u2ABC",
  Scaron: "\u0160",
  Scedil: "\u015E",
  Scirc: "\u015C",
  Scy: "\u0421",
  Sfr: "\u{1D516}",
  ShortDownArrow: "\u2193",
  ShortLeftArrow: "\u2190",
  ShortRightArrow: "\u2192",
  ShortUpArrow: "\u2191",
  Sigma: "\u03A3",
  SmallCircle: "\u2218",
  Sopf: "\u{1D54A}",
  Sqrt: "\u221A",
  Square: "\u25A1",
  SquareIntersection: "\u2293",
  SquareSubset: "\u228F",
  SquareSubsetEqual: "\u2291",
  SquareSuperset: "\u2290",
  SquareSupersetEqual: "\u2292",
  SquareUnion: "\u2294",
  Sscr: "\u{1D4AE}",
  Star: "\u22C6",
  Sub: "\u22D0",
  Subset: "\u22D0",
  SubsetEqual: "\u2286",
  Succeeds: "\u227B",
  SucceedsEqual: "\u2AB0",
  SucceedsSlantEqual: "\u227D",
  SucceedsTilde: "\u227F",
  SuchThat: "\u220B",
  Sum: "\u2211",
  Sup: "\u22D1",
  Superset: "\u2283",
  SupersetEqual: "\u2287",
  Supset: "\u22D1",
  THORN: "\xDE",
  TRADE: "\u2122",
  TSHcy: "\u040B",
  TScy: "\u0426",
  Tab: "	",
  Tau: "\u03A4",
  Tcaron: "\u0164",
  Tcedil: "\u0162",
  Tcy: "\u0422",
  Tfr: "\u{1D517}",
  Therefore: "\u2234",
  Theta: "\u0398",
  ThickSpace: "\u205F\u200A",
  ThinSpace: "\u2009",
  Tilde: "\u223C",
  TildeEqual: "\u2243",
  TildeFullEqual: "\u2245",
  TildeTilde: "\u2248",
  Topf: "\u{1D54B}",
  TripleDot: "\u20DB",
  Tscr: "\u{1D4AF}",
  Tstrok: "\u0166",
  Uacute: "\xDA",
  Uarr: "\u219F",
  Uarrocir: "\u2949",
  Ubrcy: "\u040E",
  Ubreve: "\u016C",
  Ucirc: "\xDB",
  Ucy: "\u0423",
  Udblac: "\u0170",
  Ufr: "\u{1D518}",
  Ugrave: "\xD9",
  Umacr: "\u016A",
  UnderBar: "_",
  UnderBrace: "\u23DF",
  UnderBracket: "\u23B5",
  UnderParenthesis: "\u23DD",
  Union: "\u22C3",
  UnionPlus: "\u228E",
  Uogon: "\u0172",
  Uopf: "\u{1D54C}",
  UpArrow: "\u2191",
  UpArrowBar: "\u2912",
  UpArrowDownArrow: "\u21C5",
  UpDownArrow: "\u2195",
  UpEquilibrium: "\u296E",
  UpTee: "\u22A5",
  UpTeeArrow: "\u21A5",
  Uparrow: "\u21D1",
  Updownarrow: "\u21D5",
  UpperLeftArrow: "\u2196",
  UpperRightArrow: "\u2197",
  Upsi: "\u03D2",
  Upsilon: "\u03A5",
  Uring: "\u016E",
  Uscr: "\u{1D4B0}",
  Utilde: "\u0168",
  Uuml: "\xDC",
  VDash: "\u22AB",
  Vbar: "\u2AEB",
  Vcy: "\u0412",
  Vdash: "\u22A9",
  Vdashl: "\u2AE6",
  Vee: "\u22C1",
  Verbar: "\u2016",
  Vert: "\u2016",
  VerticalBar: "\u2223",
  VerticalLine: "|",
  VerticalSeparator: "\u2758",
  VerticalTilde: "\u2240",
  VeryThinSpace: "\u200A",
  Vfr: "\u{1D519}",
  Vopf: "\u{1D54D}",
  Vscr: "\u{1D4B1}",
  Vvdash: "\u22AA",
  Wcirc: "\u0174",
  Wedge: "\u22C0",
  Wfr: "\u{1D51A}",
  Wopf: "\u{1D54E}",
  Wscr: "\u{1D4B2}",
  Xfr: "\u{1D51B}",
  Xi: "\u039E",
  Xopf: "\u{1D54F}",
  Xscr: "\u{1D4B3}",
  YAcy: "\u042F",
  YIcy: "\u0407",
  YUcy: "\u042E",
  Yacute: "\xDD",
  Ycirc: "\u0176",
  Ycy: "\u042B",
  Yfr: "\u{1D51C}",
  Yopf: "\u{1D550}",
  Yscr: "\u{1D4B4}",
  Yuml: "\u0178",
  ZHcy: "\u0416",
  Zacute: "\u0179",
  Zcaron: "\u017D",
  Zcy: "\u0417",
  Zdot: "\u017B",
  ZeroWidthSpace: "\u200B",
  Zeta: "\u0396",
  Zfr: "\u2128",
  Zopf: "\u2124",
  Zscr: "\u{1D4B5}",
  aacute: "\xE1",
  abreve: "\u0103",
  ac: "\u223E",
  acE: "\u223E\u0333",
  acd: "\u223F",
  acirc: "\xE2",
  acute: "\xB4",
  acy: "\u0430",
  aelig: "\xE6",
  af: "\u2061",
  afr: "\u{1D51E}",
  agrave: "\xE0",
  alefsym: "\u2135",
  aleph: "\u2135",
  alpha: "\u03B1",
  amacr: "\u0101",
  amalg: "\u2A3F",
  amp: "&",
  and: "\u2227",
  andand: "\u2A55",
  andd: "\u2A5C",
  andslope: "\u2A58",
  andv: "\u2A5A",
  ang: "\u2220",
  ange: "\u29A4",
  angle: "\u2220",
  angmsd: "\u2221",
  angmsdaa: "\u29A8",
  angmsdab: "\u29A9",
  angmsdac: "\u29AA",
  angmsdad: "\u29AB",
  angmsdae: "\u29AC",
  angmsdaf: "\u29AD",
  angmsdag: "\u29AE",
  angmsdah: "\u29AF",
  angrt: "\u221F",
  angrtvb: "\u22BE",
  angrtvbd: "\u299D",
  angsph: "\u2222",
  angst: "\xC5",
  angzarr: "\u237C",
  aogon: "\u0105",
  aopf: "\u{1D552}",
  ap: "\u2248",
  apE: "\u2A70",
  apacir: "\u2A6F",
  ape: "\u224A",
  apid: "\u224B",
  apos: "'",
  approx: "\u2248",
  approxeq: "\u224A",
  aring: "\xE5",
  ascr: "\u{1D4B6}",
  ast: "*",
  asymp: "\u2248",
  asympeq: "\u224D",
  atilde: "\xE3",
  auml: "\xE4",
  awconint: "\u2233",
  awint: "\u2A11",
  bNot: "\u2AED",
  backcong: "\u224C",
  backepsilon: "\u03F6",
  backprime: "\u2035",
  backsim: "\u223D",
  backsimeq: "\u22CD",
  barvee: "\u22BD",
  barwed: "\u2305",
  barwedge: "\u2305",
  bbrk: "\u23B5",
  bbrktbrk: "\u23B6",
  bcong: "\u224C",
  bcy: "\u0431",
  bdquo: "\u201E",
  becaus: "\u2235",
  because: "\u2235",
  bemptyv: "\u29B0",
  bepsi: "\u03F6",
  bernou: "\u212C",
  beta: "\u03B2",
  beth: "\u2136",
  between: "\u226C",
  bfr: "\u{1D51F}",
  bigcap: "\u22C2",
  bigcirc: "\u25EF",
  bigcup: "\u22C3",
  bigodot: "\u2A00",
  bigoplus: "\u2A01",
  bigotimes: "\u2A02",
  bigsqcup: "\u2A06",
  bigstar: "\u2605",
  bigtriangledown: "\u25BD",
  bigtriangleup: "\u25B3",
  biguplus: "\u2A04",
  bigvee: "\u22C1",
  bigwedge: "\u22C0",
  bkarow: "\u290D",
  blacklozenge: "\u29EB",
  blacksquare: "\u25AA",
  blacktriangle: "\u25B4",
  blacktriangledown: "\u25BE",
  blacktriangleleft: "\u25C2",
  blacktriangleright: "\u25B8",
  blank: "\u2423",
  blk12: "\u2592",
  blk14: "\u2591",
  blk34: "\u2593",
  block: "\u2588",
  bne: "=\u20E5",
  bnequiv: "\u2261\u20E5",
  bnot: "\u2310",
  bopf: "\u{1D553}",
  bot: "\u22A5",
  bottom: "\u22A5",
  bowtie: "\u22C8",
  boxDL: "\u2557",
  boxDR: "\u2554",
  boxDl: "\u2556",
  boxDr: "\u2553",
  boxH: "\u2550",
  boxHD: "\u2566",
  boxHU: "\u2569",
  boxHd: "\u2564",
  boxHu: "\u2567",
  boxUL: "\u255D",
  boxUR: "\u255A",
  boxUl: "\u255C",
  boxUr: "\u2559",
  boxV: "\u2551",
  boxVH: "\u256C",
  boxVL: "\u2563",
  boxVR: "\u2560",
  boxVh: "\u256B",
  boxVl: "\u2562",
  boxVr: "\u255F",
  boxbox: "\u29C9",
  boxdL: "\u2555",
  boxdR: "\u2552",
  boxdl: "\u2510",
  boxdr: "\u250C",
  boxh: "\u2500",
  boxhD: "\u2565",
  boxhU: "\u2568",
  boxhd: "\u252C",
  boxhu: "\u2534",
  boxminus: "\u229F",
  boxplus: "\u229E",
  boxtimes: "\u22A0",
  boxuL: "\u255B",
  boxuR: "\u2558",
  boxul: "\u2518",
  boxur: "\u2514",
  boxv: "\u2502",
  boxvH: "\u256A",
  boxvL: "\u2561",
  boxvR: "\u255E",
  boxvh: "\u253C",
  boxvl: "\u2524",
  boxvr: "\u251C",
  bprime: "\u2035",
  breve: "\u02D8",
  brvbar: "\xA6",
  bscr: "\u{1D4B7}",
  bsemi: "\u204F",
  bsim: "\u223D",
  bsime: "\u22CD",
  bsol: "\\",
  bsolb: "\u29C5",
  bsolhsub: "\u27C8",
  bull: "\u2022",
  bullet: "\u2022",
  bump: "\u224E",
  bumpE: "\u2AAE",
  bumpe: "\u224F",
  bumpeq: "\u224F",
  cacute: "\u0107",
  cap: "\u2229",
  capand: "\u2A44",
  capbrcup: "\u2A49",
  capcap: "\u2A4B",
  capcup: "\u2A47",
  capdot: "\u2A40",
  caps: "\u2229\uFE00",
  caret: "\u2041",
  caron: "\u02C7",
  ccaps: "\u2A4D",
  ccaron: "\u010D",
  ccedil: "\xE7",
  ccirc: "\u0109",
  ccups: "\u2A4C",
  ccupssm: "\u2A50",
  cdot: "\u010B",
  cedil: "\xB8",
  cemptyv: "\u29B2",
  cent: "\xA2",
  centerdot: "\xB7",
  cfr: "\u{1D520}",
  chcy: "\u0447",
  check: "\u2713",
  checkmark: "\u2713",
  chi: "\u03C7",
  cir: "\u25CB",
  cirE: "\u29C3",
  circ: "\u02C6",
  circeq: "\u2257",
  circlearrowleft: "\u21BA",
  circlearrowright: "\u21BB",
  circledR: "\xAE",
  circledS: "\u24C8",
  circledast: "\u229B",
  circledcirc: "\u229A",
  circleddash: "\u229D",
  cire: "\u2257",
  cirfnint: "\u2A10",
  cirmid: "\u2AEF",
  cirscir: "\u29C2",
  clubs: "\u2663",
  clubsuit: "\u2663",
  colon: ":",
  colone: "\u2254",
  coloneq: "\u2254",
  comma: ",",
  commat: "@",
  comp: "\u2201",
  compfn: "\u2218",
  complement: "\u2201",
  complexes: "\u2102",
  cong: "\u2245",
  congdot: "\u2A6D",
  conint: "\u222E",
  copf: "\u{1D554}",
  coprod: "\u2210",
  copy: "\xA9",
  copysr: "\u2117",
  crarr: "\u21B5",
  cross: "\u2717",
  cscr: "\u{1D4B8}",
  csub: "\u2ACF",
  csube: "\u2AD1",
  csup: "\u2AD0",
  csupe: "\u2AD2",
  ctdot: "\u22EF",
  cudarrl: "\u2938",
  cudarrr: "\u2935",
  cuepr: "\u22DE",
  cuesc: "\u22DF",
  cularr: "\u21B6",
  cularrp: "\u293D",
  cup: "\u222A",
  cupbrcap: "\u2A48",
  cupcap: "\u2A46",
  cupcup: "\u2A4A",
  cupdot: "\u228D",
  cupor: "\u2A45",
  cups: "\u222A\uFE00",
  curarr: "\u21B7",
  curarrm: "\u293C",
  curlyeqprec: "\u22DE",
  curlyeqsucc: "\u22DF",
  curlyvee: "\u22CE",
  curlywedge: "\u22CF",
  curren: "\xA4",
  curvearrowleft: "\u21B6",
  curvearrowright: "\u21B7",
  cuvee: "\u22CE",
  cuwed: "\u22CF",
  cwconint: "\u2232",
  cwint: "\u2231",
  cylcty: "\u232D",
  dArr: "\u21D3",
  dHar: "\u2965",
  dagger: "\u2020",
  daleth: "\u2138",
  darr: "\u2193",
  dash: "\u2010",
  dashv: "\u22A3",
  dbkarow: "\u290F",
  dblac: "\u02DD",
  dcaron: "\u010F",
  dcy: "\u0434",
  dd: "\u2146",
  ddagger: "\u2021",
  ddarr: "\u21CA",
  ddotseq: "\u2A77",
  deg: "\xB0",
  delta: "\u03B4",
  demptyv: "\u29B1",
  dfisht: "\u297F",
  dfr: "\u{1D521}",
  dharl: "\u21C3",
  dharr: "\u21C2",
  diam: "\u22C4",
  diamond: "\u22C4",
  diamondsuit: "\u2666",
  diams: "\u2666",
  die: "\xA8",
  digamma: "\u03DD",
  disin: "\u22F2",
  div: "\xF7",
  divide: "\xF7",
  divideontimes: "\u22C7",
  divonx: "\u22C7",
  djcy: "\u0452",
  dlcorn: "\u231E",
  dlcrop: "\u230D",
  dollar: "$",
  dopf: "\u{1D555}",
  dot: "\u02D9",
  doteq: "\u2250",
  doteqdot: "\u2251",
  dotminus: "\u2238",
  dotplus: "\u2214",
  dotsquare: "\u22A1",
  doublebarwedge: "\u2306",
  downarrow: "\u2193",
  downdownarrows: "\u21CA",
  downharpoonleft: "\u21C3",
  downharpoonright: "\u21C2",
  drbkarow: "\u2910",
  drcorn: "\u231F",
  drcrop: "\u230C",
  dscr: "\u{1D4B9}",
  dscy: "\u0455",
  dsol: "\u29F6",
  dstrok: "\u0111",
  dtdot: "\u22F1",
  dtri: "\u25BF",
  dtrif: "\u25BE",
  duarr: "\u21F5",
  duhar: "\u296F",
  dwangle: "\u29A6",
  dzcy: "\u045F",
  dzigrarr: "\u27FF",
  eDDot: "\u2A77",
  eDot: "\u2251",
  eacute: "\xE9",
  easter: "\u2A6E",
  ecaron: "\u011B",
  ecir: "\u2256",
  ecirc: "\xEA",
  ecolon: "\u2255",
  ecy: "\u044D",
  edot: "\u0117",
  ee: "\u2147",
  efDot: "\u2252",
  efr: "\u{1D522}",
  eg: "\u2A9A",
  egrave: "\xE8",
  egs: "\u2A96",
  egsdot: "\u2A98",
  el: "\u2A99",
  elinters: "\u23E7",
  ell: "\u2113",
  els: "\u2A95",
  elsdot: "\u2A97",
  emacr: "\u0113",
  empty: "\u2205",
  emptyset: "\u2205",
  emptyv: "\u2205",
  emsp13: "\u2004",
  emsp14: "\u2005",
  emsp: "\u2003",
  eng: "\u014B",
  ensp: "\u2002",
  eogon: "\u0119",
  eopf: "\u{1D556}",
  epar: "\u22D5",
  eparsl: "\u29E3",
  eplus: "\u2A71",
  epsi: "\u03B5",
  epsilon: "\u03B5",
  epsiv: "\u03F5",
  eqcirc: "\u2256",
  eqcolon: "\u2255",
  eqsim: "\u2242",
  eqslantgtr: "\u2A96",
  eqslantless: "\u2A95",
  equals: "=",
  equest: "\u225F",
  equiv: "\u2261",
  equivDD: "\u2A78",
  eqvparsl: "\u29E5",
  erDot: "\u2253",
  erarr: "\u2971",
  escr: "\u212F",
  esdot: "\u2250",
  esim: "\u2242",
  eta: "\u03B7",
  eth: "\xF0",
  euml: "\xEB",
  euro: "\u20AC",
  excl: "!",
  exist: "\u2203",
  expectation: "\u2130",
  exponentiale: "\u2147",
  fallingdotseq: "\u2252",
  fcy: "\u0444",
  female: "\u2640",
  ffilig: "\uFB03",
  fflig: "\uFB00",
  ffllig: "\uFB04",
  ffr: "\u{1D523}",
  filig: "\uFB01",
  fjlig: "fj",
  flat: "\u266D",
  fllig: "\uFB02",
  fltns: "\u25B1",
  fnof: "\u0192",
  fopf: "\u{1D557}",
  forall: "\u2200",
  fork: "\u22D4",
  forkv: "\u2AD9",
  fpartint: "\u2A0D",
  frac12: "\xBD",
  frac13: "\u2153",
  frac14: "\xBC",
  frac15: "\u2155",
  frac16: "\u2159",
  frac18: "\u215B",
  frac23: "\u2154",
  frac25: "\u2156",
  frac34: "\xBE",
  frac35: "\u2157",
  frac38: "\u215C",
  frac45: "\u2158",
  frac56: "\u215A",
  frac58: "\u215D",
  frac78: "\u215E",
  frasl: "\u2044",
  frown: "\u2322",
  fscr: "\u{1D4BB}",
  gE: "\u2267",
  gEl: "\u2A8C",
  gacute: "\u01F5",
  gamma: "\u03B3",
  gammad: "\u03DD",
  gap: "\u2A86",
  gbreve: "\u011F",
  gcirc: "\u011D",
  gcy: "\u0433",
  gdot: "\u0121",
  ge: "\u2265",
  gel: "\u22DB",
  geq: "\u2265",
  geqq: "\u2267",
  geqslant: "\u2A7E",
  ges: "\u2A7E",
  gescc: "\u2AA9",
  gesdot: "\u2A80",
  gesdoto: "\u2A82",
  gesdotol: "\u2A84",
  gesl: "\u22DB\uFE00",
  gesles: "\u2A94",
  gfr: "\u{1D524}",
  gg: "\u226B",
  ggg: "\u22D9",
  gimel: "\u2137",
  gjcy: "\u0453",
  gl: "\u2277",
  glE: "\u2A92",
  gla: "\u2AA5",
  glj: "\u2AA4",
  gnE: "\u2269",
  gnap: "\u2A8A",
  gnapprox: "\u2A8A",
  gne: "\u2A88",
  gneq: "\u2A88",
  gneqq: "\u2269",
  gnsim: "\u22E7",
  gopf: "\u{1D558}",
  grave: "`",
  gscr: "\u210A",
  gsim: "\u2273",
  gsime: "\u2A8E",
  gsiml: "\u2A90",
  gt: ">",
  gtcc: "\u2AA7",
  gtcir: "\u2A7A",
  gtdot: "\u22D7",
  gtlPar: "\u2995",
  gtquest: "\u2A7C",
  gtrapprox: "\u2A86",
  gtrarr: "\u2978",
  gtrdot: "\u22D7",
  gtreqless: "\u22DB",
  gtreqqless: "\u2A8C",
  gtrless: "\u2277",
  gtrsim: "\u2273",
  gvertneqq: "\u2269\uFE00",
  gvnE: "\u2269\uFE00",
  hArr: "\u21D4",
  hairsp: "\u200A",
  half: "\xBD",
  hamilt: "\u210B",
  hardcy: "\u044A",
  harr: "\u2194",
  harrcir: "\u2948",
  harrw: "\u21AD",
  hbar: "\u210F",
  hcirc: "\u0125",
  hearts: "\u2665",
  heartsuit: "\u2665",
  hellip: "\u2026",
  hercon: "\u22B9",
  hfr: "\u{1D525}",
  hksearow: "\u2925",
  hkswarow: "\u2926",
  hoarr: "\u21FF",
  homtht: "\u223B",
  hookleftarrow: "\u21A9",
  hookrightarrow: "\u21AA",
  hopf: "\u{1D559}",
  horbar: "\u2015",
  hscr: "\u{1D4BD}",
  hslash: "\u210F",
  hstrok: "\u0127",
  hybull: "\u2043",
  hyphen: "\u2010",
  iacute: "\xED",
  ic: "\u2063",
  icirc: "\xEE",
  icy: "\u0438",
  iecy: "\u0435",
  iexcl: "\xA1",
  iff: "\u21D4",
  ifr: "\u{1D526}",
  igrave: "\xEC",
  ii: "\u2148",
  iiiint: "\u2A0C",
  iiint: "\u222D",
  iinfin: "\u29DC",
  iiota: "\u2129",
  ijlig: "\u0133",
  imacr: "\u012B",
  image: "\u2111",
  imagline: "\u2110",
  imagpart: "\u2111",
  imath: "\u0131",
  imof: "\u22B7",
  imped: "\u01B5",
  in: "\u2208",
  incare: "\u2105",
  infin: "\u221E",
  infintie: "\u29DD",
  inodot: "\u0131",
  int: "\u222B",
  intcal: "\u22BA",
  integers: "\u2124",
  intercal: "\u22BA",
  intlarhk: "\u2A17",
  intprod: "\u2A3C",
  iocy: "\u0451",
  iogon: "\u012F",
  iopf: "\u{1D55A}",
  iota: "\u03B9",
  iprod: "\u2A3C",
  iquest: "\xBF",
  iscr: "\u{1D4BE}",
  isin: "\u2208",
  isinE: "\u22F9",
  isindot: "\u22F5",
  isins: "\u22F4",
  isinsv: "\u22F3",
  isinv: "\u2208",
  it: "\u2062",
  itilde: "\u0129",
  iukcy: "\u0456",
  iuml: "\xEF",
  jcirc: "\u0135",
  jcy: "\u0439",
  jfr: "\u{1D527}",
  jmath: "\u0237",
  jopf: "\u{1D55B}",
  jscr: "\u{1D4BF}",
  jsercy: "\u0458",
  jukcy: "\u0454",
  kappa: "\u03BA",
  kappav: "\u03F0",
  kcedil: "\u0137",
  kcy: "\u043A",
  kfr: "\u{1D528}",
  kgreen: "\u0138",
  khcy: "\u0445",
  kjcy: "\u045C",
  kopf: "\u{1D55C}",
  kscr: "\u{1D4C0}",
  lAarr: "\u21DA",
  lArr: "\u21D0",
  lAtail: "\u291B",
  lBarr: "\u290E",
  lE: "\u2266",
  lEg: "\u2A8B",
  lHar: "\u2962",
  lacute: "\u013A",
  laemptyv: "\u29B4",
  lagran: "\u2112",
  lambda: "\u03BB",
  lang: "\u27E8",
  langd: "\u2991",
  langle: "\u27E8",
  lap: "\u2A85",
  laquo: "\xAB",
  larr: "\u2190",
  larrb: "\u21E4",
  larrbfs: "\u291F",
  larrfs: "\u291D",
  larrhk: "\u21A9",
  larrlp: "\u21AB",
  larrpl: "\u2939",
  larrsim: "\u2973",
  larrtl: "\u21A2",
  lat: "\u2AAB",
  latail: "\u2919",
  late: "\u2AAD",
  lates: "\u2AAD\uFE00",
  lbarr: "\u290C",
  lbbrk: "\u2772",
  lbrace: "{",
  lbrack: "[",
  lbrke: "\u298B",
  lbrksld: "\u298F",
  lbrkslu: "\u298D",
  lcaron: "\u013E",
  lcedil: "\u013C",
  lceil: "\u2308",
  lcub: "{",
  lcy: "\u043B",
  ldca: "\u2936",
  ldquo: "\u201C",
  ldquor: "\u201E",
  ldrdhar: "\u2967",
  ldrushar: "\u294B",
  ldsh: "\u21B2",
  le: "\u2264",
  leftarrow: "\u2190",
  leftarrowtail: "\u21A2",
  leftharpoondown: "\u21BD",
  leftharpoonup: "\u21BC",
  leftleftarrows: "\u21C7",
  leftrightarrow: "\u2194",
  leftrightarrows: "\u21C6",
  leftrightharpoons: "\u21CB",
  leftrightsquigarrow: "\u21AD",
  leftthreetimes: "\u22CB",
  leg: "\u22DA",
  leq: "\u2264",
  leqq: "\u2266",
  leqslant: "\u2A7D",
  les: "\u2A7D",
  lescc: "\u2AA8",
  lesdot: "\u2A7F",
  lesdoto: "\u2A81",
  lesdotor: "\u2A83",
  lesg: "\u22DA\uFE00",
  lesges: "\u2A93",
  lessapprox: "\u2A85",
  lessdot: "\u22D6",
  lesseqgtr: "\u22DA",
  lesseqqgtr: "\u2A8B",
  lessgtr: "\u2276",
  lesssim: "\u2272",
  lfisht: "\u297C",
  lfloor: "\u230A",
  lfr: "\u{1D529}",
  lg: "\u2276",
  lgE: "\u2A91",
  lhard: "\u21BD",
  lharu: "\u21BC",
  lharul: "\u296A",
  lhblk: "\u2584",
  ljcy: "\u0459",
  ll: "\u226A",
  llarr: "\u21C7",
  llcorner: "\u231E",
  llhard: "\u296B",
  lltri: "\u25FA",
  lmidot: "\u0140",
  lmoust: "\u23B0",
  lmoustache: "\u23B0",
  lnE: "\u2268",
  lnap: "\u2A89",
  lnapprox: "\u2A89",
  lne: "\u2A87",
  lneq: "\u2A87",
  lneqq: "\u2268",
  lnsim: "\u22E6",
  loang: "\u27EC",
  loarr: "\u21FD",
  lobrk: "\u27E6",
  longleftarrow: "\u27F5",
  longleftrightarrow: "\u27F7",
  longmapsto: "\u27FC",
  longrightarrow: "\u27F6",
  looparrowleft: "\u21AB",
  looparrowright: "\u21AC",
  lopar: "\u2985",
  lopf: "\u{1D55D}",
  loplus: "\u2A2D",
  lotimes: "\u2A34",
  lowast: "\u2217",
  lowbar: "_",
  loz: "\u25CA",
  lozenge: "\u25CA",
  lozf: "\u29EB",
  lpar: "(",
  lparlt: "\u2993",
  lrarr: "\u21C6",
  lrcorner: "\u231F",
  lrhar: "\u21CB",
  lrhard: "\u296D",
  lrm: "\u200E",
  lrtri: "\u22BF",
  lsaquo: "\u2039",
  lscr: "\u{1D4C1}",
  lsh: "\u21B0",
  lsim: "\u2272",
  lsime: "\u2A8D",
  lsimg: "\u2A8F",
  lsqb: "[",
  lsquo: "\u2018",
  lsquor: "\u201A",
  lstrok: "\u0142",
  lt: "<",
  ltcc: "\u2AA6",
  ltcir: "\u2A79",
  ltdot: "\u22D6",
  lthree: "\u22CB",
  ltimes: "\u22C9",
  ltlarr: "\u2976",
  ltquest: "\u2A7B",
  ltrPar: "\u2996",
  ltri: "\u25C3",
  ltrie: "\u22B4",
  ltrif: "\u25C2",
  lurdshar: "\u294A",
  luruhar: "\u2966",
  lvertneqq: "\u2268\uFE00",
  lvnE: "\u2268\uFE00",
  mDDot: "\u223A",
  macr: "\xAF",
  male: "\u2642",
  malt: "\u2720",
  maltese: "\u2720",
  map: "\u21A6",
  mapsto: "\u21A6",
  mapstodown: "\u21A7",
  mapstoleft: "\u21A4",
  mapstoup: "\u21A5",
  marker: "\u25AE",
  mcomma: "\u2A29",
  mcy: "\u043C",
  mdash: "\u2014",
  measuredangle: "\u2221",
  mfr: "\u{1D52A}",
  mho: "\u2127",
  micro: "\xB5",
  mid: "\u2223",
  midast: "*",
  midcir: "\u2AF0",
  middot: "\xB7",
  minus: "\u2212",
  minusb: "\u229F",
  minusd: "\u2238",
  minusdu: "\u2A2A",
  mlcp: "\u2ADB",
  mldr: "\u2026",
  mnplus: "\u2213",
  models: "\u22A7",
  mopf: "\u{1D55E}",
  mp: "\u2213",
  mscr: "\u{1D4C2}",
  mstpos: "\u223E",
  mu: "\u03BC",
  multimap: "\u22B8",
  mumap: "\u22B8",
  nGg: "\u22D9\u0338",
  nGt: "\u226B\u20D2",
  nGtv: "\u226B\u0338",
  nLeftarrow: "\u21CD",
  nLeftrightarrow: "\u21CE",
  nLl: "\u22D8\u0338",
  nLt: "\u226A\u20D2",
  nLtv: "\u226A\u0338",
  nRightarrow: "\u21CF",
  nVDash: "\u22AF",
  nVdash: "\u22AE",
  nabla: "\u2207",
  nacute: "\u0144",
  nang: "\u2220\u20D2",
  nap: "\u2249",
  napE: "\u2A70\u0338",
  napid: "\u224B\u0338",
  napos: "\u0149",
  napprox: "\u2249",
  natur: "\u266E",
  natural: "\u266E",
  naturals: "\u2115",
  nbsp: "\xA0",
  nbump: "\u224E\u0338",
  nbumpe: "\u224F\u0338",
  ncap: "\u2A43",
  ncaron: "\u0148",
  ncedil: "\u0146",
  ncong: "\u2247",
  ncongdot: "\u2A6D\u0338",
  ncup: "\u2A42",
  ncy: "\u043D",
  ndash: "\u2013",
  ne: "\u2260",
  neArr: "\u21D7",
  nearhk: "\u2924",
  nearr: "\u2197",
  nearrow: "\u2197",
  nedot: "\u2250\u0338",
  nequiv: "\u2262",
  nesear: "\u2928",
  nesim: "\u2242\u0338",
  nexist: "\u2204",
  nexists: "\u2204",
  nfr: "\u{1D52B}",
  ngE: "\u2267\u0338",
  nge: "\u2271",
  ngeq: "\u2271",
  ngeqq: "\u2267\u0338",
  ngeqslant: "\u2A7E\u0338",
  nges: "\u2A7E\u0338",
  ngsim: "\u2275",
  ngt: "\u226F",
  ngtr: "\u226F",
  nhArr: "\u21CE",
  nharr: "\u21AE",
  nhpar: "\u2AF2",
  ni: "\u220B",
  nis: "\u22FC",
  nisd: "\u22FA",
  niv: "\u220B",
  njcy: "\u045A",
  nlArr: "\u21CD",
  nlE: "\u2266\u0338",
  nlarr: "\u219A",
  nldr: "\u2025",
  nle: "\u2270",
  nleftarrow: "\u219A",
  nleftrightarrow: "\u21AE",
  nleq: "\u2270",
  nleqq: "\u2266\u0338",
  nleqslant: "\u2A7D\u0338",
  nles: "\u2A7D\u0338",
  nless: "\u226E",
  nlsim: "\u2274",
  nlt: "\u226E",
  nltri: "\u22EA",
  nltrie: "\u22EC",
  nmid: "\u2224",
  nopf: "\u{1D55F}",
  not: "\xAC",
  notin: "\u2209",
  notinE: "\u22F9\u0338",
  notindot: "\u22F5\u0338",
  notinva: "\u2209",
  notinvb: "\u22F7",
  notinvc: "\u22F6",
  notni: "\u220C",
  notniva: "\u220C",
  notnivb: "\u22FE",
  notnivc: "\u22FD",
  npar: "\u2226",
  nparallel: "\u2226",
  nparsl: "\u2AFD\u20E5",
  npart: "\u2202\u0338",
  npolint: "\u2A14",
  npr: "\u2280",
  nprcue: "\u22E0",
  npre: "\u2AAF\u0338",
  nprec: "\u2280",
  npreceq: "\u2AAF\u0338",
  nrArr: "\u21CF",
  nrarr: "\u219B",
  nrarrc: "\u2933\u0338",
  nrarrw: "\u219D\u0338",
  nrightarrow: "\u219B",
  nrtri: "\u22EB",
  nrtrie: "\u22ED",
  nsc: "\u2281",
  nsccue: "\u22E1",
  nsce: "\u2AB0\u0338",
  nscr: "\u{1D4C3}",
  nshortmid: "\u2224",
  nshortparallel: "\u2226",
  nsim: "\u2241",
  nsime: "\u2244",
  nsimeq: "\u2244",
  nsmid: "\u2224",
  nspar: "\u2226",
  nsqsube: "\u22E2",
  nsqsupe: "\u22E3",
  nsub: "\u2284",
  nsubE: "\u2AC5\u0338",
  nsube: "\u2288",
  nsubset: "\u2282\u20D2",
  nsubseteq: "\u2288",
  nsubseteqq: "\u2AC5\u0338",
  nsucc: "\u2281",
  nsucceq: "\u2AB0\u0338",
  nsup: "\u2285",
  nsupE: "\u2AC6\u0338",
  nsupe: "\u2289",
  nsupset: "\u2283\u20D2",
  nsupseteq: "\u2289",
  nsupseteqq: "\u2AC6\u0338",
  ntgl: "\u2279",
  ntilde: "\xF1",
  ntlg: "\u2278",
  ntriangleleft: "\u22EA",
  ntrianglelefteq: "\u22EC",
  ntriangleright: "\u22EB",
  ntrianglerighteq: "\u22ED",
  nu: "\u03BD",
  num: "#",
  numero: "\u2116",
  numsp: "\u2007",
  nvDash: "\u22AD",
  nvHarr: "\u2904",
  nvap: "\u224D\u20D2",
  nvdash: "\u22AC",
  nvge: "\u2265\u20D2",
  nvgt: ">\u20D2",
  nvinfin: "\u29DE",
  nvlArr: "\u2902",
  nvle: "\u2264\u20D2",
  nvlt: "<\u20D2",
  nvltrie: "\u22B4\u20D2",
  nvrArr: "\u2903",
  nvrtrie: "\u22B5\u20D2",
  nvsim: "\u223C\u20D2",
  nwArr: "\u21D6",
  nwarhk: "\u2923",
  nwarr: "\u2196",
  nwarrow: "\u2196",
  nwnear: "\u2927",
  oS: "\u24C8",
  oacute: "\xF3",
  oast: "\u229B",
  ocir: "\u229A",
  ocirc: "\xF4",
  ocy: "\u043E",
  odash: "\u229D",
  odblac: "\u0151",
  odiv: "\u2A38",
  odot: "\u2299",
  odsold: "\u29BC",
  oelig: "\u0153",
  ofcir: "\u29BF",
  ofr: "\u{1D52C}",
  ogon: "\u02DB",
  ograve: "\xF2",
  ogt: "\u29C1",
  ohbar: "\u29B5",
  ohm: "\u03A9",
  oint: "\u222E",
  olarr: "\u21BA",
  olcir: "\u29BE",
  olcross: "\u29BB",
  oline: "\u203E",
  olt: "\u29C0",
  omacr: "\u014D",
  omega: "\u03C9",
  omicron: "\u03BF",
  omid: "\u29B6",
  ominus: "\u2296",
  oopf: "\u{1D560}",
  opar: "\u29B7",
  operp: "\u29B9",
  oplus: "\u2295",
  or: "\u2228",
  orarr: "\u21BB",
  ord: "\u2A5D",
  order: "\u2134",
  orderof: "\u2134",
  ordf: "\xAA",
  ordm: "\xBA",
  origof: "\u22B6",
  oror: "\u2A56",
  orslope: "\u2A57",
  orv: "\u2A5B",
  oscr: "\u2134",
  oslash: "\xF8",
  osol: "\u2298",
  otilde: "\xF5",
  otimes: "\u2297",
  otimesas: "\u2A36",
  ouml: "\xF6",
  ovbar: "\u233D",
  par: "\u2225",
  para: "\xB6",
  parallel: "\u2225",
  parsim: "\u2AF3",
  parsl: "\u2AFD",
  part: "\u2202",
  pcy: "\u043F",
  percnt: "%",
  period: ".",
  permil: "\u2030",
  perp: "\u22A5",
  pertenk: "\u2031",
  pfr: "\u{1D52D}",
  phi: "\u03C6",
  phiv: "\u03D5",
  phmmat: "\u2133",
  phone: "\u260E",
  pi: "\u03C0",
  pitchfork: "\u22D4",
  piv: "\u03D6",
  planck: "\u210F",
  planckh: "\u210E",
  plankv: "\u210F",
  plus: "+",
  plusacir: "\u2A23",
  plusb: "\u229E",
  pluscir: "\u2A22",
  plusdo: "\u2214",
  plusdu: "\u2A25",
  pluse: "\u2A72",
  plusmn: "\xB1",
  plussim: "\u2A26",
  plustwo: "\u2A27",
  pm: "\xB1",
  pointint: "\u2A15",
  popf: "\u{1D561}",
  pound: "\xA3",
  pr: "\u227A",
  prE: "\u2AB3",
  prap: "\u2AB7",
  prcue: "\u227C",
  pre: "\u2AAF",
  prec: "\u227A",
  precapprox: "\u2AB7",
  preccurlyeq: "\u227C",
  preceq: "\u2AAF",
  precnapprox: "\u2AB9",
  precneqq: "\u2AB5",
  precnsim: "\u22E8",
  precsim: "\u227E",
  prime: "\u2032",
  primes: "\u2119",
  prnE: "\u2AB5",
  prnap: "\u2AB9",
  prnsim: "\u22E8",
  prod: "\u220F",
  profalar: "\u232E",
  profline: "\u2312",
  profsurf: "\u2313",
  prop: "\u221D",
  propto: "\u221D",
  prsim: "\u227E",
  prurel: "\u22B0",
  pscr: "\u{1D4C5}",
  psi: "\u03C8",
  puncsp: "\u2008",
  qfr: "\u{1D52E}",
  qint: "\u2A0C",
  qopf: "\u{1D562}",
  qprime: "\u2057",
  qscr: "\u{1D4C6}",
  quaternions: "\u210D",
  quatint: "\u2A16",
  quest: "?",
  questeq: "\u225F",
  quot: '"',
  rAarr: "\u21DB",
  rArr: "\u21D2",
  rAtail: "\u291C",
  rBarr: "\u290F",
  rHar: "\u2964",
  race: "\u223D\u0331",
  racute: "\u0155",
  radic: "\u221A",
  raemptyv: "\u29B3",
  rang: "\u27E9",
  rangd: "\u2992",
  range: "\u29A5",
  rangle: "\u27E9",
  raquo: "\xBB",
  rarr: "\u2192",
  rarrap: "\u2975",
  rarrb: "\u21E5",
  rarrbfs: "\u2920",
  rarrc: "\u2933",
  rarrfs: "\u291E",
  rarrhk: "\u21AA",
  rarrlp: "\u21AC",
  rarrpl: "\u2945",
  rarrsim: "\u2974",
  rarrtl: "\u21A3",
  rarrw: "\u219D",
  ratail: "\u291A",
  ratio: "\u2236",
  rationals: "\u211A",
  rbarr: "\u290D",
  rbbrk: "\u2773",
  rbrace: "}",
  rbrack: "]",
  rbrke: "\u298C",
  rbrksld: "\u298E",
  rbrkslu: "\u2990",
  rcaron: "\u0159",
  rcedil: "\u0157",
  rceil: "\u2309",
  rcub: "}",
  rcy: "\u0440",
  rdca: "\u2937",
  rdldhar: "\u2969",
  rdquo: "\u201D",
  rdquor: "\u201D",
  rdsh: "\u21B3",
  real: "\u211C",
  realine: "\u211B",
  realpart: "\u211C",
  reals: "\u211D",
  rect: "\u25AD",
  reg: "\xAE",
  rfisht: "\u297D",
  rfloor: "\u230B",
  rfr: "\u{1D52F}",
  rhard: "\u21C1",
  rharu: "\u21C0",
  rharul: "\u296C",
  rho: "\u03C1",
  rhov: "\u03F1",
  rightarrow: "\u2192",
  rightarrowtail: "\u21A3",
  rightharpoondown: "\u21C1",
  rightharpoonup: "\u21C0",
  rightleftarrows: "\u21C4",
  rightleftharpoons: "\u21CC",
  rightrightarrows: "\u21C9",
  rightsquigarrow: "\u219D",
  rightthreetimes: "\u22CC",
  ring: "\u02DA",
  risingdotseq: "\u2253",
  rlarr: "\u21C4",
  rlhar: "\u21CC",
  rlm: "\u200F",
  rmoust: "\u23B1",
  rmoustache: "\u23B1",
  rnmid: "\u2AEE",
  roang: "\u27ED",
  roarr: "\u21FE",
  robrk: "\u27E7",
  ropar: "\u2986",
  ropf: "\u{1D563}",
  roplus: "\u2A2E",
  rotimes: "\u2A35",
  rpar: ")",
  rpargt: "\u2994",
  rppolint: "\u2A12",
  rrarr: "\u21C9",
  rsaquo: "\u203A",
  rscr: "\u{1D4C7}",
  rsh: "\u21B1",
  rsqb: "]",
  rsquo: "\u2019",
  rsquor: "\u2019",
  rthree: "\u22CC",
  rtimes: "\u22CA",
  rtri: "\u25B9",
  rtrie: "\u22B5",
  rtrif: "\u25B8",
  rtriltri: "\u29CE",
  ruluhar: "\u2968",
  rx: "\u211E",
  sacute: "\u015B",
  sbquo: "\u201A",
  sc: "\u227B",
  scE: "\u2AB4",
  scap: "\u2AB8",
  scaron: "\u0161",
  sccue: "\u227D",
  sce: "\u2AB0",
  scedil: "\u015F",
  scirc: "\u015D",
  scnE: "\u2AB6",
  scnap: "\u2ABA",
  scnsim: "\u22E9",
  scpolint: "\u2A13",
  scsim: "\u227F",
  scy: "\u0441",
  sdot: "\u22C5",
  sdotb: "\u22A1",
  sdote: "\u2A66",
  seArr: "\u21D8",
  searhk: "\u2925",
  searr: "\u2198",
  searrow: "\u2198",
  sect: "\xA7",
  semi: ";",
  seswar: "\u2929",
  setminus: "\u2216",
  setmn: "\u2216",
  sext: "\u2736",
  sfr: "\u{1D530}",
  sfrown: "\u2322",
  sharp: "\u266F",
  shchcy: "\u0449",
  shcy: "\u0448",
  shortmid: "\u2223",
  shortparallel: "\u2225",
  shy: "\xAD",
  sigma: "\u03C3",
  sigmaf: "\u03C2",
  sigmav: "\u03C2",
  sim: "\u223C",
  simdot: "\u2A6A",
  sime: "\u2243",
  simeq: "\u2243",
  simg: "\u2A9E",
  simgE: "\u2AA0",
  siml: "\u2A9D",
  simlE: "\u2A9F",
  simne: "\u2246",
  simplus: "\u2A24",
  simrarr: "\u2972",
  slarr: "\u2190",
  smallsetminus: "\u2216",
  smashp: "\u2A33",
  smeparsl: "\u29E4",
  smid: "\u2223",
  smile: "\u2323",
  smt: "\u2AAA",
  smte: "\u2AAC",
  smtes: "\u2AAC\uFE00",
  softcy: "\u044C",
  sol: "/",
  solb: "\u29C4",
  solbar: "\u233F",
  sopf: "\u{1D564}",
  spades: "\u2660",
  spadesuit: "\u2660",
  spar: "\u2225",
  sqcap: "\u2293",
  sqcaps: "\u2293\uFE00",
  sqcup: "\u2294",
  sqcups: "\u2294\uFE00",
  sqsub: "\u228F",
  sqsube: "\u2291",
  sqsubset: "\u228F",
  sqsubseteq: "\u2291",
  sqsup: "\u2290",
  sqsupe: "\u2292",
  sqsupset: "\u2290",
  sqsupseteq: "\u2292",
  squ: "\u25A1",
  square: "\u25A1",
  squarf: "\u25AA",
  squf: "\u25AA",
  srarr: "\u2192",
  sscr: "\u{1D4C8}",
  ssetmn: "\u2216",
  ssmile: "\u2323",
  sstarf: "\u22C6",
  star: "\u2606",
  starf: "\u2605",
  straightepsilon: "\u03F5",
  straightphi: "\u03D5",
  strns: "\xAF",
  sub: "\u2282",
  subE: "\u2AC5",
  subdot: "\u2ABD",
  sube: "\u2286",
  subedot: "\u2AC3",
  submult: "\u2AC1",
  subnE: "\u2ACB",
  subne: "\u228A",
  subplus: "\u2ABF",
  subrarr: "\u2979",
  subset: "\u2282",
  subseteq: "\u2286",
  subseteqq: "\u2AC5",
  subsetneq: "\u228A",
  subsetneqq: "\u2ACB",
  subsim: "\u2AC7",
  subsub: "\u2AD5",
  subsup: "\u2AD3",
  succ: "\u227B",
  succapprox: "\u2AB8",
  succcurlyeq: "\u227D",
  succeq: "\u2AB0",
  succnapprox: "\u2ABA",
  succneqq: "\u2AB6",
  succnsim: "\u22E9",
  succsim: "\u227F",
  sum: "\u2211",
  sung: "\u266A",
  sup1: "\xB9",
  sup2: "\xB2",
  sup3: "\xB3",
  sup: "\u2283",
  supE: "\u2AC6",
  supdot: "\u2ABE",
  supdsub: "\u2AD8",
  supe: "\u2287",
  supedot: "\u2AC4",
  suphsol: "\u27C9",
  suphsub: "\u2AD7",
  suplarr: "\u297B",
  supmult: "\u2AC2",
  supnE: "\u2ACC",
  supne: "\u228B",
  supplus: "\u2AC0",
  supset: "\u2283",
  supseteq: "\u2287",
  supseteqq: "\u2AC6",
  supsetneq: "\u228B",
  supsetneqq: "\u2ACC",
  supsim: "\u2AC8",
  supsub: "\u2AD4",
  supsup: "\u2AD6",
  swArr: "\u21D9",
  swarhk: "\u2926",
  swarr: "\u2199",
  swarrow: "\u2199",
  swnwar: "\u292A",
  szlig: "\xDF",
  target: "\u2316",
  tau: "\u03C4",
  tbrk: "\u23B4",
  tcaron: "\u0165",
  tcedil: "\u0163",
  tcy: "\u0442",
  tdot: "\u20DB",
  telrec: "\u2315",
  tfr: "\u{1D531}",
  there4: "\u2234",
  therefore: "\u2234",
  theta: "\u03B8",
  thetasym: "\u03D1",
  thetav: "\u03D1",
  thickapprox: "\u2248",
  thicksim: "\u223C",
  thinsp: "\u2009",
  thkap: "\u2248",
  thksim: "\u223C",
  thorn: "\xFE",
  tilde: "\u02DC",
  times: "\xD7",
  timesb: "\u22A0",
  timesbar: "\u2A31",
  timesd: "\u2A30",
  tint: "\u222D",
  toea: "\u2928",
  top: "\u22A4",
  topbot: "\u2336",
  topcir: "\u2AF1",
  topf: "\u{1D565}",
  topfork: "\u2ADA",
  tosa: "\u2929",
  tprime: "\u2034",
  trade: "\u2122",
  triangle: "\u25B5",
  triangledown: "\u25BF",
  triangleleft: "\u25C3",
  trianglelefteq: "\u22B4",
  triangleq: "\u225C",
  triangleright: "\u25B9",
  trianglerighteq: "\u22B5",
  tridot: "\u25EC",
  trie: "\u225C",
  triminus: "\u2A3A",
  triplus: "\u2A39",
  trisb: "\u29CD",
  tritime: "\u2A3B",
  trpezium: "\u23E2",
  tscr: "\u{1D4C9}",
  tscy: "\u0446",
  tshcy: "\u045B",
  tstrok: "\u0167",
  twixt: "\u226C",
  twoheadleftarrow: "\u219E",
  twoheadrightarrow: "\u21A0",
  uArr: "\u21D1",
  uHar: "\u2963",
  uacute: "\xFA",
  uarr: "\u2191",
  ubrcy: "\u045E",
  ubreve: "\u016D",
  ucirc: "\xFB",
  ucy: "\u0443",
  udarr: "\u21C5",
  udblac: "\u0171",
  udhar: "\u296E",
  ufisht: "\u297E",
  ufr: "\u{1D532}",
  ugrave: "\xF9",
  uharl: "\u21BF",
  uharr: "\u21BE",
  uhblk: "\u2580",
  ulcorn: "\u231C",
  ulcorner: "\u231C",
  ulcrop: "\u230F",
  ultri: "\u25F8",
  umacr: "\u016B",
  uml: "\xA8",
  uogon: "\u0173",
  uopf: "\u{1D566}",
  uparrow: "\u2191",
  updownarrow: "\u2195",
  upharpoonleft: "\u21BF",
  upharpoonright: "\u21BE",
  uplus: "\u228E",
  upsi: "\u03C5",
  upsih: "\u03D2",
  upsilon: "\u03C5",
  upuparrows: "\u21C8",
  urcorn: "\u231D",
  urcorner: "\u231D",
  urcrop: "\u230E",
  uring: "\u016F",
  urtri: "\u25F9",
  uscr: "\u{1D4CA}",
  utdot: "\u22F0",
  utilde: "\u0169",
  utri: "\u25B5",
  utrif: "\u25B4",
  uuarr: "\u21C8",
  uuml: "\xFC",
  uwangle: "\u29A7",
  vArr: "\u21D5",
  vBar: "\u2AE8",
  vBarv: "\u2AE9",
  vDash: "\u22A8",
  vangrt: "\u299C",
  varepsilon: "\u03F5",
  varkappa: "\u03F0",
  varnothing: "\u2205",
  varphi: "\u03D5",
  varpi: "\u03D6",
  varpropto: "\u221D",
  varr: "\u2195",
  varrho: "\u03F1",
  varsigma: "\u03C2",
  varsubsetneq: "\u228A\uFE00",
  varsubsetneqq: "\u2ACB\uFE00",
  varsupsetneq: "\u228B\uFE00",
  varsupsetneqq: "\u2ACC\uFE00",
  vartheta: "\u03D1",
  vartriangleleft: "\u22B2",
  vartriangleright: "\u22B3",
  vcy: "\u0432",
  vdash: "\u22A2",
  vee: "\u2228",
  veebar: "\u22BB",
  veeeq: "\u225A",
  vellip: "\u22EE",
  verbar: "|",
  vert: "|",
  vfr: "\u{1D533}",
  vltri: "\u22B2",
  vnsub: "\u2282\u20D2",
  vnsup: "\u2283\u20D2",
  vopf: "\u{1D567}",
  vprop: "\u221D",
  vrtri: "\u22B3",
  vscr: "\u{1D4CB}",
  vsubnE: "\u2ACB\uFE00",
  vsubne: "\u228A\uFE00",
  vsupnE: "\u2ACC\uFE00",
  vsupne: "\u228B\uFE00",
  vzigzag: "\u299A",
  wcirc: "\u0175",
  wedbar: "\u2A5F",
  wedge: "\u2227",
  wedgeq: "\u2259",
  weierp: "\u2118",
  wfr: "\u{1D534}",
  wopf: "\u{1D568}",
  wp: "\u2118",
  wr: "\u2240",
  wreath: "\u2240",
  wscr: "\u{1D4CC}",
  xcap: "\u22C2",
  xcirc: "\u25EF",
  xcup: "\u22C3",
  xdtri: "\u25BD",
  xfr: "\u{1D535}",
  xhArr: "\u27FA",
  xharr: "\u27F7",
  xi: "\u03BE",
  xlArr: "\u27F8",
  xlarr: "\u27F5",
  xmap: "\u27FC",
  xnis: "\u22FB",
  xodot: "\u2A00",
  xopf: "\u{1D569}",
  xoplus: "\u2A01",
  xotime: "\u2A02",
  xrArr: "\u27F9",
  xrarr: "\u27F6",
  xscr: "\u{1D4CD}",
  xsqcup: "\u2A06",
  xuplus: "\u2A04",
  xutri: "\u25B3",
  xvee: "\u22C1",
  xwedge: "\u22C0",
  yacute: "\xFD",
  yacy: "\u044F",
  ycirc: "\u0177",
  ycy: "\u044B",
  yen: "\xA5",
  yfr: "\u{1D536}",
  yicy: "\u0457",
  yopf: "\u{1D56A}",
  yscr: "\u{1D4CE}",
  yucy: "\u044E",
  yuml: "\xFF",
  zacute: "\u017A",
  zcaron: "\u017E",
  zcy: "\u0437",
  zdot: "\u017C",
  zeetrf: "\u2128",
  zeta: "\u03B6",
  zfr: "\u{1D537}",
  zhcy: "\u0436",
  zigrarr: "\u21DD",
  zopf: "\u{1D56B}",
  zscr: "\u{1D4CF}",
  zwj: "\u200D",
  zwnj: "\u200C"
};

// node_modules/decode-named-character-reference/index.js
var own2 = {}.hasOwnProperty;
function decodeNamedCharacterReference(value) {
  return own2.call(characterEntities, value) ? characterEntities[value] : false;
}

// node_modules/micromark-util-chunked/index.js
function splice(list3, start, remove, items) {
  const end = list3.length;
  let chunkStart = 0;
  let parameters;
  if (start < 0) {
    start = -start > end ? 0 : end + start;
  } else {
    start = start > end ? end : start;
  }
  remove = remove > 0 ? remove : 0;
  if (items.length < 1e4) {
    parameters = Array.from(items);
    parameters.unshift(start, remove);
    list3.splice(...parameters);
  } else {
    if (remove) list3.splice(start, remove);
    while (chunkStart < items.length) {
      parameters = items.slice(chunkStart, chunkStart + 1e4);
      parameters.unshift(start, 0);
      list3.splice(...parameters);
      chunkStart += 1e4;
      start += 1e4;
    }
  }
}
function push(list3, items) {
  if (list3.length > 0) {
    splice(list3, list3.length, 0, items);
    return list3;
  }
  return items;
}

// node_modules/micromark-util-combine-extensions/index.js
var hasOwnProperty = {}.hasOwnProperty;
function combineExtensions(extensions) {
  const all2 = {};
  let index2 = -1;
  while (++index2 < extensions.length) {
    syntaxExtension(all2, extensions[index2]);
  }
  return all2;
}
function syntaxExtension(all2, extension2) {
  let hook;
  for (hook in extension2) {
    const maybe = hasOwnProperty.call(all2, hook) ? all2[hook] : void 0;
    const left = maybe || (all2[hook] = {});
    const right = extension2[hook];
    let code3;
    if (right) {
      for (code3 in right) {
        if (!hasOwnProperty.call(left, code3)) left[code3] = [];
        const value = right[code3];
        constructs(
          // @ts-expect-error Looks like a list.
          left[code3],
          Array.isArray(value) ? value : value ? [value] : []
        );
      }
    }
  }
}
function constructs(existing, list3) {
  let index2 = -1;
  const before = [];
  while (++index2 < list3.length) {
    ;
    (list3[index2].add === "after" ? existing : before).push(list3[index2]);
  }
  splice(existing, 0, 0, before);
}

// node_modules/micromark-util-decode-numeric-character-reference/index.js
function decodeNumericCharacterReference(value, base) {
  const code3 = Number.parseInt(value, base);
  if (
    // C0 except for HT, LF, FF, CR, space.
    code3 < 9 || code3 === 11 || code3 > 13 && code3 < 32 || // Control character (DEL) of C0, and C1 controls.
    code3 > 126 && code3 < 160 || // Lone high surrogates and low surrogates.
    code3 > 55295 && code3 < 57344 || // Noncharacters.
    code3 > 64975 && code3 < 65008 || /* eslint-disable no-bitwise */
    (code3 & 65535) === 65535 || (code3 & 65535) === 65534 || /* eslint-enable no-bitwise */
    // Out of range
    code3 > 1114111
  ) {
    return "\uFFFD";
  }
  return String.fromCodePoint(code3);
}

// node_modules/micromark-util-normalize-identifier/index.js
function normalizeIdentifier(value) {
  return value.replace(/[\t\n\r ]+/g, " ").replace(/^ | $/g, "").toLowerCase().toUpperCase();
}

// node_modules/micromark-util-character/index.js
var asciiAlpha = regexCheck(/[A-Za-z]/);
var asciiAlphanumeric = regexCheck(/[\dA-Za-z]/);
var asciiAtext = regexCheck(/[#-'*+\--9=?A-Z^-~]/);
function asciiControl(code3) {
  return (
    // Special whitespace codes (which have negative values), C0 and Control
    // character DEL
    code3 !== null && (code3 < 32 || code3 === 127)
  );
}
var asciiDigit = regexCheck(/\d/);
var asciiHexDigit = regexCheck(/[\dA-Fa-f]/);
var asciiPunctuation = regexCheck(/[!-/:-@[-`{-~]/);
function markdownLineEnding(code3) {
  return code3 !== null && code3 < -2;
}
function markdownLineEndingOrSpace(code3) {
  return code3 !== null && (code3 < 0 || code3 === 32);
}
function markdownSpace(code3) {
  return code3 === -2 || code3 === -1 || code3 === 32;
}
var unicodePunctuation = regexCheck(/\p{P}|\p{S}/u);
var unicodeWhitespace = regexCheck(/\s/);
function regexCheck(regex) {
  return check;
  function check(code3) {
    return code3 !== null && code3 > -1 && regex.test(String.fromCharCode(code3));
  }
}

// node_modules/micromark-factory-space/index.js
function factorySpace(effects, ok3, type, max) {
  const limit = max ? max - 1 : Number.POSITIVE_INFINITY;
  let size = 0;
  return start;
  function start(code3) {
    if (markdownSpace(code3)) {
      effects.enter(type);
      return prefix(code3);
    }
    return ok3(code3);
  }
  function prefix(code3) {
    if (markdownSpace(code3) && size++ < limit) {
      effects.consume(code3);
      return prefix;
    }
    effects.exit(type);
    return ok3(code3);
  }
}

// node_modules/micromark/lib/initialize/content.js
var content = {
  tokenize: initializeContent
};
function initializeContent(effects) {
  const contentStart = effects.attempt(this.parser.constructs.contentInitial, afterContentStartConstruct, paragraphInitial);
  let previous4;
  return contentStart;
  function afterContentStartConstruct(code3) {
    if (code3 === null) {
      effects.consume(code3);
      return;
    }
    effects.enter("lineEnding");
    effects.consume(code3);
    effects.exit("lineEnding");
    return factorySpace(effects, contentStart, "linePrefix");
  }
  function paragraphInitial(code3) {
    effects.enter("paragraph");
    return lineStart(code3);
  }
  function lineStart(code3) {
    const token = effects.enter("chunkText", {
      contentType: "text",
      previous: previous4
    });
    if (previous4) {
      previous4.next = token;
    }
    previous4 = token;
    return data(code3);
  }
  function data(code3) {
    if (code3 === null) {
      effects.exit("chunkText");
      effects.exit("paragraph");
      effects.consume(code3);
      return;
    }
    if (markdownLineEnding(code3)) {
      effects.consume(code3);
      effects.exit("chunkText");
      return lineStart;
    }
    effects.consume(code3);
    return data;
  }
}

// node_modules/micromark/lib/initialize/document.js
var document = {
  tokenize: initializeDocument
};
var containerConstruct = {
  tokenize: tokenizeContainer
};
function initializeDocument(effects) {
  const self = this;
  const stack = [];
  let continued = 0;
  let childFlow;
  let childToken;
  let lineStartOffset;
  return start;
  function start(code3) {
    if (continued < stack.length) {
      const item = stack[continued];
      self.containerState = item[1];
      return effects.attempt(item[0].continuation, documentContinue, checkNewContainers)(code3);
    }
    return checkNewContainers(code3);
  }
  function documentContinue(code3) {
    continued++;
    if (self.containerState._closeFlow) {
      self.containerState._closeFlow = void 0;
      if (childFlow) {
        closeFlow();
      }
      const indexBeforeExits = self.events.length;
      let indexBeforeFlow = indexBeforeExits;
      let point3;
      while (indexBeforeFlow--) {
        if (self.events[indexBeforeFlow][0] === "exit" && self.events[indexBeforeFlow][1].type === "chunkFlow") {
          point3 = self.events[indexBeforeFlow][1].end;
          break;
        }
      }
      exitContainers(continued);
      let index2 = indexBeforeExits;
      while (index2 < self.events.length) {
        self.events[index2][1].end = {
          ...point3
        };
        index2++;
      }
      splice(self.events, indexBeforeFlow + 1, 0, self.events.slice(indexBeforeExits));
      self.events.length = index2;
      return checkNewContainers(code3);
    }
    return start(code3);
  }
  function checkNewContainers(code3) {
    if (continued === stack.length) {
      if (!childFlow) {
        return documentContinued(code3);
      }
      if (childFlow.currentConstruct && childFlow.currentConstruct.concrete) {
        return flowStart(code3);
      }
      self.interrupt = Boolean(childFlow.currentConstruct && !childFlow._gfmTableDynamicInterruptHack);
    }
    self.containerState = {};
    return effects.check(containerConstruct, thereIsANewContainer, thereIsNoNewContainer)(code3);
  }
  function thereIsANewContainer(code3) {
    if (childFlow) closeFlow();
    exitContainers(continued);
    return documentContinued(code3);
  }
  function thereIsNoNewContainer(code3) {
    self.parser.lazy[self.now().line] = continued !== stack.length;
    lineStartOffset = self.now().offset;
    return flowStart(code3);
  }
  function documentContinued(code3) {
    self.containerState = {};
    return effects.attempt(containerConstruct, containerContinue, flowStart)(code3);
  }
  function containerContinue(code3) {
    continued++;
    stack.push([self.currentConstruct, self.containerState]);
    return documentContinued(code3);
  }
  function flowStart(code3) {
    if (code3 === null) {
      if (childFlow) closeFlow();
      exitContainers(0);
      effects.consume(code3);
      return;
    }
    childFlow = childFlow || self.parser.flow(self.now());
    effects.enter("chunkFlow", {
      _tokenizer: childFlow,
      contentType: "flow",
      previous: childToken
    });
    return flowContinue(code3);
  }
  function flowContinue(code3) {
    if (code3 === null) {
      writeToChild(effects.exit("chunkFlow"), true);
      exitContainers(0);
      effects.consume(code3);
      return;
    }
    if (markdownLineEnding(code3)) {
      effects.consume(code3);
      writeToChild(effects.exit("chunkFlow"));
      continued = 0;
      self.interrupt = void 0;
      return start;
    }
    effects.consume(code3);
    return flowContinue;
  }
  function writeToChild(token, endOfFile) {
    const stream = self.sliceStream(token);
    if (endOfFile) stream.push(null);
    token.previous = childToken;
    if (childToken) childToken.next = token;
    childToken = token;
    childFlow.defineSkip(token.start);
    childFlow.write(stream);
    if (self.parser.lazy[token.start.line]) {
      let index2 = childFlow.events.length;
      while (index2--) {
        if (
          // The token starts before the line ending…
          childFlow.events[index2][1].start.offset < lineStartOffset && // …and either is not ended yet…
          (!childFlow.events[index2][1].end || // …or ends after it.
          childFlow.events[index2][1].end.offset > lineStartOffset)
        ) {
          return;
        }
      }
      const indexBeforeExits = self.events.length;
      let indexBeforeFlow = indexBeforeExits;
      let seen;
      let point3;
      while (indexBeforeFlow--) {
        if (self.events[indexBeforeFlow][0] === "exit" && self.events[indexBeforeFlow][1].type === "chunkFlow") {
          if (seen) {
            point3 = self.events[indexBeforeFlow][1].end;
            break;
          }
          seen = true;
        }
      }
      exitContainers(continued);
      index2 = indexBeforeExits;
      while (index2 < self.events.length) {
        self.events[index2][1].end = {
          ...point3
        };
        index2++;
      }
      splice(self.events, indexBeforeFlow + 1, 0, self.events.slice(indexBeforeExits));
      self.events.length = index2;
    }
  }
  function exitContainers(size) {
    let index2 = stack.length;
    while (index2-- > size) {
      const entry = stack[index2];
      self.containerState = entry[1];
      entry[0].exit.call(self, effects);
    }
    stack.length = size;
  }
  function closeFlow() {
    childFlow.write([null]);
    childToken = void 0;
    childFlow = void 0;
    self.containerState._closeFlow = void 0;
  }
}
function tokenizeContainer(effects, ok3, nok) {
  return factorySpace(effects, effects.attempt(this.parser.constructs.document, ok3, nok), "linePrefix", this.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4);
}

// node_modules/micromark-util-classify-character/index.js
function classifyCharacter(code3) {
  if (code3 === null || markdownLineEndingOrSpace(code3) || unicodeWhitespace(code3)) {
    return 1;
  }
  if (unicodePunctuation(code3)) {
    return 2;
  }
}

// node_modules/micromark-util-resolve-all/index.js
function resolveAll(constructs2, events, context) {
  const called = [];
  let index2 = -1;
  while (++index2 < constructs2.length) {
    const resolve = constructs2[index2].resolveAll;
    if (resolve && !called.includes(resolve)) {
      events = resolve(events, context);
      called.push(resolve);
    }
  }
  return events;
}

// node_modules/micromark-core-commonmark/lib/attention.js
var attention = {
  name: "attention",
  resolveAll: resolveAllAttention,
  tokenize: tokenizeAttention
};
function resolveAllAttention(events, context) {
  let index2 = -1;
  let open;
  let group;
  let text5;
  let openingSequence;
  let closingSequence;
  let use;
  let nextEvents;
  let offset;
  while (++index2 < events.length) {
    if (events[index2][0] === "enter" && events[index2][1].type === "attentionSequence" && events[index2][1]._close) {
      open = index2;
      while (open--) {
        if (events[open][0] === "exit" && events[open][1].type === "attentionSequence" && events[open][1]._open && // If the markers are the same:
        context.sliceSerialize(events[open][1]).charCodeAt(0) === context.sliceSerialize(events[index2][1]).charCodeAt(0)) {
          if ((events[open][1]._close || events[index2][1]._open) && (events[index2][1].end.offset - events[index2][1].start.offset) % 3 && !((events[open][1].end.offset - events[open][1].start.offset + events[index2][1].end.offset - events[index2][1].start.offset) % 3)) {
            continue;
          }
          use = events[open][1].end.offset - events[open][1].start.offset > 1 && events[index2][1].end.offset - events[index2][1].start.offset > 1 ? 2 : 1;
          const start = {
            ...events[open][1].end
          };
          const end = {
            ...events[index2][1].start
          };
          movePoint(start, -use);
          movePoint(end, use);
          openingSequence = {
            type: use > 1 ? "strongSequence" : "emphasisSequence",
            start,
            end: {
              ...events[open][1].end
            }
          };
          closingSequence = {
            type: use > 1 ? "strongSequence" : "emphasisSequence",
            start: {
              ...events[index2][1].start
            },
            end
          };
          text5 = {
            type: use > 1 ? "strongText" : "emphasisText",
            start: {
              ...events[open][1].end
            },
            end: {
              ...events[index2][1].start
            }
          };
          group = {
            type: use > 1 ? "strong" : "emphasis",
            start: {
              ...openingSequence.start
            },
            end: {
              ...closingSequence.end
            }
          };
          events[open][1].end = {
            ...openingSequence.start
          };
          events[index2][1].start = {
            ...closingSequence.end
          };
          nextEvents = [];
          if (events[open][1].end.offset - events[open][1].start.offset) {
            nextEvents = push(nextEvents, [["enter", events[open][1], context], ["exit", events[open][1], context]]);
          }
          nextEvents = push(nextEvents, [["enter", group, context], ["enter", openingSequence, context], ["exit", openingSequence, context], ["enter", text5, context]]);
          nextEvents = push(nextEvents, resolveAll(context.parser.constructs.insideSpan.null, events.slice(open + 1, index2), context));
          nextEvents = push(nextEvents, [["exit", text5, context], ["enter", closingSequence, context], ["exit", closingSequence, context], ["exit", group, context]]);
          if (events[index2][1].end.offset - events[index2][1].start.offset) {
            offset = 2;
            nextEvents = push(nextEvents, [["enter", events[index2][1], context], ["exit", events[index2][1], context]]);
          } else {
            offset = 0;
          }
          splice(events, open - 1, index2 - open + 3, nextEvents);
          index2 = open + nextEvents.length - offset - 2;
          break;
        }
      }
    }
  }
  index2 = -1;
  while (++index2 < events.length) {
    if (events[index2][1].type === "attentionSequence") {
      events[index2][1].type = "data";
    }
  }
  return events;
}
function tokenizeAttention(effects, ok3) {
  const attentionMarkers2 = this.parser.constructs.attentionMarkers.null;
  const previous4 = this.previous;
  const before = classifyCharacter(previous4);
  let marker;
  return start;
  function start(code3) {
    marker = code3;
    effects.enter("attentionSequence");
    return inside(code3);
  }
  function inside(code3) {
    if (code3 === marker) {
      effects.consume(code3);
      return inside;
    }
    const token = effects.exit("attentionSequence");
    const after = classifyCharacter(code3);
    const open = !after || after === 2 && before || attentionMarkers2.includes(code3);
    const close = !before || before === 2 && after || attentionMarkers2.includes(previous4);
    token._open = Boolean(marker === 42 ? open : open && (before || !close));
    token._close = Boolean(marker === 42 ? close : close && (after || !open));
    return ok3(code3);
  }
}
function movePoint(point3, offset) {
  point3.column += offset;
  point3.offset += offset;
  point3._bufferIndex += offset;
}

// node_modules/micromark-core-commonmark/lib/autolink.js
var autolink = {
  name: "autolink",
  tokenize: tokenizeAutolink
};
function tokenizeAutolink(effects, ok3, nok) {
  let size = 0;
  return start;
  function start(code3) {
    effects.enter("autolink");
    effects.enter("autolinkMarker");
    effects.consume(code3);
    effects.exit("autolinkMarker");
    effects.enter("autolinkProtocol");
    return open;
  }
  function open(code3) {
    if (asciiAlpha(code3)) {
      effects.consume(code3);
      return schemeOrEmailAtext;
    }
    if (code3 === 64) {
      return nok(code3);
    }
    return emailAtext(code3);
  }
  function schemeOrEmailAtext(code3) {
    if (code3 === 43 || code3 === 45 || code3 === 46 || asciiAlphanumeric(code3)) {
      size = 1;
      return schemeInsideOrEmailAtext(code3);
    }
    return emailAtext(code3);
  }
  function schemeInsideOrEmailAtext(code3) {
    if (code3 === 58) {
      effects.consume(code3);
      size = 0;
      return urlInside;
    }
    if ((code3 === 43 || code3 === 45 || code3 === 46 || asciiAlphanumeric(code3)) && size++ < 32) {
      effects.consume(code3);
      return schemeInsideOrEmailAtext;
    }
    size = 0;
    return emailAtext(code3);
  }
  function urlInside(code3) {
    if (code3 === 62) {
      effects.exit("autolinkProtocol");
      effects.enter("autolinkMarker");
      effects.consume(code3);
      effects.exit("autolinkMarker");
      effects.exit("autolink");
      return ok3;
    }
    if (code3 === null || code3 === 32 || code3 === 60 || asciiControl(code3)) {
      return nok(code3);
    }
    effects.consume(code3);
    return urlInside;
  }
  function emailAtext(code3) {
    if (code3 === 64) {
      effects.consume(code3);
      return emailAtSignOrDot;
    }
    if (asciiAtext(code3)) {
      effects.consume(code3);
      return emailAtext;
    }
    return nok(code3);
  }
  function emailAtSignOrDot(code3) {
    return asciiAlphanumeric(code3) ? emailLabel(code3) : nok(code3);
  }
  function emailLabel(code3) {
    if (code3 === 46) {
      effects.consume(code3);
      size = 0;
      return emailAtSignOrDot;
    }
    if (code3 === 62) {
      effects.exit("autolinkProtocol").type = "autolinkEmail";
      effects.enter("autolinkMarker");
      effects.consume(code3);
      effects.exit("autolinkMarker");
      effects.exit("autolink");
      return ok3;
    }
    return emailValue(code3);
  }
  function emailValue(code3) {
    if ((code3 === 45 || asciiAlphanumeric(code3)) && size++ < 63) {
      const next = code3 === 45 ? emailValue : emailLabel;
      effects.consume(code3);
      return next;
    }
    return nok(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/blank-line.js
var blankLine = {
  partial: true,
  tokenize: tokenizeBlankLine
};
function tokenizeBlankLine(effects, ok3, nok) {
  return start;
  function start(code3) {
    return markdownSpace(code3) ? factorySpace(effects, after, "linePrefix")(code3) : after(code3);
  }
  function after(code3) {
    return code3 === null || markdownLineEnding(code3) ? ok3(code3) : nok(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/block-quote.js
var blockQuote = {
  continuation: {
    tokenize: tokenizeBlockQuoteContinuation
  },
  exit,
  name: "blockQuote",
  tokenize: tokenizeBlockQuoteStart
};
function tokenizeBlockQuoteStart(effects, ok3, nok) {
  const self = this;
  return start;
  function start(code3) {
    if (code3 === 62) {
      const state = self.containerState;
      if (!state.open) {
        effects.enter("blockQuote", {
          _container: true
        });
        state.open = true;
      }
      effects.enter("blockQuotePrefix");
      effects.enter("blockQuoteMarker");
      effects.consume(code3);
      effects.exit("blockQuoteMarker");
      return after;
    }
    return nok(code3);
  }
  function after(code3) {
    if (markdownSpace(code3)) {
      effects.enter("blockQuotePrefixWhitespace");
      effects.consume(code3);
      effects.exit("blockQuotePrefixWhitespace");
      effects.exit("blockQuotePrefix");
      return ok3;
    }
    effects.exit("blockQuotePrefix");
    return ok3(code3);
  }
}
function tokenizeBlockQuoteContinuation(effects, ok3, nok) {
  const self = this;
  return contStart;
  function contStart(code3) {
    if (markdownSpace(code3)) {
      return factorySpace(effects, contBefore, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code3);
    }
    return contBefore(code3);
  }
  function contBefore(code3) {
    return effects.attempt(blockQuote, ok3, nok)(code3);
  }
}
function exit(effects) {
  effects.exit("blockQuote");
}

// node_modules/micromark-core-commonmark/lib/character-escape.js
var characterEscape = {
  name: "characterEscape",
  tokenize: tokenizeCharacterEscape
};
function tokenizeCharacterEscape(effects, ok3, nok) {
  return start;
  function start(code3) {
    effects.enter("characterEscape");
    effects.enter("escapeMarker");
    effects.consume(code3);
    effects.exit("escapeMarker");
    return inside;
  }
  function inside(code3) {
    if (asciiPunctuation(code3)) {
      effects.enter("characterEscapeValue");
      effects.consume(code3);
      effects.exit("characterEscapeValue");
      effects.exit("characterEscape");
      return ok3;
    }
    return nok(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/character-reference.js
var characterReference = {
  name: "characterReference",
  tokenize: tokenizeCharacterReference
};
function tokenizeCharacterReference(effects, ok3, nok) {
  const self = this;
  let size = 0;
  let max;
  let test;
  return start;
  function start(code3) {
    effects.enter("characterReference");
    effects.enter("characterReferenceMarker");
    effects.consume(code3);
    effects.exit("characterReferenceMarker");
    return open;
  }
  function open(code3) {
    if (code3 === 35) {
      effects.enter("characterReferenceMarkerNumeric");
      effects.consume(code3);
      effects.exit("characterReferenceMarkerNumeric");
      return numeric;
    }
    effects.enter("characterReferenceValue");
    max = 31;
    test = asciiAlphanumeric;
    return value(code3);
  }
  function numeric(code3) {
    if (code3 === 88 || code3 === 120) {
      effects.enter("characterReferenceMarkerHexadecimal");
      effects.consume(code3);
      effects.exit("characterReferenceMarkerHexadecimal");
      effects.enter("characterReferenceValue");
      max = 6;
      test = asciiHexDigit;
      return value;
    }
    effects.enter("characterReferenceValue");
    max = 7;
    test = asciiDigit;
    return value(code3);
  }
  function value(code3) {
    if (code3 === 59 && size) {
      const token = effects.exit("characterReferenceValue");
      if (test === asciiAlphanumeric && !decodeNamedCharacterReference(self.sliceSerialize(token))) {
        return nok(code3);
      }
      effects.enter("characterReferenceMarker");
      effects.consume(code3);
      effects.exit("characterReferenceMarker");
      effects.exit("characterReference");
      return ok3;
    }
    if (test(code3) && size++ < max) {
      effects.consume(code3);
      return value;
    }
    return nok(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/code-fenced.js
var nonLazyContinuation = {
  partial: true,
  tokenize: tokenizeNonLazyContinuation
};
var codeFenced = {
  concrete: true,
  name: "codeFenced",
  tokenize: tokenizeCodeFenced
};
function tokenizeCodeFenced(effects, ok3, nok) {
  const self = this;
  const closeStart = {
    partial: true,
    tokenize: tokenizeCloseStart
  };
  let initialPrefix = 0;
  let sizeOpen = 0;
  let marker;
  return start;
  function start(code3) {
    return beforeSequenceOpen(code3);
  }
  function beforeSequenceOpen(code3) {
    const tail = self.events[self.events.length - 1];
    initialPrefix = tail && tail[1].type === "linePrefix" ? tail[2].sliceSerialize(tail[1], true).length : 0;
    marker = code3;
    effects.enter("codeFenced");
    effects.enter("codeFencedFence");
    effects.enter("codeFencedFenceSequence");
    return sequenceOpen(code3);
  }
  function sequenceOpen(code3) {
    if (code3 === marker) {
      sizeOpen++;
      effects.consume(code3);
      return sequenceOpen;
    }
    if (sizeOpen < 3) {
      return nok(code3);
    }
    effects.exit("codeFencedFenceSequence");
    return markdownSpace(code3) ? factorySpace(effects, infoBefore, "whitespace")(code3) : infoBefore(code3);
  }
  function infoBefore(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      effects.exit("codeFencedFence");
      return self.interrupt ? ok3(code3) : effects.check(nonLazyContinuation, atNonLazyBreak, after)(code3);
    }
    effects.enter("codeFencedFenceInfo");
    effects.enter("chunkString", {
      contentType: "string"
    });
    return info(code3);
  }
  function info(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceInfo");
      return infoBefore(code3);
    }
    if (markdownSpace(code3)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceInfo");
      return factorySpace(effects, metaBefore, "whitespace")(code3);
    }
    if (code3 === 96 && code3 === marker) {
      return nok(code3);
    }
    effects.consume(code3);
    return info;
  }
  function metaBefore(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      return infoBefore(code3);
    }
    effects.enter("codeFencedFenceMeta");
    effects.enter("chunkString", {
      contentType: "string"
    });
    return meta(code3);
  }
  function meta(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceMeta");
      return infoBefore(code3);
    }
    if (code3 === 96 && code3 === marker) {
      return nok(code3);
    }
    effects.consume(code3);
    return meta;
  }
  function atNonLazyBreak(code3) {
    return effects.attempt(closeStart, after, contentBefore)(code3);
  }
  function contentBefore(code3) {
    effects.enter("lineEnding");
    effects.consume(code3);
    effects.exit("lineEnding");
    return contentStart;
  }
  function contentStart(code3) {
    return initialPrefix > 0 && markdownSpace(code3) ? factorySpace(effects, beforeContentChunk, "linePrefix", initialPrefix + 1)(code3) : beforeContentChunk(code3);
  }
  function beforeContentChunk(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      return effects.check(nonLazyContinuation, atNonLazyBreak, after)(code3);
    }
    effects.enter("codeFlowValue");
    return contentChunk(code3);
  }
  function contentChunk(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      effects.exit("codeFlowValue");
      return beforeContentChunk(code3);
    }
    effects.consume(code3);
    return contentChunk;
  }
  function after(code3) {
    effects.exit("codeFenced");
    return ok3(code3);
  }
  function tokenizeCloseStart(effects2, ok4, nok2) {
    let size = 0;
    return startBefore;
    function startBefore(code3) {
      effects2.enter("lineEnding");
      effects2.consume(code3);
      effects2.exit("lineEnding");
      return start2;
    }
    function start2(code3) {
      effects2.enter("codeFencedFence");
      return markdownSpace(code3) ? factorySpace(effects2, beforeSequenceClose, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code3) : beforeSequenceClose(code3);
    }
    function beforeSequenceClose(code3) {
      if (code3 === marker) {
        effects2.enter("codeFencedFenceSequence");
        return sequenceClose(code3);
      }
      return nok2(code3);
    }
    function sequenceClose(code3) {
      if (code3 === marker) {
        size++;
        effects2.consume(code3);
        return sequenceClose;
      }
      if (size >= sizeOpen) {
        effects2.exit("codeFencedFenceSequence");
        return markdownSpace(code3) ? factorySpace(effects2, sequenceCloseAfter, "whitespace")(code3) : sequenceCloseAfter(code3);
      }
      return nok2(code3);
    }
    function sequenceCloseAfter(code3) {
      if (code3 === null || markdownLineEnding(code3)) {
        effects2.exit("codeFencedFence");
        return ok4(code3);
      }
      return nok2(code3);
    }
  }
}
function tokenizeNonLazyContinuation(effects, ok3, nok) {
  const self = this;
  return start;
  function start(code3) {
    if (code3 === null) {
      return nok(code3);
    }
    effects.enter("lineEnding");
    effects.consume(code3);
    effects.exit("lineEnding");
    return lineStart;
  }
  function lineStart(code3) {
    return self.parser.lazy[self.now().line] ? nok(code3) : ok3(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/code-indented.js
var codeIndented = {
  name: "codeIndented",
  tokenize: tokenizeCodeIndented
};
var furtherStart = {
  partial: true,
  tokenize: tokenizeFurtherStart
};
function tokenizeCodeIndented(effects, ok3, nok) {
  const self = this;
  return start;
  function start(code3) {
    effects.enter("codeIndented");
    return factorySpace(effects, afterPrefix, "linePrefix", 4 + 1)(code3);
  }
  function afterPrefix(code3) {
    const tail = self.events[self.events.length - 1];
    return tail && tail[1].type === "linePrefix" && tail[2].sliceSerialize(tail[1], true).length >= 4 ? atBreak(code3) : nok(code3);
  }
  function atBreak(code3) {
    if (code3 === null) {
      return after(code3);
    }
    if (markdownLineEnding(code3)) {
      return effects.attempt(furtherStart, atBreak, after)(code3);
    }
    effects.enter("codeFlowValue");
    return inside(code3);
  }
  function inside(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      effects.exit("codeFlowValue");
      return atBreak(code3);
    }
    effects.consume(code3);
    return inside;
  }
  function after(code3) {
    effects.exit("codeIndented");
    return ok3(code3);
  }
}
function tokenizeFurtherStart(effects, ok3, nok) {
  const self = this;
  return furtherStart2;
  function furtherStart2(code3) {
    if (self.parser.lazy[self.now().line]) {
      return nok(code3);
    }
    if (markdownLineEnding(code3)) {
      effects.enter("lineEnding");
      effects.consume(code3);
      effects.exit("lineEnding");
      return furtherStart2;
    }
    return factorySpace(effects, afterPrefix, "linePrefix", 4 + 1)(code3);
  }
  function afterPrefix(code3) {
    const tail = self.events[self.events.length - 1];
    return tail && tail[1].type === "linePrefix" && tail[2].sliceSerialize(tail[1], true).length >= 4 ? ok3(code3) : markdownLineEnding(code3) ? furtherStart2(code3) : nok(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/code-text.js
var codeText = {
  name: "codeText",
  previous,
  resolve: resolveCodeText,
  tokenize: tokenizeCodeText
};
function resolveCodeText(events) {
  let tailExitIndex = events.length - 4;
  let headEnterIndex = 3;
  let index2;
  let enter;
  if ((events[headEnterIndex][1].type === "lineEnding" || events[headEnterIndex][1].type === "space") && (events[tailExitIndex][1].type === "lineEnding" || events[tailExitIndex][1].type === "space")) {
    index2 = headEnterIndex;
    while (++index2 < tailExitIndex) {
      if (events[index2][1].type === "codeTextData") {
        events[headEnterIndex][1].type = "codeTextPadding";
        events[tailExitIndex][1].type = "codeTextPadding";
        headEnterIndex += 2;
        tailExitIndex -= 2;
        break;
      }
    }
  }
  index2 = headEnterIndex - 1;
  tailExitIndex++;
  while (++index2 <= tailExitIndex) {
    if (enter === void 0) {
      if (index2 !== tailExitIndex && events[index2][1].type !== "lineEnding") {
        enter = index2;
      }
    } else if (index2 === tailExitIndex || events[index2][1].type === "lineEnding") {
      events[enter][1].type = "codeTextData";
      if (index2 !== enter + 2) {
        events[enter][1].end = events[index2 - 1][1].end;
        events.splice(enter + 2, index2 - enter - 2);
        tailExitIndex -= index2 - enter - 2;
        index2 = enter + 2;
      }
      enter = void 0;
    }
  }
  return events;
}
function previous(code3) {
  return code3 !== 96 || this.events[this.events.length - 1][1].type === "characterEscape";
}
function tokenizeCodeText(effects, ok3, nok) {
  const self = this;
  let sizeOpen = 0;
  let size;
  let token;
  return start;
  function start(code3) {
    effects.enter("codeText");
    effects.enter("codeTextSequence");
    return sequenceOpen(code3);
  }
  function sequenceOpen(code3) {
    if (code3 === 96) {
      effects.consume(code3);
      sizeOpen++;
      return sequenceOpen;
    }
    effects.exit("codeTextSequence");
    return between(code3);
  }
  function between(code3) {
    if (code3 === null) {
      return nok(code3);
    }
    if (code3 === 32) {
      effects.enter("space");
      effects.consume(code3);
      effects.exit("space");
      return between;
    }
    if (code3 === 96) {
      token = effects.enter("codeTextSequence");
      size = 0;
      return sequenceClose(code3);
    }
    if (markdownLineEnding(code3)) {
      effects.enter("lineEnding");
      effects.consume(code3);
      effects.exit("lineEnding");
      return between;
    }
    effects.enter("codeTextData");
    return data(code3);
  }
  function data(code3) {
    if (code3 === null || code3 === 32 || code3 === 96 || markdownLineEnding(code3)) {
      effects.exit("codeTextData");
      return between(code3);
    }
    effects.consume(code3);
    return data;
  }
  function sequenceClose(code3) {
    if (code3 === 96) {
      effects.consume(code3);
      size++;
      return sequenceClose;
    }
    if (size === sizeOpen) {
      effects.exit("codeTextSequence");
      effects.exit("codeText");
      return ok3(code3);
    }
    token.type = "codeTextData";
    return data(code3);
  }
}

// node_modules/micromark-util-subtokenize/lib/splice-buffer.js
var SpliceBuffer = class {
  /**
   * @param {ReadonlyArray<T> | null | undefined} [initial]
   *   Initial items (optional).
   * @returns
   *   Splice buffer.
   */
  constructor(initial) {
    this.left = initial ? [...initial] : [];
    this.right = [];
  }
  /**
   * Array access;
   * does not move the cursor.
   *
   * @param {number} index
   *   Index.
   * @return {T}
   *   Item.
   */
  get(index2) {
    if (index2 < 0 || index2 >= this.left.length + this.right.length) {
      throw new RangeError("Cannot access index `" + index2 + "` in a splice buffer of size `" + (this.left.length + this.right.length) + "`");
    }
    if (index2 < this.left.length) return this.left[index2];
    return this.right[this.right.length - index2 + this.left.length - 1];
  }
  /**
   * The length of the splice buffer, one greater than the largest index in the
   * array.
   */
  get length() {
    return this.left.length + this.right.length;
  }
  /**
   * Remove and return `list[0]`;
   * moves the cursor to `0`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  shift() {
    this.setCursor(0);
    return this.right.pop();
  }
  /**
   * Slice the buffer to get an array;
   * does not move the cursor.
   *
   * @param {number} start
   *   Start.
   * @param {number | null | undefined} [end]
   *   End (optional).
   * @returns {Array<T>}
   *   Array of items.
   */
  slice(start, end) {
    const stop = end === null || end === void 0 ? Number.POSITIVE_INFINITY : end;
    if (stop < this.left.length) {
      return this.left.slice(start, stop);
    }
    if (start > this.left.length) {
      return this.right.slice(this.right.length - stop + this.left.length, this.right.length - start + this.left.length).reverse();
    }
    return this.left.slice(start).concat(this.right.slice(this.right.length - stop + this.left.length).reverse());
  }
  /**
   * Mimics the behavior of Array.prototype.splice() except for the change of
   * interface necessary to avoid segfaults when patching in very large arrays.
   *
   * This operation moves cursor is moved to `start` and results in the cursor
   * placed after any inserted items.
   *
   * @param {number} start
   *   Start;
   *   zero-based index at which to start changing the array;
   *   negative numbers count backwards from the end of the array and values
   *   that are out-of bounds are clamped to the appropriate end of the array.
   * @param {number | null | undefined} [deleteCount=0]
   *   Delete count (default: `0`);
   *   maximum number of elements to delete, starting from start.
   * @param {Array<T> | null | undefined} [items=[]]
   *   Items to include in place of the deleted items (default: `[]`).
   * @return {Array<T>}
   *   Any removed items.
   */
  splice(start, deleteCount, items) {
    const count = deleteCount || 0;
    this.setCursor(Math.trunc(start));
    const removed = this.right.splice(this.right.length - count, Number.POSITIVE_INFINITY);
    if (items) chunkedPush(this.left, items);
    return removed.reverse();
  }
  /**
   * Remove and return the highest-numbered item in the array, so
   * `list[list.length - 1]`;
   * Moves the cursor to `length`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  pop() {
    this.setCursor(Number.POSITIVE_INFINITY);
    return this.left.pop();
  }
  /**
   * Inserts a single item to the high-numbered side of the array;
   * moves the cursor to `length`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  push(item) {
    this.setCursor(Number.POSITIVE_INFINITY);
    this.left.push(item);
  }
  /**
   * Inserts many items to the high-numbered side of the array.
   * Moves the cursor to `length`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  pushMany(items) {
    this.setCursor(Number.POSITIVE_INFINITY);
    chunkedPush(this.left, items);
  }
  /**
   * Inserts a single item to the low-numbered side of the array;
   * Moves the cursor to `0`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  unshift(item) {
    this.setCursor(0);
    this.right.push(item);
  }
  /**
   * Inserts many items to the low-numbered side of the array;
   * moves the cursor to `0`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  unshiftMany(items) {
    this.setCursor(0);
    chunkedPush(this.right, items.reverse());
  }
  /**
   * Move the cursor to a specific position in the array. Requires
   * time proportional to the distance moved.
   *
   * If `n < 0`, the cursor will end up at the beginning.
   * If `n > length`, the cursor will end up at the end.
   *
   * @param {number} n
   *   Position.
   * @return {undefined}
   *   Nothing.
   */
  setCursor(n) {
    if (n === this.left.length || n > this.left.length && this.right.length === 0 || n < 0 && this.left.length === 0) return;
    if (n < this.left.length) {
      const removed = this.left.splice(n, Number.POSITIVE_INFINITY);
      chunkedPush(this.right, removed.reverse());
    } else {
      const removed = this.right.splice(this.left.length + this.right.length - n, Number.POSITIVE_INFINITY);
      chunkedPush(this.left, removed.reverse());
    }
  }
};
function chunkedPush(list3, right) {
  let chunkStart = 0;
  if (right.length < 1e4) {
    list3.push(...right);
  } else {
    while (chunkStart < right.length) {
      list3.push(...right.slice(chunkStart, chunkStart + 1e4));
      chunkStart += 1e4;
    }
  }
}

// node_modules/micromark-util-subtokenize/index.js
function subtokenize(eventsArray) {
  const jumps = {};
  let index2 = -1;
  let event;
  let lineIndex;
  let otherIndex;
  let otherEvent;
  let parameters;
  let subevents;
  let more;
  const events = new SpliceBuffer(eventsArray);
  while (++index2 < events.length) {
    while (index2 in jumps) {
      index2 = jumps[index2];
    }
    event = events.get(index2);
    if (index2 && event[1].type === "chunkFlow" && events.get(index2 - 1)[1].type === "listItemPrefix") {
      subevents = event[1]._tokenizer.events;
      otherIndex = 0;
      if (otherIndex < subevents.length && subevents[otherIndex][1].type === "lineEndingBlank") {
        otherIndex += 2;
      }
      if (otherIndex < subevents.length && subevents[otherIndex][1].type === "content") {
        while (++otherIndex < subevents.length) {
          if (subevents[otherIndex][1].type === "content") {
            break;
          }
          if (subevents[otherIndex][1].type === "chunkText") {
            subevents[otherIndex][1]._isInFirstContentOfListItem = true;
            otherIndex++;
          }
        }
      }
    }
    if (event[0] === "enter") {
      if (event[1].contentType) {
        Object.assign(jumps, subcontent(events, index2));
        index2 = jumps[index2];
        more = true;
      }
    } else if (event[1]._container) {
      otherIndex = index2;
      lineIndex = void 0;
      while (otherIndex--) {
        otherEvent = events.get(otherIndex);
        if (otherEvent[1].type === "lineEnding" || otherEvent[1].type === "lineEndingBlank") {
          if (otherEvent[0] === "enter") {
            if (lineIndex) {
              events.get(lineIndex)[1].type = "lineEndingBlank";
            }
            otherEvent[1].type = "lineEnding";
            lineIndex = otherIndex;
          }
        } else if (otherEvent[1].type === "linePrefix" || otherEvent[1].type === "listItemIndent") {
        } else {
          break;
        }
      }
      if (lineIndex) {
        event[1].end = {
          ...events.get(lineIndex)[1].start
        };
        parameters = events.slice(lineIndex, index2);
        parameters.unshift(event);
        events.splice(lineIndex, index2 - lineIndex + 1, parameters);
      }
    }
  }
  splice(eventsArray, 0, Number.POSITIVE_INFINITY, events.slice(0));
  return !more;
}
function subcontent(events, eventIndex) {
  const token = events.get(eventIndex)[1];
  const context = events.get(eventIndex)[2];
  let startPosition = eventIndex - 1;
  const startPositions = [];
  let tokenizer = token._tokenizer;
  if (!tokenizer) {
    tokenizer = context.parser[token.contentType](token.start);
    if (token._contentTypeTextTrailing) {
      tokenizer._contentTypeTextTrailing = true;
    }
  }
  const childEvents = tokenizer.events;
  const jumps = [];
  const gaps = {};
  let stream;
  let previous4;
  let index2 = -1;
  let current = token;
  let adjust = 0;
  let start = 0;
  const breaks = [start];
  while (current) {
    while (events.get(++startPosition)[1] !== current) {
    }
    startPositions.push(startPosition);
    if (!current._tokenizer) {
      stream = context.sliceStream(current);
      if (!current.next) {
        stream.push(null);
      }
      if (previous4) {
        tokenizer.defineSkip(current.start);
      }
      if (current._isInFirstContentOfListItem) {
        tokenizer._gfmTasklistFirstContentOfListItem = true;
      }
      tokenizer.write(stream);
      if (current._isInFirstContentOfListItem) {
        tokenizer._gfmTasklistFirstContentOfListItem = void 0;
      }
    }
    previous4 = current;
    current = current.next;
  }
  current = token;
  while (++index2 < childEvents.length) {
    if (
      // Find a void token that includes a break.
      childEvents[index2][0] === "exit" && childEvents[index2 - 1][0] === "enter" && childEvents[index2][1].type === childEvents[index2 - 1][1].type && childEvents[index2][1].start.line !== childEvents[index2][1].end.line
    ) {
      start = index2 + 1;
      breaks.push(start);
      current._tokenizer = void 0;
      current.previous = void 0;
      current = current.next;
    }
  }
  tokenizer.events = [];
  if (current) {
    current._tokenizer = void 0;
    current.previous = void 0;
  } else {
    breaks.pop();
  }
  index2 = breaks.length;
  while (index2--) {
    const slice = childEvents.slice(breaks[index2], breaks[index2 + 1]);
    const start2 = startPositions.pop();
    jumps.push([start2, start2 + slice.length - 1]);
    events.splice(start2, 2, slice);
  }
  jumps.reverse();
  index2 = -1;
  while (++index2 < jumps.length) {
    gaps[adjust + jumps[index2][0]] = adjust + jumps[index2][1];
    adjust += jumps[index2][1] - jumps[index2][0] - 1;
  }
  return gaps;
}

// node_modules/micromark-core-commonmark/lib/content.js
var content2 = {
  resolve: resolveContent,
  tokenize: tokenizeContent
};
var continuationConstruct = {
  partial: true,
  tokenize: tokenizeContinuation
};
function resolveContent(events) {
  subtokenize(events);
  return events;
}
function tokenizeContent(effects, ok3) {
  let previous4;
  return chunkStart;
  function chunkStart(code3) {
    effects.enter("content");
    previous4 = effects.enter("chunkContent", {
      contentType: "content"
    });
    return chunkInside(code3);
  }
  function chunkInside(code3) {
    if (code3 === null) {
      return contentEnd(code3);
    }
    if (markdownLineEnding(code3)) {
      return effects.check(continuationConstruct, contentContinue, contentEnd)(code3);
    }
    effects.consume(code3);
    return chunkInside;
  }
  function contentEnd(code3) {
    effects.exit("chunkContent");
    effects.exit("content");
    return ok3(code3);
  }
  function contentContinue(code3) {
    effects.consume(code3);
    effects.exit("chunkContent");
    previous4.next = effects.enter("chunkContent", {
      contentType: "content",
      previous: previous4
    });
    previous4 = previous4.next;
    return chunkInside;
  }
}
function tokenizeContinuation(effects, ok3, nok) {
  const self = this;
  return startLookahead;
  function startLookahead(code3) {
    effects.exit("chunkContent");
    effects.enter("lineEnding");
    effects.consume(code3);
    effects.exit("lineEnding");
    return factorySpace(effects, prefixed, "linePrefix");
  }
  function prefixed(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      return nok(code3);
    }
    const tail = self.events[self.events.length - 1];
    if (!self.parser.constructs.disable.null.includes("codeIndented") && tail && tail[1].type === "linePrefix" && tail[2].sliceSerialize(tail[1], true).length >= 4) {
      return ok3(code3);
    }
    return effects.interrupt(self.parser.constructs.flow, nok, ok3)(code3);
  }
}

// node_modules/micromark-factory-destination/index.js
function factoryDestination(effects, ok3, nok, type, literalType, literalMarkerType, rawType, stringType, max) {
  const limit = max || Number.POSITIVE_INFINITY;
  let balance = 0;
  return start;
  function start(code3) {
    if (code3 === 60) {
      effects.enter(type);
      effects.enter(literalType);
      effects.enter(literalMarkerType);
      effects.consume(code3);
      effects.exit(literalMarkerType);
      return enclosedBefore;
    }
    if (code3 === null || code3 === 32 || code3 === 41 || asciiControl(code3)) {
      return nok(code3);
    }
    effects.enter(type);
    effects.enter(rawType);
    effects.enter(stringType);
    effects.enter("chunkString", {
      contentType: "string"
    });
    return raw(code3);
  }
  function enclosedBefore(code3) {
    if (code3 === 62) {
      effects.enter(literalMarkerType);
      effects.consume(code3);
      effects.exit(literalMarkerType);
      effects.exit(literalType);
      effects.exit(type);
      return ok3;
    }
    effects.enter(stringType);
    effects.enter("chunkString", {
      contentType: "string"
    });
    return enclosed(code3);
  }
  function enclosed(code3) {
    if (code3 === 62) {
      effects.exit("chunkString");
      effects.exit(stringType);
      return enclosedBefore(code3);
    }
    if (code3 === null || code3 === 60 || markdownLineEnding(code3)) {
      return nok(code3);
    }
    effects.consume(code3);
    return code3 === 92 ? enclosedEscape : enclosed;
  }
  function enclosedEscape(code3) {
    if (code3 === 60 || code3 === 62 || code3 === 92) {
      effects.consume(code3);
      return enclosed;
    }
    return enclosed(code3);
  }
  function raw(code3) {
    if (!balance && (code3 === null || code3 === 41 || markdownLineEndingOrSpace(code3))) {
      effects.exit("chunkString");
      effects.exit(stringType);
      effects.exit(rawType);
      effects.exit(type);
      return ok3(code3);
    }
    if (balance < limit && code3 === 40) {
      effects.consume(code3);
      balance++;
      return raw;
    }
    if (code3 === 41) {
      effects.consume(code3);
      balance--;
      return raw;
    }
    if (code3 === null || code3 === 32 || code3 === 40 || asciiControl(code3)) {
      return nok(code3);
    }
    effects.consume(code3);
    return code3 === 92 ? rawEscape : raw;
  }
  function rawEscape(code3) {
    if (code3 === 40 || code3 === 41 || code3 === 92) {
      effects.consume(code3);
      return raw;
    }
    return raw(code3);
  }
}

// node_modules/micromark-factory-label/index.js
function factoryLabel(effects, ok3, nok, type, markerType, stringType) {
  const self = this;
  let size = 0;
  let seen;
  return start;
  function start(code3) {
    effects.enter(type);
    effects.enter(markerType);
    effects.consume(code3);
    effects.exit(markerType);
    effects.enter(stringType);
    return atBreak;
  }
  function atBreak(code3) {
    if (size > 999 || code3 === null || code3 === 91 || code3 === 93 && !seen || // To do: remove in the future once we’ve switched from
    // `micromark-extension-footnote` to `micromark-extension-gfm-footnote`,
    // which doesn’t need this.
    // Hidden footnotes hook.
    /* c8 ignore next 3 */
    code3 === 94 && !size && "_hiddenFootnoteSupport" in self.parser.constructs) {
      return nok(code3);
    }
    if (code3 === 93) {
      effects.exit(stringType);
      effects.enter(markerType);
      effects.consume(code3);
      effects.exit(markerType);
      effects.exit(type);
      return ok3;
    }
    if (markdownLineEnding(code3)) {
      effects.enter("lineEnding");
      effects.consume(code3);
      effects.exit("lineEnding");
      return atBreak;
    }
    effects.enter("chunkString", {
      contentType: "string"
    });
    return labelInside(code3);
  }
  function labelInside(code3) {
    if (code3 === null || code3 === 91 || code3 === 93 || markdownLineEnding(code3) || size++ > 999) {
      effects.exit("chunkString");
      return atBreak(code3);
    }
    effects.consume(code3);
    if (!seen) seen = !markdownSpace(code3);
    return code3 === 92 ? labelEscape : labelInside;
  }
  function labelEscape(code3) {
    if (code3 === 91 || code3 === 92 || code3 === 93) {
      effects.consume(code3);
      size++;
      return labelInside;
    }
    return labelInside(code3);
  }
}

// node_modules/micromark-factory-title/index.js
function factoryTitle(effects, ok3, nok, type, markerType, stringType) {
  let marker;
  return start;
  function start(code3) {
    if (code3 === 34 || code3 === 39 || code3 === 40) {
      effects.enter(type);
      effects.enter(markerType);
      effects.consume(code3);
      effects.exit(markerType);
      marker = code3 === 40 ? 41 : code3;
      return begin;
    }
    return nok(code3);
  }
  function begin(code3) {
    if (code3 === marker) {
      effects.enter(markerType);
      effects.consume(code3);
      effects.exit(markerType);
      effects.exit(type);
      return ok3;
    }
    effects.enter(stringType);
    return atBreak(code3);
  }
  function atBreak(code3) {
    if (code3 === marker) {
      effects.exit(stringType);
      return begin(marker);
    }
    if (code3 === null) {
      return nok(code3);
    }
    if (markdownLineEnding(code3)) {
      effects.enter("lineEnding");
      effects.consume(code3);
      effects.exit("lineEnding");
      return factorySpace(effects, atBreak, "linePrefix");
    }
    effects.enter("chunkString", {
      contentType: "string"
    });
    return inside(code3);
  }
  function inside(code3) {
    if (code3 === marker || code3 === null || markdownLineEnding(code3)) {
      effects.exit("chunkString");
      return atBreak(code3);
    }
    effects.consume(code3);
    return code3 === 92 ? escape : inside;
  }
  function escape(code3) {
    if (code3 === marker || code3 === 92) {
      effects.consume(code3);
      return inside;
    }
    return inside(code3);
  }
}

// node_modules/micromark-factory-whitespace/index.js
function factoryWhitespace(effects, ok3) {
  let seen;
  return start;
  function start(code3) {
    if (markdownLineEnding(code3)) {
      effects.enter("lineEnding");
      effects.consume(code3);
      effects.exit("lineEnding");
      seen = true;
      return start;
    }
    if (markdownSpace(code3)) {
      return factorySpace(effects, start, seen ? "linePrefix" : "lineSuffix")(code3);
    }
    return ok3(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/definition.js
var definition = {
  name: "definition",
  tokenize: tokenizeDefinition
};
var titleBefore = {
  partial: true,
  tokenize: tokenizeTitleBefore
};
function tokenizeDefinition(effects, ok3, nok) {
  const self = this;
  let identifier;
  return start;
  function start(code3) {
    effects.enter("definition");
    return before(code3);
  }
  function before(code3) {
    return factoryLabel.call(
      self,
      effects,
      labelAfter,
      // Note: we don’t need to reset the way `markdown-rs` does.
      nok,
      "definitionLabel",
      "definitionLabelMarker",
      "definitionLabelString"
    )(code3);
  }
  function labelAfter(code3) {
    identifier = normalizeIdentifier(self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1));
    if (code3 === 58) {
      effects.enter("definitionMarker");
      effects.consume(code3);
      effects.exit("definitionMarker");
      return markerAfter;
    }
    return nok(code3);
  }
  function markerAfter(code3) {
    return markdownLineEndingOrSpace(code3) ? factoryWhitespace(effects, destinationBefore)(code3) : destinationBefore(code3);
  }
  function destinationBefore(code3) {
    return factoryDestination(
      effects,
      destinationAfter,
      // Note: we don’t need to reset the way `markdown-rs` does.
      nok,
      "definitionDestination",
      "definitionDestinationLiteral",
      "definitionDestinationLiteralMarker",
      "definitionDestinationRaw",
      "definitionDestinationString"
    )(code3);
  }
  function destinationAfter(code3) {
    return effects.attempt(titleBefore, after, after)(code3);
  }
  function after(code3) {
    return markdownSpace(code3) ? factorySpace(effects, afterWhitespace, "whitespace")(code3) : afterWhitespace(code3);
  }
  function afterWhitespace(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      effects.exit("definition");
      self.parser.defined.push(identifier);
      return ok3(code3);
    }
    return nok(code3);
  }
}
function tokenizeTitleBefore(effects, ok3, nok) {
  return titleBefore2;
  function titleBefore2(code3) {
    return markdownLineEndingOrSpace(code3) ? factoryWhitespace(effects, beforeMarker)(code3) : nok(code3);
  }
  function beforeMarker(code3) {
    return factoryTitle(effects, titleAfter, nok, "definitionTitle", "definitionTitleMarker", "definitionTitleString")(code3);
  }
  function titleAfter(code3) {
    return markdownSpace(code3) ? factorySpace(effects, titleAfterOptionalWhitespace, "whitespace")(code3) : titleAfterOptionalWhitespace(code3);
  }
  function titleAfterOptionalWhitespace(code3) {
    return code3 === null || markdownLineEnding(code3) ? ok3(code3) : nok(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/hard-break-escape.js
var hardBreakEscape = {
  name: "hardBreakEscape",
  tokenize: tokenizeHardBreakEscape
};
function tokenizeHardBreakEscape(effects, ok3, nok) {
  return start;
  function start(code3) {
    effects.enter("hardBreakEscape");
    effects.consume(code3);
    return after;
  }
  function after(code3) {
    if (markdownLineEnding(code3)) {
      effects.exit("hardBreakEscape");
      return ok3(code3);
    }
    return nok(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/heading-atx.js
var headingAtx = {
  name: "headingAtx",
  resolve: resolveHeadingAtx,
  tokenize: tokenizeHeadingAtx
};
function resolveHeadingAtx(events, context) {
  let contentEnd = events.length - 2;
  let contentStart = 3;
  let content3;
  let text5;
  if (events[contentStart][1].type === "whitespace") {
    contentStart += 2;
  }
  if (contentEnd - 2 > contentStart && events[contentEnd][1].type === "whitespace") {
    contentEnd -= 2;
  }
  if (events[contentEnd][1].type === "atxHeadingSequence" && (contentStart === contentEnd - 1 || contentEnd - 4 > contentStart && events[contentEnd - 2][1].type === "whitespace")) {
    contentEnd -= contentStart + 1 === contentEnd ? 2 : 4;
  }
  if (contentEnd > contentStart) {
    content3 = {
      type: "atxHeadingText",
      start: events[contentStart][1].start,
      end: events[contentEnd][1].end
    };
    text5 = {
      type: "chunkText",
      start: events[contentStart][1].start,
      end: events[contentEnd][1].end,
      contentType: "text"
    };
    splice(events, contentStart, contentEnd - contentStart + 1, [["enter", content3, context], ["enter", text5, context], ["exit", text5, context], ["exit", content3, context]]);
  }
  return events;
}
function tokenizeHeadingAtx(effects, ok3, nok) {
  let size = 0;
  return start;
  function start(code3) {
    effects.enter("atxHeading");
    return before(code3);
  }
  function before(code3) {
    effects.enter("atxHeadingSequence");
    return sequenceOpen(code3);
  }
  function sequenceOpen(code3) {
    if (code3 === 35 && size++ < 6) {
      effects.consume(code3);
      return sequenceOpen;
    }
    if (code3 === null || markdownLineEndingOrSpace(code3)) {
      effects.exit("atxHeadingSequence");
      return atBreak(code3);
    }
    return nok(code3);
  }
  function atBreak(code3) {
    if (code3 === 35) {
      effects.enter("atxHeadingSequence");
      return sequenceFurther(code3);
    }
    if (code3 === null || markdownLineEnding(code3)) {
      effects.exit("atxHeading");
      return ok3(code3);
    }
    if (markdownSpace(code3)) {
      return factorySpace(effects, atBreak, "whitespace")(code3);
    }
    effects.enter("atxHeadingText");
    return data(code3);
  }
  function sequenceFurther(code3) {
    if (code3 === 35) {
      effects.consume(code3);
      return sequenceFurther;
    }
    effects.exit("atxHeadingSequence");
    return atBreak(code3);
  }
  function data(code3) {
    if (code3 === null || code3 === 35 || markdownLineEndingOrSpace(code3)) {
      effects.exit("atxHeadingText");
      return atBreak(code3);
    }
    effects.consume(code3);
    return data;
  }
}

// node_modules/micromark-util-html-tag-name/index.js
var htmlBlockNames = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
];
var htmlRawNames = ["pre", "script", "style", "textarea"];

// node_modules/micromark-core-commonmark/lib/html-flow.js
var htmlFlow = {
  concrete: true,
  name: "htmlFlow",
  resolveTo: resolveToHtmlFlow,
  tokenize: tokenizeHtmlFlow
};
var blankLineBefore = {
  partial: true,
  tokenize: tokenizeBlankLineBefore
};
var nonLazyContinuationStart = {
  partial: true,
  tokenize: tokenizeNonLazyContinuationStart
};
function resolveToHtmlFlow(events) {
  let index2 = events.length;
  while (index2--) {
    if (events[index2][0] === "enter" && events[index2][1].type === "htmlFlow") {
      break;
    }
  }
  if (index2 > 1 && events[index2 - 2][1].type === "linePrefix") {
    events[index2][1].start = events[index2 - 2][1].start;
    events[index2 + 1][1].start = events[index2 - 2][1].start;
    events.splice(index2 - 2, 2);
  }
  return events;
}
function tokenizeHtmlFlow(effects, ok3, nok) {
  const self = this;
  let marker;
  let closingTag;
  let buffer;
  let index2;
  let markerB;
  return start;
  function start(code3) {
    return before(code3);
  }
  function before(code3) {
    effects.enter("htmlFlow");
    effects.enter("htmlFlowData");
    effects.consume(code3);
    return open;
  }
  function open(code3) {
    if (code3 === 33) {
      effects.consume(code3);
      return declarationOpen;
    }
    if (code3 === 47) {
      effects.consume(code3);
      closingTag = true;
      return tagCloseStart;
    }
    if (code3 === 63) {
      effects.consume(code3);
      marker = 3;
      return self.interrupt ? ok3 : continuationDeclarationInside;
    }
    if (asciiAlpha(code3)) {
      effects.consume(code3);
      buffer = String.fromCharCode(code3);
      return tagName;
    }
    return nok(code3);
  }
  function declarationOpen(code3) {
    if (code3 === 45) {
      effects.consume(code3);
      marker = 2;
      return commentOpenInside;
    }
    if (code3 === 91) {
      effects.consume(code3);
      marker = 5;
      index2 = 0;
      return cdataOpenInside;
    }
    if (asciiAlpha(code3)) {
      effects.consume(code3);
      marker = 4;
      return self.interrupt ? ok3 : continuationDeclarationInside;
    }
    return nok(code3);
  }
  function commentOpenInside(code3) {
    if (code3 === 45) {
      effects.consume(code3);
      return self.interrupt ? ok3 : continuationDeclarationInside;
    }
    return nok(code3);
  }
  function cdataOpenInside(code3) {
    const value = "CDATA[";
    if (code3 === value.charCodeAt(index2++)) {
      effects.consume(code3);
      if (index2 === value.length) {
        return self.interrupt ? ok3 : continuation;
      }
      return cdataOpenInside;
    }
    return nok(code3);
  }
  function tagCloseStart(code3) {
    if (asciiAlpha(code3)) {
      effects.consume(code3);
      buffer = String.fromCharCode(code3);
      return tagName;
    }
    return nok(code3);
  }
  function tagName(code3) {
    if (code3 === null || code3 === 47 || code3 === 62 || markdownLineEndingOrSpace(code3)) {
      const slash = code3 === 47;
      const name2 = buffer.toLowerCase();
      if (!slash && !closingTag && htmlRawNames.includes(name2)) {
        marker = 1;
        return self.interrupt ? ok3(code3) : continuation(code3);
      }
      if (htmlBlockNames.includes(buffer.toLowerCase())) {
        marker = 6;
        if (slash) {
          effects.consume(code3);
          return basicSelfClosing;
        }
        return self.interrupt ? ok3(code3) : continuation(code3);
      }
      marker = 7;
      return self.interrupt && !self.parser.lazy[self.now().line] ? nok(code3) : closingTag ? completeClosingTagAfter(code3) : completeAttributeNameBefore(code3);
    }
    if (code3 === 45 || asciiAlphanumeric(code3)) {
      effects.consume(code3);
      buffer += String.fromCharCode(code3);
      return tagName;
    }
    return nok(code3);
  }
  function basicSelfClosing(code3) {
    if (code3 === 62) {
      effects.consume(code3);
      return self.interrupt ? ok3 : continuation;
    }
    return nok(code3);
  }
  function completeClosingTagAfter(code3) {
    if (markdownSpace(code3)) {
      effects.consume(code3);
      return completeClosingTagAfter;
    }
    return completeEnd(code3);
  }
  function completeAttributeNameBefore(code3) {
    if (code3 === 47) {
      effects.consume(code3);
      return completeEnd;
    }
    if (code3 === 58 || code3 === 95 || asciiAlpha(code3)) {
      effects.consume(code3);
      return completeAttributeName;
    }
    if (markdownSpace(code3)) {
      effects.consume(code3);
      return completeAttributeNameBefore;
    }
    return completeEnd(code3);
  }
  function completeAttributeName(code3) {
    if (code3 === 45 || code3 === 46 || code3 === 58 || code3 === 95 || asciiAlphanumeric(code3)) {
      effects.consume(code3);
      return completeAttributeName;
    }
    return completeAttributeNameAfter(code3);
  }
  function completeAttributeNameAfter(code3) {
    if (code3 === 61) {
      effects.consume(code3);
      return completeAttributeValueBefore;
    }
    if (markdownSpace(code3)) {
      effects.consume(code3);
      return completeAttributeNameAfter;
    }
    return completeAttributeNameBefore(code3);
  }
  function completeAttributeValueBefore(code3) {
    if (code3 === null || code3 === 60 || code3 === 61 || code3 === 62 || code3 === 96) {
      return nok(code3);
    }
    if (code3 === 34 || code3 === 39) {
      effects.consume(code3);
      markerB = code3;
      return completeAttributeValueQuoted;
    }
    if (markdownSpace(code3)) {
      effects.consume(code3);
      return completeAttributeValueBefore;
    }
    return completeAttributeValueUnquoted(code3);
  }
  function completeAttributeValueQuoted(code3) {
    if (code3 === markerB) {
      effects.consume(code3);
      markerB = null;
      return completeAttributeValueQuotedAfter;
    }
    if (code3 === null || markdownLineEnding(code3)) {
      return nok(code3);
    }
    effects.consume(code3);
    return completeAttributeValueQuoted;
  }
  function completeAttributeValueUnquoted(code3) {
    if (code3 === null || code3 === 34 || code3 === 39 || code3 === 47 || code3 === 60 || code3 === 61 || code3 === 62 || code3 === 96 || markdownLineEndingOrSpace(code3)) {
      return completeAttributeNameAfter(code3);
    }
    effects.consume(code3);
    return completeAttributeValueUnquoted;
  }
  function completeAttributeValueQuotedAfter(code3) {
    if (code3 === 47 || code3 === 62 || markdownSpace(code3)) {
      return completeAttributeNameBefore(code3);
    }
    return nok(code3);
  }
  function completeEnd(code3) {
    if (code3 === 62) {
      effects.consume(code3);
      return completeAfter;
    }
    return nok(code3);
  }
  function completeAfter(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      return continuation(code3);
    }
    if (markdownSpace(code3)) {
      effects.consume(code3);
      return completeAfter;
    }
    return nok(code3);
  }
  function continuation(code3) {
    if (code3 === 45 && marker === 2) {
      effects.consume(code3);
      return continuationCommentInside;
    }
    if (code3 === 60 && marker === 1) {
      effects.consume(code3);
      return continuationRawTagOpen;
    }
    if (code3 === 62 && marker === 4) {
      effects.consume(code3);
      return continuationClose;
    }
    if (code3 === 63 && marker === 3) {
      effects.consume(code3);
      return continuationDeclarationInside;
    }
    if (code3 === 93 && marker === 5) {
      effects.consume(code3);
      return continuationCdataInside;
    }
    if (markdownLineEnding(code3) && (marker === 6 || marker === 7)) {
      effects.exit("htmlFlowData");
      return effects.check(blankLineBefore, continuationAfter, continuationStart)(code3);
    }
    if (code3 === null || markdownLineEnding(code3)) {
      effects.exit("htmlFlowData");
      return continuationStart(code3);
    }
    effects.consume(code3);
    return continuation;
  }
  function continuationStart(code3) {
    return effects.check(nonLazyContinuationStart, continuationStartNonLazy, continuationAfter)(code3);
  }
  function continuationStartNonLazy(code3) {
    effects.enter("lineEnding");
    effects.consume(code3);
    effects.exit("lineEnding");
    return continuationBefore;
  }
  function continuationBefore(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      return continuationStart(code3);
    }
    effects.enter("htmlFlowData");
    return continuation(code3);
  }
  function continuationCommentInside(code3) {
    if (code3 === 45) {
      effects.consume(code3);
      return continuationDeclarationInside;
    }
    return continuation(code3);
  }
  function continuationRawTagOpen(code3) {
    if (code3 === 47) {
      effects.consume(code3);
      buffer = "";
      return continuationRawEndTag;
    }
    return continuation(code3);
  }
  function continuationRawEndTag(code3) {
    if (code3 === 62) {
      const name2 = buffer.toLowerCase();
      if (htmlRawNames.includes(name2)) {
        effects.consume(code3);
        return continuationClose;
      }
      return continuation(code3);
    }
    if (asciiAlpha(code3) && buffer.length < 8) {
      effects.consume(code3);
      buffer += String.fromCharCode(code3);
      return continuationRawEndTag;
    }
    return continuation(code3);
  }
  function continuationCdataInside(code3) {
    if (code3 === 93) {
      effects.consume(code3);
      return continuationDeclarationInside;
    }
    return continuation(code3);
  }
  function continuationDeclarationInside(code3) {
    if (code3 === 62) {
      effects.consume(code3);
      return continuationClose;
    }
    if (code3 === 45 && marker === 2) {
      effects.consume(code3);
      return continuationDeclarationInside;
    }
    return continuation(code3);
  }
  function continuationClose(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      effects.exit("htmlFlowData");
      return continuationAfter(code3);
    }
    effects.consume(code3);
    return continuationClose;
  }
  function continuationAfter(code3) {
    effects.exit("htmlFlow");
    return ok3(code3);
  }
}
function tokenizeNonLazyContinuationStart(effects, ok3, nok) {
  const self = this;
  return start;
  function start(code3) {
    if (markdownLineEnding(code3)) {
      effects.enter("lineEnding");
      effects.consume(code3);
      effects.exit("lineEnding");
      return after;
    }
    return nok(code3);
  }
  function after(code3) {
    return self.parser.lazy[self.now().line] ? nok(code3) : ok3(code3);
  }
}
function tokenizeBlankLineBefore(effects, ok3, nok) {
  return start;
  function start(code3) {
    effects.enter("lineEnding");
    effects.consume(code3);
    effects.exit("lineEnding");
    return effects.attempt(blankLine, ok3, nok);
  }
}

// node_modules/micromark-core-commonmark/lib/html-text.js
var htmlText = {
  name: "htmlText",
  tokenize: tokenizeHtmlText
};
function tokenizeHtmlText(effects, ok3, nok) {
  const self = this;
  let marker;
  let index2;
  let returnState;
  return start;
  function start(code3) {
    effects.enter("htmlText");
    effects.enter("htmlTextData");
    effects.consume(code3);
    return open;
  }
  function open(code3) {
    if (code3 === 33) {
      effects.consume(code3);
      return declarationOpen;
    }
    if (code3 === 47) {
      effects.consume(code3);
      return tagCloseStart;
    }
    if (code3 === 63) {
      effects.consume(code3);
      return instruction;
    }
    if (asciiAlpha(code3)) {
      effects.consume(code3);
      return tagOpen;
    }
    return nok(code3);
  }
  function declarationOpen(code3) {
    if (code3 === 45) {
      effects.consume(code3);
      return commentOpenInside;
    }
    if (code3 === 91) {
      effects.consume(code3);
      index2 = 0;
      return cdataOpenInside;
    }
    if (asciiAlpha(code3)) {
      effects.consume(code3);
      return declaration;
    }
    return nok(code3);
  }
  function commentOpenInside(code3) {
    if (code3 === 45) {
      effects.consume(code3);
      return commentEnd;
    }
    return nok(code3);
  }
  function comment(code3) {
    if (code3 === null) {
      return nok(code3);
    }
    if (code3 === 45) {
      effects.consume(code3);
      return commentClose;
    }
    if (markdownLineEnding(code3)) {
      returnState = comment;
      return lineEndingBefore(code3);
    }
    effects.consume(code3);
    return comment;
  }
  function commentClose(code3) {
    if (code3 === 45) {
      effects.consume(code3);
      return commentEnd;
    }
    return comment(code3);
  }
  function commentEnd(code3) {
    return code3 === 62 ? end(code3) : code3 === 45 ? commentClose(code3) : comment(code3);
  }
  function cdataOpenInside(code3) {
    const value = "CDATA[";
    if (code3 === value.charCodeAt(index2++)) {
      effects.consume(code3);
      return index2 === value.length ? cdata : cdataOpenInside;
    }
    return nok(code3);
  }
  function cdata(code3) {
    if (code3 === null) {
      return nok(code3);
    }
    if (code3 === 93) {
      effects.consume(code3);
      return cdataClose;
    }
    if (markdownLineEnding(code3)) {
      returnState = cdata;
      return lineEndingBefore(code3);
    }
    effects.consume(code3);
    return cdata;
  }
  function cdataClose(code3) {
    if (code3 === 93) {
      effects.consume(code3);
      return cdataEnd;
    }
    return cdata(code3);
  }
  function cdataEnd(code3) {
    if (code3 === 62) {
      return end(code3);
    }
    if (code3 === 93) {
      effects.consume(code3);
      return cdataEnd;
    }
    return cdata(code3);
  }
  function declaration(code3) {
    if (code3 === null || code3 === 62) {
      return end(code3);
    }
    if (markdownLineEnding(code3)) {
      returnState = declaration;
      return lineEndingBefore(code3);
    }
    effects.consume(code3);
    return declaration;
  }
  function instruction(code3) {
    if (code3 === null) {
      return nok(code3);
    }
    if (code3 === 63) {
      effects.consume(code3);
      return instructionClose;
    }
    if (markdownLineEnding(code3)) {
      returnState = instruction;
      return lineEndingBefore(code3);
    }
    effects.consume(code3);
    return instruction;
  }
  function instructionClose(code3) {
    return code3 === 62 ? end(code3) : instruction(code3);
  }
  function tagCloseStart(code3) {
    if (asciiAlpha(code3)) {
      effects.consume(code3);
      return tagClose;
    }
    return nok(code3);
  }
  function tagClose(code3) {
    if (code3 === 45 || asciiAlphanumeric(code3)) {
      effects.consume(code3);
      return tagClose;
    }
    return tagCloseBetween(code3);
  }
  function tagCloseBetween(code3) {
    if (markdownLineEnding(code3)) {
      returnState = tagCloseBetween;
      return lineEndingBefore(code3);
    }
    if (markdownSpace(code3)) {
      effects.consume(code3);
      return tagCloseBetween;
    }
    return end(code3);
  }
  function tagOpen(code3) {
    if (code3 === 45 || asciiAlphanumeric(code3)) {
      effects.consume(code3);
      return tagOpen;
    }
    if (code3 === 47 || code3 === 62 || markdownLineEndingOrSpace(code3)) {
      return tagOpenBetween(code3);
    }
    return nok(code3);
  }
  function tagOpenBetween(code3) {
    if (code3 === 47) {
      effects.consume(code3);
      return end;
    }
    if (code3 === 58 || code3 === 95 || asciiAlpha(code3)) {
      effects.consume(code3);
      return tagOpenAttributeName;
    }
    if (markdownLineEnding(code3)) {
      returnState = tagOpenBetween;
      return lineEndingBefore(code3);
    }
    if (markdownSpace(code3)) {
      effects.consume(code3);
      return tagOpenBetween;
    }
    return end(code3);
  }
  function tagOpenAttributeName(code3) {
    if (code3 === 45 || code3 === 46 || code3 === 58 || code3 === 95 || asciiAlphanumeric(code3)) {
      effects.consume(code3);
      return tagOpenAttributeName;
    }
    return tagOpenAttributeNameAfter(code3);
  }
  function tagOpenAttributeNameAfter(code3) {
    if (code3 === 61) {
      effects.consume(code3);
      return tagOpenAttributeValueBefore;
    }
    if (markdownLineEnding(code3)) {
      returnState = tagOpenAttributeNameAfter;
      return lineEndingBefore(code3);
    }
    if (markdownSpace(code3)) {
      effects.consume(code3);
      return tagOpenAttributeNameAfter;
    }
    return tagOpenBetween(code3);
  }
  function tagOpenAttributeValueBefore(code3) {
    if (code3 === null || code3 === 60 || code3 === 61 || code3 === 62 || code3 === 96) {
      return nok(code3);
    }
    if (code3 === 34 || code3 === 39) {
      effects.consume(code3);
      marker = code3;
      return tagOpenAttributeValueQuoted;
    }
    if (markdownLineEnding(code3)) {
      returnState = tagOpenAttributeValueBefore;
      return lineEndingBefore(code3);
    }
    if (markdownSpace(code3)) {
      effects.consume(code3);
      return tagOpenAttributeValueBefore;
    }
    effects.consume(code3);
    return tagOpenAttributeValueUnquoted;
  }
  function tagOpenAttributeValueQuoted(code3) {
    if (code3 === marker) {
      effects.consume(code3);
      marker = void 0;
      return tagOpenAttributeValueQuotedAfter;
    }
    if (code3 === null) {
      return nok(code3);
    }
    if (markdownLineEnding(code3)) {
      returnState = tagOpenAttributeValueQuoted;
      return lineEndingBefore(code3);
    }
    effects.consume(code3);
    return tagOpenAttributeValueQuoted;
  }
  function tagOpenAttributeValueUnquoted(code3) {
    if (code3 === null || code3 === 34 || code3 === 39 || code3 === 60 || code3 === 61 || code3 === 96) {
      return nok(code3);
    }
    if (code3 === 47 || code3 === 62 || markdownLineEndingOrSpace(code3)) {
      return tagOpenBetween(code3);
    }
    effects.consume(code3);
    return tagOpenAttributeValueUnquoted;
  }
  function tagOpenAttributeValueQuotedAfter(code3) {
    if (code3 === 47 || code3 === 62 || markdownLineEndingOrSpace(code3)) {
      return tagOpenBetween(code3);
    }
    return nok(code3);
  }
  function end(code3) {
    if (code3 === 62) {
      effects.consume(code3);
      effects.exit("htmlTextData");
      effects.exit("htmlText");
      return ok3;
    }
    return nok(code3);
  }
  function lineEndingBefore(code3) {
    effects.exit("htmlTextData");
    effects.enter("lineEnding");
    effects.consume(code3);
    effects.exit("lineEnding");
    return lineEndingAfter;
  }
  function lineEndingAfter(code3) {
    return markdownSpace(code3) ? factorySpace(effects, lineEndingAfterPrefix, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code3) : lineEndingAfterPrefix(code3);
  }
  function lineEndingAfterPrefix(code3) {
    effects.enter("htmlTextData");
    return returnState(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/label-end.js
var labelEnd = {
  name: "labelEnd",
  resolveAll: resolveAllLabelEnd,
  resolveTo: resolveToLabelEnd,
  tokenize: tokenizeLabelEnd
};
var resourceConstruct = {
  tokenize: tokenizeResource
};
var referenceFullConstruct = {
  tokenize: tokenizeReferenceFull
};
var referenceCollapsedConstruct = {
  tokenize: tokenizeReferenceCollapsed
};
function resolveAllLabelEnd(events) {
  let index2 = -1;
  const newEvents = [];
  while (++index2 < events.length) {
    const token = events[index2][1];
    newEvents.push(events[index2]);
    if (token.type === "labelImage" || token.type === "labelLink" || token.type === "labelEnd") {
      const offset = token.type === "labelImage" ? 4 : 2;
      token.type = "data";
      index2 += offset;
    }
  }
  if (events.length !== newEvents.length) {
    splice(events, 0, events.length, newEvents);
  }
  return events;
}
function resolveToLabelEnd(events, context) {
  let index2 = events.length;
  let offset = 0;
  let token;
  let open;
  let close;
  let media;
  while (index2--) {
    token = events[index2][1];
    if (open) {
      if (token.type === "link" || token.type === "labelLink" && token._inactive) {
        break;
      }
      if (events[index2][0] === "enter" && token.type === "labelLink") {
        token._inactive = true;
      }
    } else if (close) {
      if (events[index2][0] === "enter" && (token.type === "labelImage" || token.type === "labelLink") && !token._balanced) {
        open = index2;
        if (token.type !== "labelLink") {
          offset = 2;
          break;
        }
      }
    } else if (token.type === "labelEnd") {
      close = index2;
    }
  }
  const group = {
    type: events[open][1].type === "labelLink" ? "link" : "image",
    start: {
      ...events[open][1].start
    },
    end: {
      ...events[events.length - 1][1].end
    }
  };
  const label = {
    type: "label",
    start: {
      ...events[open][1].start
    },
    end: {
      ...events[close][1].end
    }
  };
  const text5 = {
    type: "labelText",
    start: {
      ...events[open + offset + 2][1].end
    },
    end: {
      ...events[close - 2][1].start
    }
  };
  media = [["enter", group, context], ["enter", label, context]];
  media = push(media, events.slice(open + 1, open + offset + 3));
  media = push(media, [["enter", text5, context]]);
  media = push(media, resolveAll(context.parser.constructs.insideSpan.null, events.slice(open + offset + 4, close - 3), context));
  media = push(media, [["exit", text5, context], events[close - 2], events[close - 1], ["exit", label, context]]);
  media = push(media, events.slice(close + 1));
  media = push(media, [["exit", group, context]]);
  splice(events, open, events.length, media);
  return events;
}
function tokenizeLabelEnd(effects, ok3, nok) {
  const self = this;
  let index2 = self.events.length;
  let labelStart;
  let defined;
  while (index2--) {
    if ((self.events[index2][1].type === "labelImage" || self.events[index2][1].type === "labelLink") && !self.events[index2][1]._balanced) {
      labelStart = self.events[index2][1];
      break;
    }
  }
  return start;
  function start(code3) {
    if (!labelStart) {
      return nok(code3);
    }
    if (labelStart._inactive) {
      return labelEndNok(code3);
    }
    defined = self.parser.defined.includes(normalizeIdentifier(self.sliceSerialize({
      start: labelStart.end,
      end: self.now()
    })));
    effects.enter("labelEnd");
    effects.enter("labelMarker");
    effects.consume(code3);
    effects.exit("labelMarker");
    effects.exit("labelEnd");
    return after;
  }
  function after(code3) {
    if (code3 === 40) {
      return effects.attempt(resourceConstruct, labelEndOk, defined ? labelEndOk : labelEndNok)(code3);
    }
    if (code3 === 91) {
      return effects.attempt(referenceFullConstruct, labelEndOk, defined ? referenceNotFull : labelEndNok)(code3);
    }
    return defined ? labelEndOk(code3) : labelEndNok(code3);
  }
  function referenceNotFull(code3) {
    return effects.attempt(referenceCollapsedConstruct, labelEndOk, labelEndNok)(code3);
  }
  function labelEndOk(code3) {
    return ok3(code3);
  }
  function labelEndNok(code3) {
    labelStart._balanced = true;
    return nok(code3);
  }
}
function tokenizeResource(effects, ok3, nok) {
  return resourceStart;
  function resourceStart(code3) {
    effects.enter("resource");
    effects.enter("resourceMarker");
    effects.consume(code3);
    effects.exit("resourceMarker");
    return resourceBefore;
  }
  function resourceBefore(code3) {
    return markdownLineEndingOrSpace(code3) ? factoryWhitespace(effects, resourceOpen)(code3) : resourceOpen(code3);
  }
  function resourceOpen(code3) {
    if (code3 === 41) {
      return resourceEnd(code3);
    }
    return factoryDestination(effects, resourceDestinationAfter, resourceDestinationMissing, "resourceDestination", "resourceDestinationLiteral", "resourceDestinationLiteralMarker", "resourceDestinationRaw", "resourceDestinationString", 32)(code3);
  }
  function resourceDestinationAfter(code3) {
    return markdownLineEndingOrSpace(code3) ? factoryWhitespace(effects, resourceBetween)(code3) : resourceEnd(code3);
  }
  function resourceDestinationMissing(code3) {
    return nok(code3);
  }
  function resourceBetween(code3) {
    if (code3 === 34 || code3 === 39 || code3 === 40) {
      return factoryTitle(effects, resourceTitleAfter, nok, "resourceTitle", "resourceTitleMarker", "resourceTitleString")(code3);
    }
    return resourceEnd(code3);
  }
  function resourceTitleAfter(code3) {
    return markdownLineEndingOrSpace(code3) ? factoryWhitespace(effects, resourceEnd)(code3) : resourceEnd(code3);
  }
  function resourceEnd(code3) {
    if (code3 === 41) {
      effects.enter("resourceMarker");
      effects.consume(code3);
      effects.exit("resourceMarker");
      effects.exit("resource");
      return ok3;
    }
    return nok(code3);
  }
}
function tokenizeReferenceFull(effects, ok3, nok) {
  const self = this;
  return referenceFull;
  function referenceFull(code3) {
    return factoryLabel.call(self, effects, referenceFullAfter, referenceFullMissing, "reference", "referenceMarker", "referenceString")(code3);
  }
  function referenceFullAfter(code3) {
    return self.parser.defined.includes(normalizeIdentifier(self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1))) ? ok3(code3) : nok(code3);
  }
  function referenceFullMissing(code3) {
    return nok(code3);
  }
}
function tokenizeReferenceCollapsed(effects, ok3, nok) {
  return referenceCollapsedStart;
  function referenceCollapsedStart(code3) {
    effects.enter("reference");
    effects.enter("referenceMarker");
    effects.consume(code3);
    effects.exit("referenceMarker");
    return referenceCollapsedOpen;
  }
  function referenceCollapsedOpen(code3) {
    if (code3 === 93) {
      effects.enter("referenceMarker");
      effects.consume(code3);
      effects.exit("referenceMarker");
      effects.exit("reference");
      return ok3;
    }
    return nok(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/label-start-image.js
var labelStartImage = {
  name: "labelStartImage",
  resolveAll: labelEnd.resolveAll,
  tokenize: tokenizeLabelStartImage
};
function tokenizeLabelStartImage(effects, ok3, nok) {
  const self = this;
  return start;
  function start(code3) {
    effects.enter("labelImage");
    effects.enter("labelImageMarker");
    effects.consume(code3);
    effects.exit("labelImageMarker");
    return open;
  }
  function open(code3) {
    if (code3 === 91) {
      effects.enter("labelMarker");
      effects.consume(code3);
      effects.exit("labelMarker");
      effects.exit("labelImage");
      return after;
    }
    return nok(code3);
  }
  function after(code3) {
    return code3 === 94 && "_hiddenFootnoteSupport" in self.parser.constructs ? nok(code3) : ok3(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/label-start-link.js
var labelStartLink = {
  name: "labelStartLink",
  resolveAll: labelEnd.resolveAll,
  tokenize: tokenizeLabelStartLink
};
function tokenizeLabelStartLink(effects, ok3, nok) {
  const self = this;
  return start;
  function start(code3) {
    effects.enter("labelLink");
    effects.enter("labelMarker");
    effects.consume(code3);
    effects.exit("labelMarker");
    effects.exit("labelLink");
    return after;
  }
  function after(code3) {
    return code3 === 94 && "_hiddenFootnoteSupport" in self.parser.constructs ? nok(code3) : ok3(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/line-ending.js
var lineEnding = {
  name: "lineEnding",
  tokenize: tokenizeLineEnding
};
function tokenizeLineEnding(effects, ok3) {
  return start;
  function start(code3) {
    effects.enter("lineEnding");
    effects.consume(code3);
    effects.exit("lineEnding");
    return factorySpace(effects, ok3, "linePrefix");
  }
}

// node_modules/micromark-core-commonmark/lib/thematic-break.js
var thematicBreak = {
  name: "thematicBreak",
  tokenize: tokenizeThematicBreak
};
function tokenizeThematicBreak(effects, ok3, nok) {
  let size = 0;
  let marker;
  return start;
  function start(code3) {
    effects.enter("thematicBreak");
    return before(code3);
  }
  function before(code3) {
    marker = code3;
    return atBreak(code3);
  }
  function atBreak(code3) {
    if (code3 === marker) {
      effects.enter("thematicBreakSequence");
      return sequence(code3);
    }
    if (size >= 3 && (code3 === null || markdownLineEnding(code3))) {
      effects.exit("thematicBreak");
      return ok3(code3);
    }
    return nok(code3);
  }
  function sequence(code3) {
    if (code3 === marker) {
      effects.consume(code3);
      size++;
      return sequence;
    }
    effects.exit("thematicBreakSequence");
    return markdownSpace(code3) ? factorySpace(effects, atBreak, "whitespace")(code3) : atBreak(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/list.js
var list = {
  continuation: {
    tokenize: tokenizeListContinuation
  },
  exit: tokenizeListEnd,
  name: "list",
  tokenize: tokenizeListStart
};
var listItemPrefixWhitespaceConstruct = {
  partial: true,
  tokenize: tokenizeListItemPrefixWhitespace
};
var indentConstruct = {
  partial: true,
  tokenize: tokenizeIndent
};
function tokenizeListStart(effects, ok3, nok) {
  const self = this;
  const tail = self.events[self.events.length - 1];
  let initialSize = tail && tail[1].type === "linePrefix" ? tail[2].sliceSerialize(tail[1], true).length : 0;
  let size = 0;
  return start;
  function start(code3) {
    const kind = self.containerState.type || (code3 === 42 || code3 === 43 || code3 === 45 ? "listUnordered" : "listOrdered");
    if (kind === "listUnordered" ? !self.containerState.marker || code3 === self.containerState.marker : asciiDigit(code3)) {
      if (!self.containerState.type) {
        self.containerState.type = kind;
        effects.enter(kind, {
          _container: true
        });
      }
      if (kind === "listUnordered") {
        effects.enter("listItemPrefix");
        return code3 === 42 || code3 === 45 ? effects.check(thematicBreak, nok, atMarker)(code3) : atMarker(code3);
      }
      if (!self.interrupt || code3 === 49) {
        effects.enter("listItemPrefix");
        effects.enter("listItemValue");
        return inside(code3);
      }
    }
    return nok(code3);
  }
  function inside(code3) {
    if (asciiDigit(code3) && ++size < 10) {
      effects.consume(code3);
      return inside;
    }
    if ((!self.interrupt || size < 2) && (self.containerState.marker ? code3 === self.containerState.marker : code3 === 41 || code3 === 46)) {
      effects.exit("listItemValue");
      return atMarker(code3);
    }
    return nok(code3);
  }
  function atMarker(code3) {
    effects.enter("listItemMarker");
    effects.consume(code3);
    effects.exit("listItemMarker");
    self.containerState.marker = self.containerState.marker || code3;
    return effects.check(
      blankLine,
      // Can’t be empty when interrupting.
      self.interrupt ? nok : onBlank,
      effects.attempt(listItemPrefixWhitespaceConstruct, endOfPrefix, otherPrefix)
    );
  }
  function onBlank(code3) {
    self.containerState.initialBlankLine = true;
    initialSize++;
    return endOfPrefix(code3);
  }
  function otherPrefix(code3) {
    if (markdownSpace(code3)) {
      effects.enter("listItemPrefixWhitespace");
      effects.consume(code3);
      effects.exit("listItemPrefixWhitespace");
      return endOfPrefix;
    }
    return nok(code3);
  }
  function endOfPrefix(code3) {
    self.containerState.size = initialSize + self.sliceSerialize(effects.exit("listItemPrefix"), true).length;
    return ok3(code3);
  }
}
function tokenizeListContinuation(effects, ok3, nok) {
  const self = this;
  self.containerState._closeFlow = void 0;
  return effects.check(blankLine, onBlank, notBlank);
  function onBlank(code3) {
    self.containerState.furtherBlankLines = self.containerState.furtherBlankLines || self.containerState.initialBlankLine;
    return factorySpace(effects, ok3, "listItemIndent", self.containerState.size + 1)(code3);
  }
  function notBlank(code3) {
    if (self.containerState.furtherBlankLines || !markdownSpace(code3)) {
      self.containerState.furtherBlankLines = void 0;
      self.containerState.initialBlankLine = void 0;
      return notInCurrentItem(code3);
    }
    self.containerState.furtherBlankLines = void 0;
    self.containerState.initialBlankLine = void 0;
    return effects.attempt(indentConstruct, ok3, notInCurrentItem)(code3);
  }
  function notInCurrentItem(code3) {
    self.containerState._closeFlow = true;
    self.interrupt = void 0;
    return factorySpace(effects, effects.attempt(list, ok3, nok), "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code3);
  }
}
function tokenizeIndent(effects, ok3, nok) {
  const self = this;
  return factorySpace(effects, afterPrefix, "listItemIndent", self.containerState.size + 1);
  function afterPrefix(code3) {
    const tail = self.events[self.events.length - 1];
    return tail && tail[1].type === "listItemIndent" && tail[2].sliceSerialize(tail[1], true).length === self.containerState.size ? ok3(code3) : nok(code3);
  }
}
function tokenizeListEnd(effects) {
  effects.exit(this.containerState.type);
}
function tokenizeListItemPrefixWhitespace(effects, ok3, nok) {
  const self = this;
  return factorySpace(effects, afterPrefix, "listItemPrefixWhitespace", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4 + 1);
  function afterPrefix(code3) {
    const tail = self.events[self.events.length - 1];
    return !markdownSpace(code3) && tail && tail[1].type === "listItemPrefixWhitespace" ? ok3(code3) : nok(code3);
  }
}

// node_modules/micromark-core-commonmark/lib/setext-underline.js
var setextUnderline = {
  name: "setextUnderline",
  resolveTo: resolveToSetextUnderline,
  tokenize: tokenizeSetextUnderline
};
function resolveToSetextUnderline(events, context) {
  let index2 = events.length;
  let content3;
  let text5;
  let definition3;
  while (index2--) {
    if (events[index2][0] === "enter") {
      if (events[index2][1].type === "content") {
        content3 = index2;
        break;
      }
      if (events[index2][1].type === "paragraph") {
        text5 = index2;
      }
    } else {
      if (events[index2][1].type === "content") {
        events.splice(index2, 1);
      }
      if (!definition3 && events[index2][1].type === "definition") {
        definition3 = index2;
      }
    }
  }
  const heading2 = {
    type: "setextHeading",
    start: {
      ...events[content3][1].start
    },
    end: {
      ...events[events.length - 1][1].end
    }
  };
  events[text5][1].type = "setextHeadingText";
  if (definition3) {
    events.splice(text5, 0, ["enter", heading2, context]);
    events.splice(definition3 + 1, 0, ["exit", events[content3][1], context]);
    events[content3][1].end = {
      ...events[definition3][1].end
    };
  } else {
    events[content3][1] = heading2;
  }
  events.push(["exit", heading2, context]);
  return events;
}
function tokenizeSetextUnderline(effects, ok3, nok) {
  const self = this;
  let marker;
  return start;
  function start(code3) {
    let index2 = self.events.length;
    let paragraph2;
    while (index2--) {
      if (self.events[index2][1].type !== "lineEnding" && self.events[index2][1].type !== "linePrefix" && self.events[index2][1].type !== "content") {
        paragraph2 = self.events[index2][1].type === "paragraph";
        break;
      }
    }
    if (!self.parser.lazy[self.now().line] && (self.interrupt || paragraph2)) {
      effects.enter("setextHeadingLine");
      marker = code3;
      return before(code3);
    }
    return nok(code3);
  }
  function before(code3) {
    effects.enter("setextHeadingLineSequence");
    return inside(code3);
  }
  function inside(code3) {
    if (code3 === marker) {
      effects.consume(code3);
      return inside;
    }
    effects.exit("setextHeadingLineSequence");
    return markdownSpace(code3) ? factorySpace(effects, after, "lineSuffix")(code3) : after(code3);
  }
  function after(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      effects.exit("setextHeadingLine");
      return ok3(code3);
    }
    return nok(code3);
  }
}

// node_modules/micromark/lib/initialize/flow.js
var flow = {
  tokenize: initializeFlow
};
function initializeFlow(effects) {
  const self = this;
  const initial = effects.attempt(
    // Try to parse a blank line.
    blankLine,
    atBlankEnding,
    // Try to parse initial flow (essentially, only code).
    effects.attempt(this.parser.constructs.flowInitial, afterConstruct, factorySpace(effects, effects.attempt(this.parser.constructs.flow, afterConstruct, effects.attempt(content2, afterConstruct)), "linePrefix"))
  );
  return initial;
  function atBlankEnding(code3) {
    if (code3 === null) {
      effects.consume(code3);
      return;
    }
    effects.enter("lineEndingBlank");
    effects.consume(code3);
    effects.exit("lineEndingBlank");
    self.currentConstruct = void 0;
    return initial;
  }
  function afterConstruct(code3) {
    if (code3 === null) {
      effects.consume(code3);
      return;
    }
    effects.enter("lineEnding");
    effects.consume(code3);
    effects.exit("lineEnding");
    self.currentConstruct = void 0;
    return initial;
  }
}

// node_modules/micromark/lib/initialize/text.js
var resolver = {
  resolveAll: createResolver()
};
var string = initializeFactory("string");
var text = initializeFactory("text");
function initializeFactory(field) {
  return {
    resolveAll: createResolver(field === "text" ? resolveAllLineSuffixes : void 0),
    tokenize: initializeText
  };
  function initializeText(effects) {
    const self = this;
    const constructs2 = this.parser.constructs[field];
    const text5 = effects.attempt(constructs2, start, notText);
    return start;
    function start(code3) {
      return atBreak(code3) ? text5(code3) : notText(code3);
    }
    function notText(code3) {
      if (code3 === null) {
        effects.consume(code3);
        return;
      }
      effects.enter("data");
      effects.consume(code3);
      return data;
    }
    function data(code3) {
      if (atBreak(code3)) {
        effects.exit("data");
        return text5(code3);
      }
      effects.consume(code3);
      return data;
    }
    function atBreak(code3) {
      if (code3 === null) {
        return true;
      }
      const list3 = constructs2[code3];
      let index2 = -1;
      if (list3) {
        while (++index2 < list3.length) {
          const item = list3[index2];
          if (!item.previous || item.previous.call(self, self.previous)) {
            return true;
          }
        }
      }
      return false;
    }
  }
}
function createResolver(extraResolver) {
  return resolveAllText;
  function resolveAllText(events, context) {
    let index2 = -1;
    let enter;
    while (++index2 <= events.length) {
      if (enter === void 0) {
        if (events[index2] && events[index2][1].type === "data") {
          enter = index2;
          index2++;
        }
      } else if (!events[index2] || events[index2][1].type !== "data") {
        if (index2 !== enter + 2) {
          events[enter][1].end = events[index2 - 1][1].end;
          events.splice(enter + 2, index2 - enter - 2);
          index2 = enter + 2;
        }
        enter = void 0;
      }
    }
    return extraResolver ? extraResolver(events, context) : events;
  }
}
function resolveAllLineSuffixes(events, context) {
  let eventIndex = 0;
  while (++eventIndex <= events.length) {
    if ((eventIndex === events.length || events[eventIndex][1].type === "lineEnding") && events[eventIndex - 1][1].type === "data") {
      const data = events[eventIndex - 1][1];
      const chunks = context.sliceStream(data);
      let index2 = chunks.length;
      let bufferIndex = -1;
      let size = 0;
      let tabs;
      while (index2--) {
        const chunk = chunks[index2];
        if (typeof chunk === "string") {
          bufferIndex = chunk.length;
          while (chunk.charCodeAt(bufferIndex - 1) === 32) {
            size++;
            bufferIndex--;
          }
          if (bufferIndex) break;
          bufferIndex = -1;
        } else if (chunk === -2) {
          tabs = true;
          size++;
        } else if (chunk === -1) {
        } else {
          index2++;
          break;
        }
      }
      if (context._contentTypeTextTrailing && eventIndex === events.length) {
        size = 0;
      }
      if (size) {
        const token = {
          type: eventIndex === events.length || tabs || size < 2 ? "lineSuffix" : "hardBreakTrailing",
          start: {
            _bufferIndex: index2 ? bufferIndex : data.start._bufferIndex + bufferIndex,
            _index: data.start._index + index2,
            line: data.end.line,
            column: data.end.column - size,
            offset: data.end.offset - size
          },
          end: {
            ...data.end
          }
        };
        data.end = {
          ...token.start
        };
        if (data.start.offset === data.end.offset) {
          Object.assign(data, token);
        } else {
          events.splice(eventIndex, 0, ["enter", token, context], ["exit", token, context]);
          eventIndex += 2;
        }
      }
      eventIndex++;
    }
  }
  return events;
}

// node_modules/micromark/lib/constructs.js
var constructs_exports = {};
__export(constructs_exports, {
  attentionMarkers: () => attentionMarkers,
  contentInitial: () => contentInitial,
  disable: () => disable,
  document: () => document2,
  flow: () => flow2,
  flowInitial: () => flowInitial,
  insideSpan: () => insideSpan,
  string: () => string2,
  text: () => text2
});
var document2 = {
  [42]: list,
  [43]: list,
  [45]: list,
  [48]: list,
  [49]: list,
  [50]: list,
  [51]: list,
  [52]: list,
  [53]: list,
  [54]: list,
  [55]: list,
  [56]: list,
  [57]: list,
  [62]: blockQuote
};
var contentInitial = {
  [91]: definition
};
var flowInitial = {
  [-2]: codeIndented,
  [-1]: codeIndented,
  [32]: codeIndented
};
var flow2 = {
  [35]: headingAtx,
  [42]: thematicBreak,
  [45]: [setextUnderline, thematicBreak],
  [60]: htmlFlow,
  [61]: setextUnderline,
  [95]: thematicBreak,
  [96]: codeFenced,
  [126]: codeFenced
};
var string2 = {
  [38]: characterReference,
  [92]: characterEscape
};
var text2 = {
  [-5]: lineEnding,
  [-4]: lineEnding,
  [-3]: lineEnding,
  [33]: labelStartImage,
  [38]: characterReference,
  [42]: attention,
  [60]: [autolink, htmlText],
  [91]: labelStartLink,
  [92]: [hardBreakEscape, characterEscape],
  [93]: labelEnd,
  [95]: attention,
  [96]: codeText
};
var insideSpan = {
  null: [attention, resolver]
};
var attentionMarkers = {
  null: [42, 95]
};
var disable = {
  null: []
};

// node_modules/micromark/lib/create-tokenizer.js
function createTokenizer(parser, initialize, from) {
  let point3 = {
    _bufferIndex: -1,
    _index: 0,
    line: from && from.line || 1,
    column: from && from.column || 1,
    offset: from && from.offset || 0
  };
  const columnStart = {};
  const resolveAllConstructs = [];
  let chunks = [];
  let stack = [];
  let consumed = true;
  const effects = {
    attempt: constructFactory(onsuccessfulconstruct),
    check: constructFactory(onsuccessfulcheck),
    consume,
    enter,
    exit: exit3,
    interrupt: constructFactory(onsuccessfulcheck, {
      interrupt: true
    })
  };
  const context = {
    code: null,
    containerState: {},
    defineSkip,
    events: [],
    now,
    parser,
    previous: null,
    sliceSerialize,
    sliceStream,
    write
  };
  let state = initialize.tokenize.call(context, effects);
  let expectedCode;
  if (initialize.resolveAll) {
    resolveAllConstructs.push(initialize);
  }
  return context;
  function write(slice) {
    chunks = push(chunks, slice);
    main();
    if (chunks[chunks.length - 1] !== null) {
      return [];
    }
    addResult(initialize, 0);
    context.events = resolveAll(resolveAllConstructs, context.events, context);
    return context.events;
  }
  function sliceSerialize(token, expandTabs) {
    return serializeChunks(sliceStream(token), expandTabs);
  }
  function sliceStream(token) {
    return sliceChunks(chunks, token);
  }
  function now() {
    const {
      _bufferIndex,
      _index,
      line,
      column,
      offset
    } = point3;
    return {
      _bufferIndex,
      _index,
      line,
      column,
      offset
    };
  }
  function defineSkip(value) {
    columnStart[value.line] = value.column;
    accountForPotentialSkip();
  }
  function main() {
    let chunkIndex;
    while (point3._index < chunks.length) {
      const chunk = chunks[point3._index];
      if (typeof chunk === "string") {
        chunkIndex = point3._index;
        if (point3._bufferIndex < 0) {
          point3._bufferIndex = 0;
        }
        while (point3._index === chunkIndex && point3._bufferIndex < chunk.length) {
          go(chunk.charCodeAt(point3._bufferIndex));
        }
      } else {
        go(chunk);
      }
    }
  }
  function go(code3) {
    consumed = void 0;
    expectedCode = code3;
    state = state(code3);
  }
  function consume(code3) {
    if (markdownLineEnding(code3)) {
      point3.line++;
      point3.column = 1;
      point3.offset += code3 === -3 ? 2 : 1;
      accountForPotentialSkip();
    } else if (code3 !== -1) {
      point3.column++;
      point3.offset++;
    }
    if (point3._bufferIndex < 0) {
      point3._index++;
    } else {
      point3._bufferIndex++;
      if (point3._bufferIndex === // Points w/ non-negative `_bufferIndex` reference
      // strings.
      /** @type {string} */
      chunks[point3._index].length) {
        point3._bufferIndex = -1;
        point3._index++;
      }
    }
    context.previous = code3;
    consumed = true;
  }
  function enter(type, fields) {
    const token = fields || {};
    token.type = type;
    token.start = now();
    context.events.push(["enter", token, context]);
    stack.push(token);
    return token;
  }
  function exit3(type) {
    const token = stack.pop();
    token.end = now();
    context.events.push(["exit", token, context]);
    return token;
  }
  function onsuccessfulconstruct(construct, info) {
    addResult(construct, info.from);
  }
  function onsuccessfulcheck(_, info) {
    info.restore();
  }
  function constructFactory(onreturn, fields) {
    return hook;
    function hook(constructs2, returnState, bogusState) {
      let listOfConstructs;
      let constructIndex;
      let currentConstruct;
      let info;
      return Array.isArray(constructs2) ? (
        /* c8 ignore next 1 */
        handleListOfConstructs(constructs2)
      ) : "tokenize" in constructs2 ? (
        // Looks like a construct.
        handleListOfConstructs([
          /** @type {Construct} */
          constructs2
        ])
      ) : handleMapOfConstructs(constructs2);
      function handleMapOfConstructs(map3) {
        return start;
        function start(code3) {
          const left = code3 !== null && map3[code3];
          const all2 = code3 !== null && map3.null;
          const list3 = [
            // To do: add more extension tests.
            /* c8 ignore next 2 */
            ...Array.isArray(left) ? left : left ? [left] : [],
            ...Array.isArray(all2) ? all2 : all2 ? [all2] : []
          ];
          return handleListOfConstructs(list3)(code3);
        }
      }
      function handleListOfConstructs(list3) {
        listOfConstructs = list3;
        constructIndex = 0;
        if (list3.length === 0) {
          return bogusState;
        }
        return handleConstruct(list3[constructIndex]);
      }
      function handleConstruct(construct) {
        return start;
        function start(code3) {
          info = store();
          currentConstruct = construct;
          if (!construct.partial) {
            context.currentConstruct = construct;
          }
          if (construct.name && context.parser.constructs.disable.null.includes(construct.name)) {
            return nok(code3);
          }
          return construct.tokenize.call(
            // If we do have fields, create an object w/ `context` as its
            // prototype.
            // This allows a “live binding”, which is needed for `interrupt`.
            fields ? Object.assign(Object.create(context), fields) : context,
            effects,
            ok3,
            nok
          )(code3);
        }
      }
      function ok3(code3) {
        consumed = true;
        onreturn(currentConstruct, info);
        return returnState;
      }
      function nok(code3) {
        consumed = true;
        info.restore();
        if (++constructIndex < listOfConstructs.length) {
          return handleConstruct(listOfConstructs[constructIndex]);
        }
        return bogusState;
      }
    }
  }
  function addResult(construct, from2) {
    if (construct.resolveAll && !resolveAllConstructs.includes(construct)) {
      resolveAllConstructs.push(construct);
    }
    if (construct.resolve) {
      splice(context.events, from2, context.events.length - from2, construct.resolve(context.events.slice(from2), context));
    }
    if (construct.resolveTo) {
      context.events = construct.resolveTo(context.events, context);
    }
  }
  function store() {
    const startPoint = now();
    const startPrevious = context.previous;
    const startCurrentConstruct = context.currentConstruct;
    const startEventsIndex = context.events.length;
    const startStack = Array.from(stack);
    return {
      from: startEventsIndex,
      restore
    };
    function restore() {
      point3 = startPoint;
      context.previous = startPrevious;
      context.currentConstruct = startCurrentConstruct;
      context.events.length = startEventsIndex;
      stack = startStack;
      accountForPotentialSkip();
    }
  }
  function accountForPotentialSkip() {
    if (point3.line in columnStart && point3.column < 2) {
      point3.column = columnStart[point3.line];
      point3.offset += columnStart[point3.line] - 1;
    }
  }
}
function sliceChunks(chunks, token) {
  const startIndex = token.start._index;
  const startBufferIndex = token.start._bufferIndex;
  const endIndex = token.end._index;
  const endBufferIndex = token.end._bufferIndex;
  let view;
  if (startIndex === endIndex) {
    view = [chunks[startIndex].slice(startBufferIndex, endBufferIndex)];
  } else {
    view = chunks.slice(startIndex, endIndex);
    if (startBufferIndex > -1) {
      const head = view[0];
      if (typeof head === "string") {
        view[0] = head.slice(startBufferIndex);
      } else {
        view.shift();
      }
    }
    if (endBufferIndex > 0) {
      view.push(chunks[endIndex].slice(0, endBufferIndex));
    }
  }
  return view;
}
function serializeChunks(chunks, expandTabs) {
  let index2 = -1;
  const result = [];
  let atTab;
  while (++index2 < chunks.length) {
    const chunk = chunks[index2];
    let value;
    if (typeof chunk === "string") {
      value = chunk;
    } else switch (chunk) {
      case -5: {
        value = "\r";
        break;
      }
      case -4: {
        value = "\n";
        break;
      }
      case -3: {
        value = "\r\n";
        break;
      }
      case -2: {
        value = expandTabs ? " " : "	";
        break;
      }
      case -1: {
        if (!expandTabs && atTab) continue;
        value = " ";
        break;
      }
      default: {
        value = String.fromCharCode(chunk);
      }
    }
    atTab = chunk === -2;
    result.push(value);
  }
  return result.join("");
}

// node_modules/micromark/lib/parse.js
function parse(options) {
  const settings = options || {};
  const constructs2 = (
    /** @type {FullNormalizedExtension} */
    combineExtensions([constructs_exports, ...settings.extensions || []])
  );
  const parser = {
    constructs: constructs2,
    content: create(content),
    defined: [],
    document: create(document),
    flow: create(flow),
    lazy: {},
    string: create(string),
    text: create(text)
  };
  return parser;
  function create(initial) {
    return creator;
    function creator(from) {
      return createTokenizer(parser, initial, from);
    }
  }
}

// node_modules/micromark/lib/postprocess.js
function postprocess(events) {
  while (!subtokenize(events)) {
  }
  return events;
}

// node_modules/micromark/lib/preprocess.js
var search = /[\0\t\n\r]/g;
function preprocess() {
  let column = 1;
  let buffer = "";
  let start = true;
  let atCarriageReturn;
  return preprocessor;
  function preprocessor(value, encoding, end) {
    const chunks = [];
    let match;
    let next;
    let startPosition;
    let endPosition;
    let code3;
    value = buffer + (typeof value === "string" ? value.toString() : new TextDecoder(encoding || void 0).decode(value));
    startPosition = 0;
    buffer = "";
    if (start) {
      if (value.charCodeAt(0) === 65279) {
        startPosition++;
      }
      start = void 0;
    }
    while (startPosition < value.length) {
      search.lastIndex = startPosition;
      match = search.exec(value);
      endPosition = match && match.index !== void 0 ? match.index : value.length;
      code3 = value.charCodeAt(endPosition);
      if (!match) {
        buffer = value.slice(startPosition);
        break;
      }
      if (code3 === 10 && startPosition === endPosition && atCarriageReturn) {
        chunks.push(-3);
        atCarriageReturn = void 0;
      } else {
        if (atCarriageReturn) {
          chunks.push(-5);
          atCarriageReturn = void 0;
        }
        if (startPosition < endPosition) {
          chunks.push(value.slice(startPosition, endPosition));
          column += endPosition - startPosition;
        }
        switch (code3) {
          case 0: {
            chunks.push(65533);
            column++;
            break;
          }
          case 9: {
            next = Math.ceil(column / 4) * 4;
            chunks.push(-2);
            while (column++ < next) chunks.push(-1);
            break;
          }
          case 10: {
            chunks.push(-4);
            column = 1;
            break;
          }
          default: {
            atCarriageReturn = true;
            column = 1;
          }
        }
      }
      startPosition = endPosition + 1;
    }
    if (end) {
      if (atCarriageReturn) chunks.push(-5);
      if (buffer) chunks.push(buffer);
      chunks.push(null);
    }
    return chunks;
  }
}

// node_modules/micromark-util-decode-string/index.js
var characterEscapeOrReference = /\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi;
function decodeString(value) {
  return value.replace(characterEscapeOrReference, decode);
}
function decode($0, $1, $2) {
  if ($1) {
    return $1;
  }
  const head = $2.charCodeAt(0);
  if (head === 35) {
    const head2 = $2.charCodeAt(1);
    const hex = head2 === 120 || head2 === 88;
    return decodeNumericCharacterReference($2.slice(hex ? 2 : 1), hex ? 16 : 10);
  }
  return decodeNamedCharacterReference($2) || $0;
}

// node_modules/mdast-util-from-markdown/lib/index.js
var own3 = {}.hasOwnProperty;
function fromMarkdown(value, encoding, options) {
  if (encoding && typeof encoding === "object") {
    options = encoding;
    encoding = void 0;
  }
  return compiler(options)(postprocess(parse(options).document().write(preprocess()(value, encoding, true))));
}
function compiler(options) {
  const config = {
    transforms: [],
    canContainEols: ["emphasis", "fragment", "heading", "paragraph", "strong"],
    enter: {
      autolink: opener(link2),
      autolinkProtocol: onenterdata,
      autolinkEmail: onenterdata,
      atxHeading: opener(heading2),
      blockQuote: opener(blockQuote2),
      characterEscape: onenterdata,
      characterReference: onenterdata,
      codeFenced: opener(codeFlow),
      codeFencedFenceInfo: buffer,
      codeFencedFenceMeta: buffer,
      codeIndented: opener(codeFlow, buffer),
      codeText: opener(codeText2, buffer),
      codeTextData: onenterdata,
      data: onenterdata,
      codeFlowValue: onenterdata,
      definition: opener(definition3),
      definitionDestinationString: buffer,
      definitionLabelString: buffer,
      definitionTitleString: buffer,
      emphasis: opener(emphasis2),
      hardBreakEscape: opener(hardBreak2),
      hardBreakTrailing: opener(hardBreak2),
      htmlFlow: opener(html2, buffer),
      htmlFlowData: onenterdata,
      htmlText: opener(html2, buffer),
      htmlTextData: onenterdata,
      image: opener(image2),
      label: buffer,
      link: opener(link2),
      listItem: opener(listItem2),
      listItemValue: onenterlistitemvalue,
      listOrdered: opener(list3, onenterlistordered),
      listUnordered: opener(list3),
      paragraph: opener(paragraph2),
      reference: onenterreference,
      referenceString: buffer,
      resourceDestinationString: buffer,
      resourceTitleString: buffer,
      setextHeading: opener(heading2),
      strong: opener(strong2),
      thematicBreak: opener(thematicBreak3)
    },
    exit: {
      atxHeading: closer(),
      atxHeadingSequence: onexitatxheadingsequence,
      autolink: closer(),
      autolinkEmail: onexitautolinkemail,
      autolinkProtocol: onexitautolinkprotocol,
      blockQuote: closer(),
      characterEscapeValue: onexitdata,
      characterReferenceMarkerHexadecimal: onexitcharacterreferencemarker,
      characterReferenceMarkerNumeric: onexitcharacterreferencemarker,
      characterReferenceValue: onexitcharacterreferencevalue,
      characterReference: onexitcharacterreference,
      codeFenced: closer(onexitcodefenced),
      codeFencedFence: onexitcodefencedfence,
      codeFencedFenceInfo: onexitcodefencedfenceinfo,
      codeFencedFenceMeta: onexitcodefencedfencemeta,
      codeFlowValue: onexitdata,
      codeIndented: closer(onexitcodeindented),
      codeText: closer(onexitcodetext),
      codeTextData: onexitdata,
      data: onexitdata,
      definition: closer(),
      definitionDestinationString: onexitdefinitiondestinationstring,
      definitionLabelString: onexitdefinitionlabelstring,
      definitionTitleString: onexitdefinitiontitlestring,
      emphasis: closer(),
      hardBreakEscape: closer(onexithardbreak),
      hardBreakTrailing: closer(onexithardbreak),
      htmlFlow: closer(onexithtmlflow),
      htmlFlowData: onexitdata,
      htmlText: closer(onexithtmltext),
      htmlTextData: onexitdata,
      image: closer(onexitimage),
      label: onexitlabel,
      labelText: onexitlabeltext,
      lineEnding: onexitlineending,
      link: closer(onexitlink),
      listItem: closer(),
      listOrdered: closer(),
      listUnordered: closer(),
      paragraph: closer(),
      referenceString: onexitreferencestring,
      resourceDestinationString: onexitresourcedestinationstring,
      resourceTitleString: onexitresourcetitlestring,
      resource: onexitresource,
      setextHeading: closer(onexitsetextheading),
      setextHeadingLineSequence: onexitsetextheadinglinesequence,
      setextHeadingText: onexitsetextheadingtext,
      strong: closer(),
      thematicBreak: closer()
    }
  };
  configure(config, (options || {}).mdastExtensions || []);
  const data = {};
  return compile;
  function compile(events) {
    let tree = {
      type: "root",
      children: []
    };
    const context = {
      stack: [tree],
      tokenStack: [],
      config,
      enter,
      exit: exit3,
      buffer,
      resume,
      data
    };
    const listStack = [];
    let index2 = -1;
    while (++index2 < events.length) {
      if (events[index2][1].type === "listOrdered" || events[index2][1].type === "listUnordered") {
        if (events[index2][0] === "enter") {
          listStack.push(index2);
        } else {
          const tail = listStack.pop();
          index2 = prepareList(events, tail, index2);
        }
      }
    }
    index2 = -1;
    while (++index2 < events.length) {
      const handler = config[events[index2][0]];
      if (own3.call(handler, events[index2][1].type)) {
        handler[events[index2][1].type].call(Object.assign({
          sliceSerialize: events[index2][2].sliceSerialize
        }, context), events[index2][1]);
      }
    }
    if (context.tokenStack.length > 0) {
      const tail = context.tokenStack[context.tokenStack.length - 1];
      const handler = tail[1] || defaultOnError;
      handler.call(context, void 0, tail[0]);
    }
    tree.position = {
      start: point2(events.length > 0 ? events[0][1].start : {
        line: 1,
        column: 1,
        offset: 0
      }),
      end: point2(events.length > 0 ? events[events.length - 2][1].end : {
        line: 1,
        column: 1,
        offset: 0
      })
    };
    index2 = -1;
    while (++index2 < config.transforms.length) {
      tree = config.transforms[index2](tree) || tree;
    }
    return tree;
  }
  function prepareList(events, start, length) {
    let index2 = start - 1;
    let containerBalance = -1;
    let listSpread = false;
    let listItem3;
    let lineIndex;
    let firstBlankLineIndex;
    let atMarker;
    while (++index2 <= length) {
      const event = events[index2];
      switch (event[1].type) {
        case "listUnordered":
        case "listOrdered":
        case "blockQuote": {
          if (event[0] === "enter") {
            containerBalance++;
          } else {
            containerBalance--;
          }
          atMarker = void 0;
          break;
        }
        case "lineEndingBlank": {
          if (event[0] === "enter") {
            if (listItem3 && !atMarker && !containerBalance && !firstBlankLineIndex) {
              firstBlankLineIndex = index2;
            }
            atMarker = void 0;
          }
          break;
        }
        case "linePrefix":
        case "listItemValue":
        case "listItemMarker":
        case "listItemPrefix":
        case "listItemPrefixWhitespace": {
          break;
        }
        default: {
          atMarker = void 0;
        }
      }
      if (!containerBalance && event[0] === "enter" && event[1].type === "listItemPrefix" || containerBalance === -1 && event[0] === "exit" && (event[1].type === "listUnordered" || event[1].type === "listOrdered")) {
        if (listItem3) {
          let tailIndex = index2;
          lineIndex = void 0;
          while (tailIndex--) {
            const tailEvent = events[tailIndex];
            if (tailEvent[1].type === "lineEnding" || tailEvent[1].type === "lineEndingBlank") {
              if (tailEvent[0] === "exit") continue;
              if (lineIndex) {
                events[lineIndex][1].type = "lineEndingBlank";
                listSpread = true;
              }
              tailEvent[1].type = "lineEnding";
              lineIndex = tailIndex;
            } else if (tailEvent[1].type === "linePrefix" || tailEvent[1].type === "blockQuotePrefix" || tailEvent[1].type === "blockQuotePrefixWhitespace" || tailEvent[1].type === "blockQuoteMarker" || tailEvent[1].type === "listItemIndent") {
            } else {
              break;
            }
          }
          if (firstBlankLineIndex && (!lineIndex || firstBlankLineIndex < lineIndex)) {
            listItem3._spread = true;
          }
          listItem3.end = Object.assign({}, lineIndex ? events[lineIndex][1].start : event[1].end);
          events.splice(lineIndex || index2, 0, ["exit", listItem3, event[2]]);
          index2++;
          length++;
        }
        if (event[1].type === "listItemPrefix") {
          const item = {
            type: "listItem",
            _spread: false,
            start: Object.assign({}, event[1].start),
            // @ts-expect-error: we’ll add `end` in a second.
            end: void 0
          };
          listItem3 = item;
          events.splice(index2, 0, ["enter", item, event[2]]);
          index2++;
          length++;
          firstBlankLineIndex = void 0;
          atMarker = true;
        }
      }
    }
    events[start][1]._spread = listSpread;
    return length;
  }
  function opener(create, and) {
    return open;
    function open(token) {
      enter.call(this, create(token), token);
      if (and) and.call(this, token);
    }
  }
  function buffer() {
    this.stack.push({
      type: "fragment",
      children: []
    });
  }
  function enter(node2, token, errorHandler) {
    const parent = this.stack[this.stack.length - 1];
    const siblings = parent.children;
    siblings.push(node2);
    this.stack.push(node2);
    this.tokenStack.push([token, errorHandler || void 0]);
    node2.position = {
      start: point2(token.start),
      // @ts-expect-error: `end` will be patched later.
      end: void 0
    };
  }
  function closer(and) {
    return close;
    function close(token) {
      if (and) and.call(this, token);
      exit3.call(this, token);
    }
  }
  function exit3(token, onExitError) {
    const node2 = this.stack.pop();
    const open = this.tokenStack.pop();
    if (!open) {
      throw new Error("Cannot close `" + token.type + "` (" + stringifyPosition({
        start: token.start,
        end: token.end
      }) + "): it\u2019s not open");
    } else if (open[0].type !== token.type) {
      if (onExitError) {
        onExitError.call(this, token, open[0]);
      } else {
        const handler = open[1] || defaultOnError;
        handler.call(this, token, open[0]);
      }
    }
    node2.position.end = point2(token.end);
  }
  function resume() {
    return toString(this.stack.pop());
  }
  function onenterlistordered() {
    this.data.expectingFirstListItemValue = true;
  }
  function onenterlistitemvalue(token) {
    if (this.data.expectingFirstListItemValue) {
      const ancestor = this.stack[this.stack.length - 2];
      ancestor.start = Number.parseInt(this.sliceSerialize(token), 10);
      this.data.expectingFirstListItemValue = void 0;
    }
  }
  function onexitcodefencedfenceinfo() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.lang = data2;
  }
  function onexitcodefencedfencemeta() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.meta = data2;
  }
  function onexitcodefencedfence() {
    if (this.data.flowCodeInside) return;
    this.buffer();
    this.data.flowCodeInside = true;
  }
  function onexitcodefenced() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, "");
    this.data.flowCodeInside = void 0;
  }
  function onexitcodeindented() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2.replace(/(\r?\n|\r)$/g, "");
  }
  function onexitdefinitionlabelstring(token) {
    const label = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.label = label;
    node2.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
  }
  function onexitdefinitiontitlestring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.title = data2;
  }
  function onexitdefinitiondestinationstring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.url = data2;
  }
  function onexitatxheadingsequence(token) {
    const node2 = this.stack[this.stack.length - 1];
    if (!node2.depth) {
      const depth = this.sliceSerialize(token).length;
      node2.depth = depth;
    }
  }
  function onexitsetextheadingtext() {
    this.data.setextHeadingSlurpLineEnding = true;
  }
  function onexitsetextheadinglinesequence(token) {
    const node2 = this.stack[this.stack.length - 1];
    node2.depth = this.sliceSerialize(token).codePointAt(0) === 61 ? 1 : 2;
  }
  function onexitsetextheading() {
    this.data.setextHeadingSlurpLineEnding = void 0;
  }
  function onenterdata(token) {
    const node2 = this.stack[this.stack.length - 1];
    const siblings = node2.children;
    let tail = siblings[siblings.length - 1];
    if (!tail || tail.type !== "text") {
      tail = text5();
      tail.position = {
        start: point2(token.start),
        // @ts-expect-error: we’ll add `end` later.
        end: void 0
      };
      siblings.push(tail);
    }
    this.stack.push(tail);
  }
  function onexitdata(token) {
    const tail = this.stack.pop();
    tail.value += this.sliceSerialize(token);
    tail.position.end = point2(token.end);
  }
  function onexitlineending(token) {
    const context = this.stack[this.stack.length - 1];
    if (this.data.atHardBreak) {
      const tail = context.children[context.children.length - 1];
      tail.position.end = point2(token.end);
      this.data.atHardBreak = void 0;
      return;
    }
    if (!this.data.setextHeadingSlurpLineEnding && config.canContainEols.includes(context.type)) {
      onenterdata.call(this, token);
      onexitdata.call(this, token);
    }
  }
  function onexithardbreak() {
    this.data.atHardBreak = true;
  }
  function onexithtmlflow() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexithtmltext() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexitcodetext() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexitlink() {
    const node2 = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const referenceType = this.data.referenceType || "shortcut";
      node2.type += "Reference";
      node2.referenceType = referenceType;
      delete node2.url;
      delete node2.title;
    } else {
      delete node2.identifier;
      delete node2.label;
    }
    this.data.referenceType = void 0;
  }
  function onexitimage() {
    const node2 = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const referenceType = this.data.referenceType || "shortcut";
      node2.type += "Reference";
      node2.referenceType = referenceType;
      delete node2.url;
      delete node2.title;
    } else {
      delete node2.identifier;
      delete node2.label;
    }
    this.data.referenceType = void 0;
  }
  function onexitlabeltext(token) {
    const string3 = this.sliceSerialize(token);
    const ancestor = this.stack[this.stack.length - 2];
    ancestor.label = decodeString(string3);
    ancestor.identifier = normalizeIdentifier(string3).toLowerCase();
  }
  function onexitlabel() {
    const fragment = this.stack[this.stack.length - 1];
    const value = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    this.data.inReference = true;
    if (node2.type === "link") {
      const children = fragment.children;
      node2.children = children;
    } else {
      node2.alt = value;
    }
  }
  function onexitresourcedestinationstring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.url = data2;
  }
  function onexitresourcetitlestring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.title = data2;
  }
  function onexitresource() {
    this.data.inReference = void 0;
  }
  function onenterreference() {
    this.data.referenceType = "collapsed";
  }
  function onexitreferencestring(token) {
    const label = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.label = label;
    node2.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
    this.data.referenceType = "full";
  }
  function onexitcharacterreferencemarker(token) {
    this.data.characterReferenceType = token.type;
  }
  function onexitcharacterreferencevalue(token) {
    const data2 = this.sliceSerialize(token);
    const type = this.data.characterReferenceType;
    let value;
    if (type) {
      value = decodeNumericCharacterReference(data2, type === "characterReferenceMarkerNumeric" ? 10 : 16);
      this.data.characterReferenceType = void 0;
    } else {
      const result = decodeNamedCharacterReference(data2);
      value = result;
    }
    const tail = this.stack[this.stack.length - 1];
    tail.value += value;
  }
  function onexitcharacterreference(token) {
    const tail = this.stack.pop();
    tail.position.end = point2(token.end);
  }
  function onexitautolinkprotocol(token) {
    onexitdata.call(this, token);
    const node2 = this.stack[this.stack.length - 1];
    node2.url = this.sliceSerialize(token);
  }
  function onexitautolinkemail(token) {
    onexitdata.call(this, token);
    const node2 = this.stack[this.stack.length - 1];
    node2.url = "mailto:" + this.sliceSerialize(token);
  }
  function blockQuote2() {
    return {
      type: "blockquote",
      children: []
    };
  }
  function codeFlow() {
    return {
      type: "code",
      lang: null,
      meta: null,
      value: ""
    };
  }
  function codeText2() {
    return {
      type: "inlineCode",
      value: ""
    };
  }
  function definition3() {
    return {
      type: "definition",
      identifier: "",
      label: null,
      title: null,
      url: ""
    };
  }
  function emphasis2() {
    return {
      type: "emphasis",
      children: []
    };
  }
  function heading2() {
    return {
      type: "heading",
      // @ts-expect-error `depth` will be set later.
      depth: 0,
      children: []
    };
  }
  function hardBreak2() {
    return {
      type: "break"
    };
  }
  function html2() {
    return {
      type: "html",
      value: ""
    };
  }
  function image2() {
    return {
      type: "image",
      title: null,
      url: "",
      alt: null
    };
  }
  function link2() {
    return {
      type: "link",
      title: null,
      url: "",
      children: []
    };
  }
  function list3(token) {
    return {
      type: "list",
      ordered: token.type === "listOrdered",
      start: null,
      spread: token._spread,
      children: []
    };
  }
  function listItem2(token) {
    return {
      type: "listItem",
      spread: token._spread,
      checked: null,
      children: []
    };
  }
  function paragraph2() {
    return {
      type: "paragraph",
      children: []
    };
  }
  function strong2() {
    return {
      type: "strong",
      children: []
    };
  }
  function text5() {
    return {
      type: "text",
      value: ""
    };
  }
  function thematicBreak3() {
    return {
      type: "thematicBreak"
    };
  }
}
function point2(d) {
  return {
    line: d.line,
    column: d.column,
    offset: d.offset
  };
}
function configure(combined, extensions) {
  let index2 = -1;
  while (++index2 < extensions.length) {
    const value = extensions[index2];
    if (Array.isArray(value)) {
      configure(combined, value);
    } else {
      extension(combined, value);
    }
  }
}
function extension(combined, extension2) {
  let key;
  for (key in extension2) {
    if (own3.call(extension2, key)) {
      switch (key) {
        case "canContainEols": {
          const right = extension2[key];
          if (right) {
            combined[key].push(...right);
          }
          break;
        }
        case "transforms": {
          const right = extension2[key];
          if (right) {
            combined[key].push(...right);
          }
          break;
        }
        case "enter":
        case "exit": {
          const right = extension2[key];
          if (right) {
            Object.assign(combined[key], right);
          }
          break;
        }
      }
    }
  }
}
function defaultOnError(left, right) {
  if (left) {
    throw new Error("Cannot close `" + left.type + "` (" + stringifyPosition({
      start: left.start,
      end: left.end
    }) + "): a different token (`" + right.type + "`, " + stringifyPosition({
      start: right.start,
      end: right.end
    }) + ") is open");
  } else {
    throw new Error("Cannot close document, a token (`" + right.type + "`, " + stringifyPosition({
      start: right.start,
      end: right.end
    }) + ") is still open");
  }
}

// node_modules/remark-parse/lib/index.js
function remarkParse(options) {
  const self = this;
  self.parser = parser;
  function parser(doc) {
    return fromMarkdown(doc, {
      ...self.data("settings"),
      ...options,
      // Note: these options are not in the readme.
      // The goal is for them to be set by plugins on `data` instead of being
      // passed by users.
      extensions: self.data("micromarkExtensions") || [],
      mdastExtensions: self.data("fromMarkdownExtensions") || []
    });
  }
}

// node_modules/ccount/index.js
function ccount(value, character) {
  const source = String(value);
  if (typeof character !== "string") {
    throw new TypeError("Expected character");
  }
  let count = 0;
  let index2 = source.indexOf(character);
  while (index2 !== -1) {
    count++;
    index2 = source.indexOf(character, index2 + character.length);
  }
  return count;
}

// node_modules/escape-string-regexp/index.js
function escapeStringRegexp(string3) {
  if (typeof string3 !== "string") {
    throw new TypeError("Expected a string");
  }
  return string3.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}

// node_modules/unist-util-is/lib/index.js
var convert = (
  // Note: overloads in JSDoc can’t yet use different `@template`s.
  /**
   * @type {(
   *   (<Condition extends string>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & {type: Condition}) &
   *   (<Condition extends Props>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Condition) &
   *   (<Condition extends TestFunction>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Predicate<Condition, Node>) &
   *   ((test?: null | undefined) => (node?: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node) &
   *   ((test?: Test) => Check)
   * )}
   */
  /**
   * @param {Test} [test]
   * @returns {Check}
   */
  (function(test) {
    if (test === null || test === void 0) {
      return ok2;
    }
    if (typeof test === "function") {
      return castFactory(test);
    }
    if (typeof test === "object") {
      return Array.isArray(test) ? anyFactory(test) : (
        // Cast because `ReadonlyArray` goes into the above but `isArray`
        // narrows to `Array`.
        propertiesFactory(
          /** @type {Props} */
          test
        )
      );
    }
    if (typeof test === "string") {
      return typeFactory(test);
    }
    throw new Error("Expected function, string, or object as test");
  })
);
function anyFactory(tests) {
  const checks = [];
  let index2 = -1;
  while (++index2 < tests.length) {
    checks[index2] = convert(tests[index2]);
  }
  return castFactory(any);
  function any(...parameters) {
    let index3 = -1;
    while (++index3 < checks.length) {
      if (checks[index3].apply(this, parameters)) return true;
    }
    return false;
  }
}
function propertiesFactory(check) {
  const checkAsRecord = (
    /** @type {Record<string, unknown>} */
    check
  );
  return castFactory(all2);
  function all2(node2) {
    const nodeAsRecord = (
      /** @type {Record<string, unknown>} */
      /** @type {unknown} */
      node2
    );
    let key;
    for (key in check) {
      if (nodeAsRecord[key] !== checkAsRecord[key]) return false;
    }
    return true;
  }
}
function typeFactory(check) {
  return castFactory(type);
  function type(node2) {
    return node2 && node2.type === check;
  }
}
function castFactory(testFunction) {
  return check;
  function check(value, index2, parent) {
    return Boolean(
      looksLikeANode(value) && testFunction.call(
        this,
        value,
        typeof index2 === "number" ? index2 : void 0,
        parent || void 0
      )
    );
  }
}
function ok2() {
  return true;
}
function looksLikeANode(value) {
  return value !== null && typeof value === "object" && "type" in value;
}

// node_modules/unist-util-visit-parents/lib/color.node.js
function color(d) {
  return "\x1B[33m" + d + "\x1B[39m";
}

// node_modules/unist-util-visit-parents/lib/index.js
var empty = [];
var CONTINUE = true;
var EXIT = false;
var SKIP = "skip";
function visitParents(tree, test, visitor, reverse) {
  let check;
  if (typeof test === "function" && typeof visitor !== "function") {
    reverse = visitor;
    visitor = test;
  } else {
    check = test;
  }
  const is2 = convert(check);
  const step = reverse ? -1 : 1;
  factory(tree, void 0, [])();
  function factory(node2, index2, parents) {
    const value = (
      /** @type {Record<string, unknown>} */
      node2 && typeof node2 === "object" ? node2 : {}
    );
    if (typeof value.type === "string") {
      const name2 = (
        // `hast`
        typeof value.tagName === "string" ? value.tagName : (
          // `xast`
          typeof value.name === "string" ? value.name : void 0
        )
      );
      Object.defineProperty(visit2, "name", {
        value: "node (" + color(node2.type + (name2 ? "<" + name2 + ">" : "")) + ")"
      });
    }
    return visit2;
    function visit2() {
      let result = empty;
      let subresult;
      let offset;
      let grandparents;
      if (!test || is2(node2, index2, parents[parents.length - 1] || void 0)) {
        result = toResult(visitor(node2, parents));
        if (result[0] === EXIT) {
          return result;
        }
      }
      if ("children" in node2 && node2.children) {
        const nodeAsParent = (
          /** @type {UnistParent} */
          node2
        );
        if (nodeAsParent.children && result[0] !== SKIP) {
          offset = (reverse ? nodeAsParent.children.length : -1) + step;
          grandparents = parents.concat(nodeAsParent);
          while (offset > -1 && offset < nodeAsParent.children.length) {
            const child = nodeAsParent.children[offset];
            subresult = factory(child, offset, grandparents)();
            if (subresult[0] === EXIT) {
              return subresult;
            }
            offset = typeof subresult[1] === "number" ? subresult[1] : offset + step;
          }
        }
      }
      return result;
    }
  }
}
function toResult(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "number") {
    return [CONTINUE, value];
  }
  return value === null || value === void 0 ? empty : [value];
}

// node_modules/mdast-util-find-and-replace/lib/index.js
function findAndReplace(tree, list3, options) {
  const settings = options || {};
  const ignored = convert(settings.ignore || []);
  const pairs = toPairs(list3);
  let pairIndex = -1;
  while (++pairIndex < pairs.length) {
    visitParents(tree, "text", visitor);
  }
  function visitor(node2, parents) {
    let index2 = -1;
    let grandparent;
    while (++index2 < parents.length) {
      const parent = parents[index2];
      const siblings = grandparent ? grandparent.children : void 0;
      if (ignored(
        parent,
        siblings ? siblings.indexOf(parent) : void 0,
        grandparent
      )) {
        return;
      }
      grandparent = parent;
    }
    if (grandparent) {
      return handler(node2, parents);
    }
  }
  function handler(node2, parents) {
    const parent = parents[parents.length - 1];
    const find = pairs[pairIndex][0];
    const replace2 = pairs[pairIndex][1];
    let start = 0;
    const siblings = parent.children;
    const index2 = siblings.indexOf(node2);
    let change = false;
    let nodes = [];
    find.lastIndex = 0;
    let match = find.exec(node2.value);
    while (match) {
      const position2 = match.index;
      const matchObject = {
        index: match.index,
        input: match.input,
        stack: [...parents, node2]
      };
      let value = replace2(...match, matchObject);
      if (typeof value === "string") {
        value = value.length > 0 ? { type: "text", value } : void 0;
      }
      if (value === false) {
        find.lastIndex = position2 + 1;
      } else {
        if (start !== position2) {
          nodes.push({
            type: "text",
            value: node2.value.slice(start, position2)
          });
        }
        if (Array.isArray(value)) {
          nodes.push(...value);
        } else if (value) {
          nodes.push(value);
        }
        start = position2 + match[0].length;
        change = true;
      }
      if (!find.global) {
        break;
      }
      match = find.exec(node2.value);
    }
    if (change) {
      if (start < node2.value.length) {
        nodes.push({ type: "text", value: node2.value.slice(start) });
      }
      parent.children.splice(index2, 1, ...nodes);
    } else {
      nodes = [node2];
    }
    return index2 + nodes.length;
  }
}
function toPairs(tupleOrList) {
  const result = [];
  if (!Array.isArray(tupleOrList)) {
    throw new TypeError("Expected find and replace tuple or list of tuples");
  }
  const list3 = !tupleOrList[0] || Array.isArray(tupleOrList[0]) ? tupleOrList : [tupleOrList];
  let index2 = -1;
  while (++index2 < list3.length) {
    const tuple = list3[index2];
    result.push([toExpression(tuple[0]), toFunction(tuple[1])]);
  }
  return result;
}
function toExpression(find) {
  return typeof find === "string" ? new RegExp(escapeStringRegexp(find), "g") : find;
}
function toFunction(replace2) {
  return typeof replace2 === "function" ? replace2 : function() {
    return replace2;
  };
}

// node_modules/mdast-util-gfm-autolink-literal/lib/index.js
var inConstruct = "phrasing";
var notInConstruct = ["autolink", "link", "image", "label"];
function gfmAutolinkLiteralFromMarkdown() {
  return {
    transforms: [transformGfmAutolinkLiterals],
    enter: {
      literalAutolink: enterLiteralAutolink,
      literalAutolinkEmail: enterLiteralAutolinkValue,
      literalAutolinkHttp: enterLiteralAutolinkValue,
      literalAutolinkWww: enterLiteralAutolinkValue
    },
    exit: {
      literalAutolink: exitLiteralAutolink,
      literalAutolinkEmail: exitLiteralAutolinkEmail,
      literalAutolinkHttp: exitLiteralAutolinkHttp,
      literalAutolinkWww: exitLiteralAutolinkWww
    }
  };
}
function gfmAutolinkLiteralToMarkdown() {
  return {
    unsafe: [
      {
        character: "@",
        before: "[+\\-.\\w]",
        after: "[\\-.\\w]",
        inConstruct,
        notInConstruct
      },
      {
        character: ".",
        before: "[Ww]",
        after: "[\\-.\\w]",
        inConstruct,
        notInConstruct
      },
      {
        character: ":",
        before: "[ps]",
        after: "\\/",
        inConstruct,
        notInConstruct
      }
    ]
  };
}
function enterLiteralAutolink(token) {
  this.enter({ type: "link", title: null, url: "", children: [] }, token);
}
function enterLiteralAutolinkValue(token) {
  this.config.enter.autolinkProtocol.call(this, token);
}
function exitLiteralAutolinkHttp(token) {
  this.config.exit.autolinkProtocol.call(this, token);
}
function exitLiteralAutolinkWww(token) {
  this.config.exit.data.call(this, token);
  const node2 = this.stack[this.stack.length - 1];
  ok(node2.type === "link");
  node2.url = "http://" + this.sliceSerialize(token);
}
function exitLiteralAutolinkEmail(token) {
  this.config.exit.autolinkEmail.call(this, token);
}
function exitLiteralAutolink(token) {
  this.exit(token);
}
function transformGfmAutolinkLiterals(tree) {
  findAndReplace(
    tree,
    [
      [/(https?:\/\/|www(?=\.))([-.\w]+)([^ \t\r\n]*)/gi, findUrl],
      [/(?<=^|\s|\p{P}|\p{S})([-.\w+]+)@([-\w]+(?:\.[-\w]+)+)/gu, findEmail]
    ],
    { ignore: ["link", "linkReference"] }
  );
}
function findUrl(_, protocol, domain2, path2, match) {
  let prefix = "";
  if (!previous2(match)) {
    return false;
  }
  if (/^w/i.test(protocol)) {
    domain2 = protocol + domain2;
    protocol = "";
    prefix = "http://";
  }
  if (!isCorrectDomain(domain2)) {
    return false;
  }
  const parts = splitUrl(domain2 + path2);
  if (!parts[0]) return false;
  const result = {
    type: "link",
    title: null,
    url: prefix + protocol + parts[0],
    children: [{ type: "text", value: protocol + parts[0] }]
  };
  if (parts[1]) {
    return [result, { type: "text", value: parts[1] }];
  }
  return result;
}
function findEmail(_, atext, label, match) {
  if (
    // Not an expected previous character.
    !previous2(match, true) || // Label ends in not allowed character.
    /[-\d_]$/.test(label)
  ) {
    return false;
  }
  return {
    type: "link",
    title: null,
    url: "mailto:" + atext + "@" + label,
    children: [{ type: "text", value: atext + "@" + label }]
  };
}
function isCorrectDomain(domain2) {
  const parts = domain2.split(".");
  if (parts.length < 2 || parts[parts.length - 1] && (/_/.test(parts[parts.length - 1]) || !/[a-zA-Z\d]/.test(parts[parts.length - 1])) || parts[parts.length - 2] && (/_/.test(parts[parts.length - 2]) || !/[a-zA-Z\d]/.test(parts[parts.length - 2]))) {
    return false;
  }
  return true;
}
function splitUrl(url) {
  const trailExec = /[!"&'),.:;<>?\]}]+$/.exec(url);
  if (!trailExec) {
    return [url, void 0];
  }
  url = url.slice(0, trailExec.index);
  let trail2 = trailExec[0];
  let closingParenIndex = trail2.indexOf(")");
  const openingParens = ccount(url, "(");
  let closingParens = ccount(url, ")");
  while (closingParenIndex !== -1 && openingParens > closingParens) {
    url += trail2.slice(0, closingParenIndex + 1);
    trail2 = trail2.slice(closingParenIndex + 1);
    closingParenIndex = trail2.indexOf(")");
    closingParens++;
  }
  return [url, trail2];
}
function previous2(match, email) {
  const code3 = match.input.charCodeAt(match.index - 1);
  return (match.index === 0 || unicodeWhitespace(code3) || unicodePunctuation(code3)) && // If it’s an email, the previous character should not be a slash.
  (!email || code3 !== 47);
}

// node_modules/mdast-util-gfm-footnote/lib/index.js
footnoteReference.peek = footnoteReferencePeek;
function enterFootnoteCallString() {
  this.buffer();
}
function enterFootnoteCall(token) {
  this.enter({ type: "footnoteReference", identifier: "", label: "" }, token);
}
function enterFootnoteDefinitionLabelString() {
  this.buffer();
}
function enterFootnoteDefinition(token) {
  this.enter(
    { type: "footnoteDefinition", identifier: "", label: "", children: [] },
    token
  );
}
function exitFootnoteCallString(token) {
  const label = this.resume();
  const node2 = this.stack[this.stack.length - 1];
  ok(node2.type === "footnoteReference");
  node2.identifier = normalizeIdentifier(
    this.sliceSerialize(token)
  ).toLowerCase();
  node2.label = label;
}
function exitFootnoteCall(token) {
  this.exit(token);
}
function exitFootnoteDefinitionLabelString(token) {
  const label = this.resume();
  const node2 = this.stack[this.stack.length - 1];
  ok(node2.type === "footnoteDefinition");
  node2.identifier = normalizeIdentifier(
    this.sliceSerialize(token)
  ).toLowerCase();
  node2.label = label;
}
function exitFootnoteDefinition(token) {
  this.exit(token);
}
function footnoteReferencePeek() {
  return "[";
}
function footnoteReference(node2, _, state, info) {
  const tracker = state.createTracker(info);
  let value = tracker.move("[^");
  const exit3 = state.enter("footnoteReference");
  const subexit = state.enter("reference");
  value += tracker.move(
    state.safe(state.associationId(node2), { after: "]", before: value })
  );
  subexit();
  exit3();
  value += tracker.move("]");
  return value;
}
function gfmFootnoteFromMarkdown() {
  return {
    enter: {
      gfmFootnoteCallString: enterFootnoteCallString,
      gfmFootnoteCall: enterFootnoteCall,
      gfmFootnoteDefinitionLabelString: enterFootnoteDefinitionLabelString,
      gfmFootnoteDefinition: enterFootnoteDefinition
    },
    exit: {
      gfmFootnoteCallString: exitFootnoteCallString,
      gfmFootnoteCall: exitFootnoteCall,
      gfmFootnoteDefinitionLabelString: exitFootnoteDefinitionLabelString,
      gfmFootnoteDefinition: exitFootnoteDefinition
    }
  };
}
function gfmFootnoteToMarkdown(options) {
  let firstLineBlank = false;
  if (options && options.firstLineBlank) {
    firstLineBlank = true;
  }
  return {
    handlers: { footnoteDefinition, footnoteReference },
    // This is on by default already.
    unsafe: [{ character: "[", inConstruct: ["label", "phrasing", "reference"] }]
  };
  function footnoteDefinition(node2, _, state, info) {
    const tracker = state.createTracker(info);
    let value = tracker.move("[^");
    const exit3 = state.enter("footnoteDefinition");
    const subexit = state.enter("label");
    value += tracker.move(
      state.safe(state.associationId(node2), { before: value, after: "]" })
    );
    subexit();
    value += tracker.move("]:");
    if (node2.children && node2.children.length > 0) {
      tracker.shift(4);
      value += tracker.move(
        (firstLineBlank ? "\n" : " ") + state.indentLines(
          state.containerFlow(node2, tracker.current()),
          firstLineBlank ? mapAll : mapExceptFirst
        )
      );
    }
    exit3();
    return value;
  }
}
function mapExceptFirst(line, index2, blank) {
  return index2 === 0 ? line : mapAll(line, index2, blank);
}
function mapAll(line, index2, blank) {
  return (blank ? "" : "    ") + line;
}

// node_modules/mdast-util-gfm-strikethrough/lib/index.js
var constructsWithoutStrikethrough = [
  "autolink",
  "destinationLiteral",
  "destinationRaw",
  "reference",
  "titleQuote",
  "titleApostrophe"
];
handleDelete.peek = peekDelete;
function gfmStrikethroughFromMarkdown() {
  return {
    canContainEols: ["delete"],
    enter: { strikethrough: enterStrikethrough },
    exit: { strikethrough: exitStrikethrough }
  };
}
function gfmStrikethroughToMarkdown() {
  return {
    unsafe: [
      {
        character: "~",
        inConstruct: "phrasing",
        notInConstruct: constructsWithoutStrikethrough
      }
    ],
    handlers: { delete: handleDelete }
  };
}
function enterStrikethrough(token) {
  this.enter({ type: "delete", children: [] }, token);
}
function exitStrikethrough(token) {
  this.exit(token);
}
function handleDelete(node2, _, state, info) {
  const tracker = state.createTracker(info);
  const exit3 = state.enter("strikethrough");
  let value = tracker.move("~~");
  value += state.containerPhrasing(node2, {
    ...tracker.current(),
    before: value,
    after: "~"
  });
  value += tracker.move("~~");
  exit3();
  return value;
}
function peekDelete() {
  return "~";
}

// node_modules/markdown-table/index.js
function defaultStringLength(value) {
  return value.length;
}
function markdownTable(table, options) {
  const settings = options || {};
  const align = (settings.align || []).concat();
  const stringLength = settings.stringLength || defaultStringLength;
  const alignments = [];
  const cellMatrix = [];
  const sizeMatrix = [];
  const longestCellByColumn = [];
  let mostCellsPerRow = 0;
  let rowIndex = -1;
  while (++rowIndex < table.length) {
    const row2 = [];
    const sizes2 = [];
    let columnIndex2 = -1;
    if (table[rowIndex].length > mostCellsPerRow) {
      mostCellsPerRow = table[rowIndex].length;
    }
    while (++columnIndex2 < table[rowIndex].length) {
      const cell = serialize(table[rowIndex][columnIndex2]);
      if (settings.alignDelimiters !== false) {
        const size = stringLength(cell);
        sizes2[columnIndex2] = size;
        if (longestCellByColumn[columnIndex2] === void 0 || size > longestCellByColumn[columnIndex2]) {
          longestCellByColumn[columnIndex2] = size;
        }
      }
      row2.push(cell);
    }
    cellMatrix[rowIndex] = row2;
    sizeMatrix[rowIndex] = sizes2;
  }
  let columnIndex = -1;
  if (typeof align === "object" && "length" in align) {
    while (++columnIndex < mostCellsPerRow) {
      alignments[columnIndex] = toAlignment(align[columnIndex]);
    }
  } else {
    const code3 = toAlignment(align);
    while (++columnIndex < mostCellsPerRow) {
      alignments[columnIndex] = code3;
    }
  }
  columnIndex = -1;
  const row = [];
  const sizes = [];
  while (++columnIndex < mostCellsPerRow) {
    const code3 = alignments[columnIndex];
    let before = "";
    let after = "";
    if (code3 === 99) {
      before = ":";
      after = ":";
    } else if (code3 === 108) {
      before = ":";
    } else if (code3 === 114) {
      after = ":";
    }
    let size = settings.alignDelimiters === false ? 1 : Math.max(
      1,
      longestCellByColumn[columnIndex] - before.length - after.length
    );
    const cell = before + "-".repeat(size) + after;
    if (settings.alignDelimiters !== false) {
      size = before.length + size + after.length;
      if (size > longestCellByColumn[columnIndex]) {
        longestCellByColumn[columnIndex] = size;
      }
      sizes[columnIndex] = size;
    }
    row[columnIndex] = cell;
  }
  cellMatrix.splice(1, 0, row);
  sizeMatrix.splice(1, 0, sizes);
  rowIndex = -1;
  const lines = [];
  while (++rowIndex < cellMatrix.length) {
    const row2 = cellMatrix[rowIndex];
    const sizes2 = sizeMatrix[rowIndex];
    columnIndex = -1;
    const line = [];
    while (++columnIndex < mostCellsPerRow) {
      const cell = row2[columnIndex] || "";
      let before = "";
      let after = "";
      if (settings.alignDelimiters !== false) {
        const size = longestCellByColumn[columnIndex] - (sizes2[columnIndex] || 0);
        const code3 = alignments[columnIndex];
        if (code3 === 114) {
          before = " ".repeat(size);
        } else if (code3 === 99) {
          if (size % 2) {
            before = " ".repeat(size / 2 + 0.5);
            after = " ".repeat(size / 2 - 0.5);
          } else {
            before = " ".repeat(size / 2);
            after = before;
          }
        } else {
          after = " ".repeat(size);
        }
      }
      if (settings.delimiterStart !== false && !columnIndex) {
        line.push("|");
      }
      if (settings.padding !== false && // Don’t add the opening space if we’re not aligning and the cell is
      // empty: there will be a closing space.
      !(settings.alignDelimiters === false && cell === "") && (settings.delimiterStart !== false || columnIndex)) {
        line.push(" ");
      }
      if (settings.alignDelimiters !== false) {
        line.push(before);
      }
      line.push(cell);
      if (settings.alignDelimiters !== false) {
        line.push(after);
      }
      if (settings.padding !== false) {
        line.push(" ");
      }
      if (settings.delimiterEnd !== false || columnIndex !== mostCellsPerRow - 1) {
        line.push("|");
      }
    }
    lines.push(
      settings.delimiterEnd === false ? line.join("").replace(/ +$/, "") : line.join("")
    );
  }
  return lines.join("\n");
}
function serialize(value) {
  return value === null || value === void 0 ? "" : String(value);
}
function toAlignment(value) {
  const code3 = typeof value === "string" ? value.codePointAt(0) : 0;
  return code3 === 67 || code3 === 99 ? 99 : code3 === 76 || code3 === 108 ? 108 : code3 === 82 || code3 === 114 ? 114 : 0;
}

// node_modules/mdast-util-to-markdown/lib/handle/blockquote.js
function blockquote(node2, _, state, info) {
  const exit3 = state.enter("blockquote");
  const tracker = state.createTracker(info);
  tracker.move("> ");
  tracker.shift(2);
  const value = state.indentLines(
    state.containerFlow(node2, tracker.current()),
    map
  );
  exit3();
  return value;
}
function map(line, _, blank) {
  return ">" + (blank ? "" : " ") + line;
}

// node_modules/mdast-util-to-markdown/lib/util/pattern-in-scope.js
function patternInScope(stack, pattern) {
  return listInScope(stack, pattern.inConstruct, true) && !listInScope(stack, pattern.notInConstruct, false);
}
function listInScope(stack, list3, none) {
  if (typeof list3 === "string") {
    list3 = [list3];
  }
  if (!list3 || list3.length === 0) {
    return none;
  }
  let index2 = -1;
  while (++index2 < list3.length) {
    if (stack.includes(list3[index2])) {
      return true;
    }
  }
  return false;
}

// node_modules/mdast-util-to-markdown/lib/handle/break.js
function hardBreak(_, _1, state, info) {
  let index2 = -1;
  while (++index2 < state.unsafe.length) {
    if (state.unsafe[index2].character === "\n" && patternInScope(state.stack, state.unsafe[index2])) {
      return /[ \t]/.test(info.before) ? "" : " ";
    }
  }
  return "\\\n";
}

// node_modules/longest-streak/index.js
function longestStreak(value, substring) {
  const source = String(value);
  let index2 = source.indexOf(substring);
  let expected = index2;
  let count = 0;
  let max = 0;
  if (typeof substring !== "string") {
    throw new TypeError("Expected substring");
  }
  while (index2 !== -1) {
    if (index2 === expected) {
      if (++count > max) {
        max = count;
      }
    } else {
      count = 1;
    }
    expected = index2 + substring.length;
    index2 = source.indexOf(substring, expected);
  }
  return max;
}

// node_modules/mdast-util-to-markdown/lib/util/format-code-as-indented.js
function formatCodeAsIndented(node2, state) {
  return Boolean(
    state.options.fences === false && node2.value && // If there’s no info…
    !node2.lang && // And there’s a non-whitespace character…
    /[^ \r\n]/.test(node2.value) && // And the value doesn’t start or end in a blank…
    !/^[\t ]*(?:[\r\n]|$)|(?:^|[\r\n])[\t ]*$/.test(node2.value)
  );
}

// node_modules/mdast-util-to-markdown/lib/util/check-fence.js
function checkFence(state) {
  const marker = state.options.fence || "`";
  if (marker !== "`" && marker !== "~") {
    throw new Error(
      "Cannot serialize code with `" + marker + "` for `options.fence`, expected `` ` `` or `~`"
    );
  }
  return marker;
}

// node_modules/mdast-util-to-markdown/lib/handle/code.js
function code(node2, _, state, info) {
  const marker = checkFence(state);
  const raw = node2.value || "";
  const suffix = marker === "`" ? "GraveAccent" : "Tilde";
  if (formatCodeAsIndented(node2, state)) {
    const exit4 = state.enter("codeIndented");
    const value2 = state.indentLines(raw, map2);
    exit4();
    return value2;
  }
  const tracker = state.createTracker(info);
  const sequence = marker.repeat(Math.max(longestStreak(raw, marker) + 1, 3));
  const exit3 = state.enter("codeFenced");
  let value = tracker.move(sequence);
  if (node2.lang) {
    const subexit = state.enter(`codeFencedLang${suffix}`);
    value += tracker.move(
      state.safe(node2.lang, {
        before: value,
        after: " ",
        encode: ["`"],
        ...tracker.current()
      })
    );
    subexit();
  }
  if (node2.lang && node2.meta) {
    const subexit = state.enter(`codeFencedMeta${suffix}`);
    value += tracker.move(" ");
    value += tracker.move(
      state.safe(node2.meta, {
        before: value,
        after: "\n",
        encode: ["`"],
        ...tracker.current()
      })
    );
    subexit();
  }
  value += tracker.move("\n");
  if (raw) {
    value += tracker.move(raw + "\n");
  }
  value += tracker.move(sequence);
  exit3();
  return value;
}
function map2(line, _, blank) {
  return (blank ? "" : "    ") + line;
}

// node_modules/mdast-util-to-markdown/lib/util/check-quote.js
function checkQuote(state) {
  const marker = state.options.quote || '"';
  if (marker !== '"' && marker !== "'") {
    throw new Error(
      "Cannot serialize title with `" + marker + "` for `options.quote`, expected `\"`, or `'`"
    );
  }
  return marker;
}

// node_modules/mdast-util-to-markdown/lib/handle/definition.js
function definition2(node2, _, state, info) {
  const quote = checkQuote(state);
  const suffix = quote === '"' ? "Quote" : "Apostrophe";
  const exit3 = state.enter("definition");
  let subexit = state.enter("label");
  const tracker = state.createTracker(info);
  let value = tracker.move("[");
  value += tracker.move(
    state.safe(state.associationId(node2), {
      before: value,
      after: "]",
      ...tracker.current()
    })
  );
  value += tracker.move("]: ");
  subexit();
  if (
    // If there’s no url, or…
    !node2.url || // If there are control characters or whitespace.
    /[\0- \u007F]/.test(node2.url)
  ) {
    subexit = state.enter("destinationLiteral");
    value += tracker.move("<");
    value += tracker.move(
      state.safe(node2.url, { before: value, after: ">", ...tracker.current() })
    );
    value += tracker.move(">");
  } else {
    subexit = state.enter("destinationRaw");
    value += tracker.move(
      state.safe(node2.url, {
        before: value,
        after: node2.title ? " " : "\n",
        ...tracker.current()
      })
    );
  }
  subexit();
  if (node2.title) {
    subexit = state.enter(`title${suffix}`);
    value += tracker.move(" " + quote);
    value += tracker.move(
      state.safe(node2.title, {
        before: value,
        after: quote,
        ...tracker.current()
      })
    );
    value += tracker.move(quote);
    subexit();
  }
  exit3();
  return value;
}

// node_modules/mdast-util-to-markdown/lib/util/check-emphasis.js
function checkEmphasis(state) {
  const marker = state.options.emphasis || "*";
  if (marker !== "*" && marker !== "_") {
    throw new Error(
      "Cannot serialize emphasis with `" + marker + "` for `options.emphasis`, expected `*`, or `_`"
    );
  }
  return marker;
}

// node_modules/mdast-util-to-markdown/lib/util/encode-character-reference.js
function encodeCharacterReference(code3) {
  return "&#x" + code3.toString(16).toUpperCase() + ";";
}

// node_modules/mdast-util-to-markdown/lib/util/encode-info.js
function encodeInfo(outside, inside, marker) {
  const outsideKind = classifyCharacter(outside);
  const insideKind = classifyCharacter(inside);
  if (outsideKind === void 0) {
    return insideKind === void 0 ? (
      // Letter inside:
      // we have to encode *both* letters for `_` as it is looser.
      // it already forms for `*` (and GFMs `~`).
      marker === "_" ? { inside: true, outside: true } : { inside: false, outside: false }
    ) : insideKind === 1 ? (
      // Whitespace inside: encode both (letter, whitespace).
      { inside: true, outside: true }
    ) : (
      // Punctuation inside: encode outer (letter)
      { inside: false, outside: true }
    );
  }
  if (outsideKind === 1) {
    return insideKind === void 0 ? (
      // Letter inside: already forms.
      { inside: false, outside: false }
    ) : insideKind === 1 ? (
      // Whitespace inside: encode both (whitespace).
      { inside: true, outside: true }
    ) : (
      // Punctuation inside: already forms.
      { inside: false, outside: false }
    );
  }
  return insideKind === void 0 ? (
    // Letter inside: already forms.
    { inside: false, outside: false }
  ) : insideKind === 1 ? (
    // Whitespace inside: encode inner (whitespace).
    { inside: true, outside: false }
  ) : (
    // Punctuation inside: already forms.
    { inside: false, outside: false }
  );
}

// node_modules/mdast-util-to-markdown/lib/handle/emphasis.js
emphasis.peek = emphasisPeek;
function emphasis(node2, _, state, info) {
  const marker = checkEmphasis(state);
  const exit3 = state.enter("emphasis");
  const tracker = state.createTracker(info);
  const before = tracker.move(marker);
  let between = tracker.move(
    state.containerPhrasing(node2, {
      after: marker,
      before,
      ...tracker.current()
    })
  );
  const betweenHead = between.charCodeAt(0);
  const open = encodeInfo(
    info.before.charCodeAt(info.before.length - 1),
    betweenHead,
    marker
  );
  if (open.inside) {
    between = encodeCharacterReference(betweenHead) + between.slice(1);
  }
  const betweenTail = between.charCodeAt(between.length - 1);
  const close = encodeInfo(info.after.charCodeAt(0), betweenTail, marker);
  if (close.inside) {
    between = between.slice(0, -1) + encodeCharacterReference(betweenTail);
  }
  const after = tracker.move(marker);
  exit3();
  state.attentionEncodeSurroundingInfo = {
    after: close.outside,
    before: open.outside
  };
  return before + between + after;
}
function emphasisPeek(_, _1, state) {
  return state.options.emphasis || "*";
}

// node_modules/unist-util-visit/lib/index.js
function visit(tree, testOrVisitor, visitorOrReverse, maybeReverse) {
  let reverse;
  let test;
  let visitor;
  if (typeof testOrVisitor === "function" && typeof visitorOrReverse !== "function") {
    test = void 0;
    visitor = testOrVisitor;
    reverse = visitorOrReverse;
  } else {
    test = testOrVisitor;
    visitor = visitorOrReverse;
    reverse = maybeReverse;
  }
  visitParents(tree, test, overload, reverse);
  function overload(node2, parents) {
    const parent = parents[parents.length - 1];
    const index2 = parent ? parent.children.indexOf(node2) : void 0;
    return visitor(node2, index2, parent);
  }
}

// node_modules/mdast-util-to-markdown/lib/util/format-heading-as-setext.js
function formatHeadingAsSetext(node2, state) {
  let literalWithBreak = false;
  visit(node2, function(node3) {
    if ("value" in node3 && /\r?\n|\r/.test(node3.value) || node3.type === "break") {
      literalWithBreak = true;
      return EXIT;
    }
  });
  return Boolean(
    (!node2.depth || node2.depth < 3) && toString(node2) && (state.options.setext || literalWithBreak)
  );
}

// node_modules/mdast-util-to-markdown/lib/handle/heading.js
function heading(node2, _, state, info) {
  const rank = Math.max(Math.min(6, node2.depth || 1), 1);
  const tracker = state.createTracker(info);
  if (formatHeadingAsSetext(node2, state)) {
    const exit4 = state.enter("headingSetext");
    const subexit2 = state.enter("phrasing");
    const value2 = state.containerPhrasing(node2, {
      ...tracker.current(),
      before: "\n",
      after: "\n"
    });
    subexit2();
    exit4();
    return value2 + "\n" + (rank === 1 ? "=" : "-").repeat(
      // The whole size…
      value2.length - // Minus the position of the character after the last EOL (or
      // 0 if there is none)…
      (Math.max(value2.lastIndexOf("\r"), value2.lastIndexOf("\n")) + 1)
    );
  }
  const sequence = "#".repeat(rank);
  const exit3 = state.enter("headingAtx");
  const subexit = state.enter("phrasing");
  tracker.move(sequence + " ");
  let value = state.containerPhrasing(node2, {
    before: "# ",
    after: "\n",
    ...tracker.current()
  });
  if (/^[\t ]/.test(value)) {
    value = encodeCharacterReference(value.charCodeAt(0)) + value.slice(1);
  }
  value = value ? sequence + " " + value : sequence;
  if (state.options.closeAtx) {
    value += " " + sequence;
  }
  subexit();
  exit3();
  return value;
}

// node_modules/mdast-util-to-markdown/lib/handle/html.js
html.peek = htmlPeek;
function html(node2) {
  return node2.value || "";
}
function htmlPeek() {
  return "<";
}

// node_modules/mdast-util-to-markdown/lib/handle/image.js
image.peek = imagePeek;
function image(node2, _, state, info) {
  const quote = checkQuote(state);
  const suffix = quote === '"' ? "Quote" : "Apostrophe";
  const exit3 = state.enter("image");
  let subexit = state.enter("label");
  const tracker = state.createTracker(info);
  let value = tracker.move("![");
  value += tracker.move(
    state.safe(node2.alt, { before: value, after: "]", ...tracker.current() })
  );
  value += tracker.move("](");
  subexit();
  if (
    // If there’s no url but there is a title…
    !node2.url && node2.title || // If there are control characters or whitespace.
    /[\0- \u007F]/.test(node2.url)
  ) {
    subexit = state.enter("destinationLiteral");
    value += tracker.move("<");
    value += tracker.move(
      state.safe(node2.url, { before: value, after: ">", ...tracker.current() })
    );
    value += tracker.move(">");
  } else {
    subexit = state.enter("destinationRaw");
    value += tracker.move(
      state.safe(node2.url, {
        before: value,
        after: node2.title ? " " : ")",
        ...tracker.current()
      })
    );
  }
  subexit();
  if (node2.title) {
    subexit = state.enter(`title${suffix}`);
    value += tracker.move(" " + quote);
    value += tracker.move(
      state.safe(node2.title, {
        before: value,
        after: quote,
        ...tracker.current()
      })
    );
    value += tracker.move(quote);
    subexit();
  }
  value += tracker.move(")");
  exit3();
  return value;
}
function imagePeek() {
  return "!";
}

// node_modules/mdast-util-to-markdown/lib/handle/image-reference.js
imageReference.peek = imageReferencePeek;
function imageReference(node2, _, state, info) {
  const type = node2.referenceType;
  const exit3 = state.enter("imageReference");
  let subexit = state.enter("label");
  const tracker = state.createTracker(info);
  let value = tracker.move("![");
  const alt = state.safe(node2.alt, {
    before: value,
    after: "]",
    ...tracker.current()
  });
  value += tracker.move(alt + "][");
  subexit();
  const stack = state.stack;
  state.stack = [];
  subexit = state.enter("reference");
  const reference = state.safe(state.associationId(node2), {
    before: value,
    after: "]",
    ...tracker.current()
  });
  subexit();
  state.stack = stack;
  exit3();
  if (type === "full" || !alt || alt !== reference) {
    value += tracker.move(reference + "]");
  } else if (type === "shortcut") {
    value = value.slice(0, -1);
  } else {
    value += tracker.move("]");
  }
  return value;
}
function imageReferencePeek() {
  return "!";
}

// node_modules/mdast-util-to-markdown/lib/handle/inline-code.js
inlineCode.peek = inlineCodePeek;
function inlineCode(node2, _, state) {
  let value = node2.value || "";
  let sequence = "`";
  let index2 = -1;
  while (new RegExp("(^|[^`])" + sequence + "([^`]|$)").test(value)) {
    sequence += "`";
  }
  if (/[^ \r\n]/.test(value) && (/^[ \r\n]/.test(value) && /[ \r\n]$/.test(value) || /^`|`$/.test(value))) {
    value = " " + value + " ";
  }
  while (++index2 < state.unsafe.length) {
    const pattern = state.unsafe[index2];
    const expression = state.compilePattern(pattern);
    let match;
    if (!pattern.atBreak) continue;
    while (match = expression.exec(value)) {
      let position2 = match.index;
      if (value.charCodeAt(position2) === 10 && value.charCodeAt(position2 - 1) === 13) {
        position2--;
      }
      value = value.slice(0, position2) + " " + value.slice(match.index + 1);
    }
  }
  return sequence + value + sequence;
}
function inlineCodePeek() {
  return "`";
}

// node_modules/mdast-util-to-markdown/lib/util/format-link-as-autolink.js
function formatLinkAsAutolink(node2, state) {
  const raw = toString(node2);
  return Boolean(
    !state.options.resourceLink && // If there’s a url…
    node2.url && // And there’s a no title…
    !node2.title && // And the content of `node` is a single text node…
    node2.children && node2.children.length === 1 && node2.children[0].type === "text" && // And if the url is the same as the content…
    (raw === node2.url || "mailto:" + raw === node2.url) && // And that starts w/ a protocol…
    /^[a-z][a-z+.-]+:/i.test(node2.url) && // And that doesn’t contain ASCII control codes (character escapes and
    // references don’t work), space, or angle brackets…
    !/[\0- <>\u007F]/.test(node2.url)
  );
}

// node_modules/mdast-util-to-markdown/lib/handle/link.js
link.peek = linkPeek;
function link(node2, _, state, info) {
  const quote = checkQuote(state);
  const suffix = quote === '"' ? "Quote" : "Apostrophe";
  const tracker = state.createTracker(info);
  let exit3;
  let subexit;
  if (formatLinkAsAutolink(node2, state)) {
    const stack = state.stack;
    state.stack = [];
    exit3 = state.enter("autolink");
    let value2 = tracker.move("<");
    value2 += tracker.move(
      state.containerPhrasing(node2, {
        before: value2,
        after: ">",
        ...tracker.current()
      })
    );
    value2 += tracker.move(">");
    exit3();
    state.stack = stack;
    return value2;
  }
  exit3 = state.enter("link");
  subexit = state.enter("label");
  let value = tracker.move("[");
  value += tracker.move(
    state.containerPhrasing(node2, {
      before: value,
      after: "](",
      ...tracker.current()
    })
  );
  value += tracker.move("](");
  subexit();
  if (
    // If there’s no url but there is a title…
    !node2.url && node2.title || // If there are control characters or whitespace.
    /[\0- \u007F]/.test(node2.url)
  ) {
    subexit = state.enter("destinationLiteral");
    value += tracker.move("<");
    value += tracker.move(
      state.safe(node2.url, { before: value, after: ">", ...tracker.current() })
    );
    value += tracker.move(">");
  } else {
    subexit = state.enter("destinationRaw");
    value += tracker.move(
      state.safe(node2.url, {
        before: value,
        after: node2.title ? " " : ")",
        ...tracker.current()
      })
    );
  }
  subexit();
  if (node2.title) {
    subexit = state.enter(`title${suffix}`);
    value += tracker.move(" " + quote);
    value += tracker.move(
      state.safe(node2.title, {
        before: value,
        after: quote,
        ...tracker.current()
      })
    );
    value += tracker.move(quote);
    subexit();
  }
  value += tracker.move(")");
  exit3();
  return value;
}
function linkPeek(node2, _, state) {
  return formatLinkAsAutolink(node2, state) ? "<" : "[";
}

// node_modules/mdast-util-to-markdown/lib/handle/link-reference.js
linkReference.peek = linkReferencePeek;
function linkReference(node2, _, state, info) {
  const type = node2.referenceType;
  const exit3 = state.enter("linkReference");
  let subexit = state.enter("label");
  const tracker = state.createTracker(info);
  let value = tracker.move("[");
  const text5 = state.containerPhrasing(node2, {
    before: value,
    after: "]",
    ...tracker.current()
  });
  value += tracker.move(text5 + "][");
  subexit();
  const stack = state.stack;
  state.stack = [];
  subexit = state.enter("reference");
  const reference = state.safe(state.associationId(node2), {
    before: value,
    after: "]",
    ...tracker.current()
  });
  subexit();
  state.stack = stack;
  exit3();
  if (type === "full" || !text5 || text5 !== reference) {
    value += tracker.move(reference + "]");
  } else if (type === "shortcut") {
    value = value.slice(0, -1);
  } else {
    value += tracker.move("]");
  }
  return value;
}
function linkReferencePeek() {
  return "[";
}

// node_modules/mdast-util-to-markdown/lib/util/check-bullet.js
function checkBullet(state) {
  const marker = state.options.bullet || "*";
  if (marker !== "*" && marker !== "+" && marker !== "-") {
    throw new Error(
      "Cannot serialize items with `" + marker + "` for `options.bullet`, expected `*`, `+`, or `-`"
    );
  }
  return marker;
}

// node_modules/mdast-util-to-markdown/lib/util/check-bullet-other.js
function checkBulletOther(state) {
  const bullet = checkBullet(state);
  const bulletOther = state.options.bulletOther;
  if (!bulletOther) {
    return bullet === "*" ? "-" : "*";
  }
  if (bulletOther !== "*" && bulletOther !== "+" && bulletOther !== "-") {
    throw new Error(
      "Cannot serialize items with `" + bulletOther + "` for `options.bulletOther`, expected `*`, `+`, or `-`"
    );
  }
  if (bulletOther === bullet) {
    throw new Error(
      "Expected `bullet` (`" + bullet + "`) and `bulletOther` (`" + bulletOther + "`) to be different"
    );
  }
  return bulletOther;
}

// node_modules/mdast-util-to-markdown/lib/util/check-bullet-ordered.js
function checkBulletOrdered(state) {
  const marker = state.options.bulletOrdered || ".";
  if (marker !== "." && marker !== ")") {
    throw new Error(
      "Cannot serialize items with `" + marker + "` for `options.bulletOrdered`, expected `.` or `)`"
    );
  }
  return marker;
}

// node_modules/mdast-util-to-markdown/lib/util/check-rule.js
function checkRule(state) {
  const marker = state.options.rule || "*";
  if (marker !== "*" && marker !== "-" && marker !== "_") {
    throw new Error(
      "Cannot serialize rules with `" + marker + "` for `options.rule`, expected `*`, `-`, or `_`"
    );
  }
  return marker;
}

// node_modules/mdast-util-to-markdown/lib/handle/list.js
function list2(node2, parent, state, info) {
  const exit3 = state.enter("list");
  const bulletCurrent = state.bulletCurrent;
  let bullet = node2.ordered ? checkBulletOrdered(state) : checkBullet(state);
  const bulletOther = node2.ordered ? bullet === "." ? ")" : "." : checkBulletOther(state);
  let useDifferentMarker = parent && state.bulletLastUsed ? bullet === state.bulletLastUsed : false;
  if (!node2.ordered) {
    const firstListItem = node2.children ? node2.children[0] : void 0;
    if (
      // Bullet could be used as a thematic break marker:
      (bullet === "*" || bullet === "-") && // Empty first list item:
      firstListItem && (!firstListItem.children || !firstListItem.children[0]) && // Directly in two other list items:
      state.stack[state.stack.length - 1] === "list" && state.stack[state.stack.length - 2] === "listItem" && state.stack[state.stack.length - 3] === "list" && state.stack[state.stack.length - 4] === "listItem" && // That are each the first child.
      state.indexStack[state.indexStack.length - 1] === 0 && state.indexStack[state.indexStack.length - 2] === 0 && state.indexStack[state.indexStack.length - 3] === 0
    ) {
      useDifferentMarker = true;
    }
    if (checkRule(state) === bullet && firstListItem) {
      let index2 = -1;
      while (++index2 < node2.children.length) {
        const item = node2.children[index2];
        if (item && item.type === "listItem" && item.children && item.children[0] && item.children[0].type === "thematicBreak") {
          useDifferentMarker = true;
          break;
        }
      }
    }
  }
  if (useDifferentMarker) {
    bullet = bulletOther;
  }
  state.bulletCurrent = bullet;
  const value = state.containerFlow(node2, info);
  state.bulletLastUsed = bullet;
  state.bulletCurrent = bulletCurrent;
  exit3();
  return value;
}

// node_modules/mdast-util-to-markdown/lib/util/check-list-item-indent.js
function checkListItemIndent(state) {
  const style = state.options.listItemIndent || "one";
  if (style !== "tab" && style !== "one" && style !== "mixed") {
    throw new Error(
      "Cannot serialize items with `" + style + "` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`"
    );
  }
  return style;
}

// node_modules/mdast-util-to-markdown/lib/handle/list-item.js
function listItem(node2, parent, state, info) {
  const listItemIndent = checkListItemIndent(state);
  let bullet = state.bulletCurrent || checkBullet(state);
  if (parent && parent.type === "list" && parent.ordered) {
    bullet = (typeof parent.start === "number" && parent.start > -1 ? parent.start : 1) + (state.options.incrementListMarker === false ? 0 : parent.children.indexOf(node2)) + bullet;
  }
  let size = bullet.length + 1;
  if (listItemIndent === "tab" || listItemIndent === "mixed" && (parent && parent.type === "list" && parent.spread || node2.spread)) {
    size = Math.ceil(size / 4) * 4;
  }
  const tracker = state.createTracker(info);
  tracker.move(bullet + " ".repeat(size - bullet.length));
  tracker.shift(size);
  const exit3 = state.enter("listItem");
  const value = state.indentLines(
    state.containerFlow(node2, tracker.current()),
    map3
  );
  exit3();
  return value;
  function map3(line, index2, blank) {
    if (index2) {
      return (blank ? "" : " ".repeat(size)) + line;
    }
    return (blank ? bullet : bullet + " ".repeat(size - bullet.length)) + line;
  }
}

// node_modules/mdast-util-to-markdown/lib/handle/paragraph.js
function paragraph(node2, _, state, info) {
  const exit3 = state.enter("paragraph");
  const subexit = state.enter("phrasing");
  const value = state.containerPhrasing(node2, info);
  subexit();
  exit3();
  return value;
}

// node_modules/mdast-util-phrasing/lib/index.js
var phrasing = (
  /** @type {(node?: unknown) => node is Exclude<PhrasingContent, Html>} */
  convert([
    "break",
    "delete",
    "emphasis",
    // To do: next major: removed since footnotes were added to GFM.
    "footnote",
    "footnoteReference",
    "image",
    "imageReference",
    "inlineCode",
    // Enabled by `mdast-util-math`:
    "inlineMath",
    "link",
    "linkReference",
    // Enabled by `mdast-util-mdx`:
    "mdxJsxTextElement",
    // Enabled by `mdast-util-mdx`:
    "mdxTextExpression",
    "strong",
    "text",
    // Enabled by `mdast-util-directive`:
    "textDirective"
  ])
);

// node_modules/mdast-util-to-markdown/lib/handle/root.js
function root(node2, _, state, info) {
  const hasPhrasing = node2.children.some(function(d) {
    return phrasing(d);
  });
  const container = hasPhrasing ? state.containerPhrasing : state.containerFlow;
  return container.call(state, node2, info);
}

// node_modules/mdast-util-to-markdown/lib/util/check-strong.js
function checkStrong(state) {
  const marker = state.options.strong || "*";
  if (marker !== "*" && marker !== "_") {
    throw new Error(
      "Cannot serialize strong with `" + marker + "` for `options.strong`, expected `*`, or `_`"
    );
  }
  return marker;
}

// node_modules/mdast-util-to-markdown/lib/handle/strong.js
strong.peek = strongPeek;
function strong(node2, _, state, info) {
  const marker = checkStrong(state);
  const exit3 = state.enter("strong");
  const tracker = state.createTracker(info);
  const before = tracker.move(marker + marker);
  let between = tracker.move(
    state.containerPhrasing(node2, {
      after: marker,
      before,
      ...tracker.current()
    })
  );
  const betweenHead = between.charCodeAt(0);
  const open = encodeInfo(
    info.before.charCodeAt(info.before.length - 1),
    betweenHead,
    marker
  );
  if (open.inside) {
    between = encodeCharacterReference(betweenHead) + between.slice(1);
  }
  const betweenTail = between.charCodeAt(between.length - 1);
  const close = encodeInfo(info.after.charCodeAt(0), betweenTail, marker);
  if (close.inside) {
    between = between.slice(0, -1) + encodeCharacterReference(betweenTail);
  }
  const after = tracker.move(marker + marker);
  exit3();
  state.attentionEncodeSurroundingInfo = {
    after: close.outside,
    before: open.outside
  };
  return before + between + after;
}
function strongPeek(_, _1, state) {
  return state.options.strong || "*";
}

// node_modules/mdast-util-to-markdown/lib/handle/text.js
function text3(node2, _, state, info) {
  return state.safe(node2.value, info);
}

// node_modules/mdast-util-to-markdown/lib/util/check-rule-repetition.js
function checkRuleRepetition(state) {
  const repetition = state.options.ruleRepetition || 3;
  if (repetition < 3) {
    throw new Error(
      "Cannot serialize rules with repetition `" + repetition + "` for `options.ruleRepetition`, expected `3` or more"
    );
  }
  return repetition;
}

// node_modules/mdast-util-to-markdown/lib/handle/thematic-break.js
function thematicBreak2(_, _1, state) {
  const value = (checkRule(state) + (state.options.ruleSpaces ? " " : "")).repeat(checkRuleRepetition(state));
  return state.options.ruleSpaces ? value.slice(0, -1) : value;
}

// node_modules/mdast-util-to-markdown/lib/handle/index.js
var handle = {
  blockquote,
  break: hardBreak,
  code,
  definition: definition2,
  emphasis,
  hardBreak,
  heading,
  html,
  image,
  imageReference,
  inlineCode,
  link,
  linkReference,
  list: list2,
  listItem,
  paragraph,
  root,
  strong,
  text: text3,
  thematicBreak: thematicBreak2
};

// node_modules/mdast-util-gfm-table/lib/index.js
function gfmTableFromMarkdown() {
  return {
    enter: {
      table: enterTable,
      tableData: enterCell,
      tableHeader: enterCell,
      tableRow: enterRow
    },
    exit: {
      codeText: exitCodeText,
      table: exitTable,
      tableData: exit2,
      tableHeader: exit2,
      tableRow: exit2
    }
  };
}
function enterTable(token) {
  const align = token._align;
  ok(align, "expected `_align` on table");
  this.enter(
    {
      type: "table",
      align: align.map(function(d) {
        return d === "none" ? null : d;
      }),
      children: []
    },
    token
  );
  this.data.inTable = true;
}
function exitTable(token) {
  this.exit(token);
  this.data.inTable = void 0;
}
function enterRow(token) {
  this.enter({ type: "tableRow", children: [] }, token);
}
function exit2(token) {
  this.exit(token);
}
function enterCell(token) {
  this.enter({ type: "tableCell", children: [] }, token);
}
function exitCodeText(token) {
  let value = this.resume();
  if (this.data.inTable) {
    value = value.replace(/\\([\\|])/g, replace);
  }
  const node2 = this.stack[this.stack.length - 1];
  ok(node2.type === "inlineCode");
  node2.value = value;
  this.exit(token);
}
function replace($0, $1) {
  return $1 === "|" ? $1 : $0;
}
function gfmTableToMarkdown(options) {
  const settings = options || {};
  const padding = settings.tableCellPadding;
  const alignDelimiters = settings.tablePipeAlign;
  const stringLength = settings.stringLength;
  const around = padding ? " " : "|";
  return {
    unsafe: [
      { character: "\r", inConstruct: "tableCell" },
      { character: "\n", inConstruct: "tableCell" },
      // A pipe, when followed by a tab or space (padding), or a dash or colon
      // (unpadded delimiter row), could result in a table.
      { atBreak: true, character: "|", after: "[	 :-]" },
      // A pipe in a cell must be encoded.
      { character: "|", inConstruct: "tableCell" },
      // A colon must be followed by a dash, in which case it could start a
      // delimiter row.
      { atBreak: true, character: ":", after: "-" },
      // A delimiter row can also start with a dash, when followed by more
      // dashes, a colon, or a pipe.
      // This is a stricter version than the built in check for lists, thematic
      // breaks, and setex heading underlines though:
      // <https://github.com/syntax-tree/mdast-util-to-markdown/blob/51a2038/lib/unsafe.js#L57>
      { atBreak: true, character: "-", after: "[:|-]" }
    ],
    handlers: {
      inlineCode: inlineCodeWithTable,
      table: handleTable,
      tableCell: handleTableCell,
      tableRow: handleTableRow
    }
  };
  function handleTable(node2, _, state, info) {
    return serializeData(handleTableAsData(node2, state, info), node2.align);
  }
  function handleTableRow(node2, _, state, info) {
    const row = handleTableRowAsData(node2, state, info);
    const value = serializeData([row]);
    return value.slice(0, value.indexOf("\n"));
  }
  function handleTableCell(node2, _, state, info) {
    const exit3 = state.enter("tableCell");
    const subexit = state.enter("phrasing");
    const value = state.containerPhrasing(node2, {
      ...info,
      before: around,
      after: around
    });
    subexit();
    exit3();
    return value;
  }
  function serializeData(matrix, align) {
    return markdownTable(matrix, {
      align,
      // @ts-expect-error: `markdown-table` types should support `null`.
      alignDelimiters,
      // @ts-expect-error: `markdown-table` types should support `null`.
      padding,
      // @ts-expect-error: `markdown-table` types should support `null`.
      stringLength
    });
  }
  function handleTableAsData(node2, state, info) {
    const children = node2.children;
    let index2 = -1;
    const result = [];
    const subexit = state.enter("table");
    while (++index2 < children.length) {
      result[index2] = handleTableRowAsData(children[index2], state, info);
    }
    subexit();
    return result;
  }
  function handleTableRowAsData(node2, state, info) {
    const children = node2.children;
    let index2 = -1;
    const result = [];
    const subexit = state.enter("tableRow");
    while (++index2 < children.length) {
      result[index2] = handleTableCell(children[index2], node2, state, info);
    }
    subexit();
    return result;
  }
  function inlineCodeWithTable(node2, parent, state) {
    let value = handle.inlineCode(node2, parent, state);
    if (state.stack.includes("tableCell")) {
      value = value.replace(/\|/g, "\\$&");
    }
    return value;
  }
}

// node_modules/mdast-util-gfm-task-list-item/lib/index.js
function gfmTaskListItemFromMarkdown() {
  return {
    exit: {
      taskListCheckValueChecked: exitCheck,
      taskListCheckValueUnchecked: exitCheck,
      paragraph: exitParagraphWithTaskListItem
    }
  };
}
function gfmTaskListItemToMarkdown() {
  return {
    unsafe: [{ atBreak: true, character: "-", after: "[:|-]" }],
    handlers: { listItem: listItemWithTaskListItem }
  };
}
function exitCheck(token) {
  const node2 = this.stack[this.stack.length - 2];
  ok(node2.type === "listItem");
  node2.checked = token.type === "taskListCheckValueChecked";
}
function exitParagraphWithTaskListItem(token) {
  const parent = this.stack[this.stack.length - 2];
  if (parent && parent.type === "listItem" && typeof parent.checked === "boolean") {
    const node2 = this.stack[this.stack.length - 1];
    ok(node2.type === "paragraph");
    const head = node2.children[0];
    if (head && head.type === "text") {
      const siblings = parent.children;
      let index2 = -1;
      let firstParaghraph;
      while (++index2 < siblings.length) {
        const sibling = siblings[index2];
        if (sibling.type === "paragraph") {
          firstParaghraph = sibling;
          break;
        }
      }
      if (firstParaghraph === node2) {
        head.value = head.value.slice(1);
        if (head.value.length === 0) {
          node2.children.shift();
        } else if (node2.position && head.position && typeof head.position.start.offset === "number") {
          head.position.start.column++;
          head.position.start.offset++;
          node2.position.start = Object.assign({}, head.position.start);
        }
      }
    }
  }
  this.exit(token);
}
function listItemWithTaskListItem(node2, parent, state, info) {
  const head = node2.children[0];
  const checkable = typeof node2.checked === "boolean" && head && head.type === "paragraph";
  const checkbox = "[" + (node2.checked ? "x" : " ") + "] ";
  const tracker = state.createTracker(info);
  if (checkable) {
    tracker.move(checkbox);
  }
  let value = handle.listItem(node2, parent, state, {
    ...info,
    ...tracker.current()
  });
  if (checkable) {
    value = value.replace(/^(?:[*+-]|\d+\.)([\r\n]| {1,3})/, check);
  }
  return value;
  function check($0) {
    return $0 + checkbox;
  }
}

// node_modules/mdast-util-gfm/lib/index.js
function gfmFromMarkdown() {
  return [
    gfmAutolinkLiteralFromMarkdown(),
    gfmFootnoteFromMarkdown(),
    gfmStrikethroughFromMarkdown(),
    gfmTableFromMarkdown(),
    gfmTaskListItemFromMarkdown()
  ];
}
function gfmToMarkdown(options) {
  return {
    extensions: [
      gfmAutolinkLiteralToMarkdown(),
      gfmFootnoteToMarkdown(options),
      gfmStrikethroughToMarkdown(),
      gfmTableToMarkdown(options),
      gfmTaskListItemToMarkdown()
    ]
  };
}

// node_modules/micromark-extension-gfm-autolink-literal/lib/syntax.js
var wwwPrefix = {
  tokenize: tokenizeWwwPrefix,
  partial: true
};
var domain = {
  tokenize: tokenizeDomain,
  partial: true
};
var path = {
  tokenize: tokenizePath,
  partial: true
};
var trail = {
  tokenize: tokenizeTrail,
  partial: true
};
var emailDomainDotTrail = {
  tokenize: tokenizeEmailDomainDotTrail,
  partial: true
};
var wwwAutolink = {
  name: "wwwAutolink",
  tokenize: tokenizeWwwAutolink,
  previous: previousWww
};
var protocolAutolink = {
  name: "protocolAutolink",
  tokenize: tokenizeProtocolAutolink,
  previous: previousProtocol
};
var emailAutolink = {
  name: "emailAutolink",
  tokenize: tokenizeEmailAutolink,
  previous: previousEmail
};
var text4 = {};
function gfmAutolinkLiteral() {
  return {
    text: text4
  };
}
var code2 = 48;
while (code2 < 123) {
  text4[code2] = emailAutolink;
  code2++;
  if (code2 === 58) code2 = 65;
  else if (code2 === 91) code2 = 97;
}
text4[43] = emailAutolink;
text4[45] = emailAutolink;
text4[46] = emailAutolink;
text4[95] = emailAutolink;
text4[72] = [emailAutolink, protocolAutolink];
text4[104] = [emailAutolink, protocolAutolink];
text4[87] = [emailAutolink, wwwAutolink];
text4[119] = [emailAutolink, wwwAutolink];
function tokenizeEmailAutolink(effects, ok3, nok) {
  const self = this;
  let dot;
  let data;
  return start;
  function start(code3) {
    if (!gfmAtext(code3) || !previousEmail.call(self, self.previous) || previousUnbalanced(self.events)) {
      return nok(code3);
    }
    effects.enter("literalAutolink");
    effects.enter("literalAutolinkEmail");
    return atext(code3);
  }
  function atext(code3) {
    if (gfmAtext(code3)) {
      effects.consume(code3);
      return atext;
    }
    if (code3 === 64) {
      effects.consume(code3);
      return emailDomain;
    }
    return nok(code3);
  }
  function emailDomain(code3) {
    if (code3 === 46) {
      return effects.check(emailDomainDotTrail, emailDomainAfter, emailDomainDot)(code3);
    }
    if (code3 === 45 || code3 === 95 || asciiAlphanumeric(code3)) {
      data = true;
      effects.consume(code3);
      return emailDomain;
    }
    return emailDomainAfter(code3);
  }
  function emailDomainDot(code3) {
    effects.consume(code3);
    dot = true;
    return emailDomain;
  }
  function emailDomainAfter(code3) {
    if (data && dot && asciiAlpha(self.previous)) {
      effects.exit("literalAutolinkEmail");
      effects.exit("literalAutolink");
      return ok3(code3);
    }
    return nok(code3);
  }
}
function tokenizeWwwAutolink(effects, ok3, nok) {
  const self = this;
  return wwwStart;
  function wwwStart(code3) {
    if (code3 !== 87 && code3 !== 119 || !previousWww.call(self, self.previous) || previousUnbalanced(self.events)) {
      return nok(code3);
    }
    effects.enter("literalAutolink");
    effects.enter("literalAutolinkWww");
    return effects.check(wwwPrefix, effects.attempt(domain, effects.attempt(path, wwwAfter), nok), nok)(code3);
  }
  function wwwAfter(code3) {
    effects.exit("literalAutolinkWww");
    effects.exit("literalAutolink");
    return ok3(code3);
  }
}
function tokenizeProtocolAutolink(effects, ok3, nok) {
  const self = this;
  let buffer = "";
  let seen = false;
  return protocolStart;
  function protocolStart(code3) {
    if ((code3 === 72 || code3 === 104) && previousProtocol.call(self, self.previous) && !previousUnbalanced(self.events)) {
      effects.enter("literalAutolink");
      effects.enter("literalAutolinkHttp");
      buffer += String.fromCodePoint(code3);
      effects.consume(code3);
      return protocolPrefixInside;
    }
    return nok(code3);
  }
  function protocolPrefixInside(code3) {
    if (asciiAlpha(code3) && buffer.length < 5) {
      buffer += String.fromCodePoint(code3);
      effects.consume(code3);
      return protocolPrefixInside;
    }
    if (code3 === 58) {
      const protocol = buffer.toLowerCase();
      if (protocol === "http" || protocol === "https") {
        effects.consume(code3);
        return protocolSlashesInside;
      }
    }
    return nok(code3);
  }
  function protocolSlashesInside(code3) {
    if (code3 === 47) {
      effects.consume(code3);
      if (seen) {
        return afterProtocol;
      }
      seen = true;
      return protocolSlashesInside;
    }
    return nok(code3);
  }
  function afterProtocol(code3) {
    return code3 === null || asciiControl(code3) || markdownLineEndingOrSpace(code3) || unicodeWhitespace(code3) || unicodePunctuation(code3) ? nok(code3) : effects.attempt(domain, effects.attempt(path, protocolAfter), nok)(code3);
  }
  function protocolAfter(code3) {
    effects.exit("literalAutolinkHttp");
    effects.exit("literalAutolink");
    return ok3(code3);
  }
}
function tokenizeWwwPrefix(effects, ok3, nok) {
  let size = 0;
  return wwwPrefixInside;
  function wwwPrefixInside(code3) {
    if ((code3 === 87 || code3 === 119) && size < 3) {
      size++;
      effects.consume(code3);
      return wwwPrefixInside;
    }
    if (code3 === 46 && size === 3) {
      effects.consume(code3);
      return wwwPrefixAfter;
    }
    return nok(code3);
  }
  function wwwPrefixAfter(code3) {
    return code3 === null ? nok(code3) : ok3(code3);
  }
}
function tokenizeDomain(effects, ok3, nok) {
  let underscoreInLastSegment;
  let underscoreInLastLastSegment;
  let seen;
  return domainInside;
  function domainInside(code3) {
    if (code3 === 46 || code3 === 95) {
      return effects.check(trail, domainAfter, domainAtPunctuation)(code3);
    }
    if (code3 === null || markdownLineEndingOrSpace(code3) || unicodeWhitespace(code3) || code3 !== 45 && unicodePunctuation(code3)) {
      return domainAfter(code3);
    }
    seen = true;
    effects.consume(code3);
    return domainInside;
  }
  function domainAtPunctuation(code3) {
    if (code3 === 95) {
      underscoreInLastSegment = true;
    } else {
      underscoreInLastLastSegment = underscoreInLastSegment;
      underscoreInLastSegment = void 0;
    }
    effects.consume(code3);
    return domainInside;
  }
  function domainAfter(code3) {
    if (underscoreInLastLastSegment || underscoreInLastSegment || !seen) {
      return nok(code3);
    }
    return ok3(code3);
  }
}
function tokenizePath(effects, ok3) {
  let sizeOpen = 0;
  let sizeClose = 0;
  return pathInside;
  function pathInside(code3) {
    if (code3 === 40) {
      sizeOpen++;
      effects.consume(code3);
      return pathInside;
    }
    if (code3 === 41 && sizeClose < sizeOpen) {
      return pathAtPunctuation(code3);
    }
    if (code3 === 33 || code3 === 34 || code3 === 38 || code3 === 39 || code3 === 41 || code3 === 42 || code3 === 44 || code3 === 46 || code3 === 58 || code3 === 59 || code3 === 60 || code3 === 63 || code3 === 93 || code3 === 95 || code3 === 126) {
      return effects.check(trail, ok3, pathAtPunctuation)(code3);
    }
    if (code3 === null || markdownLineEndingOrSpace(code3) || unicodeWhitespace(code3)) {
      return ok3(code3);
    }
    effects.consume(code3);
    return pathInside;
  }
  function pathAtPunctuation(code3) {
    if (code3 === 41) {
      sizeClose++;
    }
    effects.consume(code3);
    return pathInside;
  }
}
function tokenizeTrail(effects, ok3, nok) {
  return trail2;
  function trail2(code3) {
    if (code3 === 33 || code3 === 34 || code3 === 39 || code3 === 41 || code3 === 42 || code3 === 44 || code3 === 46 || code3 === 58 || code3 === 59 || code3 === 63 || code3 === 95 || code3 === 126) {
      effects.consume(code3);
      return trail2;
    }
    if (code3 === 38) {
      effects.consume(code3);
      return trailCharacterReferenceStart;
    }
    if (code3 === 93) {
      effects.consume(code3);
      return trailBracketAfter;
    }
    if (
      // `<` is an end.
      code3 === 60 || // So is whitespace.
      code3 === null || markdownLineEndingOrSpace(code3) || unicodeWhitespace(code3)
    ) {
      return ok3(code3);
    }
    return nok(code3);
  }
  function trailBracketAfter(code3) {
    if (code3 === null || code3 === 40 || code3 === 91 || markdownLineEndingOrSpace(code3) || unicodeWhitespace(code3)) {
      return ok3(code3);
    }
    return trail2(code3);
  }
  function trailCharacterReferenceStart(code3) {
    return asciiAlpha(code3) ? trailCharacterReferenceInside(code3) : nok(code3);
  }
  function trailCharacterReferenceInside(code3) {
    if (code3 === 59) {
      effects.consume(code3);
      return trail2;
    }
    if (asciiAlpha(code3)) {
      effects.consume(code3);
      return trailCharacterReferenceInside;
    }
    return nok(code3);
  }
}
function tokenizeEmailDomainDotTrail(effects, ok3, nok) {
  return start;
  function start(code3) {
    effects.consume(code3);
    return after;
  }
  function after(code3) {
    return asciiAlphanumeric(code3) ? nok(code3) : ok3(code3);
  }
}
function previousWww(code3) {
  return code3 === null || code3 === 40 || code3 === 42 || code3 === 95 || code3 === 91 || code3 === 93 || code3 === 126 || markdownLineEndingOrSpace(code3);
}
function previousProtocol(code3) {
  return !asciiAlpha(code3);
}
function previousEmail(code3) {
  return !(code3 === 47 || gfmAtext(code3));
}
function gfmAtext(code3) {
  return code3 === 43 || code3 === 45 || code3 === 46 || code3 === 95 || asciiAlphanumeric(code3);
}
function previousUnbalanced(events) {
  let index2 = events.length;
  let result = false;
  while (index2--) {
    const token = events[index2][1];
    if ((token.type === "labelLink" || token.type === "labelImage") && !token._balanced) {
      result = true;
      break;
    }
    if (token._gfmAutolinkLiteralWalkedInto) {
      result = false;
      break;
    }
  }
  if (events.length > 0 && !result) {
    events[events.length - 1][1]._gfmAutolinkLiteralWalkedInto = true;
  }
  return result;
}

// node_modules/micromark-extension-gfm-footnote/lib/syntax.js
var indent = {
  tokenize: tokenizeIndent2,
  partial: true
};
function gfmFootnote() {
  return {
    document: {
      [91]: {
        name: "gfmFootnoteDefinition",
        tokenize: tokenizeDefinitionStart,
        continuation: {
          tokenize: tokenizeDefinitionContinuation
        },
        exit: gfmFootnoteDefinitionEnd
      }
    },
    text: {
      [91]: {
        name: "gfmFootnoteCall",
        tokenize: tokenizeGfmFootnoteCall
      },
      [93]: {
        name: "gfmPotentialFootnoteCall",
        add: "after",
        tokenize: tokenizePotentialGfmFootnoteCall,
        resolveTo: resolveToPotentialGfmFootnoteCall
      }
    }
  };
}
function tokenizePotentialGfmFootnoteCall(effects, ok3, nok) {
  const self = this;
  let index2 = self.events.length;
  const defined = self.parser.gfmFootnotes || (self.parser.gfmFootnotes = []);
  let labelStart;
  while (index2--) {
    const token = self.events[index2][1];
    if (token.type === "labelImage") {
      labelStart = token;
      break;
    }
    if (token.type === "gfmFootnoteCall" || token.type === "labelLink" || token.type === "label" || token.type === "image" || token.type === "link") {
      break;
    }
  }
  return start;
  function start(code3) {
    if (!labelStart || !labelStart._balanced) {
      return nok(code3);
    }
    const id = normalizeIdentifier(self.sliceSerialize({
      start: labelStart.end,
      end: self.now()
    }));
    if (id.codePointAt(0) !== 94 || !defined.includes(id.slice(1))) {
      return nok(code3);
    }
    effects.enter("gfmFootnoteCallLabelMarker");
    effects.consume(code3);
    effects.exit("gfmFootnoteCallLabelMarker");
    return ok3(code3);
  }
}
function resolveToPotentialGfmFootnoteCall(events, context) {
  let index2 = events.length;
  let labelStart;
  while (index2--) {
    if (events[index2][1].type === "labelImage" && events[index2][0] === "enter") {
      labelStart = events[index2][1];
      break;
    }
  }
  events[index2 + 1][1].type = "data";
  events[index2 + 3][1].type = "gfmFootnoteCallLabelMarker";
  const call = {
    type: "gfmFootnoteCall",
    start: Object.assign({}, events[index2 + 3][1].start),
    end: Object.assign({}, events[events.length - 1][1].end)
  };
  const marker = {
    type: "gfmFootnoteCallMarker",
    start: Object.assign({}, events[index2 + 3][1].end),
    end: Object.assign({}, events[index2 + 3][1].end)
  };
  marker.end.column++;
  marker.end.offset++;
  marker.end._bufferIndex++;
  const string3 = {
    type: "gfmFootnoteCallString",
    start: Object.assign({}, marker.end),
    end: Object.assign({}, events[events.length - 1][1].start)
  };
  const chunk = {
    type: "chunkString",
    contentType: "string",
    start: Object.assign({}, string3.start),
    end: Object.assign({}, string3.end)
  };
  const replacement = [
    // Take the `labelImageMarker` (now `data`, the `!`)
    events[index2 + 1],
    events[index2 + 2],
    ["enter", call, context],
    // The `[`
    events[index2 + 3],
    events[index2 + 4],
    // The `^`.
    ["enter", marker, context],
    ["exit", marker, context],
    // Everything in between.
    ["enter", string3, context],
    ["enter", chunk, context],
    ["exit", chunk, context],
    ["exit", string3, context],
    // The ending (`]`, properly parsed and labelled).
    events[events.length - 2],
    events[events.length - 1],
    ["exit", call, context]
  ];
  events.splice(index2, events.length - index2 + 1, ...replacement);
  return events;
}
function tokenizeGfmFootnoteCall(effects, ok3, nok) {
  const self = this;
  const defined = self.parser.gfmFootnotes || (self.parser.gfmFootnotes = []);
  let size = 0;
  let data;
  return start;
  function start(code3) {
    effects.enter("gfmFootnoteCall");
    effects.enter("gfmFootnoteCallLabelMarker");
    effects.consume(code3);
    effects.exit("gfmFootnoteCallLabelMarker");
    return callStart;
  }
  function callStart(code3) {
    if (code3 !== 94) return nok(code3);
    effects.enter("gfmFootnoteCallMarker");
    effects.consume(code3);
    effects.exit("gfmFootnoteCallMarker");
    effects.enter("gfmFootnoteCallString");
    effects.enter("chunkString").contentType = "string";
    return callData;
  }
  function callData(code3) {
    if (
      // Too long.
      size > 999 || // Closing brace with nothing.
      code3 === 93 && !data || // Space or tab is not supported by GFM for some reason.
      // `\n` and `[` not being supported makes sense.
      code3 === null || code3 === 91 || markdownLineEndingOrSpace(code3)
    ) {
      return nok(code3);
    }
    if (code3 === 93) {
      effects.exit("chunkString");
      const token = effects.exit("gfmFootnoteCallString");
      if (!defined.includes(normalizeIdentifier(self.sliceSerialize(token)))) {
        return nok(code3);
      }
      effects.enter("gfmFootnoteCallLabelMarker");
      effects.consume(code3);
      effects.exit("gfmFootnoteCallLabelMarker");
      effects.exit("gfmFootnoteCall");
      return ok3;
    }
    if (!markdownLineEndingOrSpace(code3)) {
      data = true;
    }
    size++;
    effects.consume(code3);
    return code3 === 92 ? callEscape : callData;
  }
  function callEscape(code3) {
    if (code3 === 91 || code3 === 92 || code3 === 93) {
      effects.consume(code3);
      size++;
      return callData;
    }
    return callData(code3);
  }
}
function tokenizeDefinitionStart(effects, ok3, nok) {
  const self = this;
  const defined = self.parser.gfmFootnotes || (self.parser.gfmFootnotes = []);
  let identifier;
  let size = 0;
  let data;
  return start;
  function start(code3) {
    effects.enter("gfmFootnoteDefinition")._container = true;
    effects.enter("gfmFootnoteDefinitionLabel");
    effects.enter("gfmFootnoteDefinitionLabelMarker");
    effects.consume(code3);
    effects.exit("gfmFootnoteDefinitionLabelMarker");
    return labelAtMarker;
  }
  function labelAtMarker(code3) {
    if (code3 === 94) {
      effects.enter("gfmFootnoteDefinitionMarker");
      effects.consume(code3);
      effects.exit("gfmFootnoteDefinitionMarker");
      effects.enter("gfmFootnoteDefinitionLabelString");
      effects.enter("chunkString").contentType = "string";
      return labelInside;
    }
    return nok(code3);
  }
  function labelInside(code3) {
    if (
      // Too long.
      size > 999 || // Closing brace with nothing.
      code3 === 93 && !data || // Space or tab is not supported by GFM for some reason.
      // `\n` and `[` not being supported makes sense.
      code3 === null || code3 === 91 || markdownLineEndingOrSpace(code3)
    ) {
      return nok(code3);
    }
    if (code3 === 93) {
      effects.exit("chunkString");
      const token = effects.exit("gfmFootnoteDefinitionLabelString");
      identifier = normalizeIdentifier(self.sliceSerialize(token));
      effects.enter("gfmFootnoteDefinitionLabelMarker");
      effects.consume(code3);
      effects.exit("gfmFootnoteDefinitionLabelMarker");
      effects.exit("gfmFootnoteDefinitionLabel");
      return labelAfter;
    }
    if (!markdownLineEndingOrSpace(code3)) {
      data = true;
    }
    size++;
    effects.consume(code3);
    return code3 === 92 ? labelEscape : labelInside;
  }
  function labelEscape(code3) {
    if (code3 === 91 || code3 === 92 || code3 === 93) {
      effects.consume(code3);
      size++;
      return labelInside;
    }
    return labelInside(code3);
  }
  function labelAfter(code3) {
    if (code3 === 58) {
      effects.enter("definitionMarker");
      effects.consume(code3);
      effects.exit("definitionMarker");
      if (!defined.includes(identifier)) {
        defined.push(identifier);
      }
      return factorySpace(effects, whitespaceAfter, "gfmFootnoteDefinitionWhitespace");
    }
    return nok(code3);
  }
  function whitespaceAfter(code3) {
    return ok3(code3);
  }
}
function tokenizeDefinitionContinuation(effects, ok3, nok) {
  return effects.check(blankLine, ok3, effects.attempt(indent, ok3, nok));
}
function gfmFootnoteDefinitionEnd(effects) {
  effects.exit("gfmFootnoteDefinition");
}
function tokenizeIndent2(effects, ok3, nok) {
  const self = this;
  return factorySpace(effects, afterPrefix, "gfmFootnoteDefinitionIndent", 4 + 1);
  function afterPrefix(code3) {
    const tail = self.events[self.events.length - 1];
    return tail && tail[1].type === "gfmFootnoteDefinitionIndent" && tail[2].sliceSerialize(tail[1], true).length === 4 ? ok3(code3) : nok(code3);
  }
}

// node_modules/micromark-extension-gfm-strikethrough/lib/syntax.js
function gfmStrikethrough(options) {
  const options_ = options || {};
  let single = options_.singleTilde;
  const tokenizer = {
    name: "strikethrough",
    tokenize: tokenizeStrikethrough,
    resolveAll: resolveAllStrikethrough
  };
  if (single === null || single === void 0) {
    single = true;
  }
  return {
    text: {
      [126]: tokenizer
    },
    insideSpan: {
      null: [tokenizer]
    },
    attentionMarkers: {
      null: [126]
    }
  };
  function resolveAllStrikethrough(events, context) {
    let index2 = -1;
    while (++index2 < events.length) {
      if (events[index2][0] === "enter" && events[index2][1].type === "strikethroughSequenceTemporary" && events[index2][1]._close) {
        let open = index2;
        while (open--) {
          if (events[open][0] === "exit" && events[open][1].type === "strikethroughSequenceTemporary" && events[open][1]._open && // If the sizes are the same:
          events[index2][1].end.offset - events[index2][1].start.offset === events[open][1].end.offset - events[open][1].start.offset) {
            events[index2][1].type = "strikethroughSequence";
            events[open][1].type = "strikethroughSequence";
            const strikethrough = {
              type: "strikethrough",
              start: Object.assign({}, events[open][1].start),
              end: Object.assign({}, events[index2][1].end)
            };
            const text5 = {
              type: "strikethroughText",
              start: Object.assign({}, events[open][1].end),
              end: Object.assign({}, events[index2][1].start)
            };
            const nextEvents = [["enter", strikethrough, context], ["enter", events[open][1], context], ["exit", events[open][1], context], ["enter", text5, context]];
            const insideSpan2 = context.parser.constructs.insideSpan.null;
            if (insideSpan2) {
              splice(nextEvents, nextEvents.length, 0, resolveAll(insideSpan2, events.slice(open + 1, index2), context));
            }
            splice(nextEvents, nextEvents.length, 0, [["exit", text5, context], ["enter", events[index2][1], context], ["exit", events[index2][1], context], ["exit", strikethrough, context]]);
            splice(events, open - 1, index2 - open + 3, nextEvents);
            index2 = open + nextEvents.length - 2;
            break;
          }
        }
      }
    }
    index2 = -1;
    while (++index2 < events.length) {
      if (events[index2][1].type === "strikethroughSequenceTemporary") {
        events[index2][1].type = "data";
      }
    }
    return events;
  }
  function tokenizeStrikethrough(effects, ok3, nok) {
    const previous4 = this.previous;
    const events = this.events;
    let size = 0;
    return start;
    function start(code3) {
      if (previous4 === 126 && events[events.length - 1][1].type !== "characterEscape") {
        return nok(code3);
      }
      effects.enter("strikethroughSequenceTemporary");
      return more(code3);
    }
    function more(code3) {
      const before = classifyCharacter(previous4);
      if (code3 === 126) {
        if (size > 1) return nok(code3);
        effects.consume(code3);
        size++;
        return more;
      }
      if (size < 2 && !single) return nok(code3);
      const token = effects.exit("strikethroughSequenceTemporary");
      const after = classifyCharacter(code3);
      token._open = !after || after === 2 && Boolean(before);
      token._close = !before || before === 2 && Boolean(after);
      return ok3(code3);
    }
  }
}

// node_modules/micromark-extension-gfm-table/lib/edit-map.js
var EditMap = class {
  /**
   * Create a new edit map.
   */
  constructor() {
    this.map = [];
    this.index = /* @__PURE__ */ new Map();
  }
  /**
   * Create an edit: a remove and/or add at a certain place.
   *
   * @param {number} index
   *   Index at which to apply the edit.
   * @param {number} remove
   *   Count of items to remove at the index.
   * @param {Array<Event>} add
   *   Items to add at the index.
   * @returns {undefined}
   *   Nothing.
   */
  add(index2, remove, add) {
    addImplementation(this, index2, remove, add);
  }
  // To do: add this when moving to `micromark`.
  // /**
  //  * Create an edit: but insert `add` before existing additions.
  //  *
  //  * @param {number} index
  //  * @param {number} remove
  //  * @param {Array<Event>} add
  //  * @returns {undefined}
  //  */
  // addBefore(index, remove, add) {
  //   addImplementation(this, index, remove, add, true)
  // }
  /**
   * Done, change the events.
   *
   * @param {Array<Event>} events
   *   List of events to apply the edits to.
   * @returns {undefined}
   *   Nothing.
   */
  consume(events) {
    this.map.sort(function(a, b) {
      return a[0] - b[0];
    });
    if (this.map.length === 0) {
      return;
    }
    let index2 = this.map.length;
    const vecs = [];
    while (index2 > 0) {
      index2 -= 1;
      vecs.push(events.slice(this.map[index2][0] + this.map[index2][1]), this.map[index2][2]);
      events.length = this.map[index2][0];
    }
    vecs.push(events.slice());
    events.length = 0;
    let slice = vecs.pop();
    while (slice) {
      for (const element of slice) {
        events.push(element);
      }
      slice = vecs.pop();
    }
    this.map.length = 0;
    this.index.clear();
  }
};
function addImplementation(editMap, at, remove, add) {
  if (remove === 0 && add.length === 0) {
    return;
  }
  const existing = editMap.index.get(at);
  if (existing) {
    existing[1] += remove;
    existing[2].push(...add);
    return;
  }
  const change = [at, remove, add];
  editMap.map.push(change);
  editMap.index.set(at, change);
}

// node_modules/micromark-extension-gfm-table/lib/infer.js
function gfmTableAlign(events, index2) {
  let inDelimiterRow = false;
  const align = [];
  while (index2 < events.length) {
    const event = events[index2];
    if (inDelimiterRow) {
      if (event[0] === "enter") {
        if (event[1].type === "tableContent") {
          align.push(events[index2 + 1][1].type === "tableDelimiterMarker" ? "left" : "none");
        }
      } else if (event[1].type === "tableContent") {
        if (events[index2 - 1][1].type === "tableDelimiterMarker") {
          const alignIndex = align.length - 1;
          align[alignIndex] = align[alignIndex] === "left" ? "center" : "right";
        }
      } else if (event[1].type === "tableDelimiterRow") {
        break;
      }
    } else if (event[0] === "enter" && event[1].type === "tableDelimiterRow") {
      inDelimiterRow = true;
    }
    index2 += 1;
  }
  return align;
}

// node_modules/micromark-extension-gfm-table/lib/syntax.js
function gfmTable() {
  return {
    flow: {
      null: {
        name: "table",
        tokenize: tokenizeTable,
        resolveAll: resolveTable
      }
    }
  };
}
function tokenizeTable(effects, ok3, nok) {
  const self = this;
  let size = 0;
  let sizeB = 0;
  let seen;
  return start;
  function start(code3) {
    let index2 = self.events.length - 1;
    while (index2 > -1) {
      const {
        type
      } = self.events[index2][1];
      if (type === "lineEnding" || // Note: markdown-rs uses `whitespace` instead of `linePrefix`
      type === "linePrefix") {
        index2--;
      } else {
        break;
      }
    }
    const tail = index2 > -1 ? self.events[index2][1].type : null;
    const next = tail === "tableHead" || tail === "tableRow" ? bodyRowStart : headRowBefore;
    if (next === bodyRowStart && self.parser.lazy[self.now().line]) {
      return nok(code3);
    }
    return next(code3);
  }
  function headRowBefore(code3) {
    effects.enter("tableHead");
    effects.enter("tableRow");
    return headRowStart(code3);
  }
  function headRowStart(code3) {
    if (code3 === 124) {
      return headRowBreak(code3);
    }
    seen = true;
    sizeB += 1;
    return headRowBreak(code3);
  }
  function headRowBreak(code3) {
    if (code3 === null) {
      return nok(code3);
    }
    if (markdownLineEnding(code3)) {
      if (sizeB > 1) {
        sizeB = 0;
        self.interrupt = true;
        effects.exit("tableRow");
        effects.enter("lineEnding");
        effects.consume(code3);
        effects.exit("lineEnding");
        return headDelimiterStart;
      }
      return nok(code3);
    }
    if (markdownSpace(code3)) {
      return factorySpace(effects, headRowBreak, "whitespace")(code3);
    }
    sizeB += 1;
    if (seen) {
      seen = false;
      size += 1;
    }
    if (code3 === 124) {
      effects.enter("tableCellDivider");
      effects.consume(code3);
      effects.exit("tableCellDivider");
      seen = true;
      return headRowBreak;
    }
    effects.enter("data");
    return headRowData(code3);
  }
  function headRowData(code3) {
    if (code3 === null || code3 === 124 || markdownLineEndingOrSpace(code3)) {
      effects.exit("data");
      return headRowBreak(code3);
    }
    effects.consume(code3);
    return code3 === 92 ? headRowEscape : headRowData;
  }
  function headRowEscape(code3) {
    if (code3 === 92 || code3 === 124) {
      effects.consume(code3);
      return headRowData;
    }
    return headRowData(code3);
  }
  function headDelimiterStart(code3) {
    self.interrupt = false;
    if (self.parser.lazy[self.now().line]) {
      return nok(code3);
    }
    effects.enter("tableDelimiterRow");
    seen = false;
    if (markdownSpace(code3)) {
      return factorySpace(effects, headDelimiterBefore, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code3);
    }
    return headDelimiterBefore(code3);
  }
  function headDelimiterBefore(code3) {
    if (code3 === 45 || code3 === 58) {
      return headDelimiterValueBefore(code3);
    }
    if (code3 === 124) {
      seen = true;
      effects.enter("tableCellDivider");
      effects.consume(code3);
      effects.exit("tableCellDivider");
      return headDelimiterCellBefore;
    }
    return headDelimiterNok(code3);
  }
  function headDelimiterCellBefore(code3) {
    if (markdownSpace(code3)) {
      return factorySpace(effects, headDelimiterValueBefore, "whitespace")(code3);
    }
    return headDelimiterValueBefore(code3);
  }
  function headDelimiterValueBefore(code3) {
    if (code3 === 58) {
      sizeB += 1;
      seen = true;
      effects.enter("tableDelimiterMarker");
      effects.consume(code3);
      effects.exit("tableDelimiterMarker");
      return headDelimiterLeftAlignmentAfter;
    }
    if (code3 === 45) {
      sizeB += 1;
      return headDelimiterLeftAlignmentAfter(code3);
    }
    if (code3 === null || markdownLineEnding(code3)) {
      return headDelimiterCellAfter(code3);
    }
    return headDelimiterNok(code3);
  }
  function headDelimiterLeftAlignmentAfter(code3) {
    if (code3 === 45) {
      effects.enter("tableDelimiterFiller");
      return headDelimiterFiller(code3);
    }
    return headDelimiterNok(code3);
  }
  function headDelimiterFiller(code3) {
    if (code3 === 45) {
      effects.consume(code3);
      return headDelimiterFiller;
    }
    if (code3 === 58) {
      seen = true;
      effects.exit("tableDelimiterFiller");
      effects.enter("tableDelimiterMarker");
      effects.consume(code3);
      effects.exit("tableDelimiterMarker");
      return headDelimiterRightAlignmentAfter;
    }
    effects.exit("tableDelimiterFiller");
    return headDelimiterRightAlignmentAfter(code3);
  }
  function headDelimiterRightAlignmentAfter(code3) {
    if (markdownSpace(code3)) {
      return factorySpace(effects, headDelimiterCellAfter, "whitespace")(code3);
    }
    return headDelimiterCellAfter(code3);
  }
  function headDelimiterCellAfter(code3) {
    if (code3 === 124) {
      return headDelimiterBefore(code3);
    }
    if (code3 === null || markdownLineEnding(code3)) {
      if (!seen || size !== sizeB) {
        return headDelimiterNok(code3);
      }
      effects.exit("tableDelimiterRow");
      effects.exit("tableHead");
      return ok3(code3);
    }
    return headDelimiterNok(code3);
  }
  function headDelimiterNok(code3) {
    return nok(code3);
  }
  function bodyRowStart(code3) {
    effects.enter("tableRow");
    return bodyRowBreak(code3);
  }
  function bodyRowBreak(code3) {
    if (code3 === 124) {
      effects.enter("tableCellDivider");
      effects.consume(code3);
      effects.exit("tableCellDivider");
      return bodyRowBreak;
    }
    if (code3 === null || markdownLineEnding(code3)) {
      effects.exit("tableRow");
      return ok3(code3);
    }
    if (markdownSpace(code3)) {
      return factorySpace(effects, bodyRowBreak, "whitespace")(code3);
    }
    effects.enter("data");
    return bodyRowData(code3);
  }
  function bodyRowData(code3) {
    if (code3 === null || code3 === 124 || markdownLineEndingOrSpace(code3)) {
      effects.exit("data");
      return bodyRowBreak(code3);
    }
    effects.consume(code3);
    return code3 === 92 ? bodyRowEscape : bodyRowData;
  }
  function bodyRowEscape(code3) {
    if (code3 === 92 || code3 === 124) {
      effects.consume(code3);
      return bodyRowData;
    }
    return bodyRowData(code3);
  }
}
function resolveTable(events, context) {
  let index2 = -1;
  let inFirstCellAwaitingPipe = true;
  let rowKind = 0;
  let lastCell = [0, 0, 0, 0];
  let cell = [0, 0, 0, 0];
  let afterHeadAwaitingFirstBodyRow = false;
  let lastTableEnd = 0;
  let currentTable;
  let currentBody;
  let currentCell;
  const map3 = new EditMap();
  while (++index2 < events.length) {
    const event = events[index2];
    const token = event[1];
    if (event[0] === "enter") {
      if (token.type === "tableHead") {
        afterHeadAwaitingFirstBodyRow = false;
        if (lastTableEnd !== 0) {
          flushTableEnd(map3, context, lastTableEnd, currentTable, currentBody);
          currentBody = void 0;
          lastTableEnd = 0;
        }
        currentTable = {
          type: "table",
          start: Object.assign({}, token.start),
          // Note: correct end is set later.
          end: Object.assign({}, token.end)
        };
        map3.add(index2, 0, [["enter", currentTable, context]]);
      } else if (token.type === "tableRow" || token.type === "tableDelimiterRow") {
        inFirstCellAwaitingPipe = true;
        currentCell = void 0;
        lastCell = [0, 0, 0, 0];
        cell = [0, index2 + 1, 0, 0];
        if (afterHeadAwaitingFirstBodyRow) {
          afterHeadAwaitingFirstBodyRow = false;
          currentBody = {
            type: "tableBody",
            start: Object.assign({}, token.start),
            // Note: correct end is set later.
            end: Object.assign({}, token.end)
          };
          map3.add(index2, 0, [["enter", currentBody, context]]);
        }
        rowKind = token.type === "tableDelimiterRow" ? 2 : currentBody ? 3 : 1;
      } else if (rowKind && (token.type === "data" || token.type === "tableDelimiterMarker" || token.type === "tableDelimiterFiller")) {
        inFirstCellAwaitingPipe = false;
        if (cell[2] === 0) {
          if (lastCell[1] !== 0) {
            cell[0] = cell[1];
            currentCell = flushCell(map3, context, lastCell, rowKind, void 0, currentCell);
            lastCell = [0, 0, 0, 0];
          }
          cell[2] = index2;
        }
      } else if (token.type === "tableCellDivider") {
        if (inFirstCellAwaitingPipe) {
          inFirstCellAwaitingPipe = false;
        } else {
          if (lastCell[1] !== 0) {
            cell[0] = cell[1];
            currentCell = flushCell(map3, context, lastCell, rowKind, void 0, currentCell);
          }
          lastCell = cell;
          cell = [lastCell[1], index2, 0, 0];
        }
      }
    } else if (token.type === "tableHead") {
      afterHeadAwaitingFirstBodyRow = true;
      lastTableEnd = index2;
    } else if (token.type === "tableRow" || token.type === "tableDelimiterRow") {
      lastTableEnd = index2;
      if (lastCell[1] !== 0) {
        cell[0] = cell[1];
        currentCell = flushCell(map3, context, lastCell, rowKind, index2, currentCell);
      } else if (cell[1] !== 0) {
        currentCell = flushCell(map3, context, cell, rowKind, index2, currentCell);
      }
      rowKind = 0;
    } else if (rowKind && (token.type === "data" || token.type === "tableDelimiterMarker" || token.type === "tableDelimiterFiller")) {
      cell[3] = index2;
    }
  }
  if (lastTableEnd !== 0) {
    flushTableEnd(map3, context, lastTableEnd, currentTable, currentBody);
  }
  map3.consume(context.events);
  index2 = -1;
  while (++index2 < context.events.length) {
    const event = context.events[index2];
    if (event[0] === "enter" && event[1].type === "table") {
      event[1]._align = gfmTableAlign(context.events, index2);
    }
  }
  return events;
}
function flushCell(map3, context, range, rowKind, rowEnd, previousCell) {
  const groupName = rowKind === 1 ? "tableHeader" : rowKind === 2 ? "tableDelimiter" : "tableData";
  const valueName = "tableContent";
  if (range[0] !== 0) {
    previousCell.end = Object.assign({}, getPoint(context.events, range[0]));
    map3.add(range[0], 0, [["exit", previousCell, context]]);
  }
  const now = getPoint(context.events, range[1]);
  previousCell = {
    type: groupName,
    start: Object.assign({}, now),
    // Note: correct end is set later.
    end: Object.assign({}, now)
  };
  map3.add(range[1], 0, [["enter", previousCell, context]]);
  if (range[2] !== 0) {
    const relatedStart = getPoint(context.events, range[2]);
    const relatedEnd = getPoint(context.events, range[3]);
    const valueToken = {
      type: valueName,
      start: Object.assign({}, relatedStart),
      end: Object.assign({}, relatedEnd)
    };
    map3.add(range[2], 0, [["enter", valueToken, context]]);
    if (rowKind !== 2) {
      const start = context.events[range[2]];
      const end = context.events[range[3]];
      start[1].end = Object.assign({}, end[1].end);
      start[1].type = "chunkText";
      start[1].contentType = "text";
      if (range[3] > range[2] + 1) {
        const a = range[2] + 1;
        const b = range[3] - range[2] - 1;
        map3.add(a, b, []);
      }
    }
    map3.add(range[3] + 1, 0, [["exit", valueToken, context]]);
  }
  if (rowEnd !== void 0) {
    previousCell.end = Object.assign({}, getPoint(context.events, rowEnd));
    map3.add(rowEnd, 0, [["exit", previousCell, context]]);
    previousCell = void 0;
  }
  return previousCell;
}
function flushTableEnd(map3, context, index2, table, tableBody) {
  const exits = [];
  const related = getPoint(context.events, index2);
  if (tableBody) {
    tableBody.end = Object.assign({}, related);
    exits.push(["exit", tableBody, context]);
  }
  table.end = Object.assign({}, related);
  exits.push(["exit", table, context]);
  map3.add(index2 + 1, 0, exits);
}
function getPoint(events, index2) {
  const event = events[index2];
  const side = event[0] === "enter" ? "start" : "end";
  return event[1][side];
}

// node_modules/micromark-extension-gfm-task-list-item/lib/syntax.js
var tasklistCheck = {
  name: "tasklistCheck",
  tokenize: tokenizeTasklistCheck
};
function gfmTaskListItem() {
  return {
    text: {
      [91]: tasklistCheck
    }
  };
}
function tokenizeTasklistCheck(effects, ok3, nok) {
  const self = this;
  return open;
  function open(code3) {
    if (
      // Exit if there’s stuff before.
      self.previous !== null || // Exit if not in the first content that is the first child of a list
      // item.
      !self._gfmTasklistFirstContentOfListItem
    ) {
      return nok(code3);
    }
    effects.enter("taskListCheck");
    effects.enter("taskListCheckMarker");
    effects.consume(code3);
    effects.exit("taskListCheckMarker");
    return inside;
  }
  function inside(code3) {
    if (markdownLineEndingOrSpace(code3)) {
      effects.enter("taskListCheckValueUnchecked");
      effects.consume(code3);
      effects.exit("taskListCheckValueUnchecked");
      return close;
    }
    if (code3 === 88 || code3 === 120) {
      effects.enter("taskListCheckValueChecked");
      effects.consume(code3);
      effects.exit("taskListCheckValueChecked");
      return close;
    }
    return nok(code3);
  }
  function close(code3) {
    if (code3 === 93) {
      effects.enter("taskListCheckMarker");
      effects.consume(code3);
      effects.exit("taskListCheckMarker");
      effects.exit("taskListCheck");
      return after;
    }
    return nok(code3);
  }
  function after(code3) {
    if (markdownLineEnding(code3)) {
      return ok3(code3);
    }
    if (markdownSpace(code3)) {
      return effects.check({
        tokenize: spaceThenNonSpace
      }, ok3, nok)(code3);
    }
    return nok(code3);
  }
}
function spaceThenNonSpace(effects, ok3, nok) {
  return factorySpace(effects, after, "whitespace");
  function after(code3) {
    return code3 === null ? nok(code3) : ok3(code3);
  }
}

// node_modules/micromark-extension-gfm/index.js
function gfm(options) {
  return combineExtensions([
    gfmAutolinkLiteral(),
    gfmFootnote(),
    gfmStrikethrough(options),
    gfmTable(),
    gfmTaskListItem()
  ]);
}

// node_modules/remark-gfm/lib/index.js
var emptyOptions2 = {};
function remarkGfm(options) {
  const self = (
    /** @type {Processor<Root>} */
    this
  );
  const settings = options || emptyOptions2;
  const data = self.data();
  const micromarkExtensions = data.micromarkExtensions || (data.micromarkExtensions = []);
  const fromMarkdownExtensions = data.fromMarkdownExtensions || (data.fromMarkdownExtensions = []);
  const toMarkdownExtensions = data.toMarkdownExtensions || (data.toMarkdownExtensions = []);
  micromarkExtensions.push(gfm(settings));
  fromMarkdownExtensions.push(gfmFromMarkdown());
  toMarkdownExtensions.push(gfmToMarkdown(settings));
}

// node_modules/mdast-util-math/lib/index.js
function mathFromMarkdown() {
  return {
    enter: {
      mathFlow: enterMathFlow,
      mathFlowFenceMeta: enterMathFlowMeta,
      mathText: enterMathText
    },
    exit: {
      mathFlow: exitMathFlow,
      mathFlowFence: exitMathFlowFence,
      mathFlowFenceMeta: exitMathFlowMeta,
      mathFlowValue: exitMathData,
      mathText: exitMathText,
      mathTextData: exitMathData
    }
  };
  function enterMathFlow(token) {
    const code3 = {
      type: "element",
      tagName: "code",
      properties: { className: ["language-math", "math-display"] },
      children: []
    };
    this.enter(
      {
        type: "math",
        meta: null,
        value: "",
        data: { hName: "pre", hChildren: [code3] }
      },
      token
    );
  }
  function enterMathFlowMeta() {
    this.buffer();
  }
  function exitMathFlowMeta() {
    const data = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2.type === "math");
    node2.meta = data;
  }
  function exitMathFlowFence() {
    if (this.data.mathFlowInside) return;
    this.buffer();
    this.data.mathFlowInside = true;
  }
  function exitMathFlow(token) {
    const data = this.resume().replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, "");
    const node2 = this.stack[this.stack.length - 1];
    ok(node2.type === "math");
    this.exit(token);
    node2.value = data;
    const code3 = (
      /** @type {HastElement} */
      node2.data.hChildren[0]
    );
    ok(code3.type === "element");
    ok(code3.tagName === "code");
    code3.children.push({ type: "text", value: data });
    this.data.mathFlowInside = void 0;
  }
  function enterMathText(token) {
    this.enter(
      {
        type: "inlineMath",
        value: "",
        data: {
          hName: "code",
          hProperties: { className: ["language-math", "math-inline"] },
          hChildren: []
        }
      },
      token
    );
    this.buffer();
  }
  function exitMathText(token) {
    const data = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2.type === "inlineMath");
    this.exit(token);
    node2.value = data;
    const children = (
      /** @type {Array<HastElementContent>} */
      // @ts-expect-error: we defined it in `enterMathFlow`.
      node2.data.hChildren
    );
    children.push({ type: "text", value: data });
  }
  function exitMathData(token) {
    this.config.enter.data.call(this, token);
    this.config.exit.data.call(this, token);
  }
}
function mathToMarkdown(options) {
  let single = (options || {}).singleDollarTextMath;
  if (single === null || single === void 0) {
    single = true;
  }
  inlineMath.peek = inlineMathPeek;
  return {
    unsafe: [
      { character: "\r", inConstruct: "mathFlowMeta" },
      { character: "\n", inConstruct: "mathFlowMeta" },
      {
        character: "$",
        after: single ? void 0 : "\\$",
        inConstruct: "phrasing"
      },
      { character: "$", inConstruct: "mathFlowMeta" },
      { atBreak: true, character: "$", after: "\\$" }
    ],
    handlers: { math: math2, inlineMath }
  };
  function math2(node2, _, state, info) {
    const raw = node2.value || "";
    const tracker = state.createTracker(info);
    const sequence = "$".repeat(Math.max(longestStreak(raw, "$") + 1, 2));
    const exit3 = state.enter("mathFlow");
    let value = tracker.move(sequence);
    if (node2.meta) {
      const subexit = state.enter("mathFlowMeta");
      value += tracker.move(
        state.safe(node2.meta, {
          after: "\n",
          before: value,
          encode: ["$"],
          ...tracker.current()
        })
      );
      subexit();
    }
    value += tracker.move("\n");
    if (raw) {
      value += tracker.move(raw + "\n");
    }
    value += tracker.move(sequence);
    exit3();
    return value;
  }
  function inlineMath(node2, _, state) {
    let value = node2.value || "";
    let size = 1;
    if (!single) size++;
    while (new RegExp("(^|[^$])" + "\\$".repeat(size) + "([^$]|$)").test(value)) {
      size++;
    }
    const sequence = "$".repeat(size);
    if (
      // Contains non-space.
      /[^ \r\n]/.test(value) && // Starts with space and ends with space.
      (/^[ \r\n]/.test(value) && /[ \r\n]$/.test(value) || // Starts or ends with dollar.
      /^\$|\$$/.test(value))
    ) {
      value = " " + value + " ";
    }
    let index2 = -1;
    while (++index2 < state.unsafe.length) {
      const pattern = state.unsafe[index2];
      if (!pattern.atBreak) continue;
      const expression = state.compilePattern(pattern);
      let match;
      while (match = expression.exec(value)) {
        let position2 = match.index;
        if (value.codePointAt(position2) === 10 && value.codePointAt(position2 - 1) === 13) {
          position2--;
        }
        value = value.slice(0, position2) + " " + value.slice(match.index + 1);
      }
    }
    return sequence + value + sequence;
  }
  function inlineMathPeek() {
    return "$";
  }
}

// node_modules/micromark-extension-math/lib/math-flow.js
var mathFlow = {
  tokenize: tokenizeMathFenced,
  concrete: true,
  name: "mathFlow"
};
var nonLazyContinuation2 = {
  tokenize: tokenizeNonLazyContinuation2,
  partial: true
};
function tokenizeMathFenced(effects, ok3, nok) {
  const self = this;
  const tail = self.events[self.events.length - 1];
  const initialSize = tail && tail[1].type === "linePrefix" ? tail[2].sliceSerialize(tail[1], true).length : 0;
  let sizeOpen = 0;
  return start;
  function start(code3) {
    effects.enter("mathFlow");
    effects.enter("mathFlowFence");
    effects.enter("mathFlowFenceSequence");
    return sequenceOpen(code3);
  }
  function sequenceOpen(code3) {
    if (code3 === 36) {
      effects.consume(code3);
      sizeOpen++;
      return sequenceOpen;
    }
    if (sizeOpen < 2) {
      return nok(code3);
    }
    effects.exit("mathFlowFenceSequence");
    return factorySpace(effects, metaBefore, "whitespace")(code3);
  }
  function metaBefore(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      return metaAfter(code3);
    }
    effects.enter("mathFlowFenceMeta");
    effects.enter("chunkString", {
      contentType: "string"
    });
    return meta(code3);
  }
  function meta(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      effects.exit("chunkString");
      effects.exit("mathFlowFenceMeta");
      return metaAfter(code3);
    }
    if (code3 === 36) {
      return nok(code3);
    }
    effects.consume(code3);
    return meta;
  }
  function metaAfter(code3) {
    effects.exit("mathFlowFence");
    if (self.interrupt) {
      return ok3(code3);
    }
    return effects.attempt(nonLazyContinuation2, beforeNonLazyContinuation, after)(code3);
  }
  function beforeNonLazyContinuation(code3) {
    return effects.attempt({
      tokenize: tokenizeClosingFence,
      partial: true
    }, after, contentStart)(code3);
  }
  function contentStart(code3) {
    return (initialSize ? factorySpace(effects, beforeContentChunk, "linePrefix", initialSize + 1) : beforeContentChunk)(code3);
  }
  function beforeContentChunk(code3) {
    if (code3 === null) {
      return after(code3);
    }
    if (markdownLineEnding(code3)) {
      return effects.attempt(nonLazyContinuation2, beforeNonLazyContinuation, after)(code3);
    }
    effects.enter("mathFlowValue");
    return contentChunk(code3);
  }
  function contentChunk(code3) {
    if (code3 === null || markdownLineEnding(code3)) {
      effects.exit("mathFlowValue");
      return beforeContentChunk(code3);
    }
    effects.consume(code3);
    return contentChunk;
  }
  function after(code3) {
    effects.exit("mathFlow");
    return ok3(code3);
  }
  function tokenizeClosingFence(effects2, ok4, nok2) {
    let size = 0;
    return factorySpace(effects2, beforeSequenceClose, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4);
    function beforeSequenceClose(code3) {
      effects2.enter("mathFlowFence");
      effects2.enter("mathFlowFenceSequence");
      return sequenceClose(code3);
    }
    function sequenceClose(code3) {
      if (code3 === 36) {
        size++;
        effects2.consume(code3);
        return sequenceClose;
      }
      if (size < sizeOpen) {
        return nok2(code3);
      }
      effects2.exit("mathFlowFenceSequence");
      return factorySpace(effects2, afterSequenceClose, "whitespace")(code3);
    }
    function afterSequenceClose(code3) {
      if (code3 === null || markdownLineEnding(code3)) {
        effects2.exit("mathFlowFence");
        return ok4(code3);
      }
      return nok2(code3);
    }
  }
}
function tokenizeNonLazyContinuation2(effects, ok3, nok) {
  const self = this;
  return start;
  function start(code3) {
    if (code3 === null) {
      return ok3(code3);
    }
    effects.enter("lineEnding");
    effects.consume(code3);
    effects.exit("lineEnding");
    return lineStart;
  }
  function lineStart(code3) {
    return self.parser.lazy[self.now().line] ? nok(code3) : ok3(code3);
  }
}

// node_modules/micromark-extension-math/lib/math-text.js
function mathText(options) {
  const options_ = options || {};
  let single = options_.singleDollarTextMath;
  if (single === null || single === void 0) {
    single = true;
  }
  return {
    tokenize: tokenizeMathText,
    resolve: resolveMathText,
    previous: previous3,
    name: "mathText"
  };
  function tokenizeMathText(effects, ok3, nok) {
    const self = this;
    let sizeOpen = 0;
    let size;
    let token;
    return start;
    function start(code3) {
      effects.enter("mathText");
      effects.enter("mathTextSequence");
      return sequenceOpen(code3);
    }
    function sequenceOpen(code3) {
      if (code3 === 36) {
        effects.consume(code3);
        sizeOpen++;
        return sequenceOpen;
      }
      if (sizeOpen < 2 && !single) {
        return nok(code3);
      }
      effects.exit("mathTextSequence");
      return between(code3);
    }
    function between(code3) {
      if (code3 === null) {
        return nok(code3);
      }
      if (code3 === 36) {
        token = effects.enter("mathTextSequence");
        size = 0;
        return sequenceClose(code3);
      }
      if (code3 === 32) {
        effects.enter("space");
        effects.consume(code3);
        effects.exit("space");
        return between;
      }
      if (markdownLineEnding(code3)) {
        effects.enter("lineEnding");
        effects.consume(code3);
        effects.exit("lineEnding");
        return between;
      }
      effects.enter("mathTextData");
      return data(code3);
    }
    function data(code3) {
      if (code3 === null || code3 === 32 || code3 === 36 || markdownLineEnding(code3)) {
        effects.exit("mathTextData");
        return between(code3);
      }
      effects.consume(code3);
      return data;
    }
    function sequenceClose(code3) {
      if (code3 === 36) {
        effects.consume(code3);
        size++;
        return sequenceClose;
      }
      if (size === sizeOpen) {
        effects.exit("mathTextSequence");
        effects.exit("mathText");
        return ok3(code3);
      }
      token.type = "mathTextData";
      return data(code3);
    }
  }
}
function resolveMathText(events) {
  let tailExitIndex = events.length - 4;
  let headEnterIndex = 3;
  let index2;
  let enter;
  if ((events[headEnterIndex][1].type === "lineEnding" || events[headEnterIndex][1].type === "space") && (events[tailExitIndex][1].type === "lineEnding" || events[tailExitIndex][1].type === "space")) {
    index2 = headEnterIndex;
    while (++index2 < tailExitIndex) {
      if (events[index2][1].type === "mathTextData") {
        events[tailExitIndex][1].type = "mathTextPadding";
        events[headEnterIndex][1].type = "mathTextPadding";
        headEnterIndex += 2;
        tailExitIndex -= 2;
        break;
      }
    }
  }
  index2 = headEnterIndex - 1;
  tailExitIndex++;
  while (++index2 <= tailExitIndex) {
    if (enter === void 0) {
      if (index2 !== tailExitIndex && events[index2][1].type !== "lineEnding") {
        enter = index2;
      }
    } else if (index2 === tailExitIndex || events[index2][1].type === "lineEnding") {
      events[enter][1].type = "mathTextData";
      if (index2 !== enter + 2) {
        events[enter][1].end = events[index2 - 1][1].end;
        events.splice(enter + 2, index2 - enter - 2);
        tailExitIndex -= index2 - enter - 2;
        index2 = enter + 2;
      }
      enter = void 0;
    }
  }
  return events;
}
function previous3(code3) {
  return code3 !== 36 || this.events[this.events.length - 1][1].type === "characterEscape";
}

// node_modules/micromark-extension-math/lib/syntax.js
function math(options) {
  return {
    flow: {
      [36]: mathFlow
    },
    text: {
      [36]: mathText(options)
    }
  };
}

// node_modules/remark-math/lib/index.js
var emptyOptions3 = {};
function remarkMath(options) {
  const self = (
    /** @type {Processor} */
    this
  );
  const settings = options || emptyOptions3;
  const data = self.data();
  const micromarkExtensions = data.micromarkExtensions || (data.micromarkExtensions = []);
  const fromMarkdownExtensions = data.fromMarkdownExtensions || (data.fromMarkdownExtensions = []);
  const toMarkdownExtensions = data.toMarkdownExtensions || (data.toMarkdownExtensions = []);
  micromarkExtensions.push(math(settings));
  fromMarkdownExtensions.push(mathFromMarkdown());
  toMarkdownExtensions.push(mathToMarkdown(settings));
}

// src/block-router.ts
var processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
function cellText(cell) {
  return toString(cell).replace(/\s+/g, " ").trim();
}
function tableData(node2) {
  const rows = [];
  for (const row of node2.children) rows.push(row.children.map(cellText));
  return rows;
}
function pushInline(node2, out, block, sentence) {
  switch (node2.type) {
    case "text":
      if (node2.value) out.push({ kind: "prose", text: node2.value, block });
      return;
    case "inlineCode":
      out.push({ kind: "inline-code", text: node2.value, block });
      return;
    case "inlineMath":
      out.push({ kind: "inline-math", text: node2.value, block, meta: sentence ? { sentence } : void 0 });
      return;
    case "image":
      if (node2.alt) out.push({ kind: "prose", text: "\u56FE\u7247\uFF1A" + node2.alt, block });
      return;
    case "footnoteReference":
      out.push({ kind: "footnote-ref", text: "[" + node2.identifier + "]", block });
      return;
    case "break":
    case "html":
      return;
    default:
      if (Array.isArray(node2.children)) {
        for (const c of node2.children) pushInline(c, out, block, sentence);
      } else {
        const s = toString(node2);
        if (s) out.push({ kind: "prose", text: s, block });
      }
  }
}
var SPOKEN_BLOCKS = /* @__PURE__ */ new Set(["code", "math", "table", "paragraph", "heading"]);
function walkBlocks(nodes, out, ctx) {
  for (const node2 of nodes) {
    if (ctx.lastKind !== null && SPOKEN_BLOCKS.has(node2.type) && SPOKEN_BLOCKS.has(ctx.lastKind)) {
      out.push({
        kind: "pause",
        text: "",
        block: ctx.n++,
        meta: { pauseLevel: ctx.lastKind === "heading" ? "heading" : "block" }
      });
    }
    switch (node2.type) {
      case "code":
        out.push({ kind: "code", text: node2.value, meta: { lang: node2.lang || "" }, block: ctx.n++ });
        break;
      case "math":
        out.push({ kind: "display-math", text: node2.value, block: ctx.n++ });
        break;
      case "table": {
        const rows = tableData(node2);
        out.push({
          kind: "table",
          text: rows.map((r) => r.join(" | ")).join("\n"),
          meta: { rows, rowCount: rows.length, colCount: rows[0] ? rows[0].length : 0 },
          block: ctx.n++
        });
        break;
      }
      case "paragraph":
      case "heading": {
        const sentence = toString(node2).replace(/\s+/g, " ").trim().slice(0, 400);
        pushInline(node2, out, ctx.n++, sentence || void 0);
        break;
      }
      case "list":
      case "listItem":
      case "blockquote":
        walkBlocks(node2.children ?? [], out, ctx);
        break;
      case "footnoteDefinition":
        out.push({ kind: "footnote-def", text: toString(node2), block: ctx.n++ });
        break;
      case "thematicBreak":
      case "html":
        break;
      default:
        if (Array.isArray(node2.children)) walkBlocks(node2.children, out, ctx);
        else {
          const s = toString(node2);
          if (s) out.push({ kind: "prose", text: s, block: ctx.n++ });
        }
    }
    if (SPOKEN_BLOCKS.has(node2.type)) ctx.lastKind = node2.type;
  }
  if (ctx.lastKind === "heading") {
    out.push({ kind: "pause", text: "", block: ctx.n++, meta: { pauseLevel: "heading" } });
  }
}
function parseSpeechSegments(markdown) {
  if (!markdown || !markdown.trim()) return [];
  let tree;
  try {
    tree = processor.parse(markdown);
  } catch {
    return [{ kind: "prose", text: markdown }];
  }
  const raw = [];
  walkBlocks(tree.children ?? [], raw, { n: 0, lastKind: null });
  const merged = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (seg.kind === "prose" && last && last.kind === "prose" && last.block === seg.block) {
      last.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }
  const out = [];
  for (const s of merged) {
    if (s.kind === "pause") {
      out.push({ kind: "pause", text: "", meta: s.meta });
      continue;
    }
    if (!s.text || !s.text.trim()) continue;
    out.push(s.meta ? { kind: s.kind, text: s.text, meta: s.meta } : { kind: s.kind, text: s.text });
  }
  return out;
}
var FENCE_OPEN = /^ {0,3}(\x60{3,}|~{3,})/;
function fenceOpenInfo(line) {
  const m = FENCE_OPEN.exec(line);
  if (!m) return null;
  const marker = m[1];
  return { char: marker[0], len: marker.length };
}
function isFenceClose(line, open) {
  const m = /^ {0,3}(\x60+|~+)\s*$/.exec(line.replace(/\r?\n$/, ""));
  if (!m) return false;
  const marker = m[1];
  return marker[0] === open.char && marker.length >= open.len;
}
function mathOpen(line) {
  return /^ {0,3}\$\$/.test(line);
}
function mathClosed(lines) {
  const joined = lines.join("");
  const first = joined.indexOf("$$");
  if (first < 0) return false;
  return joined.indexOf("$$", first + 2) >= 0;
}
var BlockRouter = class {
  buf = "";
  struct = null;
  prose = "";
  maxProseChars;
  constructor(opts = {}) {
    this.maxProseChars = opts.maxProseChars ?? 0;
  }
  feed(delta) {
    if (!delta) return [];
    const out = [];
    this.buf += delta;
    for (; ; ) {
      const idx = this.buf.indexOf("\n");
      if (idx < 0) break;
      const line = this.buf.slice(0, idx + 1);
      this.buf = this.buf.slice(idx + 1);
      this.consumeLine(line, out);
    }
    return out;
  }
  flush() {
    const out = [];
    if (this.struct) {
      if (this.buf) {
        this.struct.lines.push(this.buf);
        this.buf = "";
      }
      out.push(...parseSpeechSegments(this.struct.lines.join("")));
      this.struct = null;
    } else {
      if (this.buf) {
        this.prose += this.buf;
        this.buf = "";
      }
      this.flushProse(out);
    }
    return out;
  }
  /** 流式边界（空行 / 结构块前后）的停顿标记；换算成毫秒由适配器负责。 */
  pushPause(out, level = "block") {
    out.push({ kind: "pause", text: "", meta: { pauseLevel: level } });
  }
  consumeLine(line, out) {
    if (this.struct) {
      this.struct.lines.push(line);
      if (this.struct.kind === "code" && isFenceClose(line, this.struct.open)) {
        out.push(...parseSpeechSegments(this.struct.lines.join("")));
        this.struct = null;
        this.pushPause(out);
      } else if (this.struct.kind === "math" && mathClosed(this.struct.lines)) {
        out.push(...parseSpeechSegments(this.struct.lines.join("")));
        this.struct = null;
        this.pushPause(out);
      }
      return;
    }
    const open = fenceOpenInfo(line);
    if (open) {
      if (this.flushProse(out)) this.pushPause(out);
      this.struct = { kind: "code", open, lines: [line] };
      return;
    }
    if (mathOpen(line)) {
      if (this.flushProse(out)) this.pushPause(out);
      this.struct = { kind: "math", lines: [line] };
      if (mathClosed(this.struct.lines)) {
        out.push(...parseSpeechSegments(this.struct.lines.join("")));
        this.struct = null;
        this.pushPause(out);
      }
      return;
    }
    if (line.trim() === "") {
      if (this.flushProse(out)) this.pushPause(out);
      return;
    }
    this.prose += line;
    if (this.maxProseChars > 0 && this.prose.length >= this.maxProseChars) {
      this.flushProse(out);
    }
  }
  /** 冲刷累积正文；返回是否真的产出了内容（供调用方决定要不要补停顿）。 */
  flushProse(out) {
    if (!this.prose.trim()) {
      this.prose = "";
      return false;
    }
    out.push(...parseSpeechSegments(this.prose));
    this.prose = "";
    return true;
  }
};

// src/segmenter.ts
var SKIP_PREFIX = /^[\s.,，、:：;；!?！？)\]）"'”’〉》】]+$/;
function plainText(text5) {
  return String(text5).replace(/```[\s\S]*?```/g, " ").replace(/`([^`]*)`/g, "$1").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/^[-*+]\s+/gm, "").replace(/^\d+\.\s+/gm, "").replace(/<\/?[a-zA-Z][^>]*>/g, " ");
}
function sanitizeForTts(text5) {
  return String(text5).replace(/[*_#>`|^=+~]/g, " ").replace(/\s{2,}/g, " ").replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, "$1").trim();
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
var codePoints = (s) => Array.from(s);
function parsePronunciationFixes(raw) {
  const fixes = [];
  const errors = [];
  const lines = String(raw ?? "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(.*?)\s*(?:=>|->|→)\s*(.*)$/.exec(line);
    if (!m) {
      errors.push("\u7B2C " + (i + 1) + " \u884C\u7F3A\u5C11 \u201C=>\u201D\uFF1A" + line);
      continue;
    }
    const term = m[1].trim();
    const spoken = m[2].trim();
    if (!term || !spoken) {
      errors.push("\u7B2C " + (i + 1) + " \u884C\u539F\u8BCD\u6216\u66FF\u8EAB\u4E3A\u7A7A\uFF1A" + line);
      continue;
    }
    const reMatch = /^\/(.+)\/([a-z]*)$/.exec(term);
    if (reMatch) {
      let flags = reMatch[2];
      if (!flags.includes("g")) flags += "g";
      try {
        fixes.push({ term: "", spoken, re: new RegExp(reMatch[1], flags) });
      } catch (e) {
        errors.push("\u7B2C " + (i + 1) + " \u884C\u6B63\u5219\u4E0D\u5408\u6CD5\uFF08" + (e instanceof Error ? e.message : String(e)) + "\uFF09\uFF1A" + line);
      }
      continue;
    }
    const a = codePoints(term).length;
    const b = codePoints(spoken).length;
    if (a !== b) {
      errors.push("\u7B2C " + (i + 1) + " \u884C\u5B57\u6570\u4E0D\u7B49\uFF08" + a + " vs " + b + "\uFF09\uFF1A\u53EA\u5141\u8BB8\u540C\u97F3\u66FF\u6362\uFF0C\u4E0D\u5141\u8BB8\u589E\u5220\u5B57\uFF1A" + line);
      continue;
    }
    if (term === spoken) continue;
    fixes.push({ term, spoken });
  }
  return { fixes, errors };
}
function applyPronunciationFixes(text5, fixes = []) {
  if (fixes.length === 0) return String(text5);
  let out = String(text5);
  for (const fix of fixes) {
    out = fix.re ? out.replace(fix.re, fix.spoken) : out.split(fix.term).join(fix.spoken);
  }
  return out;
}
function splitSentences(chunk) {
  const sentences = [];
  let start = 0;
  const re = /[。！？!?；;…\n]+|\.(?=\s|$)/g;
  let m;
  let lastEnd = 0;
  while ((m = re.exec(chunk)) !== null) {
    const end = m.index + m[0].length;
    sentences.push(chunk.slice(start, end));
    start = end;
    lastEnd = end;
  }
  return { sentences, tail: chunk.slice(lastEnd) };
}
var SentenceSegmenter = class {
  buffer = "";
  maxChars;
  fixes;
  constructor(options = {}) {
    this.maxChars = options.maxSentenceChars ?? 200;
    this.fixes = options.fixes;
  }
  /** 实时读取替代表（getter 抛错时退化为「不替换」，不影响朗读）。 */
  fixList() {
    if (!this.fixes) return [];
    try {
      return this.fixes() ?? [];
    } catch {
      return [];
    }
  }
  /** 喂入一段 raw delta，返回它补全的完整句子。 */
  feed(chunk) {
    const cleaned = plainText(chunk);
    if (!cleaned) return [];
    this.buffer += cleaned;
    const { sentences, tail } = splitSentences(this.buffer);
    this.buffer = tail;
    const out = [];
    const fixes = this.fixList();
    for (const s of sentences) {
      const t = applyPronunciationFixes(sanitizeForTts(s), fixes).trim();
      if (t && !SKIP_PREFIX.test(t)) out.push(t);
    }
    if (this.buffer.length > this.maxChars) {
      const cut = this.buffer.search(/[，,、\s]/);
      const idx = cut > 0 ? cut : Math.floor(this.maxChars / 2);
      const head = applyPronunciationFixes(sanitizeForTts(this.buffer.slice(0, idx)), this.fixList()).trim();
      this.buffer = this.buffer.slice(idx);
      if (head) out.push(head);
    }
    return out;
  }
  /** 收尾：flush 剩余缓冲（流结束）。 */
  flush() {
    const t = applyPronunciationFixes(sanitizeForTts(this.buffer), this.fixList()).trim();
    this.buffer = "";
    if (t && !SKIP_PREFIX.test(t)) return [t];
    return [];
  }
};

// src/math.ts
var GREEK = {
  alpha: "\u963F\u5C14\u6CD5",
  beta: "\u8D1D\u5854",
  gamma: "\u4F3D\u9A6C",
  delta: "\u5FB7\u5C14\u5854",
  epsilon: "\u4F0A\u666E\u897F\u9F99",
  zeta: "\u6CFD\u5854",
  eta: "\u4F0A\u5854",
  theta: "\u897F\u5854",
  iota: "\u7EA6\u5854",
  kappa: "\u5361\u5E15",
  lambda: "\u5170\u59C6\u8FBE",
  mu: "\u7F2A",
  nu: "\u7EBD",
  xi: "\u514B\u897F",
  pi: "\u6D3E",
  rho: "\u67D4",
  sigma: "\u897F\u683C\u739B",
  tau: "\u9676",
  upsilon: "\u5B87\u666E\u897F\u9F99",
  phi: "\u6590",
  chi: "\u51EF",
  psi: "\u666E\u897F",
  omega: "\u6B27\u7C73\u4F3D",
  Gamma: "\u4F3D\u9A6C",
  Delta: "\u5FB7\u5C14\u5854",
  Theta: "\u897F\u5854",
  Lambda: "\u5170\u59C6\u8FBE",
  Xi: "\u514B\u897F",
  Pi: "\u6D3E",
  Sigma: "\u897F\u683C\u739B",
  Phi: "\u6590",
  Psi: "\u666E\u897F",
  Omega: "\u6B27\u7C73\u4F3D"
};
var FUNCS = {
  sin: "\u6B63\u5F26",
  cos: "\u4F59\u5F26",
  tan: "\u6B63\u5207",
  cot: "\u4F59\u5207",
  sec: "\u6B63\u5272",
  csc: "\u4F59\u5272",
  arcsin: "\u53CD\u6B63\u5F26",
  arccos: "\u53CD\u4F59\u5F26",
  arctan: "\u53CD\u6B63\u5207",
  log: "\u5BF9\u6570",
  ln: "\u81EA\u7136\u5BF9\u6570",
  lg: "\u5E38\u7528\u5BF9\u6570",
  exp: "\u6307\u6570\u51FD\u6570",
  lim: "\u6781\u9650",
  max: "\u6700\u5927\u503C",
  min: "\u6700\u5C0F\u503C",
  det: "\u884C\u5217\u5F0F",
  dim: "\u7EF4\u6570",
  mod: "\u6A21"
};
var OPERATORS = {
  times: "\u4E58",
  div: "\u9664\u4EE5",
  cdot: "\u4E58",
  ast: "\u4E58",
  pm: "\u6B63\u8D1F",
  mp: "\u8D1F\u6B63",
  le: "\u5C0F\u4E8E\u7B49\u4E8E",
  leq: "\u5C0F\u4E8E\u7B49\u4E8E",
  ge: "\u5927\u4E8E\u7B49\u4E8E",
  geq: "\u5927\u4E8E\u7B49\u4E8E",
  ne: "\u4E0D\u7B49\u4E8E",
  neq: "\u4E0D\u7B49\u4E8E",
  approx: "\u7EA6\u7B49\u4E8E",
  equiv: "\u6052\u7B49\u4E8E",
  sim: "\u76F8\u4F3C\u4E8E",
  infty: "\u65E0\u7A77",
  sum: "\u6C42\u548C",
  prod: "\u8FDE\u4E58",
  int: "\u79EF\u5206",
  iint: "\u4E8C\u91CD\u79EF\u5206",
  oint: "\u73AF\u8DEF\u79EF\u5206",
  partial: "\u504F\u5BFC",
  nabla: "\u68AF\u5EA6",
  to: "\u8D8B\u4E8E",
  rightarrow: "\u8D8B\u4E8E",
  in: "\u5C5E\u4E8E",
  notin: "\u4E0D\u5C5E\u4E8E",
  forall: "\u4EFB\u610F",
  exists: "\u5B58\u5728",
  propto: "\u6B63\u6BD4\u4E8E",
  subset: "\u5305\u542B\u4E8E",
  supset: "\u5305\u542B",
  cup: "\u5E76",
  cap: "\u4EA4",
  emptyset: "\u7A7A\u96C6",
  subseteq: "\u5305\u542B\u4E8E",
  supseteq: "\u5305\u542B",
  lesssim: "\u5C0F\u4E8E\u7B49\u4E8E",
  gtrsim: "\u5927\u4E8E\u7B49\u4E8E",
  leqslant: "\u5C0F\u4E8E\u7B49\u4E8E",
  geqslant: "\u5927\u4E8E\u7B49\u4E8E",
  ll: "\u8FDC\u5C0F\u4E8E",
  gg: "\u8FDC\u5927\u4E8E",
  Rightarrow: "\u63A8\u51FA",
  Leftrightarrow: "\u7B49\u4EF7\u4E8E",
  leftrightarrow: "\u7B49\u4EF7\u4E8E",
  mapsto: "\u6620\u5C04\u5230",
  circ: "\u590D\u5408",
  odot: "\u70B9\u4E58",
  oplus: "\u76F4\u548C",
  therefore: "\u6240\u4EE5",
  because: "\u56E0\u4E3A",
  angle: "\u89D2",
  degree: "\u5EA6"
};
var SYMBOLS = {
  "+": "\u52A0",
  "-": "\u51CF",
  "=": "\u7B49\u4E8E",
  "<": "\u5C0F\u4E8E",
  ">": "\u5927\u4E8E",
  "*": "\u4E58",
  "/": "\u9664\u4EE5",
  "\xB1": "\u6B63\u8D1F",
  "\xD7": "\u4E58",
  "\xF7": "\u9664\u4EE5",
  "\u2264": "\u5C0F\u4E8E\u7B49\u4E8E",
  "\u2265": "\u5927\u4E8E\u7B49\u4E8E",
  "\u2260": "\u4E0D\u7B49\u4E8E",
  "\u221E": "\u65E0\u7A77",
  "\u03C0": "\u6D3E",
  "\u03B8": "\u897F\u5854",
  "\u03B1": "\u963F\u5C14\u6CD5",
  "\u03B2": "\u8D1D\u5854",
  "\u03B3": "\u4F3D\u9A6C",
  "\u03B4": "\u5FB7\u5C14\u5854",
  "\u03BB": "\u5170\u59C6\u8FBE",
  "\u03BC": "\u7F2A",
  "\u03C3": "\u897F\u683C\u739B",
  "\u03C9": "\u6B27\u7C73\u4F3D",
  "(": "\u5DE6\u62EC\u53F7",
  ")": "\u53F3\u62EC\u53F7",
  "[": "\u5DE6\u65B9\u62EC\u53F7",
  "]": "\u53F3\u65B9\u62EC\u53F7",
  "{": "\u5DE6\u82B1\u62EC\u53F7",
  "}": "\u53F3\u82B1\u62EC\u53F7",
  ",": "",
  ".": "\u70B9",
  "%": "\u767E\u5206\u53F7",
  "|": "\u7AD6\u7EBF"
};
var ESCAPED = {
  "\\{": "\u5DE6\u82B1\u62EC\u53F7",
  "\\}": "\u53F3\u82B1\u62EC\u53F7",
  "\\%": "\u767E\u5206\u53F7",
  "\\&": "\u548C",
  "\\$": "\u7F8E\u5143",
  // 排版性空白命令：读音上直接忽略（否则 \sim\!32 会念出感叹号）
  "\\,": "",
  "\\;": "",
  "\\!": "",
  "\\:": ""
};
var CHEM_ELEMENTS = {
  H: "\u6C22",
  He: "\u6C26",
  Li: "\u9502",
  Be: "\u94CD",
  B: "\u787C",
  C: "\u78B3",
  N: "\u6C2E",
  O: "\u6C27",
  F: "\u6C1F",
  Ne: "\u6C16",
  Na: "\u94A0",
  Mg: "\u9541",
  Al: "\u94DD",
  Si: "\u7845",
  P: "\u78F7",
  S: "\u786B",
  Cl: "\u6C2F",
  Ar: "\u6C29",
  K: "\u94BE",
  Ca: "\u9499",
  Sc: "\u94AA",
  Ti: "\u949B",
  V: "\u9492",
  Cr: "\u94EC",
  Mn: "\u9530",
  Fe: "\u94C1",
  Co: "\u94B4",
  Ni: "\u954D",
  Cu: "\u94DC",
  Zn: "\u950C",
  Ga: "\u9553",
  Ge: "\u9517",
  As: "\u7837",
  Se: "\u7852",
  Br: "\u6EB4",
  Kr: "\u6C2A",
  Rb: "\u94F7",
  Sr: "\u9536",
  Y: "\u9487",
  Zr: "\u9506",
  Nb: "\u94CC",
  Mo: "\u94BC",
  Tc: "\u951D",
  Ru: "\u948C",
  Rh: "\u94D1",
  Pd: "\u94AF",
  Ag: "\u94F6",
  Cd: "\u9549",
  In: "\u94DF",
  Sn: "\u9521",
  Sb: "\u9511",
  Te: "\u78B2",
  I: "\u7898",
  Xe: "\u6C19",
  Cs: "\u94EF",
  Ba: "\u94A1",
  La: "\u9567",
  Ce: "\u94C8",
  Pr: "\u9568",
  Nd: "\u9495",
  Pm: "\u94B7",
  Sm: "\u9490",
  Eu: "\u94D5",
  Gd: "\u9486",
  Tb: "\u94FD",
  Dy: "\u955D",
  Ho: "\u94AC",
  Er: "\u94D2",
  Tm: "\u94E5",
  Yb: "\u9571",
  Lu: "\u9565",
  Hf: "\u94EA",
  Ta: "\u94BD",
  W: "\u94A8",
  Re: "\u94FC",
  Os: "\u9507",
  Ir: "\u94F1",
  Pt: "\u94C2",
  Au: "\u91D1",
  Hg: "\u6C5E",
  Tl: "\u94CA",
  Pb: "\u94C5",
  Bi: "\u94CB",
  Po: "\u948B",
  At: "\u7839",
  Rn: "\u6C21",
  Fr: "\u94AB",
  Ra: "\u956D",
  Ac: "\u9515",
  Th: "\u948D",
  Pa: "\u9564",
  U: "\u94C0",
  Np: "\u954E",
  Pu: "\u949A",
  Am: "\u9545",
  Cm: "\u9514"
};
var CHEM_STATES = {
  aq: "\u6C34\u6EB6\u6DB2",
  s: "\u56FA\u6001",
  l: "\u6DB2\u6001",
  g: "\u6C14\u6001",
  v: "\u6C14\u6001"
};
var CHEM_ARROWS = [
  ["<=>>", "\u53EF\u9006\u751F\u6210"],
  ["<<=>", "\u53EF\u9006\u751F\u6210"],
  ["<=>", "\u53EF\u9006\u751F\u6210"],
  ["<->", "\u53EF\u9006\u751F\u6210"],
  ["->", "\u751F\u6210"],
  ["<-", "\u751F\u6210"],
  ["\u21CC", "\u53EF\u9006\u751F\u6210"],
  ["\u2192", "\u751F\u6210"],
  ["\u2190", "\u751F\u6210"]
];
var PU_UNITS = {
  kJ: "\u5343\u7126",
  J: "\u7126",
  mol: "\u6469\u5C14",
  mmol: "\u6BEB\u6469\u5C14",
  g: "\u514B",
  kg: "\u5343\u514B",
  mg: "\u6BEB\u514B",
  L: "\u5347",
  mL: "\u6BEB\u5347",
  s: "\u79D2",
  ms: "\u6BEB\u79D2",
  min: "\u5206\u949F",
  h: "\u5C0F\u65F6",
  K: "\u5F00\u5C14\u6587",
  Pa: "\u5E15",
  kPa: "\u5343\u5E15",
  MPa: "\u5146\u5E15",
  atm: "\u6807\u51C6\u5927\u6C14\u538B",
  M: "\u6469\u5C14\u6BCF\u5347",
  nm: "\u7EB3\u7C73",
  \u00B5m: "\u5FAE\u7C73",
  mm: "\u6BEB\u7C73",
  cm: "\u5398\u7C73",
  km: "\u5343\u7C73",
  m: "\u7C73",
  W: "\u74E6",
  kW: "\u5343\u74E6",
  V: "\u4F0F",
  mV: "\u6BEB\u4F0F",
  A: "\u5B89",
  mA: "\u6BEB\u5B89",
  Hz: "\u8D6B\u5179",
  N: "\u725B",
  C: "\u5E93\u4ED1",
  "\xB0C": "\u6444\u6C0F\u5EA6",
  \u00C5: "\u57C3"
};
function skipWs(s, i) {
  let j = i;
  while (j < s.length && /\s/.test(s[j])) j++;
  return j;
}
function readArg(s, i) {
  i = skipWs(s, i);
  if (s[i] === "{") {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === "{") depth++;
      else if (s[j] === "}") {
        depth--;
        if (depth === 0) return { text: s.slice(i + 1, j), next: j + 1 };
      }
    }
    return { text: s.slice(i + 1), next: s.length };
  }
  if (s[i] === "\\") {
    let j = i + 1;
    if (j < s.length && /[a-zA-Z]/.test(s[j])) {
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      return { text: s.slice(i, j), next: j };
    }
    return { text: s.slice(i, j + 1), next: j + 1 };
  }
  return { text: s[i] ?? "", next: i + 1 };
}
function readParen(s, i) {
  i = skipWs(s, i);
  if (s[i] !== "(") return readArg(s, i);
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "(") depth++;
    else if (s[j] === ")") {
      depth--;
      if (depth === 0) return { text: s.slice(i + 1, j), next: j + 1 };
    }
  }
  return { text: s.slice(i + 1), next: s.length };
}
function joinParts(parts) {
  return parts.filter((p) => p !== "").join(" ").replace(/\s+/g, " ").trim();
}
function chargeWord(body) {
  const digits = /[0-9]+/.exec(body)?.[0] ?? "1";
  const sign = body.includes("-") ? "\u8D1F" : "\u6B63";
  return sign + " " + digits + " \u4EF7";
}
function renderChem(src) {
  const s = src.replace(/\s+/g, " ").trim();
  const parts = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") {
      i++;
      continue;
    }
    const arrow = CHEM_ARROWS.find(([token]) => s.startsWith(token, i));
    if (arrow) {
      parts.push(arrow[1]);
      i += arrow[0].length;
      continue;
    }
    const state = /^\((aq|s|l|g|v)\)/.exec(s.slice(i));
    if (state) {
      parts.push(CHEM_STATES[state[1]] ?? "");
      i += state[0].length;
      continue;
    }
    if (c === "^") {
      let j = i + 1;
      let body = "";
      if (s[j] === "{") {
        const a = readArg(s, j);
        body = a.text;
        j = a.next;
      } else {
        const m = /^[0-9+\-]+/.exec(s.slice(j));
        body = m ? m[0] : "";
        j += body.length;
      }
      if (/[+\-]/.test(body)) {
        parts.push(chargeWord(body));
        i = j;
        continue;
      }
      parts.push("\u6C14\u4F53");
      i++;
      continue;
    }
    if (c === "v" && !/[a-zA-Z]/.test(s[i + 1] ?? "")) {
      parts.push("\u6C89\u6DC0");
      i++;
      continue;
    }
    if (c === "_" || c === "{") {
      const a = readArg(s, c === "_" ? i + 1 : i);
      parts.push(renderChem(a.text));
      i = a.next;
      continue;
    }
    if (c === "}") {
      i++;
      continue;
    }
    if (c === "\\") {
      const m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
      if (m) {
        const n = m[1];
        if (n === "text" || n === "mathrm" || n === "mathit" || n === "mathbf" || n === "mathsf") {
          const a = readArg(s, i + m[0].length);
          parts.push(a.text.trim());
          i = a.next;
          continue;
        }
        if (n === "to" || n === "rightarrow" || n === "longrightarrow" || n === "leftarrow" || n === "longleftarrow") {
          parts.push("\u751F\u6210");
        } else if (n === "rightleftharpoons" || n === "leftrightharpoons") {
          parts.push("\u53EF\u9006\u751F\u6210");
        } else {
          parts.push(OPERATORS[n] ?? n);
        }
        i += m[0].length;
        continue;
      }
      i++;
      continue;
    }
    const el = /^[A-Z][a-z]?/.exec(s.slice(i));
    if (el) {
      parts.push(CHEM_ELEMENTS[el[0]] ?? el[0]);
      i += el[0].length;
      continue;
    }
    if (c === "+") {
      parts.push("\u52A0");
      i++;
      continue;
    }
    if (c === "=") {
      parts.push("\u7B49\u4E8E");
      i++;
      continue;
    }
    if (c === ".") {
      parts.push("\u70B9");
      i++;
      continue;
    }
    if (c === "*") {
      parts.push("\u4E58");
      i++;
      continue;
    }
    if (c === "~") {
      parts.push("\u7EA6");
      i++;
      continue;
    }
    if (c === "," || c === ";") {
      parts.push("\uFF0C");
      i++;
      continue;
    }
    const num = /^[0-9]+/.exec(s.slice(i));
    if (num) {
      parts.push(num[0]);
      i += num[0].length;
      continue;
    }
    parts.push(c);
    i++;
  }
  return joinParts(parts);
}
function renderUnit(src) {
  const s = src;
  const parts = [];
  const unitKeys = Object.keys(PU_UNITS).sort((a, b) => b.length - a.length);
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^[+\-]?[0-9]+(?:\.[0-9]+)?(?:[eE][+\-]?[0-9]+)?/.exec(s.slice(i));
    if (num) {
      parts.push(num[0]);
      i += num[0].length;
      continue;
    }
    if (c === "\\") {
      const m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
      if (m) {
        parts.push(OPERATORS[m[1]] ?? m[1]);
        i += m[0].length;
        continue;
      }
      i++;
      continue;
    }
    if (c === "/") {
      parts.push("\u6BCF");
      i++;
      continue;
    }
    if (c === "^") {
      const a = readArg(s, i + 1);
      parts.push("\u7684 " + renderUnit(a.text) + " \u6B21\u65B9");
      i = a.next;
      continue;
    }
    if (c === "*") {
      parts.push("\u4E58");
      i++;
      continue;
    }
    if (c === ".") {
      parts.push("\u70B9");
      i++;
      continue;
    }
    const unit = /^[A-Za-zµΩÅ°]+/.exec(s.slice(i));
    if (unit) {
      const hit = unitKeys.find((k) => s.startsWith(k, i));
      if (hit) {
        parts.push(PU_UNITS[hit]);
        i += hit.length;
      } else {
        parts.push(unit[0]);
        i += unit[0].length;
      }
      continue;
    }
    parts.push(c);
    i++;
  }
  return joinParts(parts);
}
function renderComplexity(tex) {
  const s = tex.replace(/\\(log|lg|ln)\b/g, " $1 ").replace(/\s+/g, " ").replace(/([A-Za-z0-9])\s+(?=(?:log|lg|ln)\b)/g, "$1 \\cdot ");
  return render(s).replace(/左括号|右括号|左方括号|右方括号|左花括号|右花括号/g, " ").replace(/\s+/g, " ").trim();
}
function render(s) {
  const parts = [];
  let buf = "";
  const flush = () => {
    if (buf) {
      parts.push(buf);
      buf = "";
    }
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") {
      let j = i + 1;
      if (j < s.length && /[a-zA-Z]/.test(s[j])) {
        while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
        const name2 = s.slice(i + 1, j);
        if (name2 === "frac" || name2 === "dfrac" || name2 === "tfrac") {
          flush();
          const a1 = readArg(s, j);
          const a2 = readArg(s, a1.next);
          parts.push(render(a2.text) + " \u5206\u4E4B " + render(a1.text));
          i = a2.next;
          continue;
        }
        if (name2 === "sqrt") {
          flush();
          const a = readArg(s, j);
          parts.push("\u6839\u53F7 " + render(a.text));
          i = a.next;
          continue;
        }
        if (name2 === "quad" || name2 === "qquad") {
          flush();
          i = j;
          continue;
        }
        if ((name2 === "Omega" || name2 === "omega" || name2 === "Theta" || name2 === "theta") && s[skipWs(s, j)] === "(") {
          flush();
          const a = readParen(s, skipWs(s, j));
          const label = name2 === "Omega" || name2 === "omega" ? "\u5927 Omega\uFF0C" : "\u5927 Theta\uFF0C";
          parts.push(label + (a.text.replace(/\s+/g, "") === "1" ? "\u5E38\u6570" : renderComplexity(a.text)));
          i = a.next;
          continue;
        }
        if (name2 === "text" || name2 === "mathrm" || name2 === "operatorname" || name2 === "mbox" || name2 === "mathbb" || name2 === "mathcal" || name2 === "mathbf" || name2 === "mathsf" || name2 === "mathtt") {
          flush();
          const a = readArg(s, j);
          parts.push(a.text.trim());
          i = a.next;
          continue;
        }
        if (name2 === "ce") {
          flush();
          const a = readArg(s, j);
          parts.push(renderChem(a.text));
          i = a.next;
          continue;
        }
        if (name2 === "pu") {
          flush();
          const a = readArg(s, j);
          parts.push(renderUnit(a.text));
          i = a.next;
          continue;
        }
        const word = FUNCS[name2] ?? GREEK[name2] ?? OPERATORS[name2];
        flush();
        if (word !== void 0) parts.push(word);
        else parts.push(name2);
        i = j;
        continue;
      }
      const ch = s[j] ?? "";
      flush();
      if (ch === " ") {
        i = j + 1;
        continue;
      }
      parts.push(ESCAPED["\\" + ch] ?? ch);
      i = j + 1;
      continue;
    }
    if (c === "^" || c === "_") {
      flush();
      const a = readArg(s, i + 1);
      const inner = render(a.text);
      if (c === "^") {
        if (inner === "2") parts.push("\u7684\u5E73\u65B9");
        else if (inner === "3") parts.push("\u7684\u7ACB\u65B9");
        else parts.push("\u7684 " + inner + " \u6B21\u65B9");
      } else {
        parts.push("\u4E0B\u6807 " + inner);
      }
      i = a.next;
      continue;
    }
    if (c === "{" || c === "}") {
      flush();
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      flush();
      i++;
      continue;
    }
    if ((c === "O" || c === "o") && s[skipWs(s, i + 1)] === "(") {
      flush();
      const a = readParen(s, skipWs(s, i + 1));
      const inner = a.text.replace(/\s+/g, "") === "1" ? "\u5E38\u6570" : renderComplexity(a.text);
      parts.push((c === "O" ? "\u5927 O\uFF0C" : "\u5C0F o\uFF0C") + inner);
      i = a.next;
      continue;
    }
    const sym = SYMBOLS[c];
    if (sym !== void 0) {
      flush();
      if (sym) parts.push(sym);
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  flush();
  return joinParts(parts);
}
function latexToSpeech(tex) {
  if (!tex || !tex.trim()) return "";
  try {
    return render(tex);
  } catch {
    return tex.replace(/[\\{}]/g, " ").replace(/\s+/g, " ").trim();
  }
}

// src/speech-adapter.ts
var DEFAULT_BLOCK_PAUSE_MS = 350;
var DEFAULT_CONTEXT_CAP = 800;
var MIN_CONTEXT_CHARS = 120;
var CONTEXT_GROWTH = 4;
var CONTEXT_BASE = 120;
var KEEP_PROSE_CHARS = 4e3;
var MAX_SYMBOLS = 24;
function contextBudget(segmentChars, cap) {
  const limit = cap === void 0 ? DEFAULT_CONTEXT_CAP : cap;
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  const n = Number.isFinite(segmentChars) && segmentChars > 0 ? segmentChars : 0;
  const want = Math.max(MIN_CONTEXT_CHARS, Math.round(n * CONTEXT_GROWTH + CONTEXT_BASE));
  return Math.min(limit, want);
}
function trimContext(text5, budget) {
  if (!text5 || !Number.isFinite(budget) || budget <= 0) return "";
  if (text5.length <= budget) return text5;
  const cut = text5.slice(text5.length - budget);
  const idx = cut.search(/[。！？!?；;…\n]/);
  const body = idx >= 0 ? cut.slice(idx + 1) : cut;
  return body.trim() || cut.trim();
}
function codeFallback(seg) {
  const lang = seg.meta && seg.meta.lang ? "\uFF08" + seg.meta.lang + "\uFF09" : "";
  const lines = seg.text ? seg.text.split("\n").length : 0;
  return "\u4EE3\u7801\u5757" + lang + "\uFF0C\u5171 " + lines + " \u884C\u3002";
}
function tableFallback(seg) {
  const rows = seg.meta && seg.meta.rows ? seg.meta.rows : [];
  const headers = rows[0] ? rows[0].join("\u3001") : "";
  const rowCount = seg.meta && seg.meta.rowCount !== void 0 ? seg.meta.rowCount : rows.length;
  const colCount = seg.meta && seg.meta.colCount !== void 0 ? seg.meta.colCount : 0;
  const head = "\u8868\u683C\uFF1A" + rowCount + " \u884C " + colCount + " \u5217\u3002\u5217\u540D\uFF1A" + headers + "\u3002";
  const names = rows.slice(1).map((r) => r[0] ? r[0].trim() : "").filter((v) => v);
  return names.length ? head + "\u884C\u540D\uFF1A" + names.slice(0, 12).join("\u3001") + "\u3002" : head;
}
var SYMBOL_DEF_RE = /([A-Za-z])\s*(?:表示|代表|意为|指的是)\s*([\u4e00-\u9fff]{2,10})/g;
function splitSegmentSentences(group) {
  const out = [];
  let cur = [];
  for (const seg of group) {
    if (seg.kind !== "prose") {
      cur.push(seg);
      continue;
    }
    const text5 = seg.text;
    const re = /[。！？!?；;…\n]+/g;
    let start = 0;
    let m;
    while ((m = re.exec(text5)) !== null) {
      const end = m.index + m[0].length;
      cur.push({ kind: "prose", text: text5.slice(start, end) });
      out.push(cur);
      cur = [];
      start = end;
    }
    if (start < text5.length) cur.push({ kind: "prose", text: text5.slice(start) });
  }
  if (cur.length) out.push(cur);
  return out;
}
var SpeechAdapter = class {
  constructor(opts) {
    this.opts = opts;
    this.segmenter = new SentenceSegmenter({ fixes: () => this.opts.config().pronunciation ?? [] });
  }
  router = new BlockRouter();
  segmenter;
  chain = Promise.resolve();
  /** 最近正文（原文，未加标点处理）。 */
  recent = [];
  /** 本回合已确认的符号含义。 */
  symbols = /* @__PURE__ */ new Map();
  /** 待兑现的停顿：下一个成句起播前插入（段落/标题边界）。 */
  pendingPauseMs = 0;
  /** 喂入一个 text-delta。关闭改编站时退化为原路径（同步，无异步链）。 */
  feed(delta) {
    if (!delta) return;
    if (!this.opts.config().enabled) {
      for (const s of this.segmenter.feed(delta)) this.opts.onSentence(s);
      return;
    }
    this.consume(this.router.feed(delta));
  }
  /** 流结束：处理未闭合结构块，并冲刷残余句子。 */
  flush() {
    if (this.opts.config().enabled) {
      this.consume(this.router.flush());
    }
    this.run(() => {
      for (const s of this.segmenter.flush()) this.opts.onSentence(s, this.takePause());
    });
  }
  /** 等待链上所有异步改写完成（收尾/测试用）。 */
  whenIdle() {
    return this.chain;
  }
  /** 当前上下文快照（只含非空字段）；segmentChars 决定动态前文预算。 */
  context(segmentChars) {
    const ctx = {};
    const before = this.beforeContext(segmentChars);
    if (before) ctx.before = before;
    const symbols = [...this.symbols.entries()].map(([sym, meaning]) => ({ sym, meaning })).slice(-12);
    if (symbols.length) ctx.symbols = symbols;
    return ctx;
  }
  /** 把一个块内的片段按 pause 分组，再按句处理。 */
  consume(segs) {
    let group = [];
    const flushGroup = () => {
      if (group.length) {
        this.handleGroup(group);
        group = [];
      }
    };
    for (const seg of segs) {
      if (seg.kind === "pause") {
        flushGroup();
        this.schedule(seg);
      } else {
        group.push(seg);
      }
    }
    flushGroup();
  }
  /**
   * 一个块内的片段：含行内公式时按"整句"交给模型（正文不再单独念，根治重复朗读），
   * 不含公式的句子仍走原来的片段路径（不产生额外请求）。
   */
  handleGroup(group) {
    const cfg = this.opts.config();
    const wholeSentence = cfg.wholeSentenceMath !== false && cfg.mathMode === "model" && cfg.rewriter !== null;
    if (!wholeSentence || !group.some((s) => s.kind === "inline-math")) {
      for (const seg of group) this.schedule(seg);
      return;
    }
    for (const sent of splitSegmentSentences(group)) {
      const hasMath = sent.some((s) => s.kind === "inline-math");
      const hasProse = sent.some((s) => s.kind === "prose" && s.text.trim() !== "");
      if (hasMath && hasProse) this.scheduleSentence(sent);
      else for (const seg of sent) this.schedule(seg);
    }
  }
  /** 整句（含行内公式）交给改写器：模型返回整句口播稿，失败则回退逐片段原路径。 */
  scheduleSentence(sent) {
    this.run(async () => {
      const cfg = this.opts.config();
      const raw = sent.map((s) => s.kind === "inline-math" ? "$" + s.text + "$" : s.text).join("");
      const text5 = raw.replace(/\s+/g, " ").trim();
      if (!text5) return;
      const r = cfg.rewriter ? await cfg.rewriter.rewrite({
        kind: "sentence",
        text: text5,
        meta: { sentence: text5 },
        context: this.context(text5.length)
      }) : null;
      if (r) {
        for (const s of sent) if (s.kind === "prose") this.rememberProse(s.text);
        if (r.symbols) this.learnSymbols(r.symbols);
        this.emit(r.text);
        return;
      }
      for (const seg of sent) await this.handle(seg);
    });
  }
  schedule(seg) {
    this.run(() => this.handle(seg));
  }
  run(task) {
    this.chain = this.chain.then(task).catch(() => void 0);
  }
  async handle(seg) {
    const cfg = this.opts.config();
    switch (seg.kind) {
      case "pause": {
        for (const s of this.segmenter.flush()) this.opts.onSentence(s);
        const base = cfg.blockPauseMs === void 0 ? DEFAULT_BLOCK_PAUSE_MS : cfg.blockPauseMs;
        if (base > 0) {
          const factor = seg.meta && seg.meta.pauseLevel === "heading" ? 1.6 : 1;
          this.pendingPauseMs = Math.max(this.pendingPauseMs, Math.round(base * factor));
        }
        return;
      }
      case "prose":
        this.rememberProse(seg.text);
        this.emit(seg.text);
        return;
      case "inline-code":
      case "footnote-ref":
      case "footnote-def":
        this.emit(seg.text);
        return;
      case "inline-math":
        if (cfg.mathMode === "model") {
          const r = cfg.rewriter ? await cfg.rewriter.rewrite({
            kind: "inline-math",
            text: seg.text,
            meta: seg.meta,
            context: this.context(seg.text.length)
          }) : null;
          if (r && r.symbols) this.learnSymbols(r.symbols);
          this.emit(r ? r.text : latexToSpeech(seg.text));
        } else if (cfg.mathMode === "verbatim") {
          this.emit(seg.text);
        } else {
          this.emit(latexToSpeech(seg.text));
        }
        return;
      case "display-math":
        if (cfg.mathMode === "verbatim") this.emit(seg.text);
        else if (cfg.mathMode === "rules") this.emit(latexToSpeech(seg.text));
        else await this.rewriteOrFallback(seg, latexToSpeech(seg.text));
        return;
      case "code":
        await this.rewriteOrFallback(seg, codeFallback(seg));
        return;
      case "table":
        await this.rewriteOrFallback(seg, tableFallback(seg));
        return;
      default:
        return;
    }
  }
  async rewriteOrFallback(seg, fallback) {
    const cfg = this.opts.config();
    const kind = seg.kind;
    const r = cfg.rewriter ? await cfg.rewriter.rewrite({ kind, text: seg.text, meta: seg.meta, context: this.context(seg.text.length) }) : null;
    if (r && r.symbols) this.learnSymbols(r.symbols);
    this.emit(r ? r.text : fallback);
  }
  emit(text5) {
    if (!text5 || !text5.trim()) return;
    for (const s of this.segmenter.feed(text5)) this.opts.onSentence(s, this.takePause());
  }
  takePause() {
    const ms = this.pendingPauseMs;
    this.pendingPauseMs = 0;
    return ms;
  }
  /** 记入前文（只收正文；超上限时丢最旧的）。 */
  rememberProse(text5) {
    const t = String(text5).trim();
    if (!t) return;
    this.recent.push(t);
    this.extractSymbolDefs(t);
    let total = this.recent.reduce((n, s) => n + s.length, 0);
    while (this.recent.length > 1 && total > KEEP_PROSE_CHARS) {
      const dropped = this.recent.shift();
      total -= dropped ? dropped.length : 0;
    }
  }
  /** 前文 = 最近正文的尾部，长度由动态预算决定；上限 <= 0 时关闭。 */
  beforeContext(segmentChars) {
    const budget = contextBudget(segmentChars, this.opts.config().contextChars);
    if (budget <= 0) return "";
    return trimContext(this.recent.join(""), budget);
  }
  /** 从正文抽取显式符号定义（宁可漏，不可猜）。 */
  extractSymbolDefs(text5) {
    SYMBOL_DEF_RE.lastIndex = 0;
    let m;
    while ((m = SYMBOL_DEF_RE.exec(text5)) !== null) {
      this.putSymbol(m[1], m[2]);
    }
  }
  /** 吸收改写模型回传的符号含义。 */
  learnSymbols(symbols) {
    for (const s of symbols) this.putSymbol(s.sym, s.meaning);
  }
  putSymbol(sym, meaning) {
    const s = String(sym).trim();
    const m = String(meaning).trim();
    if (!s || !m) return;
    if (this.symbols.has(s)) this.symbols.delete(s);
    this.symbols.set(s, m);
    while (this.symbols.size > MAX_SYMBOLS) {
      const oldest = this.symbols.keys().next().value;
      if (oldest === void 0) break;
      this.symbols.delete(oldest);
    }
  }
};

// src/rewriter.ts
var GUARD_PROFILES = {
  // 放宽：只拦最明显的失控/照抄
  lenient: { lengthFactor: 4, lengthBase: 80, echoRatio: 0.85, prefixEcho: false, sentenceEchoRatio: 0.9 },
  standard: { lengthFactor: 3, lengthBase: 60, echoRatio: 0.6, prefixEcho: true, sentenceEchoRatio: 0.7 },
  // 收紧：宁可回退也不放行可疑输出
  strict: { lengthFactor: 2, lengthBase: 30, echoRatio: 0.5, prefixEcho: true, sentenceEchoRatio: 0.5 }
};
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function parseGuardAllow(raw) {
  const speech = [];
  const segment = [];
  const errors = [];
  const lines = String(raw ?? "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    let target = "speech";
    if (line.startsWith("seg:")) {
      target = "segment";
      line = line.slice(4).trim();
    }
    if (!line) continue;
    const m = /^\/(.+)\/([a-z]*)$/.exec(line);
    let re;
    try {
      if (m) {
        const flags = m[2].includes("g") ? m[2] : m[2] + "g";
        re = new RegExp(m[1], flags);
      } else {
        re = new RegExp(escapeRegExp(line), "g");
      }
    } catch (e) {
      errors.push("\u7B2C " + (i + 1) + " \u884C\u89C4\u5219\u4E0D\u5408\u6CD5\uFF08" + (e instanceof Error ? e.message : String(e)) + "\uFF09\uFF1A" + lines[i].trim());
      continue;
    }
    ;
    (target === "segment" ? segment : speech).push(re);
  }
  return { speech, segment, errors };
}
function anyMatch(rules, text5) {
  for (const re of rules) {
    re.lastIndex = 0;
    if (re.test(text5)) return true;
  }
  return false;
}
var PROMPT_VERSION = "sp10";
var KIND_INSTRUCTIONS = {
  "display-math": "\u8FD9\u662F\u72EC\u7ACB\u5C55\u793A\u7684\u6570\u5B66\u516C\u5F0F\u3002\u7528\u4E00\u4E24\u53E5\u8BDD\u8BF4\u660E\u5B83\u8868\u8FBE\u7684\u5173\u7CFB\uFF08\u67D0\u4E2A\u91CF\u7B49\u4E8E\u4EC0\u4E48\u3001\u968F\u4EC0\u4E48\u53D8\u5316\uFF09\uFF1B\u53EA\u6709\u5728\u542B\u4E49\u786E\u5B9E\u4E0D\u660E\u663E\u65F6\u624D\u7B80\u8981\u63D0\u5230\u5173\u952E\u7B26\u53F7\uFF0C\u4E0D\u8981\u9010\u4E2A\u7F57\u5217\u7B26\u53F7\u542B\u4E49\uFF0C\u4E5F\u4E0D\u8981\u5C55\u5F00\u63A8\u5BFC\u3002",
  "inline-math": "\u8FD9\u662F\u53E5\u5B50\u4E2D\u7684\u884C\u5185\u516C\u5F0F\u3002\u53EA\u628A\u5B83\u5FF5\u6210\u901A\u987A\u7684\u4E2D\u6587\u77ED\u8BED\uFF08\u4F8B\u5982\u300C\u4E8C\u5206\u4E4B\u4E00 m v \u5E73\u65B9\u300D\u300Cv \u7B49\u4E8E v \u96F6\u52A0 a t\u300D\uFF09\uFF0C\u4E0D\u8981\u5C55\u5F00\u89E3\u91CA\uFF0C\u4E0D\u8981\u8865\u5145\u5B9A\u4E49\uFF0C\u4E0D\u8981\u52A0\u63A8\u5BFC\u3002",
  sentence: "\u8FD9\u662F\u4E00\u6BB5\u542B\u884C\u5185\u516C\u5F0F\u7684\u6B63\u6587\uFF08\u53EF\u80FD\u662F\u4E00\u6574\u53E5\uFF0C\u4E5F\u53EF\u80FD\u53EA\u662F\u534A\u53E5\u2014\u2014\u540E\u9762\u7D27\u8DDF\u72EC\u7ACB\u5C55\u793A\u516C\u5F0F\uFF09\u3002\u8BF7\u8F93\u51FA\u8FD9\u6BB5\u7684\u53E3\u64AD\u7A3F\uFF1A\u516C\u5F0F\u6309\u8BFB\u6CD5\u89C4\u5219\u5FF5\u6210\u4E2D\u6587\uFF0C\u5176\u4F59\u6587\u5B57\u4FDD\u6301\u539F\u610F\u4E0E\u987A\u5E8F\uFF1B\u4E0D\u8981\u6982\u62EC\u3001\u4E0D\u8981\u589E\u5220\u3001\u4E0D\u8981\u91CD\u590D\uFF0C\u4E5F\u4E0D\u8981\u64C5\u81EA\u8865\u5168\u53E5\u5B50\u3002",
  code: "\u8FD9\u662F\u4EE3\u7801\u7247\u6BB5\u3002\u7528\u4E00\u4E24\u53E5\u8BDD\u6982\u62EC\u5B83\u7684\u4F5C\u7528\u4E0E\u5173\u952E\u6B65\u9AA4\uFF1B\u4E0D\u8981\u9010\u884C\u6717\u8BFB\uFF0C\u4E5F\u4E0D\u8981\u5FF5\u51FA\u6574\u6BB5\u4EE3\u7801\uFF1B\u53D8\u91CF\u540D\u4E0E\u5173\u952E\u6570\u5B57\u8981\u4FDD\u7559\u3002",
  table: "\u8FD9\u662F\u8868\u683C\u3002\u5148\u7528\u4E00\u53E5\u8BDD\u6982\u62EC\u6574\u5F20\u8868\u8868\u8FBE\u7684\u5185\u5BB9\uFF0C\u518D\u7528\u81EA\u7136\u53E3\u8BED\u8F6C\u8FF0\u5173\u952E\u5217\u540D\u4E0E\u6570\u503C\uFF0C\u6570\u5B57\u5FC5\u987B\u51C6\u786E\u3002\u8868\u91CC\u7684\u516C\u5F0F\u4E0E\u590D\u6742\u5EA6\u8BB0\u53F7\u4E00\u5F8B\u6309\u8BFB\u6CD5\u89C4\u5219\u5FF5\u6210\u4E2D\u6587\uFF08O(n^2) \u8BFB\u300C\u5927 O\uFF0Cn \u7684\u5E73\u65B9\u300D\uFF09\uFF0C\u4E0D\u8981\u4FDD\u7559\u82F1\u6587\u62EC\u53F7\u8BB0\u53F7\u3002"
};
var SYSTEM_PROMPT = [
  "\u4F60\u662F\u8BED\u97F3\u6717\u8BFB\u7A3F\u6539\u5199\u5668\uFF0C\u628A Markdown \u7247\u6BB5\u6539\u5199\u6210\u9002\u5408 TTS \u9010\u53E5\u6717\u8BFB\u7684\u53E3\u64AD\u7A3F\u3002",
  "",
  "\u4E00\u3001\u8F93\u5165\u662F\u4E00\u4E2A JSON \u5BF9\u8C61\uFF1Atask \u662F\u672C\u6B21\u6539\u5199\u8981\u6C42\uFF1Bcontext.before \u662F\u6700\u8FD1\u5DF2\u6717\u8BFB\u7684\u6B63\u6587\uFF1B",
  "context.symbols \u662F\u5DF2\u786E\u8BA4\u7684\u7B26\u53F7\u542B\u4E49\uFF08sym \u7B26\u53F7 / meaning \u4E2D\u6587\u542B\u4E49\uFF09\uFF1B",
  "segment \u662F\u5F85\u6539\u5199\u7247\u6BB5\uFF08type / text / sentence \u6240\u5728\u6574\u53E5\u539F\u6587 / \u53EF\u9009 lang\u3001rows\uFF09\u3002",
  "",
  "\u4E8C\u3001\u6700\u9AD8\u4F18\u5148\u89C4\u5219\uFF1A",
  "1. context \u53EA\u4F9B\u7406\u89E3\u8BED\u5883\uFF1A\u4E0D\u8981\u6717\u8BFB\u5B83\u3001\u4E0D\u8981\u7FFB\u8BD1\u5B83\u3001\u4E0D\u8981\u590D\u8FF0\u5B83\u3001\u4E0D\u8981\u628A\u5B83\u5199\u8FDB\u8F93\u51FA\uFF1B\u4F60\u53EA\u6539\u5199 segment\u3002",
  "2. context.symbols \u7ED9\u51FA\u7684\u7B26\u53F7\u542B\u4E49\u662F\u6743\u5A01\u7ED3\u8BBA\uFF1A\u4E00\u5F8B\u7167\u7528\uFF0C\u4E0D\u8981\u518D\u81EA\u884C\u63A8\u65AD\u6216\u66F4\u6539\u3002",
  '3. \u53EA\u8F93\u51FA\u4E00\u4E2A JSON \u5BF9\u8C61\uFF1A{"speech":"<\u53E3\u64AD\u7A3F>","symbols":[{"sym":"<\u7B26\u53F7>","meaning":"<\u4E2D\u6587\u542B\u4E49>"}]}\uFF1B',
  "\u9664\u5B83\u4EE5\u5916\u4E0D\u8981\u8F93\u51FA\u4EFB\u4F55\u5B57\u7B26\uFF08\u4E0D\u8981 Markdown \u56F4\u680F\u3001\u4E0D\u8981\u89E3\u91CA\u3001\u4E0D\u8981\u524D\u540E\u7F00\uFF09\u3002",
  "4. \u4E25\u7981\u5728 speech \u91CC\u51FA\u73B0 task\u3001context\u3001before\u3001symbols\u3001segment\u3001speech \u8FD9\u4E9B\u5B57\u6BB5\u540D\uFF0C\u4E5F\u4E0D\u8981\u590D\u8FF0\u4E0A\u9762\u7684\u8BF4\u660E\u6587\u5B57\u3002",
  "5. symbols \u53EF\u9009\uFF1A\u53EA\u5217\u672C\u7247\u6BB5\u4E2D\u65B0\u786E\u8BA4\u542B\u4E49\u7684\u7B26\u53F7\uFF08\u6700\u591A 6 \u4E2A\uFF0Cmeaning \u7528\u7B80\u77ED\u4E2D\u6587\uFF09\uFF0C\u6CA1\u6709\u5C31\u7701\u7565\u8BE5\u5B57\u6BB5\u3002",
  "",
  "\u4E09\u3001speech \u7684\u5199\u6CD5\uFF1A",
  "6. \u7EAF\u6587\u672C\uFF1B\u4E0D\u8981 Markdown \u7B26\u53F7\u6216\u4EE3\u7801\u56F4\u680F\uFF1B\u4E0D\u8981\u51FA\u73B0 LaTeX/TeX \u8BB0\u53F7\u4E0E\u6570\u5B66\u6392\u7248\u7B26\u53F7",
  "\uFF08\u53CD\u659C\u6760\u547D\u4EE4\u3001\u4E0B\u5212\u7EBF\u3001\u82B1\u62EC\u53F7\u3001\u5C16\u62EC\u53F7\u3001^\u3001$\u3001\u7AD6\u7EBF\uFF09\uFF0C\u6570\u5B66\u5173\u7CFB\u7528\u81EA\u7136\u8BED\u8A00\u8868\u8FBE\u3002",
  "7. \u4E0E segment \u540C\u8BED\u8A00\uFF0C\u4E0D\u7FFB\u8BD1\uFF1B\u4FDD\u7559\u5176\u4E2D\u7684\u6570\u5B57\u4E0E\u53D8\u91CF\u540D\u3002",
  "8. \u6309\u7C7B\u578B\u5904\u7406\uFF1A\u5C55\u793A\u516C\u5F0F\u7528\u4E00\u4E24\u53E5\u8BDD\u8BF4\u660E\u5B83\u8868\u8FBE\u7684\u5173\u7CFB\uFF1B\u884C\u5185\u516C\u5F0F\u53EA\u5FF5\u6210\u901A\u987A\u7684\u4E2D\u6587\u77ED\u8BED\uFF1B",
  "\u4EE3\u7801\u6982\u62EC\u4F5C\u7528\u4E0E\u5173\u952E\u6B65\u9AA4\uFF0C\u4E0D\u9010\u884C\u5FF5\uFF1B\u8868\u683C\u5148\u6982\u62EC\u5185\u5BB9\uFF0C\u518D\u8F6C\u8FF0\u5173\u952E\u5217\u540D\u4E0E\u6570\u503C\u3002",
  "9. \u4E0D\u5C55\u5F00\u63A8\u5BFC\uFF0C\u4E0D\u9010\u4E2A\u7F57\u5217\u7B26\u53F7\u542B\u4E49\uFF0C\u4E0D\u52A0\u89E3\u91CA\u3001\u6807\u9898\u6216\u524D\u540E\u7F00\u3002",
  "",
  "\u56DB\u3001\u7B26\u53F7\u4E0E\u7B97\u5F0F\u8BFB\u6CD5\uFF08\u6309 2 \u2192 10 \u2192 11 \u2192 12 \u7684\u987A\u5E8F\u56DE\u9000\uFF0C\u524D\u9762\u7684\u4F18\u5148\uFF09\uFF1A",
  "10. \u4EE5 context.symbols \u4E3A\u51C6\u3002",
  "11. \u5176\u6B21\u6309\u5E38\u89C1\u5B66\u79D1\u7684\u901A\u7528\u542B\u4E49\u8BFB\uFF1A",
  "\u6570\u5B66\uFF1A\u03A3 \u6C42\u548C\u3001\u222B \u79EF\u5206\u3001\u221A \u5E73\u65B9\u6839\u3001\u03C0 \u5706\u5468\u7387\u3001\u221E \u65E0\u7A77\u3001\u0394 \u589E\u91CF\u3001\u2202 \u504F\u5BFC\u3001lim \u6781\u9650\u3001\u2208 \u5C5E\u4E8E\u3001",
  "\u2264 \u5C0F\u4E8E\u7B49\u4E8E\u3001\u2265 \u5927\u4E8E\u7B49\u4E8E\u3001\u2248 \u7EA6\u7B49\u4E8E\u3001a \u7684 n \u6B21\u65B9\u3001a \u4E0B\u6807 n\u3001n \u5206\u4E4B\u4E00\u3002",
  "\u7269\u7406\uFF1Ag \u91CD\u529B\u52A0\u901F\u5EA6\u3001m \u8D28\u91CF\u3001v \u901F\u5EA6\u3001a \u52A0\u901F\u5EA6\u3001t \u65F6\u95F4\u3001s \u4F4D\u79FB\u6216\u5F27\u957F\u3001E \u80FD\u91CF\u3001T \u5468\u671F\u3001F \u529B\u3001",
  "x \u6A2A\u5750\u6807\u3001y \u7EB5\u5750\u6807\u3001\u03C9 \u89D2\u901F\u5EA6\u3001\u03BB \u6CE2\u957F\u3001f \u9891\u7387\u3001R \u7535\u963B\u6216\u534A\u5F84\u3001C \u7535\u5BB9\u3001L \u7535\u611F\u3001V \u7535\u538B\u3001I \u7535\u6D41\u3001",
  "P \u529F\u7387\u3001p \u538B\u5F3A\u3001\u03C1 \u5BC6\u5EA6\u3001\u03B8 \u89D2\u5EA6\u3001\u03BC \u6469\u64E6\u7CFB\u6570\u3001c \u5149\u901F\u3002",
  "\u5316\u5B66\u3001\u751F\u7269\u3001\u7EDF\u8BA1\u3001\u7ECF\u6D4E\u7B49\u5176\u5B83\u5B66\u79D1\u540C\u7406\uFF0C\u6309\u8BE5\u9886\u57DF\u6700\u5E38\u89C1\u7684\u542B\u4E49\u8BFB\u3002",
  "12. \u90FD\u65E0\u6CD5\u5224\u65AD\u65F6\u8BFB\u300C\u5B57\u6BCD X\u300D\uFF08\u4F8B\u5982\u300C\u5B57\u6BCD q\u300D\uFF09\uFF0C\u4E0D\u8981\u7559\u88F8\u5B57\u6BCD\u3002",
  "13. \u7EDD\u4E0D\u80FD\u628A\u5B57\u6BCD\u8BFB\u6210\u8BA1\u91CF\u5355\u4F4D\uFF1Ag \u4E0D\u8BFB\u514B\u3001m \u4E0D\u8BFB\u7C73\u3001s \u4E0D\u8BFB\u79D2\u3001t \u4E0D\u8BFB\u5428\u3002",
  "14. \u7B97\u5F0F\u8BFB\u6CD5\uFF1A\u5206\u6570\u8BFB\u300C\u4E8C\u5206\u4E4B\u4E00\u300D\uFF1Ba \u7684\u5E73\u65B9\u3001a \u7684\u7ACB\u65B9\uFF1Ba \u4E0B\u6807 n\uFF1B\u767E\u5206\u6570\u8BFB\u300C\u767E\u5206\u4E4B\u2026\u300D\uFF1B",
  "\u533A\u95F4\u8BFB\u300Ca \u5230 b\u300D\uFF1B\u4E0D\u7B49\u5F0F\u8BFB\u300C\u5927\u4E8E\u7B49\u4E8E a \u5C0F\u4E8E\u7B49\u4E8E b\u300D\u3002",
  "",
  "\u4E94\u3001\u6D88\u6B67\u4F18\u5148\u7528 segment.sentence\uFF08\u7247\u6BB5\u6240\u5728\u6574\u53E5\u7684\u539F\u6587\uFF0C\u6700\u53EF\u9760\uFF09\uFF0C\u5176\u6B21 context.before\uFF1A",
  "15. \u7BAD\u5934\uFF1A\u6781\u9650\u8BED\u5883\uFF08lim\u3001\u8D8B\u4E8E\u3001\u8D8B\u8FD1\u3001n \u8D8B\u4E8E\u65E0\u7A77\uFF09\u8BFB\u300C\u8D8B\u5411\u4E8E\u300D\uFF1B\u51FD\u6570\u6216\u6620\u5C04\u7684\u5B9A\u4E49\u5904",
  "\uFF08f: A \u2192 B\u3001\u6620\u5C04\u3001\u5B9A\u4E49\u57DF\u3001\u503C\u57DF\uFF09\u8BFB\u300C\u4ECE A \u5230 B \u7684\u6620\u5C04\u300D\uFF1B\u547D\u9898\u903B\u8F91\u8BFB\u300C\u8574\u542B\u300D\uFF1B",
  "\u5E8F\u5217\u6216\u53D8\u6362\u8BFB\u300C\u53D8\u6362\u4E3A\u300D\uFF1B\u5224\u65AD\u4E0D\u4E86\u5C31\u8BFB\u300C\u5230\u300D\u3002",
  "16. \u62EC\u53F7\uFF1A\u5728\u53D6\u503C\u8303\u56F4\u3001\u5B9A\u4E49\u57DF\u3001\u4E0D\u7B49\u5F0F\u8BED\u5883\uFF0C(a, b) \u8BFB\u300C\u5F00\u533A\u95F4 a \u5230 b\u300D\uFF0C[a, b] \u8BFB\u300C\u95ED\u533A\u95F4 a \u5230 b\u300D\uFF0C",
  "(a, b] \u8BFB\u300C\u5DE6\u5F00\u53F3\u95ED\u533A\u95F4 a \u5230 b\u300D\uFF0C[a, b) \u8BFB\u300C\u5DE6\u95ED\u53F3\u5F00\u533A\u95F4 a \u5230 b\u300D\uFF1B\u5728\u5750\u6807\u6216\u6709\u5E8F\u5BF9\u8BED\u5883\u8BFB\u300C\u70B9 a b\u300D\uFF1B",
  "f(x) \u8BFB\u300Cf \u5728 x \u5904\u7684\u503C\u300D\u6216\u300Cf x\u300D\uFF1B\u7EC4\u5408\u6570 (n k) \u8BFB\u300Cn \u9009 k\u300D\u3002\u4E0D\u8981\u4E00\u5F8B\u8BFB\u6210\u300C\u70B9\u300D\u3002",
  "17. \u5176\u5B83\u6613\u6DF7\u8BB0\u53F7\uFF1A\xB7 \u70B9\u4E58\uFF1B\xD7 \u4E58\u6216\u53C9\u4E58\uFF1B\u2218 \u590D\u5408\uFF1B\u2208 \u5C5E\u4E8E\uFF1B\u2282 \u5305\u542B\u4E8E\uFF1B\u222A \u5E76\u96C6\uFF1B\u2229 \u4EA4\u96C6\uFF1B\u2205 \u7A7A\u96C6\uFF1B",
  "\u2200 \u4EFB\u610F\uFF1B\u2203 \u5B58\u5728\uFF1B\u2211 \u6C42\u548C\uFF1B\u220F \u8FDE\u4E58\uFF1B\u222B \u79EF\u5206\uFF1B\u2202 \u504F\u5BFC\uFF1B\u2207 \u68AF\u5EA6\uFF1B\u2261 \u6052\u7B49\u4E8E\uFF1B\u2245 \u540C\u6784\uFF1B\u2248 \u7EA6\u7B49\u4E8E\uFF1B",
  "\u2260 \u4E0D\u7B49\u4E8E\uFF1B! \u9636\u4E58\uFF1B|a| \u7EDD\u5BF9\u503C\uFF1BP(A|B) \u5728 B \u53D1\u751F\u7684\u6761\u4EF6\u4E0B A \u7684\u6982\u7387\u3002",
  "18. \u540C\u4E00\u7B26\u53F7\u5728\u4E0D\u540C\u8BED\u5883\u542B\u4E49\u4E0D\u540C\uFF08s \u79D2\u6216\u4F4D\u79FB\u3001T \u5468\u671F\u6216\u6E29\u5EA6\u3001R \u7535\u963B\u6216\u534A\u5F84\uFF09\uFF0C",
  "\u4E00\u5F8B\u4EE5 segment.sentence \u4E0E context.symbols \u4E3A\u51C6\uFF0C\u4E0D\u8981\u53EA\u6309\u9ED8\u8BA4\u542B\u4E49\u5FF5\u3002",
  "",
  "\u516D\u3001\u6E10\u8FD1\u590D\u6742\u5EA6\uFF0C\u4EE5\u53CA\u884C\u5185\u516C\u5F0F\u7684\u8FB9\u754C\uFF1A",
  "19. O(...) \u8BFB\u300C\u5927 O\uFF0C\u2026\u300D\uFF1AO(n^2) \u8BFB\u300C\u5927 O\uFF0Cn \u7684\u5E73\u65B9\u300D\uFF0CO(n) \u8BFB\u300C\u5927 O\uFF0Cn\u300D\uFF0C",
  "O(n log n) \u8BFB\u300C\u5927 O\uFF0Cn \u4E58 log n\u300D\uFF08log \u8BFB\u82F1\u6587\u5355\u8BCD\uFF0C\u4E0D\u8981\u62C6\u6210\u5B57\u6BCD\uFF09\uFF0CO(1) \u8BFB\u300C\u5927 O\uFF0C\u5E38\u6570\u300D\uFF0C",
  "O(n log k) \u8BFB\u300C\u5927 O\uFF0Cn \u4E58 log k\u300D\u3002\u03A9(...) \u8BFB\u300C\u5927 Omega\uFF0C\u2026\u300D\uFF0C\u0398(...) \u8BFB\u300C\u5927 Theta\uFF0C\u2026\u300D\u3002",
  "\u5176\u5B83\u5E38\u89C1\u8BB0\u53F7\uFF1An! \u8BFB\u300Cn \u7684\u9636\u4E58\u300D\uFF1B\u4EE5 2 \u4E3A\u5E95 n \u7684\u5BF9\u6570\u8BFB\u300C\u4EE5 2 \u4E3A\u5E95 n \u7684\u5BF9\u6570\u300D\uFF1B",
  "\u504F\u5BFC\u6570\u8BFB\u300CQ \u5BF9 x \u7684\u504F\u5BFC\u300D\uFF1B\u9762\u79EF\u5143\u8BFB\u300C\u9762\u79EF\u5143\u300D\uFF1B\u5E26\u7BAD\u5934\u7684\u5B57\u6BCD\u8BFB\u300C\u5411\u91CF F\u300D\u3002",
  "\u65E0\u8BBA\u4EC0\u4E48\u7C7B\u578B\uFF08\u542B\u8868\u683C\u3001\u6574\u53E5\u51FA\u7A3F\uFF09\uFF0Cspeech \u91CC\u90FD\u4E0D\u5F97\u4FDD\u7559 O(n)\u3001O(n^2)\u3001n!\u3001\u504F\u5BFC\u8BB0\u53F7\u3001d x \u8FD9\u7C7B\u6392\u7248\u8BB0\u53F7\u3002",
  "20. \u4E0D\u8981\u8F93\u51FA\u300C\u5DE6\u62EC\u53F7\u300D\u300C\u53F3\u62EC\u53F7\u300D\u300C\u5DE6\u65B9\u62EC\u53F7\u300D\u300C\u53F3\u65B9\u62EC\u53F7\u300D\u8FD9\u7C7B\u9010\u7B26\u53F7\u8BFB\u6CD5\uFF1B\u62EC\u53F7\u91CC\u7684\u5185\u5BB9\u76F4\u63A5\u8FDE\u7740\u5FF5\u3002",
  "21. \u5F53 task \u662F\u300C\u884C\u5185\u516C\u5F0F\u300D\u65F6\uFF1A\u53EA\u5FF5\u516C\u5F0F\u672C\u8EAB\uFF0C\u7EDD\u4E0D\u8981\u590D\u8FF0 segment.sentence\uFF08\u6574\u53E5\u7684\u5176\u4F59\u90E8\u5206",
  "\u5DF2\u7ECF\u5728\u6B63\u6587\u91CC\u5FF5\u8FC7\u4E86\uFF09\uFF0C\u4E5F\u4E0D\u8981\u5E26\u4E0A\u516C\u5F0F\u524D\u540E\u7684\u8BF4\u660E\u8BCD\uFF08\u4F8B\u5982\u300C\u5E73\u5747/\u6700\u574F\u300D\u300C\u6700\u597D\u300D\u300C\u5982\u679C\u300D\uFF09\u3002",
  "22. \u5F53 task \u662F\u300C\u542B\u884C\u5185\u516C\u5F0F\u7684\u6B63\u6587\u6BB5\u300D\u65F6\uFF1A\u8F93\u51FA\u8FD9\u4E00\u6BB5\u7684\u6717\u8BFB\u7A3F\u2014\u2014\u516C\u5F0F\u6309\u4E0A\u9762\u7684\u8BFB\u6CD5\u5FF5\u6210\u4E2D\u6587\uFF0C",
  "\u5176\u4F59\u6587\u5B57\u4FDD\u6301\u539F\u610F\u4E0E\u987A\u5E8F\uFF08\u534A\u53E5\u5C31\u8F93\u51FA\u534A\u53E5\uFF0C\u4E0D\u8981\u8865\u53E5\u53F7\u6216\u8865\u5185\u5BB9\uFF09\u3002\u5141\u8BB8\u5408\u5E76\u91CD\u590D\u4FE1\u606F\uFF1A",
  "\u516C\u5F0F\u8BD1\u6587\u82E5\u4E0E\u7D27\u8DDF\u5176\u540E\u7684\u8BF4\u660E\u8BCD\uFF08\u300C\u8868\u793A\u2026\u300D\u300C\u5373\u2026\u300D\u300C\u7B49\u4E8E\u2026\u300D\u300C\u662F\u2026\u300D\uFF09\u8BF4\u7684\u662F\u540C\u4E00\u4EF6\u4E8B\uFF0C",
  "\u53EA\u4FDD\u7559\u4E00\u5904\uFF0C\u4E0D\u8981\u8FDE\u5FF5\u4E24\u904D\u3002\u4E0D\u8981\u6982\u62EC\u3001\u4E0D\u8981\u589E\u5220\u4E8B\u5B9E\u3002",
  "23. \u4E0A\u9762\u90A3\u6761\u7684\u5B9E\u4F8B\uFF1A\u516C\u5F0F\u540E\u7D27\u8DDF\u300C\u662F D \u7684\u8FB9\u754C\u300D\u65F6\u53EA\u5FF5\u300CL \u7B49\u4E8E D \u7684\u8FB9\u754C\u300D\uFF1B",
  "\u516C\u5F0F\u540E\u7D27\u8DDF\u300C\u8868\u793A\u6CBF\u95ED\u66F2\u7EBF\u79EF\u5206\u300D\u65F6\u53EA\u5FF5\u300C\u6CBF\u95ED\u66F2\u7EBF\u79EF\u5206\u300D\uFF0C\u4E0D\u8981\u5FF5\u6210\u300C\u6CBF\u95ED\u66F2\u7EBF\u79EF\u5206\u8868\u793A\u6CBF\u95ED\u66F2\u7EBF\u79EF\u5206\u300D\u3002"
].join("\n");
function extractNumbers(text5) {
  const out = [];
  const re = /-?\d+(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(text5)) !== null) out.push(m[0]);
  return out;
}
var CN_DIGIT = {
  "\u96F6": 0,
  "\u3007": 0,
  "\u4E00": 1,
  "\u58F9": 1,
  "\u4E8C": 2,
  "\u4E24": 2,
  "\u8D30": 2,
  "\u4E09": 3,
  "\u53C1": 3,
  "\u56DB": 4,
  "\u8086": 4,
  "\u4E94": 5,
  "\u4F0D": 5,
  "\u516D": 6,
  "\u9646": 6,
  "\u4E03": 7,
  "\u67D2": 7,
  "\u516B": 8,
  "\u634C": 8,
  "\u4E5D": 9,
  "\u7396": 9
};
var CN_UNIT = { "\u5341": 10, "\u62FE": 10, "\u767E": 100, "\u4F70": 100, "\u5343": 1e3, "\u4EDF": 1e3 };
function cnRunToAscii(run) {
  const hasUnit = [...run].some((c) => CN_UNIT[c] !== void 0);
  if (!hasUnit) {
    let out = "";
    for (const c of run) {
      const d = CN_DIGIT[c];
      if (d === void 0) return run;
      out += String(d);
    }
    return out;
  }
  let section = 0;
  let current = 0;
  for (const c of run) {
    const d = CN_DIGIT[c];
    if (d !== void 0) {
      current = d;
      continue;
    }
    const u = CN_UNIT[c];
    if (u === void 0) return run;
    section += (current === 0 ? 1 : current) * u;
    current = 0;
  }
  return String(section + current);
}
function normalizeNumerals(text5) {
  return text5.replace(/平方/g, "2").replace(/立方/g, "3").replace(/[零〇一二两三四五六七八九十百千壹贰叁肆伍陆柒捌玖拾佰仟]+/g, (run) => cnRunToAscii(run));
}
function verifyNumbers(original, rewritten) {
  const need = extractNumbers(original);
  if (need.length === 0) return true;
  const hay = rewritten.replace(/\s+/g, "");
  if (need.every((n) => hay.includes(n.replace(/\s+/g, "")))) return true;
  const norm = normalizeNumerals(hay);
  return need.every((n) => norm.includes(n.replace(/\s+/g, "")));
}
function buildUserPayload(req) {
  const context = {};
  const before = req.context && req.context.before ? req.context.before.trim() : "";
  if (before) context.before = before;
  const symbols = (req.context && req.context.symbols ? req.context.symbols : []).filter((s) => s && s.sym && s.meaning).slice(0, 12);
  if (symbols.length) context.symbols = symbols;
  const segment = { type: req.kind, text: req.text };
  const sentence = req.meta && req.meta.sentence ? req.meta.sentence.trim().slice(0, 400) : "";
  if (sentence) segment.sentence = sentence;
  if (req.meta && req.meta.lang) segment.lang = req.meta.lang;
  if (req.kind === "table" && req.meta && req.meta.rows) segment.rows = req.meta.rows;
  const payload = { task: KIND_INSTRUCTIONS[req.kind] };
  if (Object.keys(context).length) payload.context = context;
  payload.segment = segment;
  return JSON.stringify(payload);
}
var ECHO_MARKERS = [
  "\u524D\u6587\uFF08\u4EC5\u4F9B\u53C2\u8003\uFF09",
  "\u5F85\u6539\u5199\u7247\u6BB5",
  "\u8FD9\u662F\u53E5\u5B50\u4E2D\u7684\u884C\u5185\u516C\u5F0F",
  "\u8FD9\u662F\u72EC\u7ACB\u5C55\u793A\u7684\u6570\u5B66\u516C\u5F0F",
  "\u8FD9\u662F\u4EE3\u7801\u7247\u6BB5",
  "\u8FD9\u662F\u8868\u683C",
  "\u53EA\u628A\u5B83\u5FF5\u6210",
  "\u4E0D\u8981\u8F93\u51FA",
  "\u4E0D\u8981\u590D\u8FF0",
  "<<<",
  ">>>",
  "context.before",
  "context.symbols",
  '"speech"',
  '{"speech"',
  "\u53E3\u64AD\u7A3F>"
];
function looksLikePromptEcho(text5) {
  return ECHO_MARKERS.some((m) => text5.includes(m));
}
function withinLengthLimit(original, speech, factor = 3, base = 60) {
  return speech.length <= Math.max(original.length * factor, original.length + base);
}
function shingles(s, n = 6) {
  const t = s.replace(/\s+/g, "");
  const out = /* @__PURE__ */ new Set();
  for (let i = 0; i + n <= t.length; i++) out.add(t.slice(i, i + n));
  return out;
}
function contextEchoRatio(speech, before) {
  const a = shingles(speech);
  const b = shingles(before);
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const g of a) if (b.has(g)) hit++;
  return hit / a.size;
}
function normalizeForEcho(s) {
  return String(s).replace(/[\s，。、；：？！…—·,.!?;:'"()（）\[\]【】《》<>「」『』""''+\-=*/\\|^_~`]/g, "");
}
function sentenceEchoRatio(speech, sentence, formula) {
  const sentenceNorm = normalizeForEcho(sentence);
  if (!sentenceNorm) return 0;
  const formulaNorm = normalizeForEcho(formula);
  const prose = formulaNorm ? sentenceNorm.split(formulaNorm).join("") : sentenceNorm;
  if (prose.length < 6) return 0;
  const hayRaw = normalizeForEcho(speech);
  if (!hayRaw) return 0;
  const a = prose;
  const b = hayRaw.length > 400 ? hayRaw.slice(0, 400) : hayRaw;
  let prev = new Uint16Array(b.length + 1);
  let cur = new Uint16Array(b.length + 1);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      cur[j + 1] = a[i] === b[j] ? prev[j] + 1 : Math.max(prev[j + 1], cur[j]);
    }
    const t = prev;
    prev = cur;
    cur = t;
    cur.fill(0);
  }
  return prev[b.length] / a.length;
}
function prefixEcho(speech, sentence, formula) {
  const sentenceNorm = normalizeForEcho(sentence);
  const formulaNorm = normalizeForEcho(formula);
  if (!sentenceNorm || !formulaNorm) return false;
  const idx = sentenceNorm.indexOf(formulaNorm);
  if (idx < 3) return false;
  const pre = sentenceNorm.slice(0, idx);
  const hay = normalizeForEcho(speech);
  if (pre.length < 3 || !hay) return false;
  for (let i = 0; i + 3 <= pre.length; i++) {
    if (hay.includes(pre.slice(i, i + 3))) return true;
  }
  return false;
}
function parseSpeechResponse(raw) {
  const text5 = String(raw).replace(/^\s*\x60\x60\x60[^\n]*\n?/, "").replace(/\n?\x60\x60\x60\s*$/, "").trim();
  const candidates = [text5];
  const first = text5.indexOf("{");
  const last = text5.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text5.slice(first, last + 1));
  for (const c of candidates) {
    let obj;
    try {
      obj = JSON.parse(c);
    } catch {
      continue;
    }
    if (!obj || typeof obj !== "object") continue;
    const speech = typeof obj.speech === "string" ? obj.speech.trim() : "";
    if (!speech) continue;
    return { speech: speech.replace(/\s+/g, " ").trim(), symbols: normalizeSymbols(obj.symbols) };
  }
  return null;
}
function normalizeSymbols(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const it of v) {
    if (!it || typeof it !== "object") continue;
    const sym = typeof it.sym === "string" ? it.sym.trim() : "";
    const meaning = typeof it.meaning === "string" ? it.meaning.trim() : "";
    if (!sym || !meaning) continue;
    if (out.some((s) => s.sym === sym)) continue;
    out.push({ sym: sym.slice(0, 8), meaning: meaning.slice(0, 24) });
    if (out.length >= 6) break;
  }
  return out;
}
function contextHash(context, sentence) {
  const before = context && context.before ? context.before : "";
  const symbols = context && context.symbols ? context.symbols : [];
  const local = sentence ? sentence : "";
  if (!local && !before && symbols.length === 0) return "";
  const s = local + "\0" + before + "|" + symbols.map((x) => x.sym + ":" + x.meaning).join(",");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
var SpeechRewriter = class _SpeechRewriter {
  opts;
  cache = /* @__PURE__ */ new Map();
  static MAX_CACHE = 200;
  constructor(opts) {
    this.opts = {
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      model: opts.model,
      timeoutMs: opts.timeoutMs ?? 8e3,
      maxTokens: opts.maxTokens ?? 400,
      temperature: opts.temperature ?? 0,
      cache: opts.cache ?? true,
      disableThinking: opts.disableThinking ?? true,
      jsonMode: opts.jsonMode ?? true,
      guardMode: opts.guardMode ?? "standard",
      guardAllow: opts.guardAllow ?? { speech: [], segment: [], errors: [] },
      fetchImpl: opts.fetchImpl ?? fetch
    };
  }
  /** 是否具备可用配置（未配置则完全不走网络）。 */
  get configured() {
    return Boolean(this.opts.baseUrl && this.opts.model);
  }
  /**
   * 改写一个片段。成功返回 { text, cached, symbols? }；任何失败（未配置 / 超时 /
   * HTTP 错 / 空输出 / 协议解析失败 / 任一守卫不过）返回 null，由调用方回退。
   */
  async rewrite(req) {
    const text5 = req.text ?? "";
    if (!text5.trim()) return null;
    if (!this.configured) return null;
    const ctxHash = contextHash(req.context, req.meta && req.meta.sentence);
    const key = PROMPT_VERSION + "|" + req.kind + "|" + (req.meta && req.meta.lang ? req.meta.lang : "") + "|" + ctxHash + "|" + text5;
    if (this.opts.cache) {
      const hit = this.cache.get(key);
      if (hit !== void 0) {
        return hit.symbols ? { text: hit.text, cached: true, symbols: hit.symbols } : { text: hit.text, cached: true };
      }
    }
    const url = this.opts.baseUrl.replace(/\/+$/, "") + "/chat/completions";
    const apiKey = typeof this.opts.apiKey === "function" ? await this.opts.apiKey() : this.opts.apiKey;
    const headers = { "content-type": "application/json" };
    if (apiKey) headers.authorization = "Bearer " + apiKey;
    const user = buildUserPayload(req);
    const maxTokens = this.maxTokensFor(text5);
    let rawContent = null;
    for (let attempt = 0; attempt < 2 && rawContent === null; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 400));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
      try {
        let call = await this.callModel(url, headers, user, maxTokens, controller.signal, this.opts.jsonMode);
        if (call.content === null && this.opts.jsonMode && call.status !== 200) {
          call = await this.callModel(url, headers, user, maxTokens, controller.signal, false);
        }
        if (call.content !== null) {
          rawContent = call.content;
        } else if (call.status >= 400 && call.status < 500) {
          break;
        }
      } catch {
      } finally {
        clearTimeout(timer);
      }
    }
    if (rawContent === null) return null;
    try {
      const parsed = parseSpeechResponse(rawContent);
      if (!parsed) return null;
      const mode = this.opts.guardMode;
      const allowRules = this.opts.guardAllow;
      const modeOff = mode === "off" || mode === void 0;
      const allowSeg = anyMatch(allowRules.segment, text5);
      const allowSpeech = anyMatch(allowRules.speech, parsed.speech);
      if (!modeOff && !allowSeg && !allowSpeech) {
        const profile = GUARD_PROFILES[mode];
        if (looksLikePromptEcho(parsed.speech)) return null;
        if (!withinLengthLimit(text5, parsed.speech, profile.lengthFactor, profile.lengthBase)) return null;
        if (req.kind !== "sentence") {
          const before = req.context && req.context.before ? req.context.before : "";
          const sentence = req.meta && req.meta.sentence ? req.meta.sentence : "";
          const echoRef = sentence.length > before.length ? sentence : before;
          if (echoRef.length >= 40 && parsed.speech.length >= 40 && contextEchoRatio(parsed.speech, echoRef) >= profile.echoRatio) {
            return null;
          }
          if (profile.prefixEcho && req.kind === "inline-math" && sentence) {
            if (prefixEcho(parsed.speech, sentence, text5)) return null;
          }
          if (req.kind === "inline-math" && sentence) {
            if (sentenceEchoRatio(parsed.speech, sentence, text5) >= profile.sentenceEchoRatio) return null;
          }
        }
        if (!verifyNumbers(text5, parsed.speech)) return null;
      }
      const stored = parsed.symbols.length ? { text: parsed.speech, symbols: parsed.symbols } : { text: parsed.speech };
      if (this.opts.cache) this.remember(key, stored);
      return stored.symbols ? { text: stored.text, cached: false, symbols: stored.symbols } : { text: stored.text, cached: false };
    } catch {
      return null;
    }
  }
  /**
   * 动态输出预算：要同时装下 JSON 外壳与口播稿。以设置值为基线，按片段长度上调，
   * 上限 2048；避免长表格/多符号时 JSON 被截断、解析失败而白白回退。
   */
  maxTokensFor(text5) {
    return Math.min(2048, Math.max(this.opts.maxTokens, Math.ceil(text5.length * 1.5) + 160));
  }
  async callModel(url, headers, user, maxTokens, signal, jsonMode) {
    const body = {
      model: this.opts.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user }
      ],
      max_tokens: maxTokens,
      temperature: this.opts.temperature,
      ...this.opts.disableThinking ? { thinking: { type: "disabled" } } : {},
      stream: false
    };
    if (jsonMode) body.response_format = { type: "json_object" };
    const res = await this.opts.fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal
    });
    if (!res.ok) return { status: res.status, content: null };
    const data = await res.json();
    const content3 = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : void 0;
    return { status: res.status, content: typeof content3 === "string" ? content3 : null };
  }
  remember(key, value) {
    this.cache.set(key, value);
    if (this.cache.size > _SpeechRewriter.MAX_CACHE) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== void 0) this.cache.delete(oldest);
    }
  }
  clearCache() {
    this.cache.clear();
  }
};

// src/tts-queue.ts
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// src/azure-ssml.ts
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function normalizeAzureEndpoint(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  let base = s;
  if (!/^https?:\/\//i.test(base)) base = "https://" + base + ".tts.speech.microsoft.com";
  base = base.replace(/\/+$/, "");
  if (/\/cognitiveservices\/v1$/i.test(base)) return base;
  return base + "/cognitiveservices/v1";
}
function parsePhonemeTable(raw) {
  const rules = [];
  const errors = [];
  const lines = String(raw ?? "").split(/\r?\n/);
  lines.forEach((line, idx) => {
    const text5 = line.trim();
    if (!text5 || text5.startsWith("#")) return;
    const m = /^(.*?)(?:=>|->|→)(.*)$/.exec(text5);
    if (!m) {
      errors.push("\u7B2C " + (idx + 1) + " \u884C\u7F3A\u5C11\u300C=>\u300D\uFF1A" + text5);
      return;
    }
    const from = m[1].trim();
    const ph = m[2].trim();
    if (!from || !ph) {
      errors.push("\u7B2C " + (idx + 1) + " \u884C\u8BCD\u6216\u62FC\u97F3\u4E3A\u7A7A");
      return;
    }
    if (/[<>&"']/.test(from) || /[<>&"']/.test(ph)) {
      errors.push("\u7B2C " + (idx + 1) + " \u884C\u542B\u975E\u6CD5\u5B57\u7B26\uFF08< > & \u5F15\u53F7\uFF09");
      return;
    }
    rules.push({ from, ph });
  });
  rules.sort((a, b) => b.from.length - a.from.length);
  return { rules, errors };
}
function azureRate(rate) {
  if (rate === void 0 || !Number.isFinite(rate) || Math.abs(rate - 1) < 1e-6) return "";
  const pct = Math.round((rate - 1) * 100);
  return (pct >= 0 ? "+" : "") + pct + "%";
}
function applyPhonemes(text5, rules) {
  if (!rules.length) return escapeXml(text5);
  let out = "";
  let i = 0;
  while (i < text5.length) {
    let hit = null;
    for (const r of rules) {
      if (r.from && text5.startsWith(r.from, i)) {
        hit = r;
        break;
      }
    }
    if (hit) {
      out += '<phoneme alphabet="sapi" ph="' + escapeXml(hit.ph) + '">' + escapeXml(hit.from) + "</phoneme>";
      i += hit.from.length;
    } else {
      out += escapeXml(text5[i]);
      i++;
    }
  }
  return out;
}
function buildAzureSsml(o) {
  const voice = o.voice || "zh-CN-XiaoxiaoNeural";
  const lang = o.lang || /^([a-z]{2}-[A-Z]{2})/.exec(voice)?.[1] || "zh-CN";
  const inner = applyPhonemes(o.text, o.phonemes ?? []);
  const rate = azureRate(o.rate);
  const prosody = rate ? '<prosody rate="' + rate + '">' + inner + "</prosody>" : inner;
  return '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="' + escapeXml(lang) + '"><voice name="' + escapeXml(voice) + '">' + prosody + "</voice></speak>";
}

// src/tts-queue.ts
var MP3_MAGIC = 255;
var TTS_METADATA = { wordBoundaryEnabled: false, sentenceBoundaryEnabled: false };
function prosodyFromRate(rate) {
  if (rate !== void 0 && rate > 0 && rate !== 1) return { rate };
  return void 0;
}
function isValidMp3(buf) {
  if (buf.length === 0) return false;
  if (buf[0] === MP3_MAGIC) return true;
  return buf[0] === 73 && buf[1] === 68 && buf[2] === 51;
}
var EdgeTtsEngine = class {
  voice;
  rate;
  constructor(voice = "zh-CN-XiaoxiaoNeural", rate) {
    this.voice = voice;
    this.rate = rate;
  }
  mime = "audio/mpeg";
  updateVoice(voice, rate) {
    this.voice = voice;
    if (rate !== void 0 && Number.isFinite(rate)) this.rate = rate;
  }
  async synthesize(text5, options = {}) {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(
        options.voice ?? this.voice,
        OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
        TTS_METADATA
      );
      const { audioStream } = tts.toStream(text5, prosodyFromRate(options.rate ?? this.rate));
      const chunks = [];
      for await (const chunk of audioStream) chunks.push(chunk);
      const buf = Buffer.concat(chunks);
      if (!isValidMp3(buf)) throw new Error("empty or invalid audio");
      return buf;
    } finally {
      try {
        await tts.close();
      } catch {
      }
    }
  }
  async close() {
  }
};
var AzureTtsEngine = class {
  constructor(opts) {
    this.opts = opts;
    this.voice = opts.voice;
    this.rate = opts.rate;
  }
  voice;
  rate;
  mime = "audio/mpeg";
  updateVoice(voice, rate) {
    if (voice) this.voice = voice;
    if (rate !== void 0 && Number.isFinite(rate)) this.rate = rate;
  }
  async synthesize(text5, options = {}) {
    const endpoint = normalizeAzureEndpoint(this.opts.endpoint());
    if (!endpoint) throw new Error("Azure endpoint is not configured");
    const key = (await this.opts.resolveKey()).trim();
    if (!key) throw new Error("Azure key is not configured");
    const ssml = buildAzureSsml({
      text: text5,
      voice: options.voice ?? this.voice,
      rate: options.rate ?? this.rate,
      phonemes: this.opts.phonemes?.() ?? []
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 15e3);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "dsh-voice-mode-adaptation"
        },
        body: ssml,
        signal: ctrl.signal
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error("Azure TTS HTTP " + res.status + (detail ? ": " + detail.slice(0, 200) : ""));
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!isValidMp3(buf)) throw new Error("empty or invalid audio");
      return buf;
    } finally {
      clearTimeout(timer);
    }
  }
  async close() {
  }
};
var edgeVoicesCache = null;
async function listEdgeVoices(force = false) {
  if (edgeVoicesCache && !force) return edgeVoicesCache;
  const tts = new MsEdgeTTS();
  try {
    const voices = await tts.getVoices();
    edgeVoicesCache = voices.map((v) => ({
      ShortName: v.ShortName,
      Locale: v.Locale,
      Gender: v.Gender,
      FriendlyName: v.FriendlyName
    }));
    return edgeVoicesCache;
  } finally {
    try {
      await tts.close();
    } catch {
    }
  }
}
var TtsQueue = class {
  queues = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  engine;
  /** TTS 全体不可达通知（每会话去重，成功后复位）。 */
  onError;
  constructor(options) {
    this.engine = options.engine;
    this.onError = options.onError;
  }
  /** 当前引擎音频 MIME（/preview 的 Content-Type 也用它）。 */
  get mime() {
    return this.engine.mime;
  }
  /**
   * 运行时切换引擎（设置面板「朗读引擎」即时生效）：
   * 关闭旧引擎、清空所有会话队列；新句子用新引擎合成。
   */
  setEngine(engine) {
    const old = this.engine;
    this.engine = engine;
    this.queues.clear();
    void old.close().catch(() => {
    });
  }
  /** 动态更换音色/语速（设置即时生效；正在合成的句子不受影响）。 */
  updateVoice(voice, rate) {
    this.engine.updateVoice(voice, rate);
  }
  /** 当前引擎/模型现状（设置面板状态区轮询）。 */
  status() {
    const s = this.engine.status?.();
    if (s) return s;
    return { engine: "edge", ready: true, loading: false };
  }
  /** 触发当前引擎预热/下载模型并初始化（设置面板「下载」按钮；Edge 为无操作）。 */
  async prepare() {
    await this.engine.prepare?.();
  }
  /**
   * 一次性合成（设置卡「试听」用）：委托当前引擎；不干扰朗读队列的在途合成。
   * 失败（含非法音色）抛错。
   */
  async synthesize(text5, options = {}) {
    return this.engine.synthesize(text5, options);
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  /** 为某会话入队一句（pauseBeforeMs = 起播前留白毫秒）；若泵空闲则启动。 */
  enqueue(sessionId, text5, pauseBeforeMs = 0) {
    let q = this.queues.get(sessionId);
    if (!q) {
      q = { pending: [], busy: false, seq: 0, epoch: 0, errorNotified: false, backoff: 0 };
      this.queues.set(sessionId, q);
    }
    if (q.pending.length >= 500) {
      console.warn("[dsh-voice-mode-adaptation] TTS queue overflow, dropping oldest sentence");
      q.pending.shift();
    }
    q.pending.push({ text: text5, epoch: q.epoch, pauseBeforeMs: pauseBeforeMs > 0 ? Math.round(pauseBeforeMs) : void 0 });
    void this.pump(sessionId, q);
  }
  /**
   * 弃掉某会话的所有积压并作废正在合成的句子（打断）。之后入队的句子
   * 获得新 epoch 正常播放。同时立刻中止在途合成（本地引擎杀子进程释放 CPU）。
   */
  cancel(sessionId) {
    const q = this.queues.get(sessionId);
    if (q) {
      q.epoch++;
      q.pending.length = 0;
    }
    this.engine.interrupt?.();
  }
  /** 会话退出/被抢占时彻底清理其队列（防止 Map 长期累积）。 */
  prune(sessionId) {
    const q = this.queues.get(sessionId);
    if (q) {
      q.epoch++;
      q.pending.length = 0;
    }
    this.queues.delete(sessionId);
  }
  async pump(sessionId, q) {
    if (q.busy) return;
    q.busy = true;
    try {
      while (q.pending.length > 0) {
        const item = q.pending.shift();
        const MAX_SYNTH_ATTEMPTS = 3;
        let buf = null;
        for (let attempt = 0; attempt < MAX_SYNTH_ATTEMPTS; attempt++) {
          if (item.epoch !== q.epoch) break;
          try {
            buf = await this.engine.synthesize(item.text);
            break;
          } catch (e) {
            console.warn(`[dsh-voice-mode-adaptation] synthesis failed (${attempt + 1}/${MAX_SYNTH_ATTEMPTS}): ${String(e)}`);
            if (attempt < MAX_SYNTH_ATTEMPTS - 1) {
              await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
            }
          }
        }
        if (item.epoch !== q.epoch) continue;
        if (buf === null) continue;
        q.errorNotified = false;
        q.backoff = 0;
        const sentenceId = q.seq++;
        const mime = this.engine.mime;
        const dataFrame = {
          sessionId,
          sentenceId,
          chunkId: 0,
          final: false,
          audio: buf.toString("base64"),
          mime
        };
        for (const fn of this.listeners) {
          try {
            fn(dataFrame);
          } catch {
          }
        }
        const finalFrame = {
          sessionId,
          sentenceId,
          chunkId: 1,
          final: true,
          text: item.text,
          audio: "",
          mime,
          pauseBeforeMs: item.pauseBeforeMs
        };
        for (const fn of this.listeners) {
          try {
            fn(finalFrame);
          } catch {
          }
        }
      }
    } catch (e) {
      console.warn(`[dsh-voice-mode-adaptation] TTS unavailable: ${String(e)}`);
      if (!q.errorNotified) {
        q.errorNotified = true;
        this.onError?.(sessionId);
      }
    } finally {
      q.busy = false;
      if (this.queues.get(sessionId) !== q) return;
      if (q.pending.length > 0) {
        const delay = q.errorNotified ? q.backoff : 0;
        q.backoff = Math.min(8e3, delay + 1e3);
        if (delay > 0) setTimeout(() => void this.pump(sessionId, q), delay);
        else void this.pump(sessionId, q);
      }
    }
  }
  async close() {
    await this.engine.close();
  }
};

// src/tts-local.ts
import { fork } from "node:child_process";
import { fileURLToPath as fileURLToPath3 } from "node:url";
import { join as join3 } from "node:path";
import { statSync as statSync2 } from "node:fs";
var TTS_MODEL_REPO = "csukuangfj/sherpa-onnx-vits-zh-ll";
var KOKORO_MODEL_DIR_INT8 = "csukuangfj/kokoro-int8-multi-lang-v1_1";
var KOKORO_MODEL_DIR_FP32 = "csukuangfj/kokoro-multi-lang-v1_1";
var kokoroModelDir = (m) => m === "fp32" ? KOKORO_MODEL_DIR_FP32 : KOKORO_MODEL_DIR_INT8;
var TTS_MODEL_FILES = [
  { file: "model.onnx", sha256: "6c349bdd73dc928234dd7bc86929748bba32cd5264d32d915bf7b7aa0595965b" },
  { file: "lexicon.txt", sha256: "b3a82f16b286c424953dea3686039e7ab465fa8e15d87ef8abd0ec69175beb21" },
  { file: "tokens.txt", sha256: "34b035b9aeb070df6188b022f29c00e0e142c7ade9f25611ced65db5e9cc8402" },
  { file: "G_multisperaker_latest.json", sha256: "f31e4bf23827c3528fdf090fd7b6fb8e63333709b80670d40fa864f1fa9fadf3" },
  { file: "date.fst", sha256: "eb8aa079ae3cb81d8f4404992f39d61a0cb990947512b5b8d1e54d1f6980e718" },
  { file: "phone.fst", sha256: "1ac2b6fa56b1442320c4de7db08353bab8963a2b57f365eebcdd3a2d3562f8d7" },
  { file: "number.fst", sha256: "743f402181fcfebf76cc2f0546b71fa26476e626fbe4e460fb7b4c3a7a8bd5bd" }
];
var VITS_SPEAKERS = [
  { name: "suyingxue", sid: 0, label: "\u7D20\u6620\u96EA \xB7 \u5973" },
  { name: "gunian", sid: 1, label: "\u987E\u5FF5 \xB7 \u7537" },
  { name: "fushiyu", sid: 2, label: "\u5085\u65AF\u9047 \xB7 \u5973" },
  { name: "bingjiao", sid: 3, label: "\u51B0\u5A07 \xB7 \u7537" },
  { name: "bazong", sid: 4, label: "\u9738\u603B \xB7 \u7537" }
];
var KOKORO_F0 = [
  224,
  189,
  154,
  261,
  226,
  222,
  220,
  229,
  198,
  186,
  212,
  293,
  233,
  161,
  247,
  207,
  218,
  216,
  220,
  238,
  242,
  229,
  198,
  286,
  211,
  190,
  264,
  261,
  226,
  147,
  216,
  240,
  233,
  188,
  222,
  247,
  253,
  270,
  276,
  276,
  279,
  320,
  247,
  296,
  276,
  235,
  139,
  240,
  282,
  282,
  238,
  226,
  273,
  216,
  286,
  270,
  198,
  179,
  117,
  130,
  114,
  128,
  108,
  106,
  122,
  136,
  190,
  112,
  108,
  128,
  131,
  111,
  110,
  132,
  138,
  189,
  137,
  148,
  151,
  127,
  135,
  111,
  138,
  114,
  125,
  158,
  128,
  156,
  132,
  162,
  131,
  136,
  142,
  124,
  129,
  136,
  126,
  135,
  161,
  150,
  124,
  104,
  124
];
var KOKORO_NAMED = {
  48: { name: "zf_xiaobei", label: "\u5C0F\u5317 \xB7 \u4E2D\u6587\u5973" },
  49: { name: "zf_xiaoni", label: "\u5C0F\u59AE \xB7 \u4E2D\u6587\u5973" },
  50: { name: "zf_xiaoxiao", label: "\u5C0F\u5C0F \xB7 \u4E2D\u6587\u5973" },
  51: { name: "zf_xiaoyi", label: "\u5C0F\u827A \xB7 \u4E2D\u6587\u5973" }
};
var KOKORO_LABEL_OVERRIDES = {
  62: "62 \xB7 \u6DF1\u6C89 \xB7 \u5E38\u7528\u7537\u58F0",
  68: "68 \xB7 \u6D51\u539A \xB7 \u5E38\u7528\u7537\u58F0",
  75: "75 \xB7 \u6E05\u4EAE \xB7 \u5E38\u7528\u7537\u58F0",
  76: "76 \xB7 \u78C1\u6027 \xB7 \u5E38\u7528\u7537\u58F0"
};
var KOKORO_PINNED = [62, 68, 75, 76];
function kokoroVoice(sid) {
  const custom = KOKORO_LABEL_OVERRIDES[sid];
  if (custom) return { name: String(sid), sid, label: custom };
  const named = KOKORO_NAMED[sid];
  if (named) return { name: named.name, sid, label: named.label };
  const hz = KOKORO_F0[sid] ?? null;
  if (hz === null) return { name: String(sid), sid, label: `${sid} \xB7 \u97F3\u8272` };
  return { name: String(sid), sid, label: `${sid} \xB7 ${hz < 180 ? "\u7537\u58F0" : "\u5973\u58F0"} \xB7 ${hz}Hz` };
}
var KOKORO_VOICES = [
  ...KOKORO_PINNED.map((sid) => kokoroVoice(sid)),
  ...KOKORO_F0.map((_, sid) => kokoroVoice(sid)).filter((v) => !KOKORO_PINNED.includes(v.sid))
];
function voiceToSid(voice) {
  const v = String(voice ?? "").trim().toLowerCase();
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    if (n >= 0 && n < VITS_SPEAKERS.length) return n;
  }
  const hit = VITS_SPEAKERS.find((s) => s.name.toLowerCase() === v);
  return hit ? hit.sid : 0;
}
function kokoroVoiceToSid(voice) {
  const v = String(voice ?? "").trim().toLowerCase();
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    if (n >= 0 && n <= KOKORO_VOICES.length - 1) return n;
  }
  const hit = KOKORO_VOICES.find((s) => s.name.toLowerCase() === v);
  return hit ? hit.sid : 48;
}
function floatToPcm16(samples) {
  const buf = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(s < 0 ? s * 32768 : s * 32767, i * 2);
  }
  return buf;
}
function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
var VITS_SPEC = {
  files: TTS_MODEL_FILES,
  workerPaths: (dir) => ({
    model: join3(dir, "model.onnx"),
    lexicon: join3(dir, "lexicon.txt"),
    tokens: join3(dir, "tokens.txt"),
    date: join3(dir, "date.fst"),
    phone: join3(dir, "phone.fst"),
    number: join3(dir, "number.fst")
  }),
  defaultVoice: "suyingxue",
  toSid: voiceToSid
};
var KOKORO_SHARED_FILES = [
  { file: "voices.bin", sha256: "e64a5a581d8c2a350d848f51c3121657cd83aa07ed6109172177345874a7244c" },
  { file: "tokens.txt", sha256: "931ab2df2400cd65d580a22402024c2347ced8ae9ea300e545144b1aacc48e14" },
  { file: "lexicon-us-en.txt", sha256: "7daaab53a181be9885b853a8582bf1838186317e5dadacbcef9c426d6fa0da14" },
  { file: "lexicon-zh.txt", sha256: "11111d8cd695fba2ace1367a1d0a708b586e6ef5c1f9be91da5d7eef129b651c" },
  { file: "espeak-ng-data/phontab", sha256: "886f3fa402cb0ba73d483aa8ad000af47a6b7cc06293c75a97913fba68a530f6" },
  { file: "date-zh.fst", sha256: "eb8aa079ae3cb81d8f4404992f39d61a0cb990947512b5b8d1e54d1f6980e718" },
  { file: "number-zh.fst", sha256: "743f402181fcfebf76cc2f0546b71fa26476e626fbe4e460fb7b4c3a7a8bd5bd" },
  { file: "phone-zh.fst", sha256: "1ac2b6fa56b1442320c4de7db08353bab8963a2b57f365eebcdd3a2d3562f8d7" }
];
var kokoroWorkerPaths = (dir, modelFile) => ({
  model: join3(dir, modelFile),
  voices: join3(dir, "voices.bin"),
  tokens: join3(dir, "tokens.txt"),
  dataDir: join3(dir, "espeak-ng-data"),
  lexicon: [join3(dir, "lexicon-us-en.txt"), join3(dir, "lexicon-zh.txt")].join(","),
  date: join3(dir, "date-zh.fst"),
  phone: join3(dir, "phone-zh.fst"),
  number: join3(dir, "number-zh.fst"),
  lang: ""
});
function kokoroSpec(model) {
  const main = model === "fp32" ? { file: "model.onnx", sha256: "acc4adc175b9d9986106cd20060329673ad5a2e12ef3c557d2d3745b694f8b38" } : { file: "model.int8.onnx", sha256: "bda15858163726a492d02a9a727bc263551b86ac77f90812c4b30ff41d380e26" };
  return {
    files: [main, ...KOKORO_SHARED_FILES],
    workerPaths: (dir) => kokoroWorkerPaths(dir, main.file),
    defaultVoice: "zf_xiaobei",
    toSid: kokoroVoiceToSid
  };
}
function createSherpaLocalEngine(options) {
  const { cacheDir, modelHost, allowCustomHost, broadcast } = options;
  let downloadProgress = null;
  const trackedBroadcast = (event, payload) => {
    if (event === "asr-progress" && payload && typeof payload === "object") {
      const pr = payload;
      if (typeof pr.file === "string" && typeof pr.percent === "number") {
        downloadProgress = { file: pr.file, percent: Math.min(100, Math.max(0, pr.percent)) };
      }
    }
    broadcast(event, payload);
  };
  const kokoroModel = options.model ?? "int8";
  const spec = options.kind === "kokoro" ? kokoroSpec(kokoroModel) : VITS_SPEC;
  const repoName = options.kind === "kokoro" ? kokoroModelDir(kokoroModel) : TTS_MODEL_REPO;
  const repoDir = join3(cacheDir, repoName);
  const workerPath = fileURLToPath3(new URL("./tts-vits-worker.cjs", import.meta.url));
  let child = null;
  let childInit = false;
  const respawnChild = async () => {
    if (child) {
      child.kill();
      child = null;
    }
    childInit = false;
    ready = null;
  };
  let voice = spec.defaultVoice;
  let speed = 1;
  let ready = null;
  let engineLoading = false;
  let engineError;
  let nextId = 1;
  const pending = /* @__PURE__ */ new Map();
  const call = (msg) => new Promise((resolve, reject) => {
    if (!child) {
      reject(new Error("tts child not running"));
      return;
    }
    const id = nextId++;
    pending.set(id, { resolve, reject });
    child.send({ id, ...msg });
  });
  const rejectAll = (e) => {
    for (const p of pending.values()) p.reject(e);
    pending.clear();
  };
  const ensureReady = () => {
    if (ready && child) return ready;
    if (!ready) {
      ready = (async () => {
        engineLoading = true;
        engineError = void 0;
        downloadProgress = null;
        try {
          if (!child || !childInit) {
            for (const f of spec.files) {
              const ok3 = await ensureModelFile({
                repo: repoName,
                repoDir,
                spec: f,
                primaryHost: modelHost(),
                allowCustomHost,
                broadcast: trackedBroadcast
              });
              if (!ok3) throw new Error("local TTS model download/verify failed: " + f.file);
            }
            if (options.kind === "kokoro") {
              const treeOk = await ensureModelTree({
                repo: repoName,
                repoDir,
                subdir: "espeak-ng-data",
                primaryHost: modelHost(),
                allowCustomHost,
                broadcast: trackedBroadcast
              });
              if (!treeOk) throw new Error("local TTS model download failed: espeak-ng-data");
            }
            if (!child) {
              child = fork(workerPath, [], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
              let stderrTail = "";
              child.stderr?.on("data", (chunk) => {
                stderrTail += String(chunk);
                const lines = stderrTail.split("\n");
                stderrTail = lines.pop() ?? "";
                for (const line of lines) {
                  const s = line.trim();
                  if (!s) continue;
                  if (/Skip unknown phonemes/.test(s)) continue;
                  console.error(`[tts-worker:${options.kind}] ${s}`);
                }
              });
              child.on("message", (m) => {
                const p = pending.get(m.id);
                if (!p) return;
                pending.delete(m.id);
                if (m.ok) p.resolve(m);
                else p.reject(new Error(m.error ?? "tts child error"));
              });
              child.on("error", (e) => {
                rejectAll(e instanceof Error ? e : new Error(String(e)));
                child = null;
                childInit = false;
                ready = null;
              });
              child.on("exit", (code3) => {
                rejectAll(new Error(`tts child exited with code ${code3}`));
                child = null;
                childInit = false;
                ready = null;
              });
            }
            if (!childInit) {
              const init = await call({ type: "init", kind: options.kind, paths: spec.workerPaths(repoDir) });
              if (!init.ok) throw new Error(init.error ?? "tts child init failed");
              childInit = true;
            }
          }
          broadcast("tts-ready", { engine: options.kind, worker: true });
        } catch (e) {
          engineError = e instanceof Error ? e.message : String(e);
          throw e;
        } finally {
          engineLoading = false;
        }
      })().finally(() => {
        ready = null;
      });
    }
    return ready;
  };
  return {
    mime: "audio/wav",
    updateVoice(nextVoice, nextRate) {
      voice = nextVoice || voice;
      if (typeof nextRate === "number" && Number.isFinite(nextRate)) {
        speed = Math.min(2, Math.max(0.5, nextRate));
      }
    },
    status() {
      const files = spec.files.map((f) => {
        const p = join3(repoDir, f.file);
        let exists = false;
        let size = 0;
        try {
          const st = statSync2(p);
          exists = st.isFile();
          size = st.size;
        } catch {
        }
        return { name: f.file, exists, size };
      });
      return {
        engine: options.kind,
        ready: childInit === true,
        loading: engineLoading,
        error: engineError,
        progress: downloadProgress ?? void 0,
        local: {
          repo: repoName,
          ready: files.every((f) => f.exists),
          loading: engineLoading,
          error: engineError,
          files
        }
      };
    },
    // 设置面板「下载」按钮：无文本也触发模型下载 + 子进程初始化（与首次合成路径一致）。
    prepare: () => ensureReady(),
    async synthesize(text5, opts = {}) {
      await ensureReady();
      const sid = spec.toSid(opts.voice ?? voice);
      const spd = typeof opts.rate === "number" && Number.isFinite(opts.rate) ? Math.min(2, Math.max(0.5, opts.rate)) : speed;
      let res = await call({ type: "synth", text: text5, sid, speed: spd });
      if (!res.ok && /Aborted/.test(res.error ?? "")) {
        await respawnChild();
        res = await call({ type: "synth", text: text5, sid, speed: spd });
      }
      if (!res.ok) throw new Error(res.error ?? "local TTS synthesis failed");
      if (typeof res.samples !== "string" || res.samples.length === 0) {
        throw new Error("local TTS produced empty audio");
      }
      const bytes = Buffer.from(res.samples, "base64");
      const samples = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      if (samples.length === 0) {
        throw new Error("local TTS produced empty audio");
      }
      return pcmToWav(floatToPcm16(samples), res.sampleRate || 16e3);
    },
    async close() {
      const c = child;
      if (c) {
        try {
          await call({ type: "close" });
        } catch {
        }
        try {
          c.kill();
        } catch {
        }
      }
      child = null;
      childInit = false;
      ready = null;
    },
    interrupt() {
      void respawnChild();
    }
  };
}
function createSherpaVitsEngine(options) {
  return createSherpaLocalEngine({ ...options, kind: "vits" });
}
function createSherpaKokoroEngine(options) {
  return createSherpaLocalEngine({ ...options, kind: "kokoro" });
}

// src/security.ts
var LOOPBACK_ADDRESSES = /* @__PURE__ */ new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
function isLoopbackRequest(req) {
  const addr = req.socket.remoteAddress ?? "";
  return LOOPBACK_ADDRESSES.has(addr);
}
function sameOriginRequest(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const xfh = req.headers["x-forwarded-host"];
    const host = (typeof xfh === "string" && xfh ? xfh.split(",")[0].trim() : "") || req.headers.host;
    if (!host) return false;
    return originHost === host;
  } catch {
    return false;
  }
}
var RateLimiter = class {
  buckets = /* @__PURE__ */ new Map();
  maxKeys;
  constructor(maxKeys = 1e4) {
    this.maxKeys = maxKeys;
  }
  /** 命中一次；返回是否允许。maxHits 次 / windowMs 毫秒。 */
  hit(key, maxHits, windowMs) {
    const now = Date.now();
    const cutoff = now - windowMs;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) return false;
      bucket = [];
      this.buckets.set(key, bucket);
    }
    while (bucket.length > 0 && bucket[0] <= cutoff) bucket.shift();
    if (bucket.length >= maxHits) return false;
    bucket.push(now);
    return true;
  }
  /** 定期清理（由调用方在低频路径触发即可）。 */
  prune(now = Date.now(), windowMs) {
    const cutoff = now - windowMs;
    for (const [key, bucket] of this.buckets) {
      while (bucket.length > 0 && bucket[0] <= cutoff) bucket.shift();
      if (bucket.length === 0) this.buckets.delete(key);
    }
  }
};

// src/index.ts
var name = "voice-mode-adaptation";
var NS_VOICE_MODE = "voice-mode-adaptation";
var BASE_PATH = "/voice-mode-adaptation";
var respondJson2 = (res, status, payload) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
};
var VOICE_SPOKEN_PROMPT = "\u3010\u6392\u7248\u4E0E\u516C\u5F0F\u3011\u8BF7\u4F7F\u7528\u4E0E\u7528\u6237\u76F8\u540C\u7684\u8BED\u8A00\u3001\u4EE5\u6B63\u5E38\u4E25\u8C28\u7684\u4E66\u9762\u98CE\u683C\u4F5C\u7B54\u3002\u5C4F\u5E55\u9605\u8BFB\u4F18\u5148\uFF1A\u8BF7\u5145\u5206\u4F7F\u7528 Markdown \u7ED3\u6784\uFF08\u6807\u9898\u3001\u5217\u8868\u3001\u8868\u683C\u3001\u5F15\u7528\u3001\u884C\u5185\u4EE3\u7801\u4E0E\u4EE3\u7801\u5757\uFF09\u4E0E LaTeX \u516C\u5F0F\uFF08\u884C\u5185 $...$\u3001\u5C55\u793A $$...$$\uFF09\uFF0C\u4E0D\u8981\u4E3A\u4E86\u6717\u8BFB\u800C\u7B80\u5316\u6392\u7248\u3002\u5B57\u9762\u7F8E\u5143\u7B26\u53F7\u5FC5\u987B\u8F6C\u4E49\uFF1A\u5F53 $ \u8868\u793A\u8D27\u5E01\u91D1\u989D\u3001\u73AF\u5883\u53D8\u91CF\u3001Shell \u53D8\u91CF\u7B49\u5B57\u9762\u5B57\u7B26\u65F6\uFF0C\u5199\u6210 \\$\uFF08\u53CD\u659C\u6760\u52A0\u7F8E\u5143\u7B26\u53F7\uFF09\uFF1B\u540C\u4E00\u884C\u5185\u51FA\u73B0\u4E24\u4E2A\u672A\u8F6C\u4E49\u7684 $ \u4F1A\u88AB\u6E32\u67D3\u6210\u884C\u5185\u516C\u5F0F\u3001\u5BFC\u81F4\u5185\u5BB9\u9519\u4E71\uFF1B\u771F\u6B63\u7684\u6570\u5B66\u516C\u5F0F\u4ECD\u7528 $ \u5B9A\u754C\uFF0C\u4E0D\u8981\u8F6C\u4E49\u3002\u6717\u8BFB\u4FA7\u4F1A\u81EA\u884C\u5904\u7406\u6392\u7248\u7B26\u53F7\u4E0E\u516C\u5F0F\uFF0C\u65E0\u9700\u4E3A\u6717\u8BFB\u6539\u53D8\u5199\u4F5C\u65B9\u5F0F\u3002";
var VOICE_SPOKEN_SECTION = "voice-mode-adaptation:spoken-format";
var inject = ["webServer", "settings", "sessions"];
var defaultModelCacheDir = () => process.platform === "win32" ? join4(process.env.LOCALAPPDATA ?? join4(homedir(), "AppData", "Local"), "dsh-voice-mode-adaptation", "models") : join4(homedir(), ".cache", "dsh-voice-mode-adaptation", "models");
var VOICE_SETTINGS_DEFAULTS = {
  ttsEngine: "edge",
  kokoroModel: "int8",
  azureEndpoint: "",
  azureKeyRef: "",
  azurePhonemes: "",
  voice: "zh-CN-XiaoxiaoNeural",
  rate: 1,
  interruptLevel: 0,
  silenceMs: 1500,
  idleTimeoutMinutes: 10,
  modelHost: "",
  autoSend: true,
  autoResume: false,
  mode: "toggle",
  bargeInMode: "auto",
  echoGateDb: 6,
  shortcut: "Ctrl+Shift+V",
  spokenFormat: false,
  senseVoice: true,
  wakeWord: "",
  toolBeep: false,
  rewriteEnabled: false,
  rewriteBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
  rewriteApiKeyRef: "",
  rewriteModel: "glm-4.5-air",
  rewriteTimeoutMs: 8e3,
  rewriteMaxTokens: 400,
  rewriteTemperature: 0,
  rewriteCache: true,
  rewriteDisableThinking: true,
  rewriteContextChars: 800,
  pronunciationFixes: DEFAULT_PRONUNCIATION_TABLE,
  pronunciationEnabled: true,
  guardMode: "standard",
  guardAllowRules: "",
  blockPauseMs: 350,
  wholeSentenceMath: true,
  mathMode: "rules"
};
function createVoiceSettingsSchema(defs) {
  const d = { ...VOICE_SETTINGS_DEFAULTS, ...defs };
  return z.object({
    ttsEngine: z.union([z.const("vits"), z.const("kokoro"), z.const("edge"), z.const("azure")]).default(d.ttsEngine).description(
      "\u6717\u8BFB\u5F15\u64CE\uFF1Aedge \u5FAE\u8F6F\u4E91\u7AEF\uFF08\u9ED8\u8BA4\uFF0C\u5FEB\u3001\u97F3\u8D28\u81EA\u7136\uFF0C\u88AB\u6717\u8BFB\u6587\u672C\u4F1A\u53D1\u9001\u5230\u5FAE\u8F6F\uFF09/ vits \u672C\u5730\u4E2D\u6587 / kokoro \u672C\u5730\u4E2D\u82F1\uFF08\u56DE\u590D\u6587\u672C\u4E0D\u51FA\u672C\u673A\uFF09/ azure \u4ED8\u8D39\u4E91\u7AEF\uFF08\u9700\u7AEF\u70B9+\u5BC6\u94A5\uFF1B\u652F\u6301 SSML \u97F3\u7D20\u7EA7\u591A\u97F3\u5B57\uFF09\uFF1B\u5207\u6362\u5373\u65F6\u751F\u6548"
    ),
    kokoroModel: z.union([z.const("int8"), z.const("fp32")]).default(d.kokoroModel).description(
      "Kokoro \u6A21\u578B\u7CBE\u5EA6\uFF1Aint8\uFF08\u9ED8\u8BA4\uFF0C\u4F53\u79EF\u5C0F/\u52A0\u8F7D\u5FEB\uFF0CCPU \u53CB\u597D\uFF09/ fp32\uFF08\u97F3\u8D28\u66F4\u597D\u3001\u4F53\u79EF\u5927\uFF0CGPU \u6216\u5927\u5185\u5B58\u673A\u5668\u63A8\u8350\uFF09\uFF1B\u4E24\u6863\u5171\u7528\u540C\u4E00\u5957 103 \u97F3\u8272\uFF0C\u5207\u6362\u5373\u65F6\u751F\u6548"
    ),
    azureEndpoint: z.string().default(d.azureEndpoint).description("Azure \u6717\u8BFB\u7AEF\u70B9\uFF1A\u586B\u533A\u57DF\u540D\uFF08\u5982 eastasia\uFF09\u6216\u5B8C\u6574\u94FE\u63A5\uFF08https://<region>.tts.speech.microsoft.com\uFF09\uFF1B\u4EC5 azure \u5F15\u64CE\u4F7F\u7528"),
    azureKeyRef: z.string().default(d.azureKeyRef).description("Azure \u5BC6\u94A5\u7684\u51ED\u636E\u5F15\u7528\u540D\uFF08\u5982 AZURE_SPEECH_KEY\uFF09\uFF1B\u771F\u5B9E\u5BC6\u94A5\u5199\u5165 DSH \u51ED\u636E\u5E93\uFF0C\u4E0D\u843D\u914D\u7F6E\u6587\u4EF6\u660E\u6587"),
    azurePhonemes: z.string().default(d.azurePhonemes).description("Azure \u591A\u97F3\u5B57\u62FC\u97F3\u8868\uFF1A\u6BCF\u884C\u300C\u8BCD => \u62FC\u97F3\u300D\uFF08\u5982 \u884C => hang2\u3001\u94F6\u884C => yin2 hang2\uFF09\uFF0C# \u8D77\u9996\u4E3A\u6CE8\u91CA\uFF1B\u7ECF SSML <phoneme> \u7CBE\u786E\u53D1\u97F3\uFF0C\u4EC5 azure \u5F15\u64CE\u4F7F\u7528"),
    voice: z.string().default(d.voice).description(
      "\u6717\u8BFB\u97F3\u8272\uFF08\u6309 ttsEngine \u53D6\u503C\uFF1Avits \u7528\u8BF4\u8BDD\u4EBA\u540D suyingxue/gunian/fushiyu/bingjiao/bazong\uFF1Bkokoro \u7528 0-102 \u7F16\u53F7\u6216\u4E2D\u6587\u540D zf_xiaobei/zf_xiaoni/zf_xiaoxiao/zf_xiaoyi\uFF1Bedge \u7528 Edge ShortName \u5982 zh-CN-XiaoxiaoNeural \u6653\u6653\xB7\u5973\uFF0C\u5B8C\u6574\u6E05\u5355\u89C1 scripts/list-voices.mjs\uFF09"
    ),
    rate: z.number().min(0.5).max(2).default(d.rate).description("\u6717\u8BFB\u8BED\u901F\u500D\u7387\uFF080.5 = \u6162\u901F\uFF0C2.0 = \u5FEB\u901F\uFF0C1.0 = \u6B63\u5E38\uFF09"),
    interruptLevel: z.union([z.const(0), z.const(1), z.const(2)]).default(d.interruptLevel).description("\u53D1\u58F0\u6253\u65AD\u7075\u654F\u5EA6\uFF1A0 \u9AD8\u95E8\u69DB\uFF08\u5B89\u9759\u73AF\u5883\uFF0C\u9ED8\u8BA4\uFF09/ 1 \u4E2D / 2 \u4F4E\uFF08\u5608\u6742\u73AF\u5883\u66F4\u5BB9\u6613\u6253\u65AD\uFF09"),
    silenceMs: z.number().min(500).max(3e4).default(d.silenceMs).description("\u8BF4\u5B8C\u6574\u4E00\u53E5\u7684\u9759\u97F3\u505C\u987F\u6BEB\u79D2\u6570\uFF08\u9ED8\u8BA4 1500 \u6BEB\u79D2\uFF0C\u7ED9\u601D\u8003\u505C\u987F\u7559\u7A7A\u95F4\uFF1B\u81F3\u5C11 250ms \u8BED\u97F3\u624D\u5224\u53E5\uFF0C\u9632\u77ED\u4FC3\u566A\u58F0\u8BEF\u89E6\u53D1\uFF09"),
    idleTimeoutMinutes: z.number().min(1).max(120).default(d.idleTimeoutMinutes).description("\u65E0\u6D3B\u52A8\u81EA\u52A8\u9000\u51FA\u8BED\u97F3\u6A21\u5F0F\u7684\u5206\u949F\u6570\uFF08\u9ED8\u8BA4 10\uFF09"),
    modelHost: z.string().default(d.modelHost).description("ASR \u6A21\u578B\u4E0B\u8F7D\u6E90\uFF08\u7559\u7A7A\u7528\u9ED8\u8BA4\u6E90\uFF1B\u56FD\u5185\u7F51\u7EDC\u53EF\u586B https://hf-mirror.com\uFF09"),
    autoSend: z.boolean().default(d.autoSend).description("\u9759\u97F3\u5230\u70B9\u81EA\u52A8\u53D1\u9001\uFF08\u8FDE\u7EED\u591A\u6BB5\u62FC\u6210\u4E00\u6761\u6D88\u606F\uFF1B\u5173\u95ED\u5219\u53EA\u8FDB\u8349\u7A3F\u4F9B\u7F16\u8F91\uFF1B\u6309\u4F4F Ctrl / hold \u677E\u624B\u4ECD\u4F1A\u53D1\u9001\uFF09"),
    autoResume: z.boolean().default(d.autoResume).description("\u5207\u6362\u56DE\u4E0A\u6B21\u8BED\u97F3\u4F1A\u8BDD\u65F6\u81EA\u52A8\u6062\u590D\u8BED\u97F3\u6A21\u5F0F\uFF08\u9ED8\u8BA4\u5173\uFF0C\u9700\u9EA6\u514B\u98CE\u6743\u9650\u5DF2\u6388\u4E88\uFF1B\u5173\u95ED\u5219\u6BCF\u6B21\u5207\u6362\u4F1A\u8BDD\u540E\u9700\u91CD\u65B0\u70B9\u9EA6\u514B\u98CE\uFF09"),
    mode: z.union([z.const("toggle"), z.const("hold")]).default(d.mode).description("\u4EA4\u4E92\u6A21\u5F0F\uFF1Atoggle \u6301\u7EED\u8046\u542C + \u9759\u97F3\u81EA\u52A8\u65AD\u53E5\uFF08\u9ED8\u8BA4\uFF09\uFF1Bhold \u6309\u4F4F\u8BF4\u8BDD\u3001\u677E\u624B\u53D1\u9001\uFF08\u77ED\u6309\u9000\u51FA\uFF09"),
    bargeInMode: z.union([z.const("auto"), z.const("manual")]).default(d.bargeInMode).description("\u6253\u65AD\u65B9\u5F0F\uFF1Aauto \u81EA\u52A8\u6253\u65AD\uFF08\u5F00\u53E3\u5373\u6253\u65AD\uFF0C\u8033\u673A/\u5B89\u9759\u73AF\u5883\u63A8\u8350\uFF09\uFF1Bmanual \u624B\u52A8\u6253\u65AD\uFF08\u5916\u653E\u63A8\u8350\u2014\u2014\u5916\u653E\u56DE\u58F0\u4F1A\u8BEF\u89E6\u53D1\u81EA\u52A8\u6253\u65AD\uFF0C\u6539\u6309\u4F4F\u9EA6\u514B\u98CE/Ctrl \u663E\u5F0F\u6253\u65AD\uFF0C\u6C38\u4E0D\u81EA\u6253\u65AD\uFF09"),
    echoGateDb: z.number().min(3).max(12).default(d.echoGateDb).description("\u56DE\u58F0\u95E8\u63A7\u9608\u503C\uFF08dB\uFF0C\u9ED8\u8BA4 6\uFF09\uFF1A\u81EA\u52A8\u6253\u65AD\u8981\u6C42\u6B8B\u5DEE\u9AD8\u4E8E\u56DE\u58F0\u5730\u677F\u6B64\u503C\uFF1B\u5916\u653E\u4ECD\u8BEF\u6253\u65AD\u8C03\u5927\uFF088~10\uFF09\uFF0C\u592A\u96BE\u6253\u65AD\u8C03\u5C0F\uFF083~4\uFF09"),
    shortcut: z.string().default(d.shortcut).description("\u8FDB\u5165/\u9000\u51FA\u8BED\u97F3\u6A21\u5F0F\u7684\u5FEB\u6377\u952E\uFF08\u5F62\u5982 Ctrl+Shift+V\uFF0C\u4FEE\u9970\u952E Ctrl/Shift/Alt/Meta + \u4E00\u4E2A\u5B57\u6BCD\u952E\uFF1B\u7559\u7A7A\u7981\u7528\u5FEB\u6377\u952E\uFF0C\u7528\u9EA6\u514B\u98CE\u6309\u94AE\uFF09"),
    spokenFormat: z.boolean().default(d.spokenFormat).description("\u8BED\u97F3\u4F1A\u8BDD\u6CE8\u5165\u6392\u7248\u4E0E\u516C\u5F0F\u63D0\u793A\u8BCD\uFF08\u4FDD\u7559\u5B8C\u6574 Markdown \u4E0E LaTeX \u6392\u7248\uFF0C\u5E76\u8981\u6C42\u5B57\u9762\u7F8E\u5143\u7B26\u53F7\u8F6C\u4E49\u4E3A \\$\uFF1B\u9ED8\u8BA4\u5173\uFF0C\u6539\u52A8\u5373\u65F6\u751F\u6548\uFF09"),
    senseVoice: z.boolean().default(d.senseVoice).description("\u5B9A\u7A3F\u7528 SenseVoice \u91CD\u8BD1\uFF08\u5E26\u6807\u70B9+\u6570\u5B57\u5F52\u4E00\u5316\u3001\u8BC6\u522B\u66F4\u51C6\uFF1B\u9ED8\u8BA4\u5F00\u3002\u5173\u95ED\u53EF\u7701 228MB \u6A21\u578B\uFF0C\u53EA\u8D70\u6D41\u5F0F\u8BC6\u522B\uFF09"),
    wakeWord: z.string().default(d.wakeWord).description("\u5524\u9192\u8BCD\uFF1A\u5728\u5F85\u673A\u6001\u8BF4\u51FA\u540E\u5F00\u59CB\u8BC6\u522B\uFF08\u9ED8\u8BA4\u5173\uFF1B\u5982\u300C\u4F60\u597D\u5C0FD\u300D\uFF09"),
    toolBeep: z.boolean().default(d.toolBeep).description('\u5DE5\u5177\u8C03\u7528\u63D0\u793A\u97F3\uFF08\u9ED8\u8BA4\u5173\uFF09\uFF1A\u5F00\u542F\u540E AI \u8C03\u7528\u5DE5\u5177\u65F6"\u6EF4"\u4E00\u58F0\uFF0C\u5173\u95ED\u5219\u5168\u7A0B\u9759\u9ED8'),
    rewriteEnabled: z.boolean().default(d.rewriteEnabled).description("\u8BED\u97F3\u6539\u7F16\u7AD9\u603B\u5F00\u5173\uFF08\u9ED8\u8BA4\u5173\uFF09\uFF1A\u5F00\u542F\u540E\u516C\u5F0F/\u8868\u683C/\u4EE3\u7801\u5148\u6539\u5199\u6210\u53E3\u64AD\u7A3F\u518D\u6717\u8BFB\uFF1B\u6B63\u6587\u6717\u8BFB\u4E0D\u53D7\u5F71\u54CD\uFF0C\u5F00\u542F\u524D\u4E0D\u6539\u52A8\u4EFB\u4F55\u73B0\u6709\u884C\u4E3A"),
    rewriteBaseUrl: z.string().default(d.rewriteBaseUrl).description("\u6539\u5199\u6A21\u578B OpenAI \u517C\u5BB9\u7AEF\u70B9\uFF08\u9ED8\u8BA4\u667A\u8C31 GLM\uFF09\uFF1B\u8BF7\u6C42\u4ECE\u5BBF\u4E3B\u53D1\u51FA\uFF0C\u5BC6\u94A5\u4E0D\u4E0A\u6D4F\u89C8\u5668"),
    rewriteApiKeyRef: z.string().default(d.rewriteApiKeyRef).description("\u6539\u5199\u6A21\u578B\u5BC6\u94A5\u7684\u51ED\u636E\u5F15\u7528\uFF08\u586B\u73AF\u5883\u53D8\u91CF\u540D\uFF0C\u5982 GLM_API_KEY\uFF1B\u5BC6\u94A5\u4E0D\u5199\u5165\u914D\u7F6E\u660E\u6587\uFF09"),
    rewriteModel: z.string().default(d.rewriteModel).description("\u6539\u5199\u6A21\u578B\u540D\uFF08\u9ED8\u8BA4 glm-4.5-air\uFF09"),
    rewriteTimeoutMs: z.number().min(500).max(6e4).default(d.rewriteTimeoutMs).description("\u6539\u5199\u8BF7\u6C42\u8D85\u65F6\u6BEB\u79D2\uFF08\u9ED8\u8BA4 8000\uFF1B\u8D85\u65F6\u81EA\u52A8\u56DE\u9000\u786E\u5B9A\u6027\u8BFB\u6CD5\uFF09"),
    rewriteMaxTokens: z.number().min(64).max(4e3).default(d.rewriteMaxTokens).description("\u6539\u5199\u8F93\u51FA token \u57FA\u7EBF\uFF08\u9ED8\u8BA4 400\uFF09\uFF1A\u63D2\u4EF6\u4F1A\u6309\u7247\u6BB5\u957F\u5EA6\u81EA\u52A8\u4E0A\u8C03\uFF08\u4E0A\u9650 2048\uFF09\uFF0C\u907F\u514D JSON \u88AB\u622A\u65AD"),
    rewriteTemperature: z.number().min(0).max(2).default(d.rewriteTemperature).description("\u6539\u5199\u6E29\u5EA6\uFF08\u9ED8\u8BA4 0\uFF0C\u8D8A\u4F4E\u8D8A\u7A33\u5B9A\uFF09"),
    rewriteCache: z.boolean().default(d.rewriteCache).description("\u76F8\u540C\u7247\u6BB5\u590D\u7528\u8BB2\u7A3F\uFF08\u9ED8\u8BA4\u5F00\uFF0C\u51CF\u5C11\u91CD\u590D\u8BF7\u6C42\uFF09"),
    rewriteDisableThinking: z.boolean().default(d.rewriteDisableThinking).description("\u5173\u95ED\u6539\u5199\u6A21\u578B\u7684\u601D\u8003\u94FE\uFF08\u9ED8\u8BA4\u5F00\uFF09\uFF1AGLM-4.5 \u7B49\u601D\u8003\u578B\u6A21\u578B\u4E0D\u5173\u601D\u8003\u53EA\u4F1A\u8F93\u51FA\u63A8\u7406\u3001\u6B63\u6587\u4E3A\u7A7A\uFF0C\u5BFC\u81F4\u6539\u5199\u56DE\u9000\uFF1B\u4EC5\u7AEF\u70B9\u652F\u6301 thinking \u53C2\u6570\u65F6\u6709\u6548"),
    rewriteContextChars: z.number().min(0).max(4e3).default(d.rewriteContextChars).description("\u4F20\u7ED9\u6539\u5199\u6A21\u578B\u7684\u524D\u6587\u5B57\u7B26\u4E0A\u9650\uFF08\u9ED8\u8BA4 800\uFF1B\u5B9E\u9645\u957F\u5EA6\u6309\u7247\u6BB5\u52A8\u6001\u4F38\u7F29\uFF0C\u77ED\u7247\u6BB5\u5C11\u7ED9\u3001\u5927\u4EE3\u7801\u5757/\u5927\u8868\u683C\u591A\u7ED9\uFF1B0 = \u4E0D\u7ED9\u524D\u6587\uFF0C\u4EC5\u4FDD\u7559\u7B26\u53F7\u8868\uFF09"),
    pronunciationEnabled: z.boolean().default(d.pronunciationEnabled).description("\u542F\u7528\u591A\u97F3\u5B57\u7528\u6237\u8BCD\u8868\uFF08\u9ED8\u8BA4\u5F00\uFF09\u3002\u5173 = \u5B8C\u5168\u4E0D\u6539\u4EFB\u4F55\u6717\u8BFB\u6587\u672C\uFF08\u5C4F\u5E55\u672C\u6765\u5C31\u4E0D\u53D7\u5F71\u54CD\uFF09"),
    pronunciationFixes: z.string().default(d.pronunciationFixes).description("\u591A\u97F3\u5B57\u7528\u6237\u8BCD\u8868\uFF08\u53EF\u589E\u5220/\u6E05\u7A7A\uFF09\uFF1A\u6BCF\u884C\u300C\u539F\u8BCD => \u540C\u97F3\u66FF\u8EAB\u300D\uFF0C\u66FF\u8EAB\u5FC5\u987B\u4E0E\u539F\u8BCD\u7B49\u5B57\u6570\uFF0C\u53EA\u5141\u8BB8\u540C\u97F3\u66FF\u6362\uFF0C\u4E0D\u5141\u8BB8\u589E\u5220\u5B57\u6216\u6539\u6210\u540C\u4E49\u8BCD\uFF1B\u539F\u8BCD\u4E5F\u53EF\u5199\u6210\u6B63\u5219 /pattern/flags\uFF08\u7528\u4E8E\u300C\u7B2C N \u884C\u300D\u8FD9\u7C7B\u52A8\u6001\u4E0A\u4E0B\u6587\uFF0C\u6B64\u65F6\u8DF3\u8FC7\u7B49\u5B57\u6570\u6821\u9A8C\uFF0C\u66FF\u6362\u4E32\u652F\u6301 $1\uFF09\u3002\u9ED8\u8BA4\u503C\u662F\u4E00\u4EFD\u300C\u884C(h\xE1ng)\u300D\u540C\u97F3\u8BCD\u8868\uFF0C\u4E0D\u4EE3\u8868\u56FA\u5B9A\u5185\u7F6E\uFF0C\u968F\u65F6\u53EF\u6539"),
    guardMode: z.union([z.const("off"), z.const("lenient"), z.const("standard"), z.const("strict")]).default(d.guardMode).description("\u6539\u5199\u5B88\u536B\u5F3A\u5EA6\uFF1Astandard \u9ED8\u8BA4 / lenient \u653E\u5BBD\uFF08\u66F4\u96BE\u89E6\u53D1\u56DE\u9000\uFF09/ strict \u6536\u7D27 / off \u5168\u5173\uFF08\u53EA\u4FDD\u7559 JSON \u534F\u8BAE\u89E3\u6790\uFF0C\u98CE\u9669\u81EA\u8D1F\uFF09"),
    guardAllowRules: z.string().default(d.guardAllowRules).description("\u81EA\u5B9A\u4E49\u653E\u884C\u89C4\u5219\uFF08\u6BCF\u884C\u4E00\u6761\uFF0C# \u6CE8\u91CA\uFF09\uFF1A\u6574\u884C /\u6B63\u5219/flags \u547D\u4E2D\u300C\u6539\u5199\u7A3F\u300D\u5373\u653E\u884C\uFF1Bseg: \u524D\u7F00\u6539\u4E3A\u547D\u4E2D\u300C\u539F\u59CB\u7247\u6BB5\u300D\uFF08\u8BE5\u7247\u6BB5\u8DF3\u8FC7\u5168\u90E8\u5B88\u536B\uFF09\uFF1B\u5176\u5B83\u6309\u5B57\u9762\u6587\u5B57\u505A\u5B50\u4E32\u5339\u914D\u3002\u7528\u4E8E\u628A\u5B88\u536B\u8BEF\u6740\u7684\u8BFB\u6CD5\u653E\u884C"),
    blockPauseMs: z.number().min(0).max(3e3).default(d.blockPauseMs).description('\u6BB5\u843D\u4E4B\u95F4\u7684\u505C\u987F\u6BEB\u79D2\uFF08\u9ED8\u8BA4 350\uFF1B0 = \u5173\uFF09\u3002\u6807\u9898\u4E4B\u540E\u7528 1.6 \u500D\u2014\u2014\u89E3\u51B3"\u6362\u6BB5/\u6807\u9898\u5230\u6B63\u6587\u4E00\u53E3\u6C14\u5FF5\u5B8C"\u7684\u4E0D\u81EA\u7136'),
    wholeSentenceMath: z.boolean().default(d.wholeSentenceMath).description("\u542B\u884C\u5185\u516C\u5F0F\u7684\u6574\u53E5\u4EA4\u7ED9\u6A21\u578B\u51FA\u7A3F\uFF08\u9ED8\u8BA4\u5F00\uFF09\uFF1A\u6574\u53E5\u4E00\u6B21\u6210\u578B\uFF0C\u6B63\u6587\u4E0E\u516C\u5F0F\u4E0D\u4F1A\u5404\u5FF5\u4E00\u904D\u3002\u5173\u6389\u5219\u9000\u56DE\u516C\u5F0F\u7247\u6BB5\u5355\u72EC\u6539\u5199\uFF0C\u957F\u53E5\u5BB9\u6613\u51FA\u73B0\u91CD\u590D\u6717\u8BFB\u3002\u4EC5 mathMode=model \u65F6\u751F\u6548"),
    mathMode: z.union([z.const("rules"), z.const("model"), z.const("verbatim")]).default(d.mathMode).description("\u6570\u5B66\u6717\u8BFB\u6A21\u5F0F\uFF1Arules \u786E\u5B9A\u6027\u89C4\u5219\uFF08\u9ED8\u8BA4\uFF0C\u96F6\u5BB9\u9519\uFF09/ model \u4EA4\u7ED9\u6539\u5199\u6A21\u578B / verbatim \u539F\u6837\u5FF5\u51FA")
  });
}
var VoiceSettingsSchema = createVoiceSettingsSchema();
var Config = z.object({
  enabled: z.boolean().default(true),
  cacheDir: z.string().default(defaultModelCacheDir()),
  modelHost: z.string().default("https://huggingface.co"),
  ttsEngine: z.union([z.const("edge"), z.const("vits"), z.const("kokoro"), z.const("azure")]).default("edge"),
  kokoroModel: z.union([z.const("int8"), z.const("fp32")]).default("int8"),
  allowLan: z.boolean().default(false),
  allowCustomModelHost: z.boolean().default(false),
  voice: z.string().default("zh-CN-XiaoxiaoNeural"),
  rate: z.number().default(1),
  interruptLevel: z.union([z.const(0), z.const(1), z.const(2)]).default(0),
  silenceMs: z.number().default(1500),
  idleTimeoutMinutes: z.number().default(10)
});
function apply(ctx, config) {
  let activeVoiceSession = null;
  let activeTabId = null;
  let ownerYieldTimer = null;
  const turnStates = /* @__PURE__ */ new Map();
  const setTurn = (sessionId, state) => {
    if (turnStates.get(sessionId) === state) return;
    turnStates.set(sessionId, state);
    broadcast("turn", { sessionId, state });
  };
  const turnGen = /* @__PURE__ */ new Map();
  const sessions = ctx.get("sessions");
  const limiter = new RateLimiter();
  const limiterPrune = setInterval(() => limiter.prune(Date.now(), 6e4), 6e4);
  ctx.effect(() => () => clearInterval(limiterPrune));
  const normalizedModelHost = () => validateModelHost(vset.modelHost, config.allowCustomModelHost) ?? HOST_PRIMARY;
  const denyNonLoopback = (req, res) => {
    if (!config.allowLan && !isLoopbackRequest(req)) {
      res.statusCode = 403;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "loopback only (allowLan=false)" }));
      return true;
    }
    return false;
  };
  const denyCrossOrigin = (req, res) => {
    if (!sameOriginRequest(req)) {
      res.statusCode = 403;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "cross-origin request denied" }));
      return true;
    }
    return false;
  };
  const sseClients = /* @__PURE__ */ new Set();
  const latestConnByTab = /* @__PURE__ */ new Map();
  const broadcast = (event, payload) => {
    for (const c of sseClients) {
      try {
        c.send(event, payload);
      } catch {
      }
    }
  };
  const settingsScope = ctx.settings.register(
    NS_VOICE_MODE,
    createVoiceSettingsSchema(),
    {
      base: {
        ttsEngine: config.ttsEngine,
        voice: config.voice,
        rate: config.rate,
        interruptLevel: config.interruptLevel,
        silenceMs: config.silenceMs,
        idleTimeoutMinutes: config.idleTimeoutMinutes,
        modelHost: config.modelHost
      }
    }
  );
  let vset = settingsScope.get();
  let rewriter = null;
  let rewriterSig = "";
  let guardAllow = { speech: [], segment: [], errors: [] };
  let guardAllowRaw = null;
  const syncGuard = () => {
    const raw = vset.guardAllowRules ?? "";
    if (raw === guardAllowRaw) return;
    guardAllowRaw = raw;
    guardAllow = parseGuardAllow(raw);
  };
  syncGuard();
  const resolveCredential = async (rawRef) => {
    const raw = String(rawRef ?? "").trim();
    if (!raw) return "";
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) {
      const creds = ctx.get("credentials");
      if (creds && typeof creds.resolve === "function") {
        try {
          const r = await creds.resolve(raw);
          if (r && typeof r.value === "string" && r.value) return r.value;
        } catch {
        }
      }
      return process.env[raw] ?? "";
    }
    return raw;
  };
  const resolveRewriteKey = () => resolveCredential(vset.rewriteApiKeyRef);
  const resolveAzureKey = () => resolveCredential(vset.azureKeyRef);
  const rebuildRewriter = () => {
    const s = vset;
    const sig = [
      s.rewriteEnabled,
      s.rewriteBaseUrl,
      s.rewriteApiKeyRef,
      s.rewriteModel,
      s.rewriteTimeoutMs,
      s.rewriteMaxTokens,
      s.rewriteTemperature,
      s.rewriteCache,
      s.rewriteDisableThinking,
      s.guardMode,
      guardAllowRaw
    ].join("|");
    if (sig === rewriterSig) return;
    rewriterSig = sig;
    rewriter = s.rewriteEnabled ? new SpeechRewriter({
      baseUrl: s.rewriteBaseUrl,
      apiKey: resolveRewriteKey,
      model: s.rewriteModel,
      timeoutMs: s.rewriteTimeoutMs,
      maxTokens: s.rewriteMaxTokens,
      temperature: s.rewriteTemperature,
      cache: s.rewriteCache,
      disableThinking: s.rewriteDisableThinking,
      guardMode: s.guardMode,
      guardAllow
    }) : null;
  };
  rebuildRewriter();
  let pronunciation = [];
  let pronunciationRaw = null;
  let pronunciationErrors = [];
  const syncPronunciation = () => {
    const raw = vset.pronunciationFixes ?? "";
    if (raw === pronunciationRaw) return;
    pronunciationRaw = raw;
    const parsed = parsePronunciationFixes(raw);
    pronunciationErrors = parsed.errors;
    pronunciation = vset.pronunciationEnabled ? parsed.fixes : [];
  };
  syncPronunciation();
  const speechConfig = () => ({
    enabled: vset.rewriteEnabled,
    mathMode: vset.mathMode,
    rewriter,
    pronunciation,
    contextChars: vset.rewriteContextChars,
    blockPauseMs: vset.blockPauseMs,
    wholeSentenceMath: vset.wholeSentenceMath
  });
  const asr = createAsrRuntime({
    cacheDir: config.cacheDir,
    modelHost: () => vset.modelHost,
    // P4：SenseVoice 定稿重译开关（实时读取，关闭则不下载/不创建模型）。
    senseVoice: () => vset.senseVoice,
    // 断句静音阈值（实时读取）：端点 VAD minSilenceDuration 跟随设置。
    silenceMs: () => vset.silenceMs,
    allowCustomHost: config.allowCustomModelHost,
    broadcast
  });
  ctx.effect(() => () => asr.dispose());
  void asr.warmup();
  const makeEngine = (kind) => {
    if (kind === "edge") return new EdgeTtsEngine(config.voice, config.rate);
    if (kind === "azure") {
      return new AzureTtsEngine({
        endpoint: () => vset.azureEndpoint,
        resolveKey: resolveAzureKey,
        phonemes: () => parsePhonemeTable(vset.azurePhonemes).rules,
        voice: vset.voice || config.voice,
        rate: vset.rate
      });
    }
    if (kind === "kokoro") {
      return createSherpaKokoroEngine({
        cacheDir: config.cacheDir,
        modelHost: normalizedModelHost,
        allowCustomHost: config.allowCustomModelHost,
        model: vset.kokoroModel,
        broadcast
      });
    }
    return createSherpaVitsEngine({
      cacheDir: config.cacheDir,
      modelHost: normalizedModelHost,
      allowCustomHost: config.allowCustomModelHost,
      broadcast
    });
  };
  let engineKind = vset.ttsEngine ?? config.ttsEngine;
  let activeKokoroModel = vset.kokoroModel;
  const queue = new TtsQueue({
    engine: makeEngine(engineKind),
    onError: (sessionId) => broadcast("tts-error", { sessionId })
  });
  queue.updateVoice(vset.voice, vset.rate);
  const unsubscribe = queue.subscribe((frame) => broadcast("audio", frame));
  ctx.effect(() => unsubscribe);
  ctx.effect(() => () => void queue.close());
  ctx.effect(
    () => settingsScope.watch((next) => {
      vset = next;
      guardAllowRaw = null;
      syncGuard();
      rebuildRewriter();
      syncPronunciation();
      if (next.ttsEngine !== engineKind) {
        engineKind = next.ttsEngine;
        queue.setEngine(makeEngine(engineKind));
      } else if (engineKind === "kokoro" && next.kokoroModel !== activeKokoroModel) {
        activeKokoroModel = next.kokoroModel;
        queue.setEngine(makeEngine("kokoro"));
      }
      queue.updateVoice(next.voice, next.rate);
    })
  );
  const currentVoice = () => vset.voice;
  const currentRate = () => vset.rate;
  const currentInterrupt = () => vset.interruptLevel;
  const currentEngine = () => engineKind;
  const yieldActiveSession = (expectedSid) => {
    ownerYieldTimer = null;
    const sid = activeVoiceSession;
    if (!sid) return;
    if (expectedSid !== void 0 && expectedSid !== sid) return;
    activeVoiceSession = null;
    activeTabId = null;
    queue.cancel(sid);
    asr.reset(sid);
    setTurn(sid, "idle");
    turnStates.delete(sid);
    broadcast("mode", { active: null, ownerTabId: activeTabId });
  };
  ctx.on("system-prompt/assemble", (assembly, context, next) => {
    if (!config.enabled || !vset.spokenFormat) return next();
    const agentId = context.agent?.id;
    if (agentId !== void 0 && agentId === activeVoiceSession) {
      assembly.sections.push({ name: VOICE_SPOKEN_SECTION, text: VOICE_SPOKEN_PROMPT });
    }
    return next();
  });
  ctx.on("llm/stream", (options, next) => {
    const rawSessionId = options.sessionId;
    if (!config.enabled || rawSessionId === void 0 || options.purpose !== void 0) return next();
    const sessionId = rawSessionId;
    if (activeVoiceSession !== sessionId) return next();
    const gen = (turnGen.get(sessionId) ?? 0) + 1;
    turnGen.set(sessionId, gen);
    return tapActiveStream(
      sessionId,
      next(),
      queue,
      broadcast,
      (state) => {
        if ((turnGen.get(sessionId) ?? 0) === gen) setTurn(sessionId, state);
      },
      speechConfig
    );
  });
  const base = BASE_PATH;
  ctx.effect(
    () => ctx.webServer.register({
      kind: "prefix",
      path: base,
      handler: (req, res) => {
        if (denyNonLoopback(req, res)) return;
        respondJson2(res, 200, {
          ok: true,
          name: "dsh-voice-mode-adaptation",
          enabled: config.enabled,
          active: activeVoiceSession,
          // 被拒绝的替代表行 / 放行规则行 / Azure 拼音表行：给用户可见反馈，而不是静默忽略。
          pronunciationErrors,
          guardErrors: guardAllow.errors,
          azurePhonemeErrors: parsePhonemeTable(vset.azurePhonemes).errors
        });
      }
    })
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: `${base}/config`,
      handler: (req, res) => {
        if (denyNonLoopback(req, res)) return;
        respondJson2(res, 200, {
          basePath: base,
          rate: currentRate(),
          voice: currentVoice(),
          senseVoice: vset.senseVoice,
          interruptLevel: currentInterrupt(),
          silenceMs: vset.silenceMs,
          idleTimeoutMinutes: vset.idleTimeoutMinutes,
          modelHost: vset.modelHost,
          autoSend: vset.autoSend,
          autoResume: vset.autoResume,
          mode: vset.mode,
          bargeInMode: vset.bargeInMode,
          echoGateDb: vset.echoGateDb,
          shortcut: vset.shortcut,
          wakeWord: vset.wakeWord,
          toolBeep: vset.toolBeep,
          cacheDir: config.cacheDir,
          ttsEngine: currentEngine(),
          audioMime: queue.mime,
          allowLan: config.allowLan
        });
      }
    })
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: `${base}/preview`,
      handler: (req, res) => {
        if (denyNonLoopback(req, res)) return;
        if (denyCrossOrigin(req, res)) return;
        if (!limiter.hit(`preview:${req.socket.remoteAddress ?? "unknown"}`, 20, 6e4)) {
          res.statusCode = 429;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "rate limited" }));
          return;
        }
        if (!config.enabled) {
          respondJson2(res, 403, { error: "voice mode disabled" });
          return;
        }
        collectBody(req, res, MAX_JSON_BODY, async (body) => {
          let voice = "";
          let rate;
          try {
            const parsed = JSON.parse(body || "{}");
            voice = String(parsed.voice ?? "").trim();
            if (typeof parsed.rate === "number" && Number.isFinite(parsed.rate)) {
              rate = Math.min(2, Math.max(0.5, parsed.rate));
            }
          } catch {
          }
          if (voice.length > 128) {
            respondJson2(res, 400, { error: "voice too long" });
            return;
          }
          if (!voice) {
            respondJson2(res, 400, { error: "voice required" });
            return;
          }
          const sample = currentEngine() === "kokoro" ? "\u4F60\u597D\uFF0C\u6B22\u8FCE\u4F7F\u7528\u8BED\u97F3\u6A21\u5F0F\u3002Hello, welcome to voice mode." : currentEngine() === "vits" || voice.startsWith("zh-") ? "\u4F60\u597D\uFF0C\u6B22\u8FCE\u4F7F\u7528\u8BED\u97F3\u6A21\u5F0F\u3002" : "Hello, welcome to voice mode.";
          let buf;
          try {
            buf = await queue.synthesize(sample, { voice, rate });
          } catch (e) {
            console.warn(`[dsh-voice-mode-adaptation] preview synthesis failed: ${String(e)}`);
            respondJson2(res, 502, { error: "\u9884\u89C8\u5408\u6210\u5931\u8D25\uFF1A\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216\u97F3\u8272\u540D\uFF08ShortName\uFF09\u662F\u5426\u6B63\u786E" });
            return;
          }
          res.writeHead(200, { "content-type": queue.mime, "cache-control": "no-store" });
          res.end(buf);
        });
      }
    })
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: base + "/rewrite-key",
      handler: (req, res) => {
        if (denyNonLoopback(req, res)) return;
        if (denyCrossOrigin(req, res)) return;
        if (req.method !== "POST") {
          respondJson2(res, 405, { error: "POST only" });
          return;
        }
        if (!limiter.hit("rewrite-key:" + (req.socket.remoteAddress ?? "unknown"), 10, 6e4)) {
          respondJson2(res, 429, { error: "rate limited" });
          return;
        }
        collectBody(req, res, MAX_JSON_BODY, async (body) => {
          let ref = "";
          let value = "";
          try {
            const parsed = JSON.parse(body || "{}");
            ref = String(parsed.ref ?? "").trim();
            value = String(parsed.value ?? "");
          } catch {
          }
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ref)) {
            respondJson2(res, 400, { error: "invalid ref (use an env-var name like GLM_API_KEY)" });
            return;
          }
          const creds = ctx.get("credentials");
          if (!creds || typeof creds.set !== "function") {
            respondJson2(res, 501, { error: "credentials service unavailable" });
            return;
          }
          try {
            if (!value.trim()) {
              if (typeof creds.unset === "function") await creds.unset(ref);
              respondJson2(res, 200, { ok: true, ref, cleared: true });
              return;
            }
            await creds.set(ref, value);
            respondJson2(res, 200, { ok: true, ref });
          } catch (e) {
            respondJson2(res, 500, { error: "store failed: " + String(e?.message ?? e) });
          }
        });
      }
    })
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: `${base}/toggle`,
      handler: (req, res) => {
        if (denyNonLoopback(req, res)) return;
        if (denyCrossOrigin(req, res)) return;
        collectBody(req, res, MAX_JSON_BODY, (body) => {
          let sessionId;
          let on;
          let tabId;
          try {
            const parsed = JSON.parse(body || "{}");
            sessionId = parsed.sessionId;
            on = parsed.on;
            tabId = typeof parsed.tabId === "string" && parsed.tabId.length <= 64 ? parsed.tabId : void 0;
          } catch {
          }
          if (!sessionId) {
            respondJson2(res, 400, { error: "sessionId required" });
            return;
          }
          if (on !== void 0 && typeof on !== "boolean") {
            respondJson2(res, 400, { error: "invalid on" });
            return;
          }
          if (!limiter.hit(`toggle:${sessionId}`, 2, 2e3)) {
            res.statusCode = 429;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "rate limited" }));
            return;
          }
          if (on === true) {
            if (!config.enabled) {
              respondJson2(res, 403, { error: "voice mode disabled" });
              return;
            }
            if (sessions && !sessions.get(sessionId)) {
              respondJson2(res, 403, { error: "unknown session" });
              return;
            }
            asr.reset(sessionId);
            queue.cancel(sessionId);
            const previous4 = activeVoiceSession;
            activeVoiceSession = sessionId;
            activeTabId = tabId ?? null;
            if (ownerYieldTimer) {
              clearTimeout(ownerYieldTimer);
              ownerYieldTimer = null;
            }
            if (previous4 && previous4 !== sessionId) {
              queue.cancel(previous4);
              asr.reset(previous4);
              setTurn(previous4, "idle");
              turnStates.delete(previous4);
            }
            broadcast("mode", { active: activeVoiceSession, ownerTabId: activeTabId });
          } else {
            if (activeVoiceSession === sessionId) {
              activeVoiceSession = null;
              activeTabId = null;
              if (ownerYieldTimer) {
                clearTimeout(ownerYieldTimer);
                ownerYieldTimer = null;
              }
              queue.cancel(sessionId);
              asr.reset(sessionId);
              setTurn(sessionId, "idle");
              turnStates.delete(sessionId);
              broadcast("mode", { active: null, ownerTabId: null });
            }
          }
          respondJson2(res, 200, { active: activeVoiceSession });
        });
      }
    })
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: `${base}/models/status`,
      handler: (req, res) => {
        if (denyNonLoopback(req, res)) return;
        respondJson2(res, 200, { ...asr.modelStatus(), tts: queue.status() });
      }
    })
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: `${base}/models/retry`,
      handler: (req, res) => {
        if (denyNonLoopback(req, res)) return;
        if (!config.enabled) {
          respondJson2(res, 403, { error: "voice mode disabled" });
          return;
        }
        collectBody(req, res, MAX_JSON_BODY, (body) => {
          let kind = "asr";
          try {
            const p = JSON.parse(body || "{}");
            if (p.kind === void 0) {
            } else if (p.kind === "vad" || p.kind === "sense" || p.kind === "asr") {
              kind = p.kind;
            } else {
              respondJson2(res, 400, { error: "invalid kind" });
              return;
            }
          } catch {
            respondJson2(res, 400, { error: "invalid json" });
            return;
          }
          void asr.retryModel(kind).then((done) => {
            respondJson2(res, 200, { ok: done, kind });
          });
        });
      }
    })
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: `${base}/models/clean`,
      handler: (req, res) => {
        if (denyNonLoopback(req, res)) return;
        if (denyCrossOrigin(req, res)) return;
        if (!config.enabled) {
          respondJson2(res, 403, { error: "voice mode disabled" });
          return;
        }
        collectBody(req, res, MAX_JSON_BODY, (body) => {
          let engine = "vits";
          try {
            const p = JSON.parse(body || "{}");
            if (p.engine === "kokoro" || p.engine === "vits") engine = p.engine;
            else {
              respondJson2(res, 400, { error: "invalid engine" });
              return;
            }
          } catch {
            respondJson2(res, 400, { error: "invalid json" });
            return;
          }
          const dir = join4(config.cacheDir, engine === "kokoro" ? kokoroModelDir(vset.kokoroModel) : TTS_MODEL_REPO);
          void rm(dir, { recursive: true, force: true }).then(() => {
            if (engineKind === engine) {
              queue.setEngine(makeEngine(engine));
              queue.updateVoice(vset.voice, vset.rate);
            }
            respondJson2(res, 200, { ok: true, engine });
          }).catch((e) => respondJson2(res, 500, { error: String(e) }));
        });
      }
    })
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: `${base}/models/download`,
      handler: (req, res) => {
        if (denyNonLoopback(req, res)) return;
        if (denyCrossOrigin(req, res)) return;
        if (!config.enabled) {
          respondJson2(res, 403, { error: "voice mode disabled" });
          return;
        }
        collectBody(req, res, MAX_JSON_BODY, (body) => {
          let engine = "vits";
          try {
            const p = JSON.parse(body || "{}");
            if (p.engine === "kokoro" || p.engine === "vits") engine = p.engine;
            else {
              respondJson2(res, 400, { error: "invalid engine" });
              return;
            }
          } catch {
            respondJson2(res, 400, { error: "invalid json" });
            return;
          }
          if (engineKind !== engine) {
            respondJson2(res, 400, { error: "engine not active" });
            return;
          }
          void queue.prepare().then(() => respondJson2(res, 200, { ok: true, engine })).catch((e) => {
            console.warn(`[dsh-voice-mode-adaptation] model download failed: ${String(e)}`);
            respondJson2(res, 502, { error: "\u6A21\u578B\u4E0B\u8F7D\u5931\u8D25\uFF1A\u8BF7\u68C0\u67E5\u7F51\u7EDC" });
          });
        });
      }
    })
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: `${base}/voices`,
      handler: async (req, res) => {
        if (denyNonLoopback(req, res)) return;
        if (denyCrossOrigin(req, res)) return;
        try {
          const voices = await listEdgeVoices();
          respondJson2(res, 200, { voices });
        } catch (e) {
          respondJson2(res, 502, { error: String(e) });
        }
      }
    })
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: `${base}/asr`,
      handler: (req, res) => {
        if (denyNonLoopback(req, res)) return;
        let sid = "";
        try {
          const url = new URL(req.url ?? "/", "http://localhost");
          sid = url.searchParams.get("sessionId") ?? "";
        } catch {
        }
        if (!limiter.hit(`asr:${sid || "unknown"}`, 60, 1e3)) {
          respondJson2(res, 429, { error: "rate limited" });
          return;
        }
        if (sid && sid === activeVoiceSession) {
          try {
            const url = new URL(req.url ?? "/", "http://localhost");
            setTurn(sid, url.searchParams.get("final") === "1" ? "finalizing" : "listening");
          } catch {
          }
        }
        handleAsrRequest(asr, activeVoiceSession, req, res);
      }
    })
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: `${base}/cancel`,
      handler: (req, res) => {
        if (denyNonLoopback(req, res)) return;
        if (denyCrossOrigin(req, res)) return;
        collectBody(req, res, MAX_JSON_BODY, (body) => {
          let sessionId;
          let keepAsr = false;
          try {
            const parsed = JSON.parse(body || "{}");
            sessionId = parsed.sessionId;
            keepAsr = parsed.keepAsr === true;
          } catch {
          }
          if (sessionId && sessionId === activeVoiceSession) {
            if (!limiter.hit(`cancel:${sessionId}`, 2, 1e3)) {
              respondJson2(res, 429, { error: "rate limited" });
              return;
            }
            queue.cancel(sessionId);
            if (!keepAsr) asr.reset(sessionId);
          }
          respondJson2(res, 200, { ok: true });
        });
      }
    })
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: `${base}/mode`,
      handler: (req, res) => {
        if (denyNonLoopback(req, res)) return;
        if (denyCrossOrigin(req, res)) return;
        collectBody(req, res, MAX_JSON_BODY, (body) => {
          let mode;
          try {
            const parsed = JSON.parse(body || "{}");
            mode = parsed.mode === "toggle" || parsed.mode === "hold" ? parsed.mode : void 0;
          } catch {
          }
          if (!mode) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "mode must be toggle or hold" }));
            return;
          }
          void settingsScope.update({ mode }).then(() => {
            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true, mode }));
          }).catch((e) => {
            console.warn(`[dsh-voice-mode-adaptation] mode update failed: ${String(e)}`);
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "mode update failed" }));
          });
        });
      }
    })
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: `${base}/stream`,
      handler: (req, res) => {
        if (denyNonLoopback(req, res)) return;
        if (sseClients.size >= 4) {
          respondJson2(res, 429, { error: "too many streams" });
          return;
        }
        let tabId = null;
        try {
          const u = new URL(req.url ?? "/", "http://localhost");
          tabId = u.searchParams.get("tabId");
        } catch {
        }
        if (tabId !== null && tabId.length > 64) tabId = null;
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive"
        });
        res.write("retry: 3000\n\n");
        const send = (event, payload) => {
          res.write(`event: ${event}
data: ${JSON.stringify(payload)}

`);
        };
        const client = { tabId, send };
        sseClients.add(client);
        if (tabId !== null) latestConnByTab.set(tabId, client);
        if (tabId !== null && tabId === activeTabId && ownerYieldTimer) {
          clearTimeout(ownerYieldTimer);
          ownerYieldTimer = null;
        }
        send("mode", { active: activeVoiceSession, ownerTabId: activeTabId });
        const heartbeat = setInterval(() => {
          try {
            res.write(": hb\n");
          } catch {
          }
        }, 25e3);
        let cleaned = false;
        const cleanup = () => {
          if (cleaned) return;
          cleaned = true;
          clearInterval(heartbeat);
          sseClients.delete(client);
          if (tabId !== null && latestConnByTab.get(tabId) === client) {
            latestConnByTab.delete(tabId);
            if (tabId === activeTabId) {
              if (ownerYieldTimer) clearTimeout(ownerYieldTimer);
              ownerYieldTimer = setTimeout(() => yieldActiveSession(activeVoiceSession), 8e3);
            }
          }
        };
        req.on("close", cleanup);
        res.on("close", cleanup);
      }
    })
  );
}
var MAX_JSON_BODY = 16 * 1024;
function collectBody(req, res, maxBytes, onBody) {
  const chunks = [];
  let received = 0;
  let tooLarge = false;
  req.on("data", (c) => {
    if (tooLarge) return;
    received += c.length;
    if (received > maxBytes) {
      tooLarge = true;
      respondJson2(res, 413, { error: "request body too large" });
      return;
    }
    chunks.push(c);
  });
  req.on("end", () => {
    if (tooLarge) return;
    const body = Buffer.concat(chunks).toString("utf8");
    try {
      const r = onBody(body);
      if (r && typeof r.then === "function") r.catch(() => {
      });
    } catch {
    }
  });
  req.on("error", () => {
  });
}
async function* tapActiveStream(sessionId, inner, queue, broadcast, onTurn, getSpeechConfig) {
  let firstTokenBroadcast = false;
  let firstSentenceBroadcast = false;
  let flushed = false;
  let finishReason = null;
  const adapter = new SpeechAdapter({
    config: getSpeechConfig,
    onSentence: (s, pauseBeforeMs) => {
      if (!firstSentenceBroadcast) {
        firstSentenceBroadcast = true;
        broadcast("latency", { sessionId, stage: "first-sentence-text" });
      }
      queue.enqueue(sessionId, s, pauseBeforeMs);
    }
  });
  const flushOnce = () => {
    if (flushed) return;
    flushed = true;
    adapter.flush();
  };
  try {
    for await (const chunk of inner) {
      if (chunk.type === "text-delta" && chunk.text) {
        if (!firstTokenBroadcast) {
          firstTokenBroadcast = true;
          broadcast("latency", { sessionId, stage: "first-llm-token" });
          onTurn("agent-speaking");
        }
        adapter.feed(chunk.text);
      }
      if (chunk.type === "tool-call-delta" && chunk.name) {
        broadcast("tool", { sessionId, name: chunk.name });
      }
      if (chunk.type === "finish") {
        finishReason = chunk.reason;
      }
      yield chunk;
    }
  } finally {
    const aborted = finishReason !== null && typeof finishReason === "object" && finishReason.kind === "aborted";
    if (!aborted) flushOnce();
    onTurn("listening");
  }
}
export {
  Config,
  VoiceSettingsSchema,
  apply,
  createVoiceSettingsSchema,
  inject,
  name
};
