# Sori — Local voice studio

Text to speech, voice design, permission-based voice cloning, WAV export, estimated SRT, and browser-local voice/audio libraries.

## Browser mode: one-time ≈1.9 GB download

Serve `dist/` with any static HTTP server, or publish it to an HTTPS host. For example:

```sh
./start.sh
```

Open http://127.0.0.1:8765 in a current Chrome or Edge desktop browser with WebGPU and shader-f16 support.

1. Under **Device and model**, click **Set up · ≈1.9 GB download**.
2. Wait for the progress bar and GPU preparation to finish.
3. Enter text, select a voice direction, or add a 3–30 second WAV reference and confirm permission to clone it.
4. Click **Generate speech**. Listen or download WAV and estimated SRT.

Model files total **1.94 GB** (decimal GB). The app also bundles about 42 MB of ONNX Runtime assets. Model data is cached in browser storage with segmented download resumption and integrity checks. After a page reload, click **Load saved model** to load it back into GPU memory. Setup can be cancelled and resumed. Clearing site data or browser eviction removes cached files. A browser with at least 2.2 GB free site-storage capacity is required. GPU compatibility and available memory vary by device.

Scripts and references stay inside the browser during browser inference. Only model files are downloaded from Hugging Face. No voice API or API key is used. Fonts and runtime files are bundled locally. The app shell and used runtime assets are cached by a service worker for offline return visits. Browser cache eviction or clearing site data requires a fresh download.

## Optional Python engine

The original Python model remains available under **Settings → Run speech on → Local Python service**. Install Python 3.10–3.12, then run:

```sh
./start-python.sh
```

Open http://127.0.0.1:8765, switch to Python mode, and click **Load Python model**. First setup downloads about 5 GB of original weights to `.models/`. Apple Silicon MPS, NVIDIA CUDA, or CPU is selected automatically. Use `SORI_DEVICE=cpu ./start-python.sh` if acceleration fails.

On Windows:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\pip install -r local/requirements.txt
.venv\Scripts\python local/server.py
```

## Notes

- Sophea and Dara are voice descriptions, not fixed speaker identities.
- Language is detected by the model; the language menu adds a speaking direction.
- Long scripts are generated in smaller chunks in browser mode.
- SRT timing is estimated proportionally by sentence, not forced alignment.
- References and audio clips are saved in IndexedDB for this browser and origin. Download important audio before clearing site data.
- Only clone voices you own or have permission to use. Label shared audio as AI-generated.
- Sources and third-party attribution: see THIRD_PARTY.md.

## Checks

```sh
node --check dist/app.js
node --check dist/browser-engine.js
node --check dist/browser-engine.worker.js
python3 -m py_compile local/server.py
```
