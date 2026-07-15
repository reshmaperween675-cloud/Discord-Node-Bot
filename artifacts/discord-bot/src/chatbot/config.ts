import { getPool } from "../persistence.js";

export interface ChatbotConfig {
  guildId: string;
  enabledChannels: string[];
  ignoredUsers: string[];
  respondRate: number;
  model: string;
  botName: string;
  customPrompt: string;
  theme: string;
}

const DEFAULT_CONFIG: Omit<ChatbotConfig, "guildId"> = {
  enabledChannels: [],
  ignoredUsers: [],
  respondRate: 15,
  model: "openai/gpt-4o-mini",
  botName: "mewo",
  customPrompt: "",
  theme: "bro",
};

const cache = new Map<string, ChatbotConfig>();

async function ensureTable(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS chatbot_config (
      guild_id         TEXT    PRIMARY KEY,
      enabled_channels TEXT[]  NOT NULL DEFAULT '{}',
      ignored_users    TEXT[]  NOT NULL DEFAULT '{}',
      respond_rate     INT     NOT NULL DEFAULT 15,
      model            TEXT    NOT NULL DEFAULT 'openai/gpt-4o-mini',
      bot_name         TEXT    NOT NULL DEFAULT 'mewo',
      custom_prompt    TEXT    NOT NULL DEFAULT '',
      theme            TEXT    NOT NULL DEFAULT 'bro'
    );

    CREATE TABLE IF NOT EXISTS chatbot_memory (
      guild_id     TEXT        NOT NULL,
      memory_type  TEXT        NOT NULL,
      subject_id   TEXT        NOT NULL,
      data         JSONB       NOT NULL DEFAULT '{}',
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, memory_type, subject_id)
    );

    CREATE TABLE IF NOT EXISTS chatbot_messages (
      id          SERIAL      PRIMARY KEY,
      guild_id    TEXT        NOT NULL,
      channel_id  TEXT        NOT NULL,
      user_id     TEXT        NOT NULL,
      username    TEXT        NOT NULL DEFAULT '',
      content     TEXT        NOT NULL,
      is_bot      BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await getPool().query(`
    CREATE INDEX IF NOT EXISTS chatbot_messages_channel_time
      ON chatbot_messages (channel_id, created_at DESC);
  `).catch(() => {});
  // Migrate existing rows — add theme column if missing
  await getPool().query(`
    ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'bro';
  `).catch(() => {});
}

let tableReady = false;
async function ready(): Promise<void> {
  if (tableReady) return;
  await ensureTable();
  tableReady = true;
}

export async function getConfig(guildId: string): Promise<ChatbotConfig> {
  if (cache.has(guildId)) return cache.get(guildId)!;
  await ready();
  const res = await getPool().query<{
    enabled_channels: string[];
    ignored_users: string[];
    respond_rate: number;
    model: string;
    bot_name: string;
    custom_prompt: string;
    theme: string;
  }>(
    "SELECT * FROM chatbot_config WHERE guild_id = $1",
    [guildId],
  );
  const row = res.rows[0];
  const config: ChatbotConfig = row
    ? {
        guildId,
        enabledChannels: row.enabled_channels,
        ignoredUsers: row.ignored_users,
        respondRate: row.respond_rate,
        model: row.model,
        botName: row.bot_name,
        customPrompt: row.custom_prompt,
        theme: row.theme ?? "bro",
      }
    : { guildId, ...DEFAULT_CONFIG };
  cache.set(guildId, config);
  return config;
}

export async function saveConfig(config: ChatbotConfig): Promise<void> {
  await ready();
  await getPool().query(
    `INSERT INTO chatbot_config (guild_id, enabled_channels, ignored_users, respond_rate, model, bot_name, custom_prompt, theme)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (guild_id) DO UPDATE SET
       enabled_channels = $2,
       ignored_users    = $3,
       respond_rate     = $4,
       model            = $5,
       bot_name         = $6,
       custom_prompt    = $7,
       theme            = $8`,
    [
      config.guildId,
      config.enabledChannels,
      config.ignoredUsers,
      config.respondRate,
      config.model,
      config.botName,
      config.customPrompt,
      config.theme,
    ],
  );
  cache.set(config.guildId, config);
}

export function isChannelEnabled(config: ChatbotConfig, channelId: string): boolean {
  return config.enabledChannels.includes(channelId);
}
