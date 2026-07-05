import app from "./app";
import { logger } from "./lib/logger";

// Prevent any unhandled promise rejection or uncaught exception from killing
// the process — log it and stay alive so the proxy never gets "unavailable".
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "[API] Unhandled promise rejection — staying alive");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "[API] Uncaught exception — staying alive");
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  logger.error("PORT environment variable is not set — defaulting to 8080");
}

const port = Number(rawPort ?? 8080);

if (Number.isNaN(port) || port <= 0) {
  logger.error({ rawPort }, "Invalid PORT value — defaulting to 8080");
}

const listenPort = (Number.isNaN(port) || port <= 0) ? 8080 : port;

app.listen(listenPort, (err) => {
  if (err) {
    logger.error({ err }, "Failed to bind port — exiting");
    process.exit(1);
  }
  logger.info({ port: listenPort }, "API server listening");
});
