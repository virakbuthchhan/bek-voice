"""Loopback-only Sori server. No cloud inference; weights are downloaded on demand."""
import base64
import io
import json
import os
from pathlib import Path
import tempfile
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = Path(__file__).resolve().parent.parent
os.environ.setdefault('HF_HOME', str(ROOT / '.models'))
os.environ.setdefault('TORCH_HOME', str(ROOT / '.models' / 'torch'))
os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK', '1')
state = {'state': 'idle', 'message': 'Local service connected. Download and load VoxCPM2 to begin.'}
model = None
lock = threading.Lock()

def load_model():
    global model
    with lock:
        try:
            from voxcpm import VoxCPM
            model = VoxCPM.from_pretrained('openbmb/VoxCPM2', load_denoiser=False, optimize=False, device=os.getenv('SORI_DEVICE', 'auto'))
            state.update(state='ready', message='VoxCPM2 is loaded. Your studio is ready for local generation.')
        except Exception as exc:
            state.update(state='error', message=f'Model setup failed: {exc}')

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)

    def respond(self, code, body, kind='application/json'):
        data = json.dumps(body).encode() if kind == 'application/json' else body
        self.send_response(code)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == '/api/status':
            self.respond(200, dict(state))
        else:
            super().do_GET()

    def do_POST(self):
        # Only the locally served studio may trigger inference or model downloads.
        host = self.headers.get('Host', '')
        allowed = {'127.0.0.1:8765', 'localhost:8765'}
        if host not in allowed or self.headers.get('Origin', f'http://{host}') not in {f'http://{h}' for h in allowed}:
            return self.respond(403, {'error': 'Open the studio directly at http://127.0.0.1:8765.'})
        if self.path == '/api/load':
            if state['state'] not in {'loading', 'ready', 'busy'}:
                state.update(state='loading', message='Downloading and loading VoxCPM2. First setup downloads several GB; see the terminal for progress.')
                threading.Thread(target=load_model, daemon=True).start()
            return self.respond(200, dict(state))
        if self.path != '/api/generate':
            return self.respond(404, {'error': 'Unknown endpoint.'})
        if state['state'] != 'ready' or model is None:
            return self.respond(409, {'error': 'Download and load the local model first.'})
        if not lock.acquire(blocking=False):
            return self.respond(409, {'error': 'Another generation is running.'})
        reference_path = None
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > 22 * 1024 * 1024:
                return self.respond(413, {'error': 'Request too large or empty.'})
            data = json.loads(self.rfile.read(length))
            text = data.get('text', '').strip()
            if not text or len(text) > 5000:
                return self.respond(400, {'error': 'Script must contain 1–5,000 characters.'})
            guidance = float(data.get('guidance', 2))
            steps = int(data.get('steps', 10))
            seed = data.get('seed')
            if not 1 <= guidance <= 4 or steps not in (5, 10, 20):
                return self.respond(400, {'error': 'Invalid generation settings.'})
            if seed is not None and (not isinstance(seed, int) or not 0 <= seed <= 2147483647):
                return self.respond(400, {'error': 'Seed must be a nonnegative 32-bit integer.'})
            import soundfile as sf
            import numpy as np
            if data.get('reference'):
                if data.get('consent') is not True:
                    return self.respond(400, {'error': 'Voice cloning requires permission.'})
                raw = base64.b64decode(data['reference'], validate=True)
                if len(raw) > 15 * 1024 * 1024:
                    return self.respond(413, {'error': 'Reference must be below 15 MB.'})
                audio, rate = sf.read(io.BytesIO(raw), dtype='float32', always_2d=True)
                if not 3 <= len(audio) / rate <= 30 or not np.isfinite(audio).all():
                    return self.respond(400, {'error': 'Reference must contain 3–30 seconds of valid audio.'})
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False, dir=ROOT / 'local') as f:
                    reference_path = f.name
                sf.write(reference_path, audio.mean(axis=1), rate)
            direction = str(data.get('style', ''))[:500].replace('(', '').replace(')', '')
            target = f'({direction}){text}' if direction else text
            state.update(state='busy', message='Generating speech on your computer…')
            wav = model.generate(text=target, reference_wav_path=reference_path, cfg_value=guidance, inference_timesteps=steps, seed=seed)
            output = io.BytesIO()
            sf.write(output, wav, model.tts_model.sample_rate, format='WAV', subtype='PCM_16')
            self.respond(200, output.getvalue(), 'audio/wav')
        except Exception as exc:
            self.respond(500, {'error': f'Local generation failed: {exc}'})
        finally:
            if reference_path:
                Path(reference_path).unlink(missing_ok=True)
            state.update(state='ready', message='VoxCPM2 is loaded. Ready to generate locally.')
            lock.release()

if __name__ == '__main__':
    print('Sori voice studio → http://127.0.0.1:8765', flush=True)
    print('Model files stay in .models/; no inference data leaves this computer.', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
