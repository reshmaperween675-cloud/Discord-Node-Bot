#!/bin/sh
set -e

# Start the API server (Control Center backend) on internal port 8080.
# Railway only exposes the bot's PORT — this port is never public.
PORT=8080 node /app/artifacts/api-server/dist/index.mjs &

# Wait until the API server is accepting connections.
# Uses node (always available) instead of wget/curl (not in slim image).
echo "[start.sh] Waiting for API server to be ready..."
TRIES=0
READY=0
while [ $TRIES -lt 30 ]; do
  if node -e "const h=require('http');h.get('http://localhost:8080/api/healthz',r=>{process.exit(r.statusCode<400?0:1)}).on('error',()=>process.exit(1))" 2>/dev/null; then
    READY=1
    break
  fi
  TRIES=$((TRIES + 1))
  sleep 1
done

if [ $READY -eq 1 ]; then
  echo "[start.sh] API server ready after ${TRIES}s."
else
  echo "[start.sh] WARNING: API server did not respond after ${TRIES}s — Control Center will be unavailable." >&2
fi

# Start the Discord bot as the main process.
# Railway monitors this process — if it dies, the service restarts.
exec node /app/artifacts/discord-bot/dist/index.mjs
