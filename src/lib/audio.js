export function encodeWav(data, rate = 48000) {
  const buffer = new ArrayBuffer(44 + data.length * 2),
    view = new DataView(buffer);
  const text = (at, s) =>
    [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + data.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++)
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 32767, true);
  return new Blob([buffer], { type: "audio/wav" });
}
export async function decode(blob) {
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await ctx.close();
  }
}
export async function referenceVoice(blob, description) {
  const decoded = await decode(blob),
    offline = new OfflineAudioContext(
      1,
      Math.ceil(decoded.duration * 16000),
      16000,
    ),
    source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const audio = await offline.startRendering();
  return {
    kind: "clone",
    style: description,
    reference: { pcm16k: audio.getChannelData(0), transcript: "" },
  };
}
export function asBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function timecode(t) {
  const ms = Math.round(t * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}
export function subtitles(clip) {
  const parts = clip.text.match(/[^.!?។\n]+[.!?។]?/gu) || [clip.text],
    total = parts.reduce((n, p) => n + p.length, 0);
  let elapsed = 0;
  return new Blob(
    [
      parts
        .map((p, i) => {
          const start = elapsed;
          elapsed += (clip.duration * p.length) / total;
          return `${i + 1}\n${timecode(start)} --> ${timecode(elapsed)}\n${p.trim()}\n`;
        })
        .join("\n"),
    ],
    { type: "text/plain;charset=utf-8" },
  );
}
