import type { Client } from "discord.js";

const WS_DISCONNECTED = 5;
const WATCHDOG_INTERVAL_MS = 30_000;
const AUTO_RESUME_WAIT_MS = 5_000;

export function startWatchdog(client: Client, token: string): void {
  let wsReconnecting = false;

  setInterval(async () => {
    if (wsReconnecting) return;
    if (client.ws.status !== WS_DISCONNECTED) return;

    wsReconnecting = true;
    console.warn("[WATCHDOG] WebSocket is DISCONNECTED — waiting 5s for auto-resume...");

    await new Promise<void>((r) => setTimeout(r, AUTO_RESUME_WAIT_MS));

    if (client.ws.status !== WS_DISCONNECTED) {
      console.log("[WATCHDOG] Connection restored automatically — no action needed.");
      wsReconnecting = false;
      return;
    }

    console.warn("[WATCHDOG] Still disconnected after 5s — forcing full reconnect.");
    try {
      client.destroy();
      await client.login(token);
      console.log("[WATCHDOG] Reconnected successfully.");
    } catch (err) {
      console.error("[WATCHDOG] Reconnect failed:", err);
    } finally {
      wsReconnecting = false;
    }
  }, WATCHDOG_INTERVAL_MS);
}
