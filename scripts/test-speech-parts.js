import { test } from "node:test";
import assert from "node:assert/strict";
import {
  splitText,
  readWav,
  mergeWavs,
  run,
  plan,
} from "../src/lib/speech-parts.js";
import { BrowserVoiceEngine } from "../src/services/BrowserVoiceEngine.js";
function wav(samples, rate = 48000) {
  const header = new ArrayBuffer(44),
    v = new DataView(header);
  const str = (at, s) =>
    [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  return new Blob([header, new Int16Array(samples)], { type: "audio/wav" });
}
const compact = (s) => s.replace(/\s/gu, "");
test("short text stays one part; paragraphs and sentences retain their content", () => {
  assert.deepEqual(splitText("Hello, world."), ["Hello, world."]);
  assert.deepEqual(splitText(""), []);
  const text =
    "A short sentence. Another sentence with a useful pause! ".repeat(25) +
    "\n\nA new paragraph.";
  const parts = splitText(text);
  assert.ok(parts.length > 2);
  assert.equal(compact(parts.join("")), compact(text));
  assert.ok(parts.every((p) => Array.from(p).length <= 200));
  assert.equal(parts.at(-1), "A new paragraph.");
});
test("Khmer without spaces splits at safe grapheme boundaries without dropping text", () => {
  const text =
    "ខ្ញុំកំពុងអានអត្ថបទនេះយ៉ាងច្បាស់ដើម្បីបង្កើតសំឡេងផ្ទាល់ខ្លួនរបស់ខ្ញុំ។".repeat(
      40,
    );
  const parts = splitText(text);
  const boundaries = new Set(
    [
      ...new Intl.Segmenter("km", { granularity: "grapheme" }).segment(text),
    ].map((s) => s.index + s.segment.length),
  );
  let offset = 0;
  for (const part of parts) {
    offset += part.length;
    assert.ok(boundaries.has(offset));
    assert.ok(Array.from(part).length <= 200);
  }
  assert.equal(parts.join(""), text);
  const emoji = "👨‍👩‍👧‍👦".repeat(60);
  assert.equal(splitText(emoji).join(""), emoji);
  assert.ok(splitText(emoji).every((p) => !p.startsWith("\u200d")));
});
test("WAV merge preserves PCM samples in exact order and correct duration", async () => {
  const merged = await mergeWavs([wav([100, -200, 300]), wav([-400, 500])]);
  const info = await readWav(merged);
  assert.deepEqual(
    [...new Int16Array(info.pcm.buffer, info.pcm.byteOffset, 5)],
    [100, -200, 300, -400, 500],
  );
  assert.equal(info.duration, 5 / 48000);
  assert.equal(merged.size, 54);
  await assert.rejects(mergeWavs([wav([1]), wav([2], 24000)]), /sample rates/);
  await assert.rejects(mergeWavs([]), /at least/);
  await assert.rejects(readWav(new Blob(["broken"])), /WAV/);
});
function batch() {
  return {
    parts: ["first", "second", "third"].map((text) => ({
      text,
      status: "pending",
    })),
    duration: 0,
  };
}
test("parts run sequentially, expose finished audio before the next call, and persist progress", async () => {
  const b = batch(),
    seen = [],
    saved = [];
  let inFlight = false;
  await run(
    b,
    async (text, index) => {
      assert.equal(inFlight, false);
      inFlight = true;
      if (index) assert.ok(b.parts[index - 1].blob);
      seen.push(text);
      await new Promise((r) => setImmediate(r));
      inFlight = false;
      return wav([index + 1]);
    },
    { save: async (b) => saved.push(b.parts.filter((p) => p.blob).length) },
  );
  assert.deepEqual(seen, ["first", "second", "third"]);
  assert.equal(b.status, "complete");
  assert.deepEqual(saved, [1, 2, 3, 3]);
});
test("stopping keeps the current part and continuing skips completed parts", async () => {
  const b = batch();
  let stop = false;
  const calls = [];
  const generate = async (text, index) => {
    calls.push(index);
    stop = true;
    return wav([10]);
  };
  await run(b, generate, { shouldStop: () => stop });
  assert.equal(b.status, "stopped");
  assert.deepEqual(calls, [0]);
  assert.ok(b.parts[0].blob);
  assert.equal(b.parts[1].status, "pending");
  await run(b, generate);
  assert.equal(b.status, "complete");
  assert.deepEqual(calls, [0, 1, 2]);
});
test("a failure preserves earlier audio and a retry starts at the failed part", async () => {
  const b = batch();
  await assert.rejects(
    run(b, async (text, index) => {
      if (index === 1) throw Error("GPU failed");
      return wav([1]);
    }),
    /GPU failed/,
  );
  assert.equal(b.status, "error");
  assert.equal(b.parts[1].status, "error");
  assert.ok(b.parts[0].blob);
  const calls = [];
  await run(b, async (text, index) => {
    calls.push(index);
    return wav([2]);
  });
  assert.deepEqual(calls, [1, 2]);
  assert.equal(b.status, "complete");
  assert.equal(b.error, "");
});

test("browser adapter sends exactly one part per request and returns to ready", async () => {
  globalThis.localStorage = { getItem: () => null };
  const engine = new BrowserVoiceEngine();
  engine.state = "ready";
  const requests = [];
  engine.request = async (type, payload) => {
    requests.push({ type, payload });
    return { pcm: new Float32Array([0.1, 0.2]) };
  };
  const b = batch(),
    voice = { kind: "design", description: "calm" },
    settings = { cfg: 2, steps: 5, seed: 0 };
  await run(b, async (text) => {
    const pcm = await engine.synthesize(text, voice, settings);
    return wav([...pcm].map((v) => v * 32767));
  });
  assert.equal(requests.length, 3);
  assert.deepEqual(
    requests.map((r) => r.payload.chunk.text),
    ["first", "second", "third"],
  );
  assert.ok(
    requests.every(
      (r) => r.payload.voice === voice && r.payload.settings === settings,
    ),
  );
  assert.equal(engine.state, "ready");
  assert.equal(b.status, "complete");
});

test("Full voice preserves the complete script in one request; Split voice creates a queue", () => {
  const script = "Hello from our studio. ".repeat(30) + "\n\nសួស្តី!";
  assert.deepEqual(plan(script, "full"), [script]);
  assert.ok(plan(script, "split").length > 1);
  assert.deepEqual(plan("  ", "full"), []);
  assert.throws(() => plan(script, "invalid"), /Choose/);
});
