import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_PORT = 8081;

// Resolve the api-server dist path relative to this file's location.
// In the Docker image: /app/artifacts/discord-bot/dist/index.mjs → ../../api-server/dist/index.mjs
const API_SERVER_DIST = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../api-server/dist/index.mjs",
);

function spawnApiServer(): void {
  if (!existsSync(API_SERVER_DIST)) {
    console.warn(
      `[API] api-server dist not found at ${API_SERVER_DIST} — skipping (dev mode?)`
    );
    return;
  }

  const env = { ...process.env, PORT: String(API_PORT) };

  function launch(): void {
    console.log(`[API] Starting api-server on :${API_PORT}...`);
    const child = spawn("node", [API_SERVER_DIST], { env, stdio: "inherit" });

    child.on("error", (err) => {
      console.error("[API] Failed to spawn api-server:", err.message);
      console.error("[API] Retrying in 3s...");
      setTimeout(launch, 3000);
    });

    child.on("exit", (code, signal) => {
      console.error(
        `[API] api-server exited (code=${code ?? "null"}, signal=${signal ?? "null"}) — restarting in 3s`
      );
      setTimeout(launch, 3000);
    });
  }

  launch();
}

export { spawnApiServer, API_PORT };
