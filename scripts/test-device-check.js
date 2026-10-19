import { test } from "node:test";
import assert from "node:assert/strict";
import { checkClientDevice, checkGpu } from "../src/services/deviceCheck.js";
function environment({ f16 = true, quota = 10e9, usage = 1e9 } = {}) {
  const state = { destroyed: 0, requested: 0 };
  const env = {
    isSecureContext: true,
    Worker: function () {},
    WebAssembly: {},
    navigator: {
      gpu: {
        requestAdapter: async () => ({
          features: new Set(f16 ? ["shader-f16"] : []),
          info: { vendor: "Test GPU" },
          requestDevice: async (options) => {
            assert.deepEqual(options.requiredFeatures, ["shader-f16"]);
            state.requested++;
            return {
              destroy() {
                state.destroyed++;
              },
            };
          },
        }),
      },
      storage: { estimate: async () => ({ quota, usage }) },
    },
  };
  return { env, state };
}
test("compatible device passes and releases its probe GPU device", async () => {
  const { env, state } = environment();
  const result = await checkClientDevice(env);
  assert.equal(result.status, "ready");
  assert.equal(result.checks[0].device, "Test GPU");
  assert.equal(state.destroyed, 1);
});
test("insecure origin, missing WebGPU, and missing adapter are blocked", async () => {
  const { env } = environment();
  env.isSecureContext = false;
  assert.equal((await checkGpu(env)).status, "fail");
  env.isSecureContext = true;
  env.navigator.gpu = undefined;
  assert.equal((await checkGpu(env)).status, "fail");
  env.navigator.gpu = { requestAdapter: async () => null };
  assert.equal((await checkGpu(env)).status, "fail");
});
test("missing shader-f16 is blocked before requesting a GPU device", async () => {
  const { env, state } = environment({ f16: false });
  assert.equal((await checkClientDevice(env)).status, "blocked");
  assert.equal(state.requested, 0);
});
test("insufficient storage blocks a fresh download but permits review of cached models", async () => {
  const { env } = environment({ quota: 2e9 });
  assert.equal((await checkClientDevice(env)).status, "blocked");
  assert.equal(
    (await checkClientDevice(env, { cached: true })).status,
    "review",
  );
});
test("unknown storage does not falsely claim the device is unsupported or ready", async () => {
  const { env } = environment({ quota: undefined });
  env.navigator.storage.estimate = async () => {
    throw Error("denied");
  };
  assert.equal((await checkClientDevice(env)).status, "review");
  env.navigator.storage.estimate = async () => ({});
  assert.equal((await checkClientDevice(env)).status, "review");
});
test("missing runtime and rejected GPU device requests are blocked", async () => {
  const { env } = environment();
  env.Worker = undefined;
  assert.equal((await checkClientDevice(env)).status, "blocked");
  env.navigator.gpu.requestAdapter = async () => ({
    features: new Set(["shader-f16"]),
    requestDevice: async () => {
      throw Error("denied");
    },
  });
  assert.equal((await checkGpu(env)).status, "fail");
  env.navigator.gpu.requestAdapter = async () => {
    throw Error("denied");
  };
  assert.equal((await checkGpu(env)).status, "fail");
});
test("hung checks time out and late GPU devices are released", async () => {
  const { env, state } = environment();
  env.navigator.gpu.requestAdapter = async () => ({
    features: new Set(["shader-f16"]),
    requestDevice: () =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              destroy() {
                state.destroyed++;
              },
            }),
          25,
        ),
      ),
  });
  env.navigator.storage.estimate = () => new Promise(() => {});
  assert.equal(
    (await checkClientDevice(env, { timeoutMs: 5 })).status,
    "blocked",
  );
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(state.destroyed, 1);
});
