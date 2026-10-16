#!/bin/sh
set -eu
cd "$(dirname "$0")"
./scripts/build-frontend.sh
echo "Bek browser voice studio → http://127.0.0.1:8765"
echo "Open that address in Chrome or Edge, then set up the 1.9 GB browser model."
echo "No Python speech dependencies are needed in browser mode."
exec python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
