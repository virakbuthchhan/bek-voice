import { test } from "node:test";
import assert from "node:assert/strict";
import { reactive } from "vue";
import { encodeWav, subtitles } from "../src/lib/audio.js";
import { readWav } from "../src/lib/speech-parts.js";
import { plain } from "../src/services/library.js";

test("Vue audio utilities emit readable PCM WAV and estimated SRT", async () => {
  const blob = encodeWav(new Float32Array([-2, -1, 0, 1, 2]), 24000),
    wav = await readWav(blob);
  assert.equal(wav.rate, 24000);
  assert.deepEqual(
    [...new Int16Array(wav.pcm.buffer, wav.pcm.byteOffset, 5)],
    [-32767, -32767, 0, 32767, 32767],
  );
  const srt = await subtitles({ text: "Hello. World!", duration: 4 }).text();
  assert.match(srt, /1\n00:00:00,000 --> 00:00:01,846\nHello\./);
  assert.match(srt, /2\n00:00:01,846 --> 00:00:04,000\nWorld!/);
});
test("saved Vue runs can be structured-cloned without losing audio blobs", async () => {
  const audio = encodeWav(new Float32Array([0.1, 0.2]));
  const run = reactive({
    id: "run",
    parts: [{ text: "Hello.", blob: audio, duration: 2 / 48000 }],
    blob: audio,
  });
  const saved = structuredClone(plain(run));
  assert.equal(saved.id, "run");
  assert.equal(saved.parts[0].blob.size, audio.size);
  assert.equal(
    await saved.blob.arrayBuffer().then((b) => b.byteLength),
    audio.size,
  );
});
