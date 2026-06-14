#!/bin/bash
set -euo pipefail

PORT="${PORT:-8000}"
SERVER_PID=""

cleanup() {
  if [[ -n "${SERVER_PID}" ]]; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Building site..."
pnpm run build

echo "Starting local server on http://localhost:${PORT}"
python3 -m http.server "${PORT}" >/dev/null 2>&1 &
SERVER_PID=$!

echo "Watching for changes..."
bash watch.sh
