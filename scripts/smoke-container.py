#!/usr/bin/env python3
"""Check a running static container/proxy without downloading AI model weights."""
from pathlib import Path
import json
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

base = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765').rstrip('/')
root = Path(__file__).resolve().parent.parent / 'dist'

def get(path, headers=None):
    with urlopen(Request(base + path, headers=headers or {}), timeout=15) as response:
        return response.status, response.headers, response.read()

status, headers, body = get('/healthz')
assert status == 200 and body == b'ok\n', 'Health endpoint failed'
status, headers, body = get('/')
assert b'Bek' in body and b'/assets/' in body, 'Wrong application root'
assert headers.get('X-Content-Type-Options') == 'nosniff', 'Missing content type protection'
assert 'no-cache' in headers.get('Cache-Control', ''), 'Application updates may be stale'

for path in root.rglob('*'):
    if not path.is_file():
        continue
    relative = '/' + path.relative_to(root).as_posix()
    if path.suffix == '.wasm':
        status, headers, body = get(relative, {'Range': 'bytes=0-1023'})
        assert status == 206, f'Range requests failed: {relative}'
        assert headers.get_content_type() == 'application/wasm', f'Wrong WASM MIME type: {relative}'
        assert body == path.read_bytes()[:1024], f'WASM bytes differ: {relative}'
    else:
        status, headers, body = get(relative)
        assert status == 200 and body == path.read_bytes(), f'Asset differs or missing: {relative}'
        if path.suffix in {'.js', '.mjs'}:
            assert headers.get_content_type() in {'application/javascript', 'text/javascript'}, f'Wrong module MIME type: {relative}'
try:
    get('/api/status')
    raise AssertionError('Static deployment unexpectedly exposed an inference API')
except HTTPError as error:
    assert error.code == 501
    assert 'browser WebGPU' in json.load(error)['error']
try:
    get('/missing-asset.js')
    raise AssertionError('Missing assets must return 404')
except HTTPError as error:
    assert error.code == 404
print(f'PASS: health, application, all assets, WASM ranges/MIME, update headers, missing files, and static-only API at {base}')
