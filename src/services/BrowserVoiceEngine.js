import { checkGpu } from "./deviceCheck.js";

/* Sori UI adapter for the browser-local VoxCPM2 WebGPU runtime. */
export class BrowserVoiceEngine {
  constructor(onChange) {
    this.onChange = onChange;
    this.worker = null;
    this.nextId = 1;
    this.requests = new Map();
    this.state = "idle";
    this.loaded = 0;
    this.total = 1937476083;
    this.message = "Download once, then generate voices on this device.";
    this.cached = localStorage.getItem("sori-browser-cached") === "yes";
  }
  notify() {
    this.onChange?.(this);
  }
  async checkDevice() {
    const result = await checkGpu();
    this.supported = result.status === "pass";
    this.device = result.device;
    if (!this.supported) this.message = result.detail;
    this.notify();
    return this.supported;
  }

  ensureWorker() {
    if (this.worker) return;
    this.worker = new Worker("browser-engine.worker.js", {
      type: "module",
      name: "sori-voxcpm2",
    });
    this.worker.onmessage = ({ data: m }) => {
      const pending = this.requests.get(m.id);
      if (m.type === "progress") {
        if (this.state === "loading") {
          this.loaded = m.loaded;
          this.total = m.total;
          this.stage = m.stage;
          this.file = m.file;
          if (m.stage === "compile") {
            this.cached = true;
            localStorage.setItem("sori-browser-cached", "yes");
          }
          this.message =
            m.stage === "compile"
              ? "Preparing the model on your GPU…"
              : "Downloading model files to this browser…";
        } else if (this.state === "busy") {
          this.message =
            m.stage === "decode"
              ? "Decoding your audio…"
              : "Generating speech on your GPU…";
        }
        this.notify();
        pending?.progress?.(m);
        return;
      }
      if (m.type === "stats") return;
      if (!pending) return;
      if (m.type === "error") {
        this.requests.delete(m.id);
        pending.reject(Object.assign(new Error(m.message), { code: m.code }));
      } else if (m.type === "loaded" || m.type === "audio") {
        this.requests.delete(m.id);
        pending.resolve(m);
      }
    };
    this.worker.onerror = (e) => {
      const error = new Error(
        e.message || "The browser inference worker stopped.",
      );
      for (const pending of this.requests.values()) pending.reject(error);
      this.requests.clear();
      this.worker?.terminate();
      this.worker = null;
      this.state = "error";
      this.message = error.message;
      this.notify();
    };
  }
  request(type, payload = {}, progress) {
    this.ensureWorker();
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.requests.set(id, { resolve, reject, progress });
      this.worker.postMessage({ id, type, ...payload });
    });
  }
  async load() {
    if (["ready", "loading", "busy"].includes(this.state)) return;
    if (!(await this.checkDevice())) throw Error(this.message);
    this.state = "loading";
    this.message = this.cached
      ? "Loading the saved model…"
      : "Starting the model download…";
    this.stage = "download";
    this.loaded = 0;
    this.total = 1937476083;
    this.notify();
    try {
      await navigator.storage?.persist?.();
      const estimate = await navigator.storage?.estimate?.();
      if (
        !this.cached &&
        estimate?.quota &&
        estimate.quota - estimate.usage < 2200000000
      )
        throw Error(
          "Not enough browser storage. Free at least 2.2 GB and try again.",
        );
      const result = await this.request("load", {
        manifestUrl: new URL("model-manifest.json", location.href).href,
      });
      this.state = "ready";
      this.cached = true;
      localStorage.setItem("sori-browser-cached", "yes");
      this.message = "Model ready · Saved in this browser · WebGPU";
      this.info = result.info;
      this.notify();
    } catch (e) {
      if (e.code === "CANCELLED") throw e;
      this.state = "error";
      this.message =
        e.code === "QUOTA"
          ? "Browser storage is full. Free space and resume setup."
          : e.message;
      this.notify();
      throw e;
    }
  }
  cancel() {
    this.worker?.terminate();
    this.worker = null;
    for (const pending of this.requests.values())
      pending.reject(
        Object.assign(
          new Error(
            "Cancelled. Downloaded segments are kept; setup can resume.",
          ),
          { code: "CANCELLED" },
        ),
      );
    this.requests.clear();
    this.state = "idle";
    this.message =
      "Stopped. Completed download segments remain cached for your next setup.";
    this.notify();
  }
  async synthesize(text, voice, settings, onProgress) {
    if (this.state !== "ready") throw Error("Load the browser model first.");
    this.state = "busy";
    this.message = "Generating speech on your GPU…";
    this.notify();
    try {
      onProgress?.("Generating speech on your GPU…");
      const audio = await this.request(
        "synthesize",
        { chunk: { index: 0, text }, voice, settings },
        (progress) =>
          onProgress?.(
            progress.stage === "decode"
              ? "Decoding audio…"
              : "Generating speech on your GPU…",
          ),
      );
      this.state = "ready";
      this.message = "Model ready · Saved in this browser · WebGPU";
      this.notify();
      return audio.pcm;
    } catch (e) {
      if (this.state !== "idle") {
        this.state = "error";
        this.message = e.message;
        this.notify();
      }
      throw e;
    }
  }
}
