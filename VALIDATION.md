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

## In-app documentation — 2026-10-16

- Added Documentation in the main navigation (Docs on mobile); the header help icon opens the guide. Nine bundled topics cover getting started, model/device requirements, cloning/recording, generation modes, exports/storage, Python, Docker, VPS deployment, and troubleshooting.
- Added topic search with relevant excerpts, no-results feedback and Escape clearing, copy buttons for setup commands, and shareable #docs/topic routes. Updated routing to support topic deep links and browser back/forward without rendering the same programmatic navigation twice.
- Browser checks passed for search (including seed troubleshooting), result selection, no results, command copying, reload on a Docker deep link, back navigation, Help → guide, guide → engine Settings, and guide → Studio. Clipboard contents were restored after the copy check.
- Reviewed light and dark guide layouts. Navigation, the model comparison table, and VPS command examples fit mobile widths of 320px and 390px without horizontal document overflow. No browser console errors were reported during verification.
- Docker image rebuilt and asset/health/MIME/range smoke checks passed, including docs.js. JavaScript syntax and whitespace checks passed. No speech inference changes were made or retested for this documentation update.

## Vue 3 + Vuetify migration — 2026-10-16

- Replaced the manually managed HTML/DOM frontend with Vue 3.5.44, Vuetify 4.2.6, and Vite 8.3.4. Added lazy-loaded Vue views, a Vuetify navigation drawer/mobile bottom navigation, component-based voice/recording controls, model setup, generation progress, results, libraries, settings, and documentation.
- Generation, preferences, routing, audio URLs, microphone capture, browser inference, audio helpers, and IndexedDB persistence now live in dedicated composables/services/modules. IndexedDB persistence unwraps Vue proxies before structured cloning. Existing database and model-cache namespaces were preserved.
- Confirmed the old saved voice and all eight pre-migration audio records remained visible. New generated runs and merged audio remained available after reload. Restored the original Khmer draft, Split voice choice, Python engine preference, and system appearance after testing.
- Real Python UI checks passed for a two-part script (1.12s + 1.92s), a 3.04-second merged PCM16 48 kHz WAV download, and cloning from the permitted saved 14.2-second voice reference (1.28-second output). A three-part run stopped after part 1, continued at part 2, and finished with all three parts (3.2 seconds total).
- Loaded the existing compact browser model to ready state through the Vue controls and generated a 2.1-second WebGPU clip. No browser console errors or warnings were reported during successful synthesis.
- Eighteen Node tests passed: recorder permission/cancellation/cleanup, speech planning and Khmer boundaries, stop/continue and failure recovery, exact WAV merging, browser adapter state/requests, WAV/SRT output, and structured cloning of reactive records with audio blobs.
- Reviewed desktop 1280px and mobile 390px/320px layouts, including cloning, recording guidance, documentation tables, light/dark switching, theme persistence, keyboard skip-to-content, and Google Sans computed styles. No horizontal document overflow was observed. Physical microphone capture was not repeated; the existing recorder tests use a mock capture source.
- Documentation search and the new frontend-development topic worked; #docs/frontend survived reload. Added Node.js/build/development instructions to README and bundled documentation.
- npm ci + the local frontend bootstrap and production build passed. Vite development proxy GET /api/status and POST /api/load reached the loopback Python service with valid origin/host handling.
- Multi-stage Docker now builds the Vue source before copying dist into the existing unprivileged NGINX runtime. Built and ran Linux ARM64 and Linux AMD64 images (AMD64 under Docker Desktop emulation); both passed all-asset, health, module/WASM MIME, byte-range, and static-only API checks. Local and VPS Compose configurations validated. Only task-owned test containers and the temporary Vite server were stopped.
- The inference worker and model assets remain unchanged. dist is generated/ignored; source, locked npm dependencies, runtime assets, and runtime license copies are tracked. New service-worker versions cache compiled assets without clearing model caches. Full offline behavior and public TLS certificate issuance were not retested.

## Authenticated GPU server — 2026-10-19

- Added a third engine choice for a private GPU server. HTTPS origin validation, bearer authentication, cookie omission, redirect refusal, and credential disposal are implemented in a separate frontend client. Only the endpoint and engine choice persist; the token stays in memory and the password field clears on successful connection.
- Thirty JavaScript tests pass, including invalid URLs, auth/origin/busy errors, token disposal, WAV responses, and browser-native fetch invocation. The original three Python generation/seed tests and ten new HTTP integration tests pass with real audio encoding and a fake model. HTTP coverage includes credentials on all API endpoints, CORS/preflight restrictions, local host/origin restrictions, model-load exclusion, generation conflicts, reference consent/cleanup, sanitized failures, and fail-closed remote configuration.
- In an isolated app origin, browser checks confirmed incorrect-token rejection, successful connection, cleared token input, Full voice output, two-part Split voice output, merge, and reconnection required after refresh. The API fixture returned a short generated test tone; these checks do not demonstrate actual remote AI inference. The user's existing script, voices, clips, and engine preference were not changed by these tests.
- The Settings form has no horizontal overflow at 390px; server-mode studio and sidebar copy explicitly describe sending scripts and reference recordings to the connected server. Onboarding and the bundled server guide expose the new option. Browser console reported no warnings or errors in the isolated session.
- Production frontend build, GPU Compose interpolation/configuration, and Caddy configuration validation passed. Confirmed the CUDA base image tag resolves for Linux AMD64. The Dockerfile check reports an expected AMD64/ARM64 platform warning on this Mac's ARM64 Docker builder even with the target platform flag. No full GPU image build, CUDA execution, actual VPS deployment, public TLS issuance, or GPU-memory capacity test was performed. The stack explicitly targets an NVIDIA Linux x86_64 host and reserves one GPU; other GPU vendors need a different image/device configuration.
- Local Python remains loopback-only by default. Remote mode requires a strong configured token and explicit allowed origins, serves API routes only, bounds HTTP concurrency, serializes model operations, and removes temporary reference audio. The dedicated VPS stack keeps the API port internal, runs inference as a non-root user, and stores model/cache data in a volume. README documents setup, token generation/rotation, storage, origin configuration, and shared-server limits.
- Task-owned API fixture and Vite preview processes were stopped; the existing main local app service remains available. Updated the source archive and added a credential-free server-settings screenshot to README.
