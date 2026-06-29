import http from "node:http";
import { readFileSync } from "node:fs";

import { handleOAuthCallback, handleOAuthConfirm, handleOAuthCancel } from "../verification/webCallback.js";
import { handleAdminPanel } from "../admin/panel.js";

const TERMS_HTML = readFileSync(new URL("./pages/terms.html", import.meta.url), "utf-8");
const PRIVACY_HTML = readFileSync(new URL("./pages/privacy.html", import.meta.url), "utf-8");

const KEEP_ALIVE_INTERVAL_MS = 30_000;

export function startHttpServer(port: number): void {
  const server = http.createServer((req, res) => {
    const path = req.url?.split("?")[0];

    if (path === "/api/oauth/callback") {
      handleOAuthCallback(req, res).catch((err) => {
        console.error("[OAUTH] Unhandled error in callback:", err);
        res.writeHead(500);
        res.end("Internal Server Error");
      });
      return;
    }

    if (path === "/api/oauth/confirm" && req.method === "POST") {
      handleOAuthConfirm(req, res).catch((err) => {
        console.error("[OAUTH] Unhandled error in confirm:", err);
        res.writeHead(500);
        res.end("Internal Server Error");
      });
      return;
    }

    if (path === "/api/oauth/cancel") {
      handleOAuthCancel(req, res);
      return;
    }

    if (path === "/admin/panel") {
      handleAdminPanel(req, res).catch((err) => {
        console.error("[ADMIN] Panel error:", err);
        res.writeHead(500);
        res.end("Internal Server Error");
      });
      return;
    }

    if (path === "/terms") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(TERMS_HTML);
      return;
    }

    if (path === "/privacy") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(PRIVACY_HTML);
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  server.listen(port, () => {
    console.log(`[KEEP-ALIVE] HTTP server running on port ${port}`);
  });

  setInterval(() => {
    http
      .get(`http://localhost:${port}/`, (res) => {
        res.resume();
      })
      .on("error", (err) => {
        console.warn("[KEEP-ALIVE] Self-ping failed:", err.message);
      });
  }, KEEP_ALIVE_INTERVAL_MS);
}
