import { Client, GatewayIntentBits, Partials, REST } from "discord.js";
import { initPersistence, flushAll } from "./persistence.js";
import { BASE_COMMANDS, makeReregister } from "./bot/registry.js";
import { buildSlashHandlers, BUTTON_HANDLERS, PUBLIC_COMMANDS } from "./bot/handlers.js";
import { registerLifecycleEvents } from "./bot/lifecycle.js";
import { registerInteractionHandler } from "./bot/interactions.js";
import { startHttpServer } from "./bot/http.js";
import { startWatchdog } from "./bot/watchdog.js";
import { registerAntiNukeEvents } from "./antinuke/index.js";
import { spawnApiServer } from "./bot/api-server.js";

const token = process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN;
if (!token) {
  console.error("DISCORD_BOT_TOKEN is not set. Exiting.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const rest = new REST({ version: "10" }).setToken(token);
const reregister = makeReregister(client, rest);
const slashHandlers = buildSlashHandlers(client, reregister);

client.on("raw", (packet: { t?: string; d?: { guild_id?: string; author?: { id?: string } } }) => {
  if (packet.t === "MESSAGE_CREATE") {
    console.log(
      `[RAW-GATEWAY] MESSAGE_CREATE received — guild_id=${packet.d?.guild_id ?? "(none, i.e. DM)"} author=${packet.d?.author?.id}`,
    );
  }
});

registerAntiNukeEvents(client);
registerLifecycleEvents(client, rest, BASE_COMMANDS);
registerInteractionHandler(client, slashHandlers, BUTTON_HANDLERS, PUBLIC_COMMANDS);

// Spawn the API server as a subprocess — ensures it runs regardless of how
// Railway launches this process (direct node invocation or via start.sh).
spawnApiServer();

const PORT = parseInt(process.env.PORT ?? "3000", 10);
startHttpServer(PORT);
startWatchdog(client, token);

process.on("unhandledRejection", (reason) => {
  console.error("[PROCESS] Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[PROCESS] Uncaught exception — bot may need restart:", err);
});

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    console.log(`[PROCESS] Received ${sig}, flushing data to Postgres...`);
    try {
      await flushAll();
    } catch (err) {
      console.error("[PROCESS] Flush on shutdown failed:", err);
    }
    process.exit(0);
  });
}

async function bootstrap(): Promise<void> {
  try {
    await initPersistence();
  } catch (err) {
    console.error("[BOOT] Persistence init failed:", err);
  }
  await client.login(token);
}

bootstrap();
