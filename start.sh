#!/bin/sh
# NO set -e — the supervisor loop must survive api-server crashes.
# With set -e, any non-zero exit inside the while loop body kills the subshell,
# meaning the api-server would never restart after its first crash.

# Railway injects PORT at runtime. Fall back to 8080 for local runs.
API_PORT="${PORT:-8080}"

# ── API server supervisor ────────────────────────────────────────────────────
# Runs in a background subshell. Restarts automatically on any crash.
(
  while true; do
    echo "[api] Starting api-server on :${API_PORT}..." >&2
    node /app/artifacts/api-server/dist/index.mjs || \
      echo "[api] Exited ($?), restarting in 3s..." >&2
    sleep 3
  done
) &

# ── Wait for api-server to be ready ─────────────────────────────────────────
# node is always available; wget/curl are not in node:22-bookworm-slim.
echo "[start] Waiting for api-server..."
i=0
while [ $i -lt 20 ]; do
  if node -e "
    var h=require('http');
    h.get('http://localhost:${API_PORT}/api/healthz',function(r){
      process.exit(r.statusCode<400?0:1);
    }).on('error',function(){process.exit(1)});
  " 2>/dev/null; then
    echo "[start] API server ready (${i}s)."
    break
  fi
  i=$((i+1))
  sleep 1
done

[ $i -ge 20 ] && echo "[start] WARNING: api-server not ready after 20s — Control Center may be unavailable." >&2

# ── Discord bot (foreground — Railway monitors this process) ─────────────────
echo "[start] Starting Discord bot..."
exec node /app/artifacts/discord-bot/dist/index.mjs
