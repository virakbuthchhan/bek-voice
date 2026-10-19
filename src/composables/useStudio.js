import {
  reactive,
  computed,
  markRaw,
  toRaw,
  watch,
  onMounted,
  onBeforeUnmount,
} from "vue";
import { BrowserVoiceEngine } from "../services/BrowserVoiceEngine.js";
import { VoiceRecorder } from "../services/VoiceRecorder.js";
import * as library from "../services/library.js";
import * as parts from "../lib/speech-parts.js";
import {
  encodeWav,
  decode,
  referenceVoice,
  asBase64,
  download,
  subtitles,
} from "../lib/audio.js";
import { readPreference, savePreference } from "./usePreferences.js";

export const languages = [
  { title: "Khmer · ភាសាខ្មែរ", value: "km" },
  { title: "Auto-detect from text", value: "auto" },
  { title: "English", value: "en" },
  { title: "French", value: "fr" },
  { title: "Japanese", value: "ja" },
  { title: "Chinese", value: "zh" },
  { title: "Thai", value: "th" },
  { title: "Vietnamese", value: "vi" },
];
export const samples = {
  khmer:
    "សួស្តី! សូមស្វាគមន៍មកកាន់ស្ទូឌីយោសំឡេងរបស់យើង។ ប្រែក្លាយអត្ថបទរបស់អ្នកទៅជាសំឡេងដ៏ធម្មជាតិ ហើយចែករំលែករឿងរ៉ាវរបស់អ្នកជាមួយពិភពលោក។",
  welcome:
    "Hello, and welcome. We’re so glad you’re here. Take a breath, make yourself comfortable, and let’s create something wonderful together.",
  story:
    "At the edge of a quiet village, where the rice fields met the morning mist, a young girl discovered that the smallest voices often tell the most extraordinary stories.",
};
export const readingSamples = {
  km: "សួស្តី! នេះគឺជាសំឡេងធម្មជាតិរបស់ខ្ញុំ។ ខ្ញុំចូលចិត្តអានរឿងរ៉ាវ និងចែករំលែកគំនិតថ្មីៗ។ ថ្ងៃនេះ ខ្ញុំកំពុងអានអត្ថបទនេះយ៉ាងច្បាស់ និងស្រួលៗ ដើម្បីបង្កើតសំឡេងផ្ទាល់ខ្លួនរបស់ខ្ញុំ។",
  en: "Hello! This is my natural speaking voice. I enjoy telling stories and sharing new ideas. Today, I am reading this short passage clearly and at a comfortable pace to create a voice that sounds like me.",
};
export const characters = [
  {
    title: "Warm & natural",
    subtitle: "Gentle female voice",
    value: "A warm, gentle young woman speaking naturally",
  },
  {
    title: "Deep & calm",
    subtitle: "Calm male voice",
    value: "A calm man with a deep, clear storytelling voice",
  },
];

export function useStudio() {
  const state = reactive({
    script: readPreference("sori-draft", ""),
    mode: "tts",
    character: characters[0].value,
    language: "auto",
    direction: "",
    guidance: 2,
    steps: 10,
    seed: "",
    outputMode:
      readPreference("bek-output-mode", "split") === "full" ? "full" : "split",
    engineChoice:
      readPreference("sori-engine", "browser") === "python"
        ? "python"
        : "browser",
    engine: { state: "idle", message: "Checking connection…" },
    browser: {
      state: "idle",
      loaded: 0,
      total: 1937476083,
      cached: readPreference("sori-browser-cached", "") === "yes",
    },
    busy: false,
    merging: false,
    stopRequested: false,
    activeBatch: null,
    viewBatch: null,
    result: null,
    voices: [],
    clips: [],
    reference: null,
    consent: false,
    voiceName: "",
    referenceMethod: "upload",
    referencePicker: true,
    selectedVoice: null,
    readingLanguage: "km",
    recording: {
      state: "idle",
      message: "Read the sample naturally. Aim for 10–20 seconds.",
      elapsed: 0,
      draft: null,
      isBusy: false,
    },
    snackbar: false,
    message: "",
    draftSaved: true,
    now: Date.now(),
  });
  let browser, mic, poll, ticker, lastOptions;
  function notify(message) {
    state.message = message;
    state.snackbar = true;
  }
  function syncBrowser() {
    if (!browser) return;
    const fields = [
      "state",
      "message",
      "loaded",
      "total",
      "stage",
      "cached",
      "supported",
      "device",
    ];
    state.browser = Object.fromEntries(
      fields.map((key) => [key, browser[key]]),
    );
    if (state.engineChoice === "browser")
      state.engine = { state: browser.state, message: browser.message };
  }
  browser = markRaw(new BrowserVoiceEngine(syncBrowser));
  mic = markRaw(
    new VoiceRecorder({
      encodeWav,
      onChange: (recorder) => {
        state.recording = {
          state: recorder.state,
          message: recorder.message,
          elapsed: recorder.elapsed,
          draft: recorder.draft,
          isBusy: recorder.isBusy,
        };
      },
    }),
  );
  const ready = computed(
    () =>
      state.engine.state === "ready" && !state.busy && !state.recording.isBusy,
  );
  const partCount = computed(
    () => parts.plan(state.script, state.outputMode).length,
  );
  const completed = computed(
    () => state.viewBatch?.parts.filter((part) => part.blob) || [],
  );
  const canContinue = computed(
    () =>
      !state.busy &&
      !!lastOptions &&
      state.viewBatch?.id === state.activeBatch?.id &&
      state.activeBatch?.status !== "complete",
  );
  const isActive = computed(
    () => state.busy && state.viewBatch?.id === state.activeBatch?.id,
  );
  watch(
    () => state.script,
    (value) => {
      try {
        localStorage.setItem("sori-draft", value);
        state.draftSaved = true;
      } catch {
        state.draftSaved = false;
      }
    },
  );
  watch(
    () => state.outputMode,
    (value) => savePreference("bek-output-mode", value),
  );
  watch(
    () => state.engineChoice,
    () => {
      savePreference("sori-engine", state.engineChoice);
      checkEngine();
    },
  );
  watch(
    () => state.mode,
    (value) => {
      if (value !== "clone" && mic.isBusy) mic.cancel();
    },
  );
  async function refreshLibrary() {
    try {
      [state.voices, state.clips] = await Promise.all([
        library.all("voices"),
        library.all("clips"),
      ]);
    } catch {
      notify("Browser storage is unavailable. Downloads still work.");
    }
  }
  async function checkEngine() {
    if (state.engineChoice === "browser") {
      syncBrowser();
      return;
    }
    if (!["localhost", "127.0.0.1"].includes(location.hostname)) {
      state.engine = {
        state: "offline",
        message: "Open the app through the included local Python service.",
      };
      return;
    }
    try {
      const response = await fetch("/api/status", {
        signal: AbortSignal.timeout(3000),
      });
      const body = await response.json();
      if (!response.ok)
        throw Error(body.error || "Python service unavailable.");
      state.engine = body;
    } catch (error) {
      state.engine = {
        state: "offline",
        message: error.message.includes("browser WebGPU")
          ? error.message
          : "Python service offline. Run ./start-python.sh in the project folder.",
      };
    }
  }
  async function loadModel() {
    try {
      if (state.engineChoice === "browser") {
        await browser.load();
        notify("Browser model ready. You can now generate speech.");
      } else {
        const response = await fetch("/api/load", { method: "POST" }),
          body = await response.json();
        if (!response.ok) throw Error(body.error || "Model setup failed.");
        state.engine = body;
        notify("Python model setup started.");
      }
    } catch (error) {
      if (error.code !== "CANCELLED") notify(error.message);
    }
  }
  function setEngine(value) {
    if (state.busy || browser.state === "loading")
      return notify("Finish the current operation before switching engines.");
    state.engineChoice = value;
  }
  function applyReference(blob, name, duration, voiceId = null) {
    if (mic.isBusy) mic.cancel();
    state.reference = { blob, name, duration };
    state.voiceName = name;
    state.consent = false;
    state.referencePicker = false;
    state.selectedVoice = voiceId;
  }
  async function pickReference(file) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024)
      return notify("Choose a WAV file smaller than 15 MB.");
    try {
      const audio = await decode(file);
      if (audio.duration < 3 || audio.duration > 30)
        throw Error("Use a reference clip between 3 and 30 seconds.");
      const mono = new Float32Array(audio.length);
      for (let c = 0; c < audio.numberOfChannels; c++) {
        const channel = audio.getChannelData(c);
        for (let i = 0; i < mono.length; i++)
          mono[i] += channel[i] / audio.numberOfChannels;
      }
      applyReference(
        encodeWav(mono, audio.sampleRate),
        file.name.replace(/\.[^.]+$/, ""),
        audio.duration,
      );
      notify("Reference ready. Confirm permission before cloning.");
    } catch (error) {
      notify(error.message || "Could not read this WAV file.");
    }
  }
  function selectVoice(id) {
    const voice = state.voices.find((item) => item.id === id);
    if (voice) applyReference(voice.blob, voice.name, voice.duration, id);
  }
  async function saveVoice() {
    if (!state.reference)
      return notify("Upload or record a reference voice first.");
    if (!state.consent)
      return notify("Confirm permission to use this voice first.");
    try {
      await library.put("voices", {
        ...state.reference,
        id: crypto.randomUUID(),
        created: Date.now(),
        name: state.voiceName.trim() || state.reference.name,
      });
      await refreshLibrary();
      notify("Voice saved on this device.");
    } catch {
      notify("Could not save this voice. Browser storage may be full.");
    }
  }
  async function deleteRecord(store, id) {
    if (store === "clips" && state.busy && id === state.activeBatch?.id)
      return notify("Wait for generation to finish before removing this run.");
    try {
      await library.remove(store, id);
      await refreshLibrary();
    } catch {
      notify("Could not remove this item.");
    }
  }
  async function saveBatch(batch) {
    if (!batch.parts.some((part) => part.blob)) return;
    try {
      await library.put("clips", batch);
    } catch {
      if (!batch.storageWarning) {
        batch.storageWarning = true;
        notify(
          "Browser storage is full. Download completed audio before leaving this page.",
        );
      }
    }
  }
  function showClip(clip) {
    if (clip.parts) {
      state.viewBatch =
        state.activeBatch?.id === clip.id ? state.activeBatch : clip;
      state.result = clip.blob
        ? {
            ...clip,
            text: clip.parts
              .filter((part) => part.blob)
              .map((part) => part.text)
              .join(" "),
          }
        : null;
    } else {
      state.viewBatch = null;
      state.result = clip;
    }
  }
  async function startQueue(batch, options) {
    if (state.busy) return;
    state.busy = true;
    state.stopRequested = false;
    state.activeBatch = batch;
    lastOptions = options;
    state.viewBatch = state.activeBatch;
    state.result = null;
    // Mutate the same reactive run rendered by Vue; convert proxies only at the persistence boundary.
    batch = state.activeBatch;
    try {
      await checkEngine();
      if (state.engine.state !== "ready")
        throw Error("Load the selected model first in Settings.");
      delete batch.blob;
      delete batch.mergedParts;
      batch.status = "running";
      if (options.engine === "browser" && !options.voice)
        options.voice = options.reference
          ? await referenceVoice(options.reference, options.directions)
          : { kind: "design", description: options.directions };
      if (
        options.engine === "python" &&
        options.reference &&
        !options.referenceBase64
      )
        options.referenceBase64 = await asBase64(options.reference);
      await parts.run(
        batch,
        async (text) => {
          if (options.engine === "browser")
            return encodeWav(
              await browser.synthesize(text, options.voice, options.settings),
              48000,
            );
          const body = {
            text,
            style: options.directions,
            guidance: options.settings.cfg,
            steps: options.settings.steps,
            seed: options.settings.seed ?? null,
            reference: options.referenceBase64 || null,
            consent: options.consent,
          };
          const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!response.ok) {
            const error = await response.json();
            throw Error(error.error || "Generation failed.");
          }
          return response.blob();
        },
        { save: saveBatch, shouldStop: () => state.stopRequested },
      );
      if (batch.parts.length === 1 && batch.parts[0].blob) {
        batch.blob = batch.parts[0].blob;
        batch.mergedParts = 1;
        await saveBatch(batch);
        if (state.viewBatch?.id === batch.id)
          state.result = { ...batch, text: batch.parts[0].text };
      }
      notify(
        batch.status === "complete"
          ? "Your audio is ready."
          : "Stopped. Completed audio is kept.",
      );
    } catch (error) {
      batch.status = "error";
      batch.error = error.message;
      await saveBatch(batch);
      notify(error.message);
    } finally {
      state.busy = false;
      await refreshLibrary();
      await checkEngine();
    }
  }
  function generate() {
    if (state.busy || state.merging) return;
    if (mic.isBusy) return notify("Finish or cancel recording first.");
    const text = state.script.trim();
    if (!text || text.length > 5000)
      return notify("Add a script between 1 and 5,000 characters.");
    if (state.mode === "clone" && (!state.reference || !state.consent))
      return notify(
        "Choose a reference voice and confirm permission to clone it.",
      );
    const seed =
      state.seed === "" || state.seed === null ? undefined : Number(state.seed);
    if (
      seed !== undefined &&
      (!Number.isInteger(seed) || seed < 0 || seed > 2147483647)
    )
      return notify("Seed must be a nonnegative 32-bit integer.");
    const language = languages
        .find((item) => item.value === state.language)
        ?.title.split(" · ")[0],
      directions = [
        state.mode === "tts" ? state.character : "",
        state.language === "auto" ? "" : "Speaking in " + language,
        state.direction.trim(),
      ]
        .filter(Boolean)
        .join(", ");
    const batch = {
      id: crypto.randomUUID(),
      created: Date.now(),
      text,
      mode: state.mode,
      outputMode: state.outputMode,
      duration: 0,
      status: "pending",
      parts: parts
        .plan(text, state.outputMode)
        .map((text) => ({ text, status: "pending" })),
    };
    startQueue(batch, {
      engine: state.engineChoice,
      directions,
      settings: {
        cfg: Number(state.guidance),
        steps: Number(state.steps),
        ...(seed === undefined ? {} : { seed }),
      },
      reference: state.mode === "clone" ? state.reference.blob : null,
      consent: state.mode === "clone" && state.consent,
    });
  }
  async function merge() {
    const batch = state.viewBatch;
    if (!batch || state.busy || state.merging) return;
    state.merging = true;
    try {
      const done = batch.parts.filter((part) => part.blob);
      batch.blob = await parts.mergeWavs(done.map((part) => part.blob));
      batch.mergedParts = done.length;
      await saveBatch(batch);
      state.result = {
        ...batch,
        text: done.map((part) => part.text).join(" "),
      };
      await refreshLibrary();
      notify("Parts merged in script order. Your WAV is ready.");
    } catch (error) {
      notify(error.message);
    } finally {
      state.merging = false;
    }
  }
  async function importText(file) {
    if (!file) return;
    const text = await file.text();
    state.script = text.slice(0, 5000);
    if (text.length > 5000) notify("Imported the first 5,000 characters.");
  }
  function leaveStudio() {
    if (mic.isBusy) mic.cancel();
  }
  const pageHide = () => {
    if (mic.isBusy) mic.cancel();
  };
  onMounted(() => {
    refreshLibrary();
    checkEngine();
    browser.checkDevice();
    poll = setInterval(() => {
      if (!state.busy) checkEngine();
    }, 5000);
    ticker = setInterval(() => (state.now = Date.now()), 1000);
    window.addEventListener("pagehide", pageHide);
  });
  onBeforeUnmount(() => {
    clearInterval(poll);
    clearInterval(ticker);
    mic.cancel();
    browser.cancel();
    window.removeEventListener("pagehide", pageHide);
  });
  return Object.assign(state, {
    ready,
    partCount,
    completed,
    canContinue,
    isActive,
    notify,
    checkEngine,
    loadModel,
    setEngine,
    cancelModel: () => browser.cancel(),
    applyReference,
    pickReference,
    selectVoice,
    saveVoice,
    deleteRecord,
    generate,
    merge,
    showClip,
    importText,
    leaveStudio,
    continueParts: () => {
      if (state.activeBatch && lastOptions)
        startQueue(toRaw(state.activeBatch), lastOptions);
    },
    stopQueue: () => (state.stopRequested = true),
    startRecording: () => {
      if (!state.busy) mic.start();
    },
    stopRecording: () => mic.stop(),
    cancelRecording: () => mic.cancel(),
    discardRecording: () => mic.discard(),
    useRecording: () => {
      if (mic.draft && !mic.isBusy)
        applyReference(mic.draft.blob, mic.draft.name, mic.draft.duration);
    },
    download,
    downloadSrt: () => {
      if (state.result) download(subtitles(state.result), "bek-estimated.srt");
    },
  });
}
