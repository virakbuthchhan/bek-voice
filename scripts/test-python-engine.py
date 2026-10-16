"""Exercise HTTP generation against the pinned VoxCPM 2.0.3 call signature.

Run with the Python engine environment: .venv/bin/python scripts/test-python-engine.py
The fake model avoids downloading weights; audio encoding and RNGs use real dependencies.
"""
import io
import json
from pathlib import Path
import sys
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import numpy as np
import soundfile as sf
import torch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'local'))
import server


class PinnedAPIModel:
    class tts_model:
        sample_rate = 24000

    def generate(self, *args, **kwargs):
        # Match VoxCPM.generate's forwarding, so an unsupported seed kwarg fails.
        return self._generate(*args, **kwargs)

    def _generate(self, text, reference_wav_path, cfg_value, inference_timesteps):
        self.settings = (text, reference_wav_path, cfg_value, inference_timesteps)
        return torch.randn(2400).numpy() * 0.1


class PythonEngineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()

    def setUp(self):
        server.model = PinnedAPIModel()
        server.state.update(state='ready')

    def generate(self, seed):
        request = Request(
            f'http://127.0.0.1:{self.http.server_port}/api/generate',
            data=json.dumps({'text': 'Hello Bek.', 'seed': seed, 'guidance': 2, 'steps': 5}).encode(),
            headers={'Host': '127.0.0.1:8765', 'Content-Type': 'application/json'},
        )
        with urlopen(request) as response:
            self.assertEqual(response.headers['Content-Type'], 'audio/wav')
            return response.read()

    def test_default_seed_generates_wav(self):
        audio, rate = sf.read(io.BytesIO(self.generate(None)))
        self.assertEqual(rate, 24000)
        self.assertEqual(len(audio), 2400)
        self.assertTrue(np.isfinite(audio).all())
        self.assertEqual(server.model.settings, ('Hello Bek.', None, 2.0, 5))
        self.assertEqual(server.state['state'], 'ready')
        self.assertFalse(server.lock.locked())

    def test_explicit_seed_is_repeatable_including_zero(self):
        for seed in (0, 42):
            with self.subTest(seed=seed):
                self.assertEqual(self.generate(seed), self.generate(seed))
        self.assertNotEqual(self.generate(0), self.generate(42))

    def test_invalid_seed_releases_lock(self):
        with self.assertRaises(HTTPError) as caught:
            self.generate(-1)
        self.assertEqual(caught.exception.code, 400)
        self.assertFalse(server.lock.locked())
        self.generate(None)


if __name__ == '__main__':
    unittest.main()
