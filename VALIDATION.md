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

## Long-script generation and WAV merging — 2026-10-16

- Added a shared parts queue for browser and Python generation, with a script preview count, current-part elapsed time, completed-part progress, individual audio players/downloads, stop-after-current and in-page continuation, and completed-part persistence.
- Seven parts tests passed: English/paragraph splitting, Khmer grapheme boundaries and emoji preservation, exact PCM sample order/duration after merging, sequential processing/persistence, stop/continue, failure/retry preserving earlier audio, and browser adapter request/state behavior. Existing recorder tests also passed (15 Node tests including the recorder parent).
- Real browser UI + Python VoxCPM2 test: generated two paragraphs, stopped after part 1 (2.40s), merged the partial run, continued only part 2 (3.68s), and merged both. The downloaded WAV was mono PCM16 at 48 kHz and 6.08s; the individual part download was 2.40s.
- Reloaded the page and reopened the saved run from Audio library; both individual players/downloads and the merged output remained available. The original Khmer draft was restored after QA.
- Desktop 1280px and mobile 390px layout checks passed without horizontal document overflow. Fixed the writing grid's intrinsic width so audio players/waveform cannot widen the mobile editor. No browser console errors were reported.
- Docker image rebuilt and container asset/health/MIME/range checks passed with the new script included. GPU browser inference itself was not rerun for this feature; its adapter/queue integration was checked with a stub. Real synthesis for this feature was exercised using Python.
- Continuing unfinished parts requires the original page to remain open (voice/settings snapshots stay in memory); completed audio survives reload. Stop waits for the current inference request to finish.

## Output choice and voice-settings clarity — 2026-10-16

- Added persisted Full voice / Split voice radio options. Full voice sends the entire script in one request; Split voice retains the short-part queue. Output mode is frozen while generation runs and recorded on each saved run.
- Each part now has its own accessible progress bar: empty while waiting, indeterminate/animated while generating, and full when complete. No invented within-request percentage is displayed because the inference API does not supply one.
- Reorganized voice settings into voice choice, language, and optional delivery. AI/cloning selection now lives in this panel. Saved voices can be selected directly; choosing a sample hides the upload/record picker and shows its name, duration, player, and a change-sample action. Permission status is explicit. Saving a voice and advanced guidance/seed settings are collapsed.
- Sixteen Node tests passed, including a Full voice plan preserving a long multi-paragraph script in one part versus Split voice creating multiple parts. Existing queue, merge, browser-adapter, and recorder checks remained green.
- Actual browser + Python generation succeeded for Full voice (one request/part) and Split voice (two separately playable parts). Confirmed active bars omit the value attribute, waiting bars are zero, and completed bars are full with accessible status text.
- Browser checks passed for saved-voice selection, permission reminder/ready state, changing a sample, and the recording sample UI. No microphone capture was started. Original draft and Split voice preference were restored after testing.
- Desktop and mobile 390px AI/cloning/recording layouts had no horizontal overflow. Removed the mobile mode-dependent panel reorder so changing voice modes keeps the panel in the same place. No browser console errors were reported.
- Rebuilt Docker and passed the deployment asset, health, MIME, and range smoke checks. Browser GPU inference was not repeated; this feature's real inference checks used Python.

## Light/dark theme toggle — 2026-10-16

- Added a keyboard-accessible sun/moon toggle in the header and a System/Light/Dark selector in Settings. System appearance is the default; explicit choices persist locally and apply before CSS paints. Native inputs/audio use the selected color scheme.
- Browser checks passed for toggling both ways, Enter-key activation, light/dark persistence after reload, and returning to system mode. System mode resolved to dark on the test device. OS appearance was not changed during testing.
- Reviewed dark editor/Khmer text, voice settings, Settings, saved audio parts, and native audio controls. Mobile header checks at 390px and 320px showed no horizontal document overflow. Browser console reported no errors.
- Docker rebuild and asset/health/MIME/range smoke checks passed, including theme.js. JavaScript syntax and whitespace checks passed. Speech inference was unchanged and was not rerun for this visual feature.
