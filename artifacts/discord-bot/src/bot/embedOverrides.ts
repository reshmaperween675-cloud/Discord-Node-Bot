/**
 * Dashboard embed override system.
 * Before any embed is sent, call applyEmbedOverride(id, embed, vars).
 * It checks bot_kv for a dashboard override and merges it in silently.
 * Variables like {user}, {level} in the override text are substituted with
 * real values from the `vars` map before the embed is sent.
 */
import { EmbedBuilder } from "discord.js";
import { getDb } from "../db.js";
import * as schema from "@workspace/db/schema";
import { eq } from "drizzle-orm";

type EmbedOverride = {
  title?: string | null;
  description?: string | null;
  color?: number | null;
  footer?: string | null;
  thumbnail?: string | null;
  image?: string | null;
  fields?: Array<{ name: string; value: string; inline: boolean }>;
};

function sub(text: string | null | undefined, vars: Record<string, string>): string | null {
  if (text == null) return null;
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), text);
}

/**
 * Applies a dashboard embed override to an existing EmbedBuilder.
 * Falls back silently to the original embed if there's no override or if DB fails.
 *
 * @param id   - Embed ID matching the dashboard catalog (e.g. "mod.kick", "leveling.rank")
 * @param embed - The EmbedBuilder already constructed with real values
 * @param vars  - Runtime values to substitute into override template text
 */
export async function applyEmbedOverride(
  id: string,
  embed: EmbedBuilder,
  vars: Record<string, string> = {},
): Promise<EmbedBuilder> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.botKvTable)
      .where(eq(schema.botKvTable.key, `dashboard:embed:${id}`))
      .limit(1);

    if (!rows[0]) return embed;

    const ov = rows[0].value as EmbedOverride;

    if (ov.title !== undefined)       embed.setTitle(sub(ov.title, vars));
    if (ov.description !== undefined) embed.setDescription(sub(ov.description, vars));
    if (ov.color != null)             embed.setColor(ov.color);
    if (ov.footer !== undefined) {
      const ft = sub(ov.footer, vars);
      embed.setFooter(ft ? { text: ft } : null);
    }
    if (ov.thumbnail !== undefined)   embed.setThumbnail(sub(ov.thumbnail, vars));
    if (ov.image !== undefined)       embed.setImage(sub(ov.image, vars));
    // Apply fields override if explicitly set (even [] to clear all fields)
    if (ov.fields !== undefined) {
      embed.setFields(
        ov.fields.map((f) => ({
          name:   sub(f.name,  vars) ?? f.name,
          value:  sub(f.value, vars) ?? f.value,
          inline: f.inline,
        })),
      );
    }
  } catch (err) {
    // Never crash the bot over a dashboard override failure
    console.warn(`[embedOverrides] ${id}:`, (err as Error).message);
  }
  return embed;
}
