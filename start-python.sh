#!/bin/sh
set -eu
cd "$(dirname "$0")"
./scripts/build-frontend.sh
if [ ! -d .venv ]; then
  PYTHON=""
  for candidate in python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; sys.exit(not ((3,10) <= sys.version_info[:2] < (3,13)))'; then
      PYTHON="$candidate"
      break
    fi
  done
  if [ -z "$PYTHON" ]; then
    echo "Install Python 3.10, 3.11, or 3.12, then run this script again."
    exit 1
  fi
  "$PYTHON" -m venv .venv
fi
if ! .venv/bin/python -c 'import voxcpm, soundfile' >/dev/null 2>&1; then
  .venv/bin/python -m pip install -r local/requirements.txt
fi
exec .venv/bin/python local/server.py
