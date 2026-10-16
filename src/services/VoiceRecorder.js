/* Microphone capture stays local. Only an explicit Start recording requests access. */
export class VoiceRecorder {
  constructor({ encodeWav, onChange, capture, decode } = {}) {
    this.encodeWav = encodeWav;
    this.onChange = onChange;
    this.capture =
      capture ||
      (() =>
        navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: false,
        }));
    this.decode =
      decode ||
      async function (blob) {
        const context = new AudioContext();
        try {
          return await context.decodeAudioData(await blob.arrayBuffer());
        } finally {
          await context.close();
        }
      };
    this.state = "idle";
    this.message = "Read the sample naturally. Aim for 10–20 seconds.";
    this.elapsed = 0;
    this.draft = null;
    this.session = 0;
  }
  get isBusy() {
    return ["requesting", "recording", "processing"].includes(this.state);
  }
  notify() {
    this.onChange?.(this);
  }
  release() {
    clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
  async start() {
    if (this.isBusy) return;
    if (
      !globalThis.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      this.state = "error";
      this.message =
        "Microphone recording requires HTTPS or localhost and a browser with recording support. You can still upload a WAV file.";
      this.notify();
      return;
    }
    const session = ++this.session;
    this.state = "requesting";
    this.message = "Allow microphone access in your browser to begin.";
    this.elapsed = 0;
    this.notify();
    try {
      const stream = await this.capture();
      if (session !== this.session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      this.recorder = recorder;
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = (event) => {
        if (session !== this.session) return;
        this.cancel();
        this.state = "error";
        this.message =
          event.error?.message ||
          "Recording stopped unexpectedly. Please try again.";
        this.notify();
      };
      recorder.onstop = () => this.finish(session, chunks, recorder.mimeType);
      recorder.start(250);
      this.startedAt = performance.now();
      this.state = "recording";
      this.message = "Recording… Read the sample aloud.";
      this.notify();
      this.timer = setInterval(() => {
        this.elapsed = (performance.now() - this.startedAt) / 1000;
        this.notify();
        if (this.elapsed >= 30) this.stop();
      }, 100);
      for (const track of stream.getAudioTracks())
        track.onended = () => {
          if (session === this.session && this.state === "recording")
            this.stop(true);
        };
    } catch (error) {
      if (session !== this.session) return;
      this.release();
      this.state = "error";
      this.message =
        {
          NotAllowedError:
            "Microphone access was denied. Allow it in your browser’s site permissions, then try again.",
          NotFoundError:
            "No microphone was found. Connect one or upload a WAV file.",
          NotReadableError:
            "Your microphone is unavailable or in use by another app.",
        }[error.name] || "Could not start recording: " + error.message;
      this.notify();
    }
  }
  stop(force = false) {
    if (this.state !== "recording") return;
    this.elapsed = (performance.now() - this.startedAt) / 1000;
    if (!force && this.elapsed < 3) {
      this.message = "Record at least 3 seconds before stopping.";
      this.notify();
      return;
    }
    this.state = "processing";
    this.message = "Preparing your recording…";
    this.notify();
    try {
      this.recorder.stop();
    } catch (error) {
      this.cancel();
      this.state = "error";
      this.message = "Could not finish recording. Please try again.";
      this.notify();
    } finally {
      this.release();
    }
  }
  async finish(session, chunks, mimeType) {
    if (session !== this.session) return;
    this.release();
    this.state = "processing";
    this.message = "Preparing your recording…";
    this.notify();
    try {
      const buffer = await this.decode(new Blob(chunks, { type: mimeType }));
      if (session !== this.session) return;
      const length = Math.min(
        buffer.length,
        Math.floor(buffer.sampleRate * 30),
      );
      if (length / buffer.sampleRate < 3)
        throw Error(
          "That recording is too short. Read for at least 3 seconds and try again.",
        );
      const mono = new Float32Array(length);
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < length; i++)
          mono[i] += data[i] / buffer.numberOfChannels;
      }
      let peak = 0;
      for (const value of mono) peak = Math.max(peak, Math.abs(value));
      if (peak < 0.001)
        throw Error(
          "The recording is silent. Check your microphone, move closer, and try again.",
        );
      this.draft = {
        blob: this.encodeWav(mono, buffer.sampleRate),
        duration: length / buffer.sampleRate,
        name: "My recorded voice",
      };
      this.state = "ready";
      this.message = `${this.draft.duration.toFixed(1)} seconds recorded. Listen back, then choose Use recording.`;
      this.notify();
    } catch (error) {
      if (session !== this.session) return;
      this.state = "error";
      this.message =
        error.message || "Could not read the recording. Please try again.";
      this.notify();
    }
  }
  cancel() {
    ++this.session;
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder) {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive")
        try {
          recorder.stop();
        } catch {}
    }
    this.release();
    this.elapsed = 0;
    this.state = this.draft ? "ready" : "idle";
    this.message = "Recording cancelled. The microphone is off.";
    this.notify();
  }
  discard() {
    if (this.isBusy) this.cancel();
    this.draft = null;
    this.elapsed = 0;
    this.state = "idle";
    this.message = "Read the sample naturally. Aim for 10–20 seconds.";
    this.notify();
  }
}
