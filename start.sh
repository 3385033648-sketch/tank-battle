#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

PORT="${PORT:-8000}"

if command -v python3 >/dev/null 2>&1; then
  echo "Serving on http://localhost:$PORT"
  exec python3 -m http.server "$PORT"
fi

if command -v python >/dev/null 2>&1; then
  echo "Serving on http://localhost:$PORT"
  exec python -m http.server "$PORT"
fi

if command -v npx >/dev/null 2>&1; then
  echo "Serving on http://localhost:$PORT"
  exec npx --yes serve -l "$PORT" .
fi

echo "未找到 python3 / python / npx，请直接双击 index.html 运行。" >&2
exit 1
