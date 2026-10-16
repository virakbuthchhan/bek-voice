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
