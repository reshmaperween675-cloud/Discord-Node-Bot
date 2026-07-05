#!/bin/sh
set -e

# Start the API server (Control Center backend) on internal port 8080.
# Railway only exposes the bot's PORT — this port is never public.
PORT=8080 node /app/artifacts/api-server/dist/index.mjs &
API_PID=$!

# Wait until the API server is accepting connections, or fail after 30s.
echo "[start.sh] Waiting for API server to be ready..."
TRIES=0
until wget -qO- http://localhost:8080/api/healthz > /dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ $TRIES -ge 30 ]; then
    echo "[start.sh] ERROR: API server did not become ready after 30s" >&2
    kill "$API_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done
echo "[start.sh] API server ready after ${TRIES}s."

# Start the Discord bot as the main process.
# Railway monitors this process — if it dies, the service restarts.
exec node /app/artifacts/discord-bot/dist/index.mjs
