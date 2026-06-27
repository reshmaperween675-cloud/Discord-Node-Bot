import type { Message } from "discord.js";
import { getUser, updateUser } from "./storage.js";
import { MINERALS, MINERAL_BY_ID, rollMineral, luckMultiplier } from "./data.js";
import { eventBonus } from "./events.js";
import { emoji } from "./emojis.js";
import { isAutohuntActive } from "./extra.js";
import { isBossActive, bossTakeDamage } from "./bosses.js";
import { tryDropElement, broadcastElementDrop } from "./elements.js";

const BASE_MINE_CD_MS = 30_000;

function pickaxeMultiplier(tier: number): number {
  // Higher tier = lower cooldown
  if (tier >= 3) return 0.5;
  if (tier >= 2) return 0.7;
  if (tier >= 1) return 0.85;
  return 1;
}

export async function cmdMine(message: Message): Promise<void> {
  const u = getUser(message.author.id);
  if (!u.hasPickaxe) {
    await message.reply(`${emoji("mine")} You need a **Pickaxe** first. Buy one with \`lowo buy pickaxe\` *(12,000 cowoncy)*.`);
    return;
  }
  const now = Date.now();
  const cd = Math.floor(BASE_MINE_CD_MS * pickaxeMultiplier(u.pickaxeTier));
  if (now - u.lastMine < cd) {
    const left = Math.ceil((cd - (now - u.lastMine)) / 1000);
    await message.reply(`⏳ The shaft is recharging. Mine again in **${left}s**.`);
    return;
  }

  const luck = luckMultiplier(u.arcuesUnlocked, u.luckUntil, u.megaLuckUntil, isAutohuntActive(message.author.id));
  const drops = eventBonus("mineral_rush") > 1 ? 2 : 1;
  const found: string[] = [];
  updateUser(message.author.id, (x) => {
    x.lastMine = now;
    for (let i = 0; i < drops; i++) {
      const m = rollMineral(luck);
      x.minerals[m.id] = (x.minerals[m.id] ?? 0) + 1;
      found.push(`${m.emoji} **${m.name}** *(${m.rarity})*`);
    }
  });

  // Mining can also chip damage on an active world boss (light contribution)
  if (isBossActive(message.guildId)) {
    const dmg = 60 + Math.floor(Math.random() * 80);
    bossTakeDamage(message, dmg, "pickaxe").catch(() => {});
  }

  // ETERNAL ELEMENTS — Underworld drop. Mine is always manual (autohunt never mines).
  const dropped = tryDropElement(message.author.id, "eternal_underworld", true);
  let replyText = `${emoji("mine")} You swing your pickaxe and find: ${found.join(" • ")}`;
  if (dropped) replyText += `\n💀 ⚡ **ABSOLUTE DROP** — **Eternal Element of Underworld** unearthed! Check \`lowo elements\`.`;
  await message.reply(replyText);
  if (dropped) await broadcastElementDrop(message, dropped);
}

export async function cmdMinerals(message: Message): Promise<void> {
  const u = getUser(message.author.id);
  const owned = MINERALS.filter((m) => (u.minerals[m.id] ?? 0) > 0);
  if (owned.length === 0) { await message.reply(`${emoji("mine")} No minerals yet. Try \`lowo mine\`!`); return; }
  const lines = [`${emoji("mine")} **Your Minerals** *(sell with \`lowo sellmineral <id> [count]\`, craft with \`lowo craft\`)*`];
  for (const m of owned) {
    lines.push(`${m.emoji} \`${m.id}\` — **${m.name}** *(${m.rarity})* × **${u.minerals[m.id]}** • sells for ${m.sellPrice.toLocaleString()} ea`);
  }
  await message.reply(lines.join("\n").slice(0, 1900));
}

export async function cmdSellMineral(message: Message, args: string[]): Promise<void> {
  const id = args[0]?.toLowerCase();
  const m = id ? MINERAL_BY_ID[id] : null;
  if (!m) { await message.reply("Usage: `lowo sellmineral <id> [count|all]` — see `lowo minerals`."); return; }
  const u = getUser(message.author.id);
  const have = u.minerals[m.id] ?? 0;
  if (have <= 0) { await message.reply(`❌ You don't have any **${m.name}**.`); return; }
  let count: number;
  const rawCount = args[1]?.toLowerCase();
  if (!rawCount || rawCount === "all") count = have;
  else { count = parseInt(rawCount, 10); if (isNaN(count) || count <= 0) count = 1; }
  count = Math.min(count, have);
  const gain = count * m.sellPrice;
  updateUser(message.author.id, (x) => {
    x.minerals[m.id] = have - count;
    if (x.minerals[m.id] <= 0) delete x.minerals[m.id];
    x.cowoncy += gain;
  });
  await message.reply(`💰 Sold ${count}× ${m.emoji} **${m.name}** → +**${gain.toLocaleString()}** cowoncy.`);
}
