# Browser-mode validation — 2026-10-16

Verified in the Codex in-app browser at http://127.0.0.1:8765:

- WebGPU/shader-f16 device check succeeded.
- Downloaded the 1,937,476,083-byte compact model through the setup control.
- Cancelled at about 31%, reloaded the page, and resumed at the saved progress.
- GPU preparation completed and Generate became enabled.
- Generated a 5.0-second English clip entirely through the browser worker.
- Generated a 12.0-second Khmer sample; WAV playback and local history were available.
- Opened a new tab, selected Load saved model, and went directly to GPU preparation using cached files.
- Used the generated English WAV as a permitted reference and produced a 10.2-second Khmer voice-cloning clip.
- No browser errors were reported during these successful runs.
- Syntax checks passed for app.js, browser-engine.js, browser-engine.worker.js, service-worker.js, and local/server.py.

Generation, output duration, downloads, and application flows were verified. Speaker similarity and Khmer pronunciation were not formally scored. The Python engine was not involved in these browser-mode generations. Offline service-worker behavior is implemented but was not tested by disabling the network.

## Docker and Compose validation — 2026-10-16

- Local and standalone VPS Compose configurations validated.
- Built and ran Linux ARM64 and Linux AMD64 images (AMD64 under Docker Desktop emulation).
- Local Compose reached healthy status with a read-only filesystem, temporary /tmp, dropped capabilities, and UID 101.
- NGINX configuration validation passed.
- `scripts/smoke-container.py` passed against local Compose, the Caddy reverse proxy stack, and the AMD64 standalone container: all app assets matched source, module/WASM MIME types were correct, WASM byte ranges worked, update headers were present, and unavailable API routes returned a descriptive response.
- Caddy's production HTTPS configuration validated with a placeholder hostname. Reverse proxy behavior was tested using a loopback-only HTTP test override, with no public ports exposed.
- Real public-domain ACME certificate issuance was not attempted; it requires a domain pointing to the target VPS and reachable ports 80/443.
- No app assets or browser inference code changed for Docker support; browser speech tests above apply to the byte-identical files served by the image.

## Browser voice recording — 2026-10-16

- Node recorder tests passed, covering permission denial, cancellation during a pending permission request, 3-second minimum, microphone-track cleanup, 30-second auto-stop/trimming, silent/short rejection, cancellation during decoding, and discarding a take.
- A browser integration harness used an oscillator-backed MediaStream (no microphone hardware) with the real MediaRecorder and Web Audio APIs. Khmer/English sample switching, a 3.54-second recording, mono WAV conversion, preview, Use recording, and permission-checkbox reset passed.
- The rebuilt Docker image passed the asset/health/MIME/range smoke check, including the new recorder script.
- Physical microphone capture and OS permission dialogs were not exercised by the automated checks.

## Bek interface redesign — 2026-10-16

- Rebuilt the presentation layer with Bek branding, a compact navigation rail, an editor-first workspace, copper accents, and grouped voice controls.
- Confirmed all existing functional control IDs remain present (only the decorative hero waveform was removed). Browser model cache and voice/audio storage namespaces remain unchanged.
- Browser QA passed at desktop 1440 px and mobile 390 px widths; no horizontal document overflow was observed.
- Checked cached-model loading to ready state, Khmer-first language selection, sample insertion and character count, fine-tuning disclosure, recording sample language switching, and Studio/Voices/Library/Settings navigation. Existing audio records remained visible.
- Browser console reported no errors in the redesigned preview.
- Recorder unit tests and the rebuilt Docker deployment asset smoke check passed. No synthesis backend or recorder capture algorithm changes were needed for this redesign.

## Python engine seed compatibility — 2026-10-16

- Confirmed installed/pinned VoxCPM 2.0.3 forwards `generate` keyword arguments to `_generate`, which does not accept `seed`.
- Removed that unsupported keyword; explicit seeds now initialize Python, NumPy, and PyTorch RNGs under the generation lock.
- Three backend regression tests passed: default/null seed returns valid WAV with the expected generation settings; seeds 0 and 42 repeat the fake model's random output; invalid seeds return HTTP 400 and release the lock. Tests use real audio encoding and PyTorch with a model stub matching the pinned call signature.
- Restarted the local Python service and loaded cached original VoxCPM2 weights. Actual HTTP generation with seed 42 returned a 3.36-second 48 kHz WAV; a null seed returned a 1.60-second 48 kHz WAV. Both responses were HTTP 200 with finite, non-silent audio.
- These checks validate generation and API compatibility; speaker similarity, pronunciation, and identical results across different hardware are not assessed.
