import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from "discord.js";
import pg from "pg";
import { requireLowoOwnerInteraction } from "./lowoOwner.js";

const { Client } = pg;

export const backupDbData = new SlashCommandBuilder()
  .setName("backupdb")
  .setDescription("Download a full backup of the Postgres database as a JSON file.")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function executeBackupDb(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!await requireLowoOwnerInteraction(interaction)) return;

  const connString = process.env.DATABASE_URL;
  if (!connString) {
    await interaction.editReply({ content: "DATABASE_URL is not set — cannot connect to Postgres." });
    return;
  }

  const client = new Client({ connectionString: connString });

  try {
    await client.connect();
  } catch (err) {
    await interaction.editReply({ content: `Failed to connect to Postgres: ${(err as Error).message}` });
    return;
  }

  let rows: { key: string; value: unknown }[] = [];
  try {
    const result = await client.query<{ key: string; value: unknown }>(
      "SELECT key, value FROM bot_kv ORDER BY key"
    );
    rows = result.rows;
  } catch (err) {
    await client.end().catch(() => {});
    await interaction.editReply({ content: `Failed to query database: ${(err as Error).message}` });
    return;
  }

  await client.end().catch(() => {});

  if (rows.length === 0) {
    await interaction.editReply({ content: "The database is empty — nothing to export." });
    return;
  }

  // Build a clean keyed object { "leveling.json": { ...data }, ... }
  const data: Record<string, unknown> = {};
  for (const row of rows) {
    data[row.key] = row.value;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    keyCount: rows.length,
    keys: rows.map((r) => r.key),
    data,
  };

  const json   = JSON.stringify(payload, null, 2);
  const buffer = Buffer.from(json, "utf-8");

  // Discord bot file limit is 8 MB
  if (buffer.byteLength > 8 * 1024 * 1024) {
    await interaction.editReply({
      content: `Backup is too large to attach (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). Contact support.`,
    });
    return;
  }

  const dateStr     = new Date().toISOString().slice(0, 10);
  const attachment  = new AttachmentBuilder(buffer, { name: `backup-${dateStr}.json` });

  await interaction.editReply({
    content:
      `Postgres backup complete.\n` +
      `**${rows.length} key(s) exported** — \`${rows.map((r) => r.key).join("`, `")}\`\n\n` +
      `Download the file and keep it safe. You can give it to the agent to restore on a fresh database.`,
    files: [attachment],
  });
}
