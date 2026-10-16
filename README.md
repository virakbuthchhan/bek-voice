# Bek — Local voice studio

Text to speech, voice design, permission-based voice cloning, WAV export, estimated SRT, and browser-local voice/audio libraries.

## Quick start with Docker Compose

Install Docker Desktop on Windows/macOS, or Docker Engine and the Compose plugin on Linux. Clone using HTTPS (your friends do not need your SSH alias):

```sh
git clone https://github.com/virakbuthchhan/bek-voice.git
cd bek-voice
docker compose up -d --build
```

Open **http://localhost:8765** in Chrome or Edge. Click **Set up · ≈1.9 GB download**, wait for the model to be ready, then generate speech or clone a permitted voice.

The container serves the app. **AI generation uses each visitor's browser GPU**, so no GPU, Python speech dependencies, API key, or model download is needed on the Docker host. Windows/macOS/Linux hosts and ARM64/AMD64 images are supported by the base image; visitors still need a compatible browser and GPU. Model files, voices, and audio history stay in that visitor's browser. Container restarts do not erase browser data.

The default port is bound only to the host's loopback interface. To change it, copy `.env.example` to `.env` and set `PORT=8876`, then run the same command. Access the app using a consistent hostname and port: browser storage is separate for every origin, including `localhost` versus `127.0.0.1`.

```sh
docker compose ps                 # Container and health status
docker compose logs -f           # Logs
docker compose down              # Stop and remove the container
git pull
docker compose up -d --build     # Apply an update
```

Use the modern `docker compose` plugin. The retired Python-based `docker-compose` v1 command is not required.

### Docker without Compose

```sh
docker build -t bek-voice .
docker run -d --name bek-voice --restart unless-stopped -p 127.0.0.1:8765:8080 bek-voice
```

## Deploy on a VPS with HTTPS

The VPS serves the same browser app; voice processing still runs on visitors' computers. The included production stack uses Caddy for automatic HTTPS and stores certificates in named Docker volumes.

1. Install Docker Engine and the Compose plugin on the VPS.
2. Point your domain's DNS A record to the VPS IPv4 address. Only add an AAAA record if IPv6 is also routed to that VPS. Allow inbound TCP ports **80 and 443**; UDP 443 is optional for HTTP/3. Keep SSH access available.
3. Clone the repository and configure your real domain and certificate contact email:

```sh
git clone https://github.com/virakbuthchhan/bek-voice.git
cd bek-voice
cp .env.example .env
# Edit .env:
# DOMAIN=voice.your-domain.com
# ACME_EMAIL=you@your-domain.com
```

4. Start the standalone VPS configuration:

```sh
docker compose -f compose.vps.yaml up -d --build
docker compose -f compose.vps.yaml logs -f caddy
```

Open **https://voice.your-domain.com** after DNS resolves and Caddy obtains a certificate. Use the same `-f compose.vps.yaml` argument for `ps`, `logs`, `down`, and future updates. Do not combine the local and VPS Compose files. Port 8080 stays internal to the VPS Docker network; only Caddy publishes ports.

**HTTPS is required for browser WebGPU on remote hosts.** An `http://VPS_IP:8765` or plain HTTP LAN address is not a working substitute for HTTPS. Localhost HTTP is suitable for local use. This requirement is documented by [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API); certificate provisioning requirements are in [Caddy's HTTPS documentation](https://caddyserver.com/docs/automatic-https).

If another reverse proxy already owns ports 80/443, use `compose.yaml` to serve on VPS loopback and configure that proxy to terminate HTTPS and forward to `127.0.0.1:8765`. Ensure its response MIME types preserve JavaScript modules and `application/wasm`. Do not put the site in a cross-origin iframe that blocks WebGPU.

Model downloads go directly from Hugging Face to the visitor. Changing the domain or port starts a new browser-storage origin. The production stack is a static website, not a shared server-side inference service; the optional local Python engine below is not included in these containers.

### Troubleshooting

- **Port already in use:** change `PORT` in `.env` for local Compose. On a VPS, ensure Caddy can use 80/443 or use your existing HTTPS reverse proxy.
- **WebGPU unavailable:** open localhost or the HTTPS domain in a current Chrome/Edge desktop browser, enable hardware acceleration, and check GPU/shader-f16 support.
- **Model download/storage errors:** keep at least 2.2 GB of browser site-storage capacity available and allow downloads from Hugging Face. Resume setup; completed segments are reused.
- **New version not visible:** refresh the page. If necessary, close/reopen the app. Clearing site data also removes model and voice caches, so reserve that for a full reset.
- **VPS certificate not issued:** check DNS (including AAAA records), reachability on 80/443, and Caddy logs. The certificate volumes must remain writable. `down -v` deletes certificate volumes; normal `down` preserves them.

## Browser mode: one-time ≈1.9 GB download

Serve `dist/` with any static HTTP server, or publish it to an HTTPS host. For example:

```sh
./start.sh
```

Open http://127.0.0.1:8765 in a current Chrome or Edge desktop browser with WebGPU and shader-f16 support.

1. Under **Device and model**, click **Set up · ≈1.9 GB download**.
2. Wait for the progress bar and GPU preparation to finish.
3. Enter text, select a voice direction, or upload/record a 3–30 second reference and confirm permission to clone it.
4. Click **Generate speech**. Listen or download WAV and estimated SRT.

Model files total **1.94 GB** (decimal GB). The app also bundles about 42 MB of ONNX Runtime assets. Model data is cached in browser storage with segmented download resumption and integrity checks. After a page reload, click **Load saved model** to load it back into GPU memory. Setup can be cancelled and resumed. Clearing site data or browser eviction removes cached files. A browser with at least 2.2 GB free site-storage capacity is required. GPU compatibility and available memory vary by device.

Scripts and references stay inside the browser during browser inference. Only model files are downloaded from Hugging Face. No voice API or API key is used. Fonts and runtime files are bundled locally. The app shell and used runtime assets are cached by a service worker for offline return visits. Browser cache eviction or clearing site data requires a fresh download.

## Record a reference voice in the browser

In **Voice cloning**, choose **Record voice**. Select the Khmer or English reading sample, then click **Start recording** and allow microphone access. Read in a quiet room using your natural voice; 10–20 seconds is a good target.

Click **Stop**, listen to the preview, then click **Use recording**. Give the voice a name, confirm permission, and generate speech or save it to **My voices**. You can record again or discard the take before using it. Uploading an existing WAV remains available.

- Recordings must contain at least 3 seconds of non-silent audio and stop automatically at 30 seconds.
- The browser converts recordings to mono WAV locally. They use the same cloning and voice-library flow as uploaded references.
- The microphone is requested only after clicking Start; its tracks are released on Stop, Cancel, leaving the recording flow, or leaving the page.
- HTTPS is required on remote deployments; localhost HTTP works for local use. If access is denied, update the site's microphone permission in your browser or upload a WAV instead.
- The reading passage is a prompt for the speaker, not an assumed transcript; cloning does not require reading it word for word.

## Long scripts and audio parts

Scripts split automatically into short parts (up to about 200 characters), preferring paragraphs, sentences, and word boundaries. Khmer character clusters stay together. The same queue works with the browser and Python engines.

- Watch the current part, elapsed time, and completed-part count while generation runs.
- Play or download each finished part immediately, without waiting for the full script.
- **Stop after this part** finishes the current request and keeps completed audio. **Continue remaining parts** resumes the current run while the page stays open, using the original voice and settings.
- **Merge all parts** joins finished WAV audio in script order without re-generating or re-encoding samples. A stopped run can merge just its completed parts.
- Parts are saved in the audio library as they finish. Reopen a saved run to play/download its parts or merge them. Reloading preserves finished audio; continuing unfinished generation requires keeping the original page open.

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
node --check dist/voice-recorder.js
node --check dist/speech-parts.js
node --test scripts/test-voice-recorder.cjs scripts/test-speech-parts.cjs
python3 -m py_compile local/server.py
```

With the optional Python engine dependencies installed, run the backend regression checks (no model download needed):

```sh
.venv/bin/python scripts/test-python-engine.py
```

To check a running Docker deployment without downloading the model again:

```sh
python3 scripts/smoke-container.py http://localhost:8765
docker compose config --quiet
docker compose --env-file .env.example -f compose.vps.yaml config --quiet
```

The smoke check validates app assets, health, module/WASM content types, byte ranges, and deployment headers. It does not perform GPU inference or request public TLS certificates.
