#!/bin/sh
set -eu
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Install Node.js 22.12+ to build the frontend, or use docker compose up -d --build."
  exit 1
fi
if ! node -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22||(major===22&&minor>=12)?0:1)'; then
  echo "Node.js 22.12 or newer is required."
  exit 1
fi
npm ci
npm run build
