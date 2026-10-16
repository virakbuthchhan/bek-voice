/* Shared planning, sequential generation, and lossless PCM WAV assembly. */

function splitText(text, maxLength = 200) {
  if (!Number.isInteger(maxLength) || maxLength < 20)
    throw Error("Invalid part length.");
  const result = [];
  const graphemes = (value) =>
    typeof Intl.Segmenter === "function"
      ? Array.from(
          new Intl.Segmenter("km", { granularity: "grapheme" }).segment(value),
          (s) => s.segment,
        )
      : value.match(
          /\r\n|[\s\S](?:\u17d2[\u1780-\u17b3]|[\p{Mark}\u200c\u200d\ufe00-\ufe0f])*/gu,
        ) || [];
  for (let paragraph of text.trim().split(/\n+/u)) {
    paragraph = paragraph.trim();
    while (paragraph) {
      if (Array.from(paragraph).length <= maxLength) {
        result.push(paragraph);
        break;
      }
      const units = graphemes(paragraph);
      let size = 0,
        end = 0;
      for (const unit of units) {
        const length = Array.from(unit).length;
        if (size + length > maxLength && end) break;
        size += length;
        end += unit.length;
      }
      const prefix = paragraph.slice(0, end);
      const sentences = [...prefix.matchAll(/[.!?។៕]+[”’"')\]]*(?:\s+|$)/gu)];
      const sentence = sentences.at(-1);
      let boundary = sentence ? sentence.index + sentence[0].length : 0;
      if (boundary < prefix.length * 0.4) {
        boundary = 0;
        if (typeof Intl.Segmenter === "function")
          for (const word of new Intl.Segmenter("km", {
            granularity: "word",
          }).segment(paragraph)) {
            const stop = word.index + word.segment.length;
            if (stop > end) break;
            boundary = stop;
          }
        else boundary = prefix.lastIndexOf(" ") + 1;
        if (boundary < prefix.length * 0.4) boundary = end;
      }
      const part = paragraph.slice(0, boundary).trim();
      if (part) result.push(part);
      paragraph = paragraph.slice(boundary).trim();
    }
  }
  return result;
}
function plan(text, mode = "split") {
  if (!["full", "split"].includes(mode))
    throw Error("Choose Full voice or Split voice.");
  const clean = text.trim();
  return mode === "full" ? (clean ? [clean] : []) : splitText(text);
}
async function readWav(blob) {
  const buffer = await blob.arrayBuffer(),
    view = new DataView(buffer);
  const tag = (at) => String.fromCharCode(...new Uint8Array(buffer, at, 4));
  if (buffer.byteLength < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE")
    throw Error("A part is not a WAV file.");
  let rate, channels, bits, format, pcm;
  for (let at = 12; at + 8 <= buffer.byteLength;) {
    const length = view.getUint32(at + 4, true),
      start = at + 8;
    if (start + length > buffer.byteLength)
      throw Error("A WAV part is incomplete.");
    if (tag(at) === "fmt " && length >= 16) {
      format = view.getUint16(start, true);
      channels = view.getUint16(start + 2, true);
      rate = view.getUint32(start + 4, true);
      bits = view.getUint16(start + 14, true);
    }
    if (tag(at) === "data") pcm = new Uint8Array(buffer, start, length);
    at = start + length + (length % 2);
  }
  if (
    format !== 1 ||
    channels !== 1 ||
    bits !== 16 ||
    !rate ||
    !pcm?.length ||
    pcm.length % 2
  )
    throw Error("Parts must be mono 16-bit PCM WAV audio.");
  return { rate, pcm, duration: pcm.length / (rate * 2) };
}
async function mergeWavs(blobs) {
  if (!blobs.length) throw Error("Generate at least one part first.");
  const parts = [];
  let size = 0,
    rate;
  for (const blob of blobs) {
    const part = await readWav(blob);
    if (rate && rate !== part.rate)
      throw Error("Parts have different sample rates.");
    rate = part.rate;
    size += part.pcm.length;
    parts.push(part.pcm);
  }
  if (size > 0xffffffff - 36)
    throw Error(
      "Audio is too large for one WAV. Download the individual parts.",
    );
  const header = new ArrayBuffer(44),
    v = new DataView(header);
  const str = (at, s) =>
    [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + size, true);
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
  v.setUint32(40, size, true);
  return new Blob([header, ...parts], { type: "audio/wav" });
}
async function run(
  batch,
  generate,
  { update = () => {}, save = async () => {}, shouldStop = () => false } = {},
) {
  batch.status = "running";
  batch.error = "";
  update();
  try {
    for (let index = 0; index < batch.parts.length; index++) {
      const part = batch.parts[index];
      if (part.blob) continue;
      if (shouldStop()) break;
      part.status = "running";
      part.started = Date.now();
      update();
      try {
        const blob = await generate(part.text, index);
        const info = await readWav(blob);
        Object.assign(part, { blob, duration: info.duration, status: "done" });
      } catch (error) {
        part.status = "error";
        throw error;
      }
      batch.duration = batch.parts.reduce(
        (sum, p) => sum + (p.duration || 0),
        0,
      );
      await save(batch);
      update();
    }
    batch.status = batch.parts.every((p) => p.blob) ? "complete" : "stopped";
  } catch (error) {
    batch.status = "error";
    batch.error = error.message;
    throw error;
  } finally {
    await save(batch);
    update();
  }
  return batch;
}

export { plan, splitText, readWav, mergeWavs, run };
