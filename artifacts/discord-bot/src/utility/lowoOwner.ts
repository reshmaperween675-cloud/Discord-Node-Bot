import type { Message, ChatInputCommandInteraction } from "discord.js";
import { getPool } from "../persistence.js";

const DELEGATES_KEY = "owner:delegates";
const delegatedOwnerIds = new Set<string>();

export function getLowoOwnerId(): string {
  // .trim() guards against a stray trailing newline/space from pasting the
  // value into Railway's env var UI — invisible in the dashboard but breaks
  // the exact-match comparison below.
  return (process.env.LOWO_OWNER_ID ?? "").trim();
}

export function isConfiguredLowoOwner(userId: string): boolean {
  const id = getLowoOwnerId();
  return !!id && userId === id;
}

export function isLowoOwner(userId: string): boolean {
  return isConfiguredLowoOwner(userId) || delegatedOwnerIds.has(userId);
}

export function getDelegatedLowoOwnerIds(): string[] {
  return [...delegatedOwnerIds];
}

export async function loadDelegatedLowoOwners(): Promise<void> {
  const result = await getPool().query<{ value: { userIds?: unknown } }>(
    "SELECT value FROM bot_kv WHERE key = $1",
    [DELEGATES_KEY],
  );
  const storedIds = result.rows[0]?.value?.userIds;
  if (!Array.isArray(storedIds)) {
    delegatedOwnerIds.clear();
    return;
  }
  const ids = storedIds.filter(
    (id): id is string => typeof id === "string" && /^\d{17,20}$/.test(id),
  );
  delegatedOwnerIds.clear();
  for (const id of ids) delegatedOwnerIds.add(id);
}

export async function addDelegatedLowoOwner(userId: string): Promise<boolean> {
  if (delegatedOwnerIds.has(userId)) return false;
  const nextIds = [...delegatedOwnerIds, userId];
  await getPool().query(
    `INSERT INTO bot_kv (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [DELEGATES_KEY, JSON.stringify({ userIds: nextIds })],
  );
  delegatedOwnerIds.add(userId);
  return true;
}

export async function removeDelegatedLowoOwner(userId: string): Promise<boolean> {
  if (!delegatedOwnerIds.has(userId)) return false;
  const nextIds = [...delegatedOwnerIds].filter((id) => id !== userId);
  await getPool().query(
    `INSERT INTO bot_kv (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [DELEGATES_KEY, JSON.stringify({ userIds: nextIds })],
  );
  delegatedOwnerIds.delete(userId);
  return true;
}

export function requireLowoOwnerMessage(message: Message): boolean {
  return isLowoOwner(message.author.id);
}

export async function requireLowoOwnerInteraction(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (isLowoOwner(interaction.user.id)) return true;
  await interaction.editReply({
    content: "🚫 This command is restricted to the bot owner.",
  });
  return false;
}
