import type { Message } from "discord.js";
import { AttachmentBuilder } from "discord.js";
import { getUser, allUsers } from "./storage.js";
import { ANIMAL_BY_ID, PITY_THRESHOLD, BACKGROUND_BY_ID } from "./data.js";
import { generateProfileCard } from "./profileCard.js";
import { isCensored } from "./censor.js";
import { PermissionFlagsBits } from "discord.js";
import { isLowoOwner } from "../utility/lowoOwner.js";
import { emoji, allEmojiKeys, isOverridden, saveOverrides, catalogKeys, mergeOverrides } from "./emojis.js";
import {
  baseEmbed, replyEmbed, successEmbed, errorEmbed, warnEmbed, val, COLOR,
  progressBar, progressBarBlocks,
} from "./embeds.js";

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

// HOTFIX helper: pretty mm:ss / Hh Mm remaining for a future timestamp.
function fmtRemaining(untilMs: number): string | null {
  const ms = untilMs - Date.now();
  if (ms <= 0) return null;
  const s = Math.ceil(ms / 1000);
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ${s % 60}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

/**
 * v6.3 — "Trainer ID" profile (anti-embed compact layout).
 * Sends the canvas Trainer Card as a file attachment alongside tight
 * horizontal emoji-string stat lines. No embed — zero vertical bloat.
 */
export async function cmdProfile(message: Message): Promise<void> {
  const target = message.mentions.users.first() ?? message.author;
  const u = getUser(target.id);
  const animals = Object.values(u.zoo).reduce((a, b) => a + b, 0);
  const married = u.marriedTo ? `<@${u.marriedTo}>` : "*single*";

  // Active potion / buff timers
  const buffs: string[] = [];
  const luckLeft     = fmtRemaining(u.luckUntil ?? 0);       if (luckLeft)     buffs.push(`🍀 Luck \`${luckLeft}\``);
  const megaLuckLeft = fmtRemaining(u.megaLuckUntil ?? 0);   if (megaLuckLeft) buffs.push(`🌟 MegaLuck \`${megaLuckLeft}\``);
  const hasteLeft    = fmtRemaining(u.hasteUntil ?? 0);      if (hasteLeft)    buffs.push(`💨 Haste \`${hasteLeft}\``);
  const shieldLeft   = fmtRemaining(u.shieldUntil ?? 0);     if (shieldLeft)   buffs.push(`🛡️ Shield \`${shieldLeft}\``);
  const dinoLeft     = fmtRemaining(u.dinoSummonUntil ?? 0); if (dinoLeft)     buffs.push(`🦖 Dino \`${dinoLeft}\``);

  // Compute level the same way `lowo level` does so the two views agree.
  const animalXpSum = Object.values(u.animalXp ?? {}).reduce((a, b) => a + b, 0);
  const xp =
    (u.huntsTotal ?? 0) * 10 +
    (u.bossKills  ?? 0) * 100 +
    (u.dex.length      ) * 50 +
    animalXpSum;
  const level = Math.floor(Math.sqrt(xp / 100));

  // Try to render the canvas Trainer Card.
  let cardFile: AttachmentBuilder | null = null;
  try {
    const buf = await generateProfileCard(target);
    cardFile = new AttachmentBuilder(buf, { name: `lowo-card-${target.id}.png` });
  } catch (err) {
    console.error("[LOWO PROFILE] card render failed", err);
  }

  const pityNow = u.pity ?? 0;
  const pityBar = progressBarBlocks(pityNow, PITY_THRESHOLD);

  // ── Compact horizontal layout ──────────────────────────────────────────
  const header = u.tag
    ? `🪪 **${target.username}'s Trainer ID** — *"${u.tag}"*`
    : `🪪 **${target.username}'s Trainer ID**`;
  const econLine    = `💰 \`${fmtK(u.cowoncy)}\` | ✨ \`${fmtK(u.essence)}\` | 🪙 \`${u.lowoCash}\` | 📈 Lv.\`${level}\` | 🎯 \`${pityNow}/${PITY_THRESHOLD}\` | 🔥 \`${u.dailyStreak}d\``;
  const combatLine  = `🐾 \`${fmtK(animals)}\` *(${u.dex.length} unique)* | ⚔️ \`${u.weapons.length} wpns\` | ⭐ \`${u.rep} rep\` | 🎟️ \`${u.lotteryTickets} tkts\` | 💍 ${married}`;
  const pityLine    = `🎯 ${pityBar}`;

  // VOID CORRUPTIONS (v6.2) — surface forge / corruption state when present.
  const corruptedCount = Object.keys(u.corrupted ?? {}).length;
  const voidShards = u.voidShards ?? 0;
  const equippedRelic = u.equippedRelic ?? null;
  const voidParts: string[] = [];
  if (voidShards     > 0)  voidParts.push(`💎 \`${fmtK(voidShards)}\``);
  if (corruptedCount > 0)  voidParts.push(`👾 \`${corruptedCount} corrupted\``);
  if (equippedRelic)       voidParts.push(`🜏 \`${equippedRelic}\``);
  const voidLine = voidParts.length ? voidParts.join(" | ") : null;

  const parts = [header, econLine, combatLine, pityLine, voidLine].filter(Boolean) as string[];
  if (buffs.length) parts.push(`⚡ **Buffs:** ${buffs.join(" • ")}`);

  await message.reply({
    content: parts.join("\n"),
    ...(cardFile ? { files: [cardFile] } : {}),
    allowedMentions: { repliedUser: false, parse: [] },
  });
}

export async function cmdCard(message: Message): Promise<void> {
  const target = message.mentions.users.first() ?? message.author;
  try {
    const buf = await generateProfileCard(target);
    const file = new AttachmentBuilder(buf, { name: `lowo-card-${target.id}.png` });
    const ch = message.channel;
    if ("send" in ch) {
      await ch.send({ content: `🪪 **${target.username}'s Lowo Card**`, files: [file] });
    } else {
      await message.reply({ files: [file] });
    }
  } catch (err) {
    console.error("[LOWO CARD]", err);
    await message.reply("⚠️ Couldn't render card right now — try again in a sec.");
  }
}

export async function cmdLevel(message: Message): Promise<void> {
  const target = message.mentions.users.first() ?? message.author;
  const u = getUser(target.id);
  const animalXpSum = Object.values(u.animalXp ?? {}).reduce((a, b) => a + b, 0);
  const xp =
    (u.huntsTotal ?? 0) * 10 +
    (u.bossKills  ?? 0) * 100 +
    (u.dex.length      ) * 50 +
    animalXpSum;
  const level = Math.floor(Math.sqrt(xp / 100));
  const prevXp = Math.pow(level, 2) * 100;
  const nextXp = Math.pow(level + 1, 2) * 100;
  const inLevel = xp - prevXp;
  const need = nextXp - prevXp;

  const e = baseEmbed(message, COLOR.profile)
    .setAuthor({ name: `${target.username} — Lowo Level ${level}`, iconURL: target.displayAvatarURL({ size: 128 }) })
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .setTitle(`📈 Level ${level}`)
    .setDescription(`**XP:** ${val(xp)} / ${val(nextXp)}\n${progressBar(inLevel, need)}`)
    .addFields(
      { name: "🏹 Hunts",   value: val(u.huntsTotal ?? 0), inline: true },
      { name: "👹 Bosses",  value: val(u.bossKills ?? 0),  inline: true },
      { name: "📖 Dex",     value: val(u.dex.length),      inline: true },
      { name: "🐾 Pet XP",  value: val(animalXpSum),       inline: true },
    );
  await replyEmbed(message, e);
}

export async function cmdAvatar(message: Message): Promise<void> {
  const target = message.mentions.users.first() ?? message.author;
  await message.reply(target.displayAvatarURL({ size: 512 }));
}

export async function cmdWallpaper(message: Message): Promise<void> {
  await message.reply("🖼️ Buy a background from `lowo shop`, then apply it with `lowo setbg <id>`. View card with `lowo card`.");
}

export async function cmdEmoji(message: Message, args: string[]): Promise<void> {
  const e = args[0];
  if (!e) { await message.reply("Usage: `lowo emoji <emoji>`"); return; }
  await message.reply(e);
}

export async function cmdCookie(message: Message): Promise<void> {
  const target = message.mentions.users.first();
  if (target && target.id !== message.author.id) {
    await message.reply(`🍪 **${message.author.username}** gives **${target.username}** a cookie!`);
  } else {
    await message.reply(`🍪 **${message.author.username}** has a cookie!`);
  }
}

export async function cmdPray(message: Message): Promise<void> {
  const target = message.mentions.users.first();
  const blessed = Math.random() < 0.5;
  if (blessed && target) await message.reply(`🙏 **${message.author.username}** prays for **${target.username}** — they feel blessed! ✨`);
  else if (target) await message.reply(`🙏 **${message.author.username}** prays for **${target.username}** — but the gods are silent...`);
  else await message.reply(`🙏 **${message.author.username}** prays — ${blessed ? "blessed!" : "the gods are silent..."}`);
}

export async function cmdCurse(message: Message): Promise<void> {
  if (isCensored(message.guildId)) {
    await message.reply("🤫 `lowo curse` is censored on this server.");
    return;
  }
  const target = message.mentions.users.first();
  if (!target) { await message.reply("Usage: `lowo curse @user`"); return; }
  const cursed = Math.random() < 0.5;
  await message.reply(`😈 **${message.author.username}** curses **${target.username}** — ${cursed ? "they are cursed! 💀" : "the curse fizzles."}`);
}

// Rankings — now with rep and tag display
export async function cmdTop(message: Message, args: string[]): Promise<void> {
  const users = allUsers();
  const kind = (args[0] ?? "cowoncy").toLowerCase();
  const sorter: Record<string, (u: ReturnType<typeof getUser>) => number> = {
    cowoncy: (u) => u.cowoncy,
    essence: (u) => u.essence,
    dex:     (u) => u.dex.length,
    animals: (u) => Object.values(u.zoo).reduce((a, b) => a + b, 0),
    rep:     (u) => u.rep ?? 0,
    streak:  (u) => u.dailyStreak ?? 0,
  };
  const fn = sorter[kind] ?? sorter.cowoncy;
  const sorted = Object.entries(users)
    .map(([id, u]) => ({ id, score: fn(u), tag: u.tag }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  if (sorted.length === 0) { await replyEmbed(message, warnEmbed(message, "Empty Leaderboard")); return; }
  const medals = ["🥇", "🥈", "🥉"];
  const lines = sorted.map((s, i) => `${medals[i] ?? `**${i + 1}.**`} <@${s.id}>${s.tag ? ` *"${s.tag.slice(0, 24)}"*` : ""} — ${val(s.score)}`);
  const e = baseEmbed(message, COLOR.brand)
    .setTitle(`🏆 Top Lowo — ${kind.toUpperCase()}`)
    .setDescription(lines.join("\n"))
    .addFields({ name: "Try other categories", value: "`cowoncy` • `essence` • `dex` • `animals` • `rep` • `streak`" });
  await replyEmbed(message, e);
}

export async function cmdMy(message: Message): Promise<void> {
  await cmdProfile(message);
}

/**
 * Lists every named emoji slot the bot knows about, marking which are using a
 * custom Discord emoji override vs the unicode fallback. Useful when building
 * `data/lowo_emojis.json`.
 *
 * Usage:
 *   lowo emojis            — list every key (chunked into multiple replies if long)
 *   lowo emojis <filter>   — only list keys containing <filter>
 */
export async function cmdEmojiList(message: Message, args: string[]): Promise<void> {
  const filter = (args[0] ?? "").toLowerCase();
  const keys = allEmojiKeys().filter((k) => !filter || k.toLowerCase().includes(filter));
  if (keys.length === 0) {
    await message.reply(`${emoji("fail")} No emoji keys match \`${filter}\`.`);
    return;
  }
  const header = `${emoji("sparkles")} **Lowo Emoji Catalog** — *${keys.length} key${keys.length === 1 ? "" : "s"}${filter ? ` matching \`${filter}\`` : ""}*\n_Override any with \`data/lowo_emojis.json\` (e.g. \`{"fire":"<:my_fire:123…>"}\`).  ${emoji("check")} = custom override active._\n`;
  const lines = keys.map((k) => `${isOverridden(k) ? emoji("check") : emoji("dot")} \`${k}\` ${emoji(k)}`);

  const chunks: string[] = [];
  let buf = header;
  for (const line of lines) {
    if (buf.length + line.length + 1 > 1900) {
      chunks.push(buf);
      buf = "";
    }
    buf += `\n${line}`;
  }
  if (buf) chunks.push(buf);

  await message.reply(chunks[0]);
  const ch = message.channel;
  if ("send" in ch) {
    for (let i = 1; i < chunks.length; i++) await ch.send(chunks[i]);
  }
}

/**
 * `lowo emojisync` — auto-build the emoji override file from the bot's
 * application emojis (uploaded in Discord Developer Portal → Emojis tab).
 * For every application emoji whose name matches a catalog key, persist
 * `<:name:id>` (or `<a:name:id>` for animated) into `data/lowo_emojis.json`
 * and hot-swap it into memory immediately.
 *
 * Restricted to bot owner (`LOWO_OWNER_ID`) or members with Manage Server.
 */
export async function cmdEmojiSync(message: Message): Promise<void> {
  const isOwner = isLowoOwner(message.author.id);
  const isAdmin = message.member?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;
  if (!isOwner && !isAdmin) {
    await message.reply(`${emoji("locked")} Only the bot owner or members with **Manage Server** can run \`emojisync\`.`);
    return;
  }

  const app = message.client.application;
  if (!app) {
    await message.reply(`${emoji("fail")} Could not access application data.`);
    return;
  }

  const appEmojis = await app.emojis.fetch().catch(() => null);
  if (!appEmojis) {
    await message.reply(`${emoji("fail")} Couldn't fetch application emojis. Make sure the bot is fully ready.`);
    return;
  }

  // Build a lowercase → exact catalog key lookup for case-insensitive matching
  // (Developer Portal often capitalises names, e.g. "Cowoncy" vs catalog "cowoncy")
  const catalogList = catalogKeys();
  const catLower = new Map<string, string>(); // lowercase → catalog key
  for (const k of catalogList) catLower.set(k.toLowerCase(), k);

  const map: Record<string, string> = {};
  const matched: string[] = [];
  const skipped: string[] = [];

  for (const e of appEmojis.values()) {
    if (!e.name) continue;
    const catalogKey = catLower.get(e.name.toLowerCase());
    if (!catalogKey) { skipped.push(e.name); continue; }
    map[catalogKey] = `<${e.animated ? "a" : ""}:${e.name}:${e.id}>`;
    matched.push(catalogKey);
  }

  if (matched.length === 0) {
    await message.reply([
      `${emoji("warn")} **No catalog matches found.**`,
      `Found **${appEmojis.size}** application emoji${appEmojis.size === 1 ? "" : "s"}, but none have names matching catalog keys.`,
      `${emoji("info")} Upload emojis in the **Discord Developer Portal → your app → Emojis tab**, name them after catalog keys (run \`lowo emojis\` to see all), then re-run \`lowo emojisync\`.`,
    ].join("\n"));
    return;
  }

  saveOverrides(map);

  const sample = matched.slice(0, 18).map((k) => `${emoji(k)} \`${k}\``).join("  ");
  const more = matched.length > 18 ? `  *…+${matched.length - 18} more*` : "";
  const missing = catalogKeys().filter((k) => !map[k]);
  await message.reply([
    `${emoji("success")} **Synced ${matched.length} application emoji${matched.length === 1 ? "" : "s"}** into \`data/lowo_emojis.json\`. Live immediately. ${emoji("sparkles")}`,
    sample + more,
    "",
    `${emoji("info")} ${missing.length} catalog slot${missing.length === 1 ? "" : "s"} still on unicode fallback (run \`lowo emojis\` to see all).`,
    skipped.length > 0 ? `${emoji("dot")} ${skipped.length} emoji${skipped.length === 1 ? "" : "s"} ignored (name didn't match a catalog key).` : "",
  ].filter(Boolean).join("\n"));
}

/**
 * `lowo emojiupload` — drag-and-drop image attachments into Discord chat.
 * The bot uploads each image as a bot application emoji (visible across all
 * servers) AND registers it in the catalog immediately. No server permissions
 * needed — emojis live on the bot application itself.
 *
 * Filename rules:
 *   - `cowoncy.png` → uploads as `:cowoncy:` and maps the `cowoncy` catalog slot
 *   - Stem must match a known catalog key (run `lowo emojis` to see all keys)
 *   - PNG/JPG/GIF/WebP, ≤256 KB each (Discord limit)
 *
 * Restricted to bot owner (`LOWO_OWNER_ID`) or members with Manage Server.
 */
export async function cmdEmojiUpload(message: Message): Promise<void> {
  const isOwner = isLowoOwner(message.author.id);
  const isAdmin = message.member?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;
  if (!isOwner && !isAdmin) {
    await message.reply(`${emoji("locked")} Only the bot owner or members with **Manage Server** can run \`emojiupload\`.`);
    return;
  }

  const app = message.client.application;
  if (!app) {
    await message.reply(`${emoji("fail")} Could not access application data.`);
    return;
  }

  if (message.attachments.size === 0) {
    await message.reply([
      `${emoji("info")} **How to use \`lowo emojiupload\`:**`,
      `${emoji("dot")} Drag image files into Discord chat (PNG/JPG/GIF/WebP, ≤256 KB each).`,
      `${emoji("dot")} Name the file after the catalog key — e.g. \`cowoncy.png\` becomes \`:cowoncy:\`.`,
      `${emoji("dot")} Attach as many as you want in one message, then send with \`lowo emojiupload\` as the message text.`,
      `${emoji("dot")} Emojis upload to the **bot application** (visible everywhere, no server limit).`,
      `${emoji("dot")} Run \`lowo emojis\` to see all catalog keys.`,
    ].join("\n"));
    return;
  }

  const cat = new Set(catalogKeys());

  // Build a map of already-existing application emojis by name
  const existingByName = new Map<string, { id: string; animated: boolean }>();
  const existing = await app.emojis.fetch().catch(() => null);
  if (existing) {
    for (const e of existing.values()) {
      if (e.name) existingByName.set(e.name, { id: e.id, animated: !!e.animated });
    }
  }

  const partial: Record<string, string> = {};
  const uploaded: string[] = [];
  const reused: string[] = [];
  const skipped: string[] = [];

  for (const att of message.attachments.values()) {
    const filename = att.name ?? "file";
    const stem = filename.replace(/\.[^.]+$/, "");
    if (!cat.has(stem)) { skipped.push(`${filename} *(name not in catalog)*`); continue; }
    const isImg = (att.contentType ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(filename);
    if (!isImg) { skipped.push(`${filename} *(not an image)*`); continue; }
    if ((att.size ?? 0) > 256_000) { skipped.push(`${filename} *(>256 KB)*`); continue; }

    const prev = existingByName.get(stem);
    if (prev) {
      partial[stem] = `<${prev.animated ? "a" : ""}:${stem}:${prev.id}>`;
      reused.push(stem);
      continue;
    }
    try {
      const created = await app.emojis.create({ attachment: att.url, name: stem });
      partial[stem] = `<${created.animated ? "a" : ""}:${stem}:${created.id}>`;
      uploaded.push(stem);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "upload failed";
      skipped.push(`${filename} *(${msg.slice(0, 80)})*`);
    }
  }

  if (Object.keys(partial).length > 0) mergeOverrides(partial);

  const lines: string[] = [];
  if (uploaded.length > 0) {
    lines.push(`${emoji("success")} **Uploaded ${uploaded.length} new application emoji${uploaded.length === 1 ? "" : "s"}** & registered in catalog ${emoji("sparkles")}`);
    lines.push(uploaded.map((k) => `${emoji(k)} \`${k}\``).join("  "));
  }
  if (reused.length > 0) {
    lines.push(`${emoji("ok")} **Re-used ${reused.length} existing application emoji${reused.length === 1 ? "" : "s"}**: ${reused.map((k) => `\`${k}\``).join(", ")}`);
  }
  if (skipped.length > 0) {
    lines.push(`${emoji("warn")} **Skipped ${skipped.length}:**`);
    lines.push(skipped.slice(0, 12).map((s) => `${emoji("dot")} ${s}`).join("\n"));
    if (skipped.length > 12) lines.push(`${emoji("dot")} *…+${skipped.length - 12} more*`);
  }
  if (lines.length === 0) lines.push(`${emoji("warn")} Nothing changed.`);
  await message.reply(lines.join("\n").slice(0, 1990));
}
