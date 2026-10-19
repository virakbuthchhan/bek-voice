"""Bek inference API: loopback by default; authenticated remote mode is opt-in."""
import base64
import io
import hashlib
import hmac
import json
import os
from pathlib import Path
import tempfile
import threading
from urllib.parse import urlsplit
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = Path(__file__).resolve().parent.parent
os.environ.setdefault('HF_HOME', str(ROOT / '.models'))
os.environ.setdefault('TORCH_HOME', str(ROOT / '.models' / 'torch'))
os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK', '1')
state = {'state': 'idle', 'message': 'Local service connected. Download and load VoxCPM2 to begin.'}
model = None
lock = threading.Lock()

def server_settings(environ=None):
    env = os.environ if environ is None else environ
    mode = env.get('BEK_SERVER_MODE', 'local')
    if mode not in {'local', 'remote'}:
        raise ValueError('BEK_SERVER_MODE must be local or remote.')
    token = env.get('BEK_API_TOKEN', '')
    origins = {v.strip() for v in env.get('BEK_ALLOWED_ORIGINS', '').split(',') if v.strip()}
    if mode == 'remote':
        if not 32 <= len(token) <= 512 or any(not 33 <= ord(c) <= 126 for c in token):
            raise ValueError('Remote mode requires a BEK_API_TOKEN of at least 32 ASCII characters without whitespace.')
        if not origins:
            raise ValueError('Remote mode requires explicit BEK_ALLOWED_ORIGINS.')
        for origin in origins:
            url = urlsplit(origin)
            if (url.scheme not in {'http', 'https'} or not url.netloc or url.username or url.password
                    or url.path or url.query or url.fragment
                    or (url.scheme == 'http' and url.hostname not in {'localhost', '127.0.0.1', '[::1]', '::1'})):
                raise ValueError('Allowed origins must be exact HTTPS origins, or HTTP localhost origins.')
    return {'remote': mode == 'remote', 'token': token, 'origins': origins}

SETTINGS = server_settings()

def load_model():
    global model
    try:
        from voxcpm import VoxCPM
        model = VoxCPM.from_pretrained('openbmb/VoxCPM2', load_denoiser=False, optimize=False, device=os.getenv('SORI_DEVICE', 'auto'))
        state.update(state='ready', message='VoxCPM2 is loaded. Ready to generate.')
    except Exception as exc:
        state.update(state='error', message='Model setup failed. Check server logs and GPU configuration.' if SETTINGS['remote'] else f'Model setup failed: {exc}')
        print(f'Model setup failed: {type(exc).__name__}', flush=True)
    finally:
        lock.release()

class InferenceHTTPServer(ThreadingHTTPServer):
    """Bound transport concurrency independently of the single model-operation lock."""
    daemon_threads = True
    request_queue_size = 32

    def __init__(self, *args, **kwargs):
        self.slots = threading.BoundedSemaphore(32)
        super().__init__(*args, **kwargs)

    def process_request(self, request, address):
        if not self.slots.acquire(blocking=False):
            try:
                request.sendall(b'HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')
            finally:
                self.shutdown_request(request)
            return
        try:
            super().process_request(request, address)
        except Exception:
            self.slots.release()
            raise

    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.slots.release()

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)

    def respond(self, code, body, kind='application/json'):
        data = json.dumps(body).encode() if kind == 'application/json' else body
        self.send_response(code)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        if code == 401:
            self.send_header('WWW-Authenticate', 'Bearer realm="Bek voice server"')
        self.end_headers()
        self.wfile.write(data)

    def setup(self):
        super().setup()
        self.connection.settimeout(30)

    def end_headers(self):
        origin = self.headers.get('Origin')
        if SETTINGS['remote'] and origin in SETTINGS['origins']:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def authorized(self):
        origin = self.headers.get('Origin')
        if SETTINGS['remote']:
            if origin and origin not in SETTINGS['origins']:
                self.respond(403, {'error': 'This app origin is not allowed by the server.'})
                return False
            supplied = self.headers.get('Authorization', '')
            expected = 'Bearer ' + SETTINGS['token']
            if not hmac.compare_digest(hashlib.sha256(supplied.encode()).digest(), hashlib.sha256(expected.encode()).digest()):
                self.respond(401, {'error': 'Server authentication failed. Check your access token.'})
                return False
        else:
            host = self.headers.get('Host', '')
            allowed = {'127.0.0.1:8765', 'localhost:8765'}
            if host not in allowed or (origin and origin not in {f'http://{h}' for h in allowed}):
                self.respond(403, {'error': 'Open the local studio at http://127.0.0.1:8765.'})
                return False
        return True

    def do_OPTIONS(self):
        if not SETTINGS['remote'] or self.headers.get('Origin') not in SETTINGS['origins']:
            return self.respond(403, {'error': 'Origin not allowed.'})
        requested = {h.strip().lower() for h in self.headers.get('Access-Control-Request-Headers', '').split(',') if h.strip()}
        if self.headers.get('Access-Control-Request-Method') not in {'GET', 'POST'} or not requested <= {'authorization', 'content-type'}:
            return self.respond(403, {'error': 'Preflight not allowed.'})
        self.send_response(204)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.send_header('Access-Control-Max-Age', '600')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_HEAD(self):
        if self.path.startswith('/api/') or SETTINGS['remote']:
            self.send_response(405)
            self.end_headers()
        else:
            super().do_HEAD()

    def do_GET(self):
        if self.path == '/healthz':
            return self.respond(200, {'ok': True})
        if self.path.startswith('/api/'):
            if not self.authorized():
                return
            if self.path != '/api/status':
                return self.respond(404, {'error': 'Unknown endpoint.'})
            return self.respond(200, {**state, 'engine': 'server' if SETTINGS['remote'] else 'python'})
        if SETTINGS['remote']:
            return self.respond(404, {'error': 'Unknown endpoint.'})
        super().do_GET()

    def do_POST(self):
        if not self.authorized():
            return
        if self.path == '/api/load':
            if lock.acquire(blocking=False):
                if model is not None and state['state'] == 'ready':
                    lock.release()
                else:
                    state.update(state='loading', message='Downloading and loading VoxCPM2. First setup downloads about 5 GB; see server logs for progress.')
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
            if self.headers.get('Transfer-Encoding'):
                return self.respond(400, {'error': 'Chunked request bodies are not supported.'})
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > 22 * 1024 * 1024:
                return self.respond(413, {'error': 'Request too large or empty.'})
            if self.headers.get_content_type() != 'application/json':
                return self.respond(415, {'error': 'Send application/json.'})
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict) or not isinstance(data.get('text'), str):
                return self.respond(400, {'error': 'A text script is required.'})
            text = data['text'].strip()
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
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False, dir=os.getenv('TMPDIR', None)) as f:
                    reference_path = f.name
                sf.write(reference_path, audio.mean(axis=1), rate)
            direction = str(data.get('style', ''))[:500].replace('(', '').replace(')', '')
            target = f'({direction}){text}' if direction else text
            state.update(state='busy', message='Generating speech on the server…' if SETTINGS['remote'] else 'Generating speech on your computer…')
            # VoxCPM 2.0.3 forwards kwargs to _generate, which has no seed argument.
            # Seed the RNGs while holding the generation lock instead.
            if seed is not None:
                import random
                import torch
                random.seed(seed)
                np.random.seed(seed)
                torch.manual_seed(seed)
            wav = model.generate(text=target, reference_wav_path=reference_path, cfg_value=guidance, inference_timesteps=steps)
            output = io.BytesIO()
            sf.write(output, wav, model.tts_model.sample_rate, format='WAV', subtype='PCM_16')
            self.respond(200, output.getvalue(), 'audio/wav')
        except (ValueError, TypeError, KeyError) as exc:
            self.respond(400, {'error': 'Invalid script, reference audio, or generation settings.'})
        except Exception as exc:
            self.respond(500, {'error': 'Server generation failed. Check server logs or GPU memory.' if SETTINGS['remote'] else f'Local generation failed: {exc}'})
        finally:
            if reference_path:
                Path(reference_path).unlink(missing_ok=True)
            state.update(state='ready', message='VoxCPM2 is loaded. Ready to generate.')
            lock.release()

if __name__ == '__main__':
    address = '0.0.0.0' if SETTINGS['remote'] else '127.0.0.1'
    port = int(os.getenv('BEK_PORT', '8765')) if SETTINGS['remote'] else 8765
    print(f'Bek inference service ({"remote, token required" if SETTINGS["remote"] else "local only"}) on {address}:{port}', flush=True)
    InferenceHTTPServer((address, port), Handler).serve_forever()
