#!/bin/bash
set -euo pipefail

snapshot() {
  find . \
    -path './.git' -prune -o \
    -path './node_modules' -prune -o \
    -name 'index.html' -prune -o \
    -type f -exec stat -f '%m %N' {} \; | sort
}

last_state="$(snapshot)"

echo "Watching source files for changes. Press Ctrl+C to stop."

while true; do
  sleep 1
  current_state="$(snapshot)"

  if [[ "${current_state}" != "${last_state}" ]]; then
    echo ""
    echo "Change detected, rebuilding..."
    pnpm run build
    last_state="$(snapshot)"
  fi
done
