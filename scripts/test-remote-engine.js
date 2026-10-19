import { test } from "node:test";
import assert from "node:assert/strict";
import {
  serverOrigin,
  RemoteVoiceEngine,
} from "../src/services/RemoteVoiceEngine.js";
const token = "test-only-token-not-for-production-123456789";
test("server addresses require HTTPS and cannot embed credentials or paths", () => {
  assert.equal(
    serverOrigin("https://voice.example.com/"),
    "https://voice.example.com",
  );
  assert.equal(serverOrigin("http://127.0.0.1:8878"), "http://127.0.0.1:8878");
  for (const url of [
    "http://public.test",
    "https://user:secret@vps.test",
    "https://vps.test/api",
    "https://vps.test?token=secret",
    "ftp://vps.test",
    "invalid",
  ])
    assert.throws(() => serverOrigin(url));
});
test("authenticated requests omit cookies, refuse redirects, and do not serialize the token", async () => {
  const calls = [];
  const engine = new RemoteVoiceEngine(
    "https://vps.test",
    token,
    async (url, options) => {
      calls.push({ url, options });
      return new Response(
        JSON.stringify({ state: "ready", message: "Ready", engine: "server" }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  );
  assert.equal((await engine.status()).state, "ready");
  await engine.load();
  assert.equal(calls[0].options.headers.Authorization, "Bearer " + token);
  assert.equal(calls[0].options.credentials, "omit");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].url, "https://vps.test/api/status");
  assert.equal(calls[1].options.method, "POST");
  assert.ok(!JSON.stringify(engine).includes(token));
  engine.disconnect();
  await assert.rejects(() => engine.status(), /Reconnect/);
  assert.equal(calls.length, 2);
});
test("rejects wrong credentials, blocked origins, busy server, and non-Bek endpoints", async () => {
  for (const status of [401, 403, 409, 500]) {
    const engine = new RemoteVoiceEngine(
      "https://vps.test",
      token,
      async () => new Response("{}", { status }),
    );
    await assert.rejects(
      () => engine.status(),
      (e) => e.status === status && !e.message.includes(token),
    );
  }
  const engine = new RemoteVoiceEngine(
    "https://vps.test",
    token,
    async () =>
      new Response(JSON.stringify({ state: "ready", engine: "python" })),
  );
  await assert.rejects(() => engine.status(), /authenticated Bek server/);
});
test("WAV generation sends the reference and returns audio; unexpected data is rejected", async () => {
  let body;
  const engine = new RemoteVoiceEngine(
    "https://vps.test",
    token,
    async (_, options) => {
      body = JSON.parse(options.body);
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "audio/wav" },
      });
    },
  );
  assert.equal(
    (
      await engine.generate({
        text: "Hello",
        reference: "encoded-wav",
        consent: true,
      })
    ).size,
    3,
  );
  assert.equal(body.reference, "encoded-wav");
  assert.equal(body.consent, true);
  const bad = new RemoteVoiceEngine(
    "https://vps.test",
    token,
    async () => new Response("<html>"),
  );
  await assert.rejects(() => bad.generate({ text: "Hello" }), /WAV/);
});

test("fetch is invoked without an engine receiver, as required by browser-native fetch", async () => {
  const engine = new RemoteVoiceEngine(
    "https://vps.test",
    token,
    async function () {
      assert.equal(this, undefined);
      return new Response(JSON.stringify({ state: "ready", engine: "server" }));
    },
  );
  assert.equal((await engine.status()).state, "ready");
});
