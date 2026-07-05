#!/bin/sh
set -e

# Supervisor: start the API server and auto-restart it if it crashes.
# The api-server runs on internal port 8080 (never public-facing).
start_api_server() {
  while true; do
    PORT=8080 node /app/artifacts/api-server/dist/index.mjs
    echo "[start.sh] API server exited ($?) — restarting in 2s..." >&2
    sleep 2
  done
}
start_api_server &

# Wait until the API server is actually accepting connections.
# Uses node (always present) — wget/curl are not in node:22-bookworm-slim.
echo "[start.sh] Waiting for API server..."
TRIES=0
while [ $TRIES -lt 30 ]; do
  if node -e "const h=require('http');h.get('http://localhost:8080/api/healthz',r=>{process.exit(r.statusCode<400?0:1)}).on('error',()=>process.exit(1))" 2>/dev/null; then
    echo "[start.sh] API server ready after ${TRIES}s."
    break
  fi
  TRIES=$((TRIES + 1))
  sleep 1
done

if [ $TRIES -ge 30 ]; then
  echo "[start.sh] WARNING: API server did not respond after 30s — Control Center may be unavailable." >&2
fi

# Start the Discord bot as the foreground process Railway monitors.
exec node /app/artifacts/discord-bot/dist/index.mjs
