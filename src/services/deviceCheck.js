// Capability checks only: no model downloads, microphone access, or telemetry.
export const MODEL_STORAGE_BYTES = 2_200_000_000;
async function bounded(task, timeoutMs, cleanup) {
  let expired = false,
    timer;
  const operation = Promise.resolve()
    .then(task)
    .then((value) => {
      if (expired) cleanup?.(value);
      return value;
    });
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error("Check timed out."));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function checkGpu(env = globalThis, timeoutMs = 6000) {
  if (!env.isSecureContext)
    return {
      status: "fail",
      detail: "Open Bek using HTTPS or localhost to enable browser AI.",
    };
  if (!env.navigator?.gpu)
    return {
      status: "fail",
      detail:
        "WebGPU is unavailable. Try an up-to-date Chrome or Edge browser with hardware acceleration enabled.",
    };
  try {
    const adapter = await bounded(
      () => env.navigator.gpu.requestAdapter(),
      timeoutMs,
    );
    if (!adapter)
      return {
        status: "fail",
        detail:
          "No usable GPU was found. Check browser hardware acceleration or use the Python engine.",
      };
    if (!adapter.features.has("shader-f16"))
      return {
        status: "fail",
        detail:
          "Your browser GPU does not expose the precision support this model requires (shader-f16).",
      };
    const device = await bounded(
      () => adapter.requestDevice({ requiredFeatures: ["shader-f16"] }),
      timeoutMs,
      (late) => late.destroy(),
    );
    device.destroy();
    return {
      status: "pass",
      device:
        adapter.info?.description || adapter.info?.vendor || "WebGPU device",
      detail: "GPU access and model precision support passed.",
    };
  } catch {
    return {
      status: "fail",
      detail:
        "GPU access could not be confirmed. Close other GPU-heavy apps, retry, or use Python.",
    };
  }
}
export async function checkClientDevice(
  env = globalThis,
  { cached = false, timeoutMs = 6000 } = {},
) {
  const [gpu, storage] = await Promise.all([
    checkGpu(env, timeoutMs),
    (async () => {
      try {
        if (!env.navigator?.storage?.estimate) throw new Error("Unavailable");
        const estimate = await bounded(
          () => env.navigator.storage.estimate(),
          timeoutMs,
        );
        if (
          !Number.isFinite(estimate.quota) ||
          !Number.isFinite(estimate.usage) ||
          estimate.quota <= 0
        )
          throw new Error("Unknown quota");
        const free = Math.max(0, estimate.quota - estimate.usage);
        return {
          status:
            free >= MODEL_STORAGE_BYTES ? "pass" : cached ? "warn" : "fail",
          detail: `${(free / 1e9).toFixed(1)} GB browser space available. ${free >= MODEL_STORAGE_BYTES ? "Enough for the initial download." : cached ? "A saved model may be reusable; a fresh download needs at least 2.2 GB." : "Free at least 2.2 GB of browser storage before downloading."}`,
        };
      } catch {
        return {
          status: "warn",
          detail:
            "Storage capacity could not be measured. Keep at least 2.2 GB available for the browser model.",
        };
      }
    })(),
  ]);
  const runtime = {
    status:
      typeof env.Worker === "function" && typeof env.WebAssembly === "object"
        ? "pass"
        : "fail",
    detail:
      typeof env.Worker === "function" && typeof env.WebAssembly === "object"
        ? "Web Workers and WebAssembly are available."
        : "Browser AI requires Web Workers and WebAssembly. Update your browser or use Python.",
  };
  const checks = [
    { id: "gpu", title: "Browser & GPU", ...gpu },
    { id: "storage", title: "Model storage", ...storage },
    { id: "runtime", title: "AI runtime", ...runtime },
  ];
  return {
    status: checks.some((c) => c.status === "fail")
      ? "blocked"
      : checks.some((c) => c.status === "warn")
        ? "review"
        : "ready",
    checks,
  };
}
