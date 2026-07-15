import { getPool } from "../persistence.js";

export interface ChannelMessage {
  userId: string;
  username: string;
  content: string;
  isBot: boolean;
  createdAt: Date;
}

export interface UserMemory {
  nickname?: string;
  interests: string[];
  notes: string[];
  personality: string;
  lastSeen?: string;
}

export interface ServerMemory {
  insideJokes: string[];
  frequentTopics: string[];
  events: string[];
  notes: string[];
}

// In-memory ring buffer: channelId → last 100 messages
const conversationCache = new Map<string, ChannelMessage[]>();
const MAX_CHANNEL_MSGS = 100;

// ─── Conversation memory ───────────────────────────────────────────────────────

export function pushToCache(channelId: string, msg: ChannelMessage): void {
  let buf = conversationCache.get(channelId);
  if (!buf) {
    buf = [];
    conversationCache.set(channelId, buf);
  }
  buf.push(msg);
  if (buf.length > MAX_CHANNEL_MSGS) buf.shift();
}

export function getCachedMessages(channelId: string, limit = 80): ChannelMessage[] {
  const buf = conversationCache.get(channelId) ?? [];
  return buf.slice(-limit);
}

export async function persistMessage(
  guildId: string,
  channelId: string,
  userId: string,
  username: string,
  content: string,
  isBot: boolean,
): Promise<void> {
  await getPool()
    .query(
      `INSERT INTO chatbot_messages (guild_id, channel_id, user_id, username, content, is_bot)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [guildId, channelId, userId, username, content, isBot],
    )
    .catch(() => {});

  // Prune old messages: keep last 500 per channel
  getPool()
    .query(
      `DELETE FROM chatbot_messages
       WHERE channel_id = $1
         AND id NOT IN (
           SELECT id FROM chatbot_messages
           WHERE channel_id = $1
           ORDER BY created_at DESC
           LIMIT 500
         )`,
      [channelId],
    )
    .catch(() => {});
}

export async function loadChannelHistory(
  channelId: string,
  limit = 80,
): Promise<ChannelMessage[]> {
  const res = await getPool().query<{
    user_id: string;
    username: string;
    content: string;
    is_bot: boolean;
    created_at: Date;
  }>(
    `SELECT user_id, username, content, is_bot, created_at
     FROM chatbot_messages
     WHERE channel_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [channelId, limit],
  );
  return res.rows
    .reverse()
    .map((r) => ({
      userId: r.user_id,
      username: r.username,
      content: r.content,
      isBot: r.is_bot,
      createdAt: r.created_at,
    }));
}

// ─── User memory ───────────────────────────────────────────────────────────────

const userMemCache = new Map<string, UserMemory>();

export async function getUserMemory(
  guildId: string,
  userId: string,
): Promise<UserMemory> {
  const key = `${guildId}:${userId}`;
  if (userMemCache.has(key)) return userMemCache.get(key)!;
  const res = await getPool().query<{ data: UserMemory }>(
    "SELECT data FROM chatbot_memory WHERE guild_id=$1 AND memory_type='user' AND subject_id=$2",
    [guildId, userId],
  );
  const mem: UserMemory = res.rows[0]?.data ?? { interests: [], notes: [], personality: "" };
  userMemCache.set(key, mem);
  return mem;
}

export async function saveUserMemory(
  guildId: string,
  userId: string,
  mem: UserMemory,
): Promise<void> {
  const key = `${guildId}:${userId}`;
  userMemCache.set(key, mem);
  await getPool()
    .query(
      `INSERT INTO chatbot_memory (guild_id, memory_type, subject_id, data)
       VALUES ($1, 'user', $2, $3::jsonb)
       ON CONFLICT (guild_id, memory_type, subject_id)
       DO UPDATE SET data = $3::jsonb, updated_at = NOW()`,
      [guildId, userId, JSON.stringify(mem)],
    )
    .catch(() => {});
}

// ─── Server memory ─────────────────────────────────────────────────────────────

const serverMemCache = new Map<string, ServerMemory>();

export async function getServerMemory(guildId: string): Promise<ServerMemory> {
  if (serverMemCache.has(guildId)) return serverMemCache.get(guildId)!;
  const res = await getPool().query<{ data: ServerMemory }>(
    "SELECT data FROM chatbot_memory WHERE guild_id=$1 AND memory_type='server' AND subject_id=$1",
    [guildId],
  );
  const mem: ServerMemory = res.rows[0]?.data ?? {
    insideJokes: [],
    frequentTopics: [],
    events: [],
    notes: [],
  };
  serverMemCache.set(guildId, mem);
  return mem;
}

export async function saveServerMemory(
  guildId: string,
  mem: ServerMemory,
): Promise<void> {
  serverMemCache.set(guildId, mem);
  await getPool()
    .query(
      `INSERT INTO chatbot_memory (guild_id, memory_type, subject_id, data)
       VALUES ($1, 'server', $1, $2::jsonb)
       ON CONFLICT (guild_id, memory_type, subject_id)
       DO UPDATE SET data = $2::jsonb, updated_at = NOW()`,
      [guildId, JSON.stringify(mem)],
    )
    .catch(() => {});
}

export async function clearServerMemory(guildId: string): Promise<void> {
  serverMemCache.delete(guildId);
  await getPool()
    .query(
      "DELETE FROM chatbot_memory WHERE guild_id=$1 AND memory_type='server'",
      [guildId],
    )
    .catch(() => {});
}
