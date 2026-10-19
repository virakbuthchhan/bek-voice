"""Authenticated HTTP integration tests. Uses a fake model and real WAV encoding; no weights downloaded."""
import base64
import io
import json
from pathlib import Path
import sys
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from unittest.mock import patch
import numpy as np
import soundfile as sf
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'local'))
import server
TOKEN = 'test-only-token-not-for-production-123456789'
ORIGIN = 'https://studio.example.test'
class Model:
    class tts_model:
        sample_rate = 24000
    def generate(self, **kwargs):
        self.kwargs = kwargs
        if kwargs['reference_wav_path']:
            assert Path(kwargs['reference_wav_path']).is_file()
        return np.zeros(2400, dtype=np.float32)
class ServerAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = server.InferenceHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown(); cls.http.server_close(); cls.thread.join()
    def setUp(self):
        self.original = server.SETTINGS
        server.SETTINGS = server.server_settings({'BEK_SERVER_MODE':'remote', 'BEK_API_TOKEN':TOKEN, 'BEK_ALLOWED_ORIGINS':ORIGIN})
        server.model = Model()
        server.state.update(state='ready', message='Ready')
    def tearDown(self):
        server.SETTINGS = self.original
    def request(self, path='/api/status', method='GET', data=None, token=TOKEN, origin=ORIGIN, extra=None):
        headers = {'Origin':origin} if origin else {}
        if token is not None: headers['Authorization'] = 'Bearer ' + token
        if data is not None: headers['Content-Type'] = 'application/json'
        headers.update(extra or {})
        payload = data if isinstance(data, bytes) else json.dumps(data).encode() if data is not None else None
        req = Request(f'http://127.0.0.1:{self.http.server_port}' + path, data=payload, method=method, headers=headers)
        try:
            with urlopen(req, timeout=5) as response: return response.status, response.headers, response.read()
        except HTTPError as response:
            return response.code, response.headers, response.read()
    def test_all_api_endpoints_require_token_and_auth_precedes_body(self):
        for path, method in [('/api/status','GET'),('/api/load','POST'),('/api/generate','POST')]:
            for token in (None, 'incorrect'):
                self.assertEqual(self.request(path, method, b'invalid', token=token)[0], 401)
        code, headers, raw = self.request()
        self.assertEqual(code, 200)
        self.assertEqual(json.loads(raw)['engine'], 'server')
        self.assertEqual(headers['Access-Control-Allow-Origin'], ORIGIN)
        self.assertNotIn(TOKEN, raw.decode())
    def test_origin_allowlist_and_preflight(self):
        self.assertEqual(self.request(origin='https://evil.test')[0], 403)
        code, headers, _ = self.request(method='OPTIONS', token=None, extra={'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'})
        self.assertEqual(code, 204)
        self.assertEqual(headers['Access-Control-Allow-Origin'], ORIGIN)
        self.assertEqual(self.request(method='OPTIONS', origin='https://evil.test')[0],403)
        self.assertEqual(self.request(method='OPTIONS', extra={'Access-Control-Request-Method':'DELETE'})[0],403)
        self.assertEqual(self.request(origin=None)[0],200)  # CLI callers still need the token.
        self.assertEqual(self.request(origin=None,token=None)[0],401)
    def test_full_and_split_requests_return_wav_and_release_lock(self):
        for text in ['A complete script.', 'Part one.', 'Part two.']:
            code, headers, raw = self.request('/api/generate','POST',{'text':text,'seed':0,'steps':5})
            self.assertEqual(code,200)
            self.assertEqual(headers['Content-Type'],'audio/wav')
            wav, rate = sf.read(io.BytesIO(raw))
            self.assertEqual((len(wav),rate),(2400,24000))
            self.assertFalse(server.lock.locked())
    def test_voice_reference_permission_and_cleanup(self):
        stream=io.BytesIO(); sf.write(stream,np.zeros(72000),24000,format='WAV')
        body={'text':'Clone test.','reference':base64.b64encode(stream.getvalue()).decode()}
        self.assertEqual(self.request('/api/generate','POST',body)[0],400)
        body['consent']=True
        self.assertEqual(self.request('/api/generate','POST',body)[0],200)
        self.assertFalse(Path(server.model.kwargs['reference_wav_path']).exists())
    def test_bad_requests_and_concurrent_generation(self):
        for body in (b'{broken', [], {'text':22}, {'text':'ok','steps':999}):
            self.assertEqual(self.request('/api/generate','POST',body)[0],400)
            self.assertFalse(server.lock.locked())
        self.assertEqual(self.request('/api/generate','POST',b'{}',extra={'Content-Length':str(23*1024*1024)})[0],413)
        server.lock.acquire()
        try: self.assertEqual(self.request('/api/generate','POST',{'text':'Busy'})[0],409)
        finally: server.lock.release()
    def test_health_and_files_do_not_expose_model_or_settings(self):
        self.assertEqual(self.request('/healthz',token=None)[0],200)
        for path in ('/.models/config.json','/local/server.py','/api/unknown'):
            self.assertEqual(self.request(path)[0],404)
    def test_load_is_authenticated_and_not_duplicated(self):
        server.model=None
        server.state.update(state='idle')
        started, release = threading.Event(), threading.Event()
        def fake_load():
            started.set(); release.wait(3)
            server.model=Model(); server.state.update(state='ready'); server.lock.release()
        with patch.object(server,'load_model',side_effect=fake_load) as load:
            self.assertEqual(self.request('/api/load','POST',{},token=None)[0],401)
            self.assertFalse(load.called)
            self.assertEqual(self.request('/api/load','POST',{})[0],200)
            self.assertTrue(started.wait(2))
            self.assertEqual(self.request('/api/load','POST',{})[0],200)
            self.assertEqual(load.call_count,1)
            release.set()
        for _ in range(100):
            if not server.lock.locked(): break
            threading.Event().wait(.01)
        self.assertFalse(server.lock.locked())
    def test_reference_is_cleaned_and_errors_do_not_echo_private_text(self):
        stream=io.BytesIO(); sf.write(stream,np.zeros(72000),24000,format='WAV')
        seen=[]
        def fail(**kwargs):
            seen.append(kwargs['reference_wav_path'])
            raise RuntimeError('Private reference or script content must not appear in responses')
        server.model.generate=fail
        code, _, raw=self.request('/api/generate','POST',{'text':'Secret test','reference':base64.b64encode(stream.getvalue()).decode(),'consent':True})
        self.assertEqual(code,500)
        self.assertNotIn(b'Private reference',raw)
        # The HTTP body may arrive just before the handler's finally block finishes.
        self.assertTrue(server.lock.acquire(timeout=1))
        server.lock.release()
        self.assertFalse(Path(seen[0]).exists())
    def test_local_mode_keeps_host_and_origin_restrictions(self):
        server.SETTINGS=server.server_settings({})
        self.assertEqual(self.request(token=None)[0],403)
        code, _, raw=self.request(token=None,origin='http://127.0.0.1:8765',extra={'Host':'127.0.0.1:8765'})
        self.assertEqual(code,200)
        self.assertEqual(json.loads(raw)['engine'],'python')
        self.assertEqual(self.request('/api/load','POST',{},origin='https://evil.test',extra={'Host':'127.0.0.1:8765'})[0],403)
    def test_remote_configuration_fails_closed(self):
        valid={'BEK_SERVER_MODE':'remote','BEK_API_TOKEN':TOKEN,'BEK_ALLOWED_ORIGINS':ORIGIN}
        for changes in ({'BEK_API_TOKEN':''},{'BEK_API_TOKEN':'x'*513},{'BEK_API_TOKEN':'x'*32+'\x01'},{'BEK_ALLOWED_ORIGINS':'*'},{'BEK_ALLOWED_ORIGINS':'http://public.test'},{'BEK_ALLOWED_ORIGINS':ORIGIN+'/path'}):
            with self.assertRaises(ValueError): server.server_settings({**valid,**changes})
        self.assertFalse(server.server_settings({})['remote'])
if __name__=='__main__': unittest.main()
