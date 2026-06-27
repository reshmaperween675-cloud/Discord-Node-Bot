import type { Message } from "discord.js";
import { getUser, updateUser } from "./storage.js";
import {
  ANIMALS, ANIMAL_BY_ID, RARITY_COLOR, RARITY_ORDER,
  HUNT_POOL, VOLCANIC_HUNT_POOL, SPACE_HUNT_POOL, HEAVEN_HUNT_POOL, VOID_UNKNOWN_HUNT_POOL,
  INFINITE_VOID_HUNT_POOL,
  rollAnimalInArea, luckMultiplier, essenceArcuesMultiplier, PITY_THRESHOLD,
  AREA_BY_ID, teamAttributeLuck, type Animal, type Rarity, type HuntArea,
} from "./data.js";
import { onHuntCaught, bestHuntCdMultiplier, sellMultiplier, essenceMultiplier } from "./skills.js";
import { eventBonus, activeEvent } from "./events.js";
import { isAutohuntActive } from "./extra.js";
import { refreshAreaUnlocks } from "./areas.js";
import { teamEnchantLuck } from "./enchant.js";
import { maybeRollMutationDuringEvent, mutationLabel } from "./mutations.js";
import { autoSellOne, getAutoSellRarities, resolveAreaArg } from "./autoSell.js";
import { emoji } from "./emojis.js";
import { huntCooldownPenaltyMs, huntLuckMultiplier, sacrificeAreaMultiplier } from "./areaTraits.js";
import { onHuntForTeam } from "./sentientPets.js";
import { hasRelic } from "./forge.js";
import { consumeVoidLureIfPresent } from "./voidshop.js";
import { tryDropElement, broadcastElementDrop } from "./elements.js";
import { teamHasCorruptedPet, corruptedTag } from "./corrupt.js";
import {
  baseEmbed, baseEmbedFor, replyEmbed, errorEmbed, warnEmbed, successEmbed, val,
  COLOR, rarityColor, pagerButtons, ZOO_BUTTON_PREFIX,
} from "./embeds.js";
import {
  EmbedBuilder, ActionRowBuilder, type ButtonBuilder, type User,
} from "discord.js";

// VOID CORRUPTIONS — Cursed Compass post-roll secret chance (+0.05% per hunt).
const CURSED_COMPASS_SECRET_CHANCE = 0.0005;
const SECRET_PET_IDS = ["pepsodent", "internet", "dino_leo", "god_rithwik"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const NO_DAILY_STEAL_CHANCE = 0.01;

const BASE_HUNT_COOLDOWN_MS = 15_000;
const HUNTS_PER_LOWOCASH = 50;
// HOTFIX: rarities strictly above `omni` in RARITY_ORDER also award +1 Lowo Cash on catch.
// RARITY_ORDER lists rarest first → "above omni" = lower index than omni's index.
const OMNI_INDEX = RARITY_ORDER.indexOf("omni");
function isAboveOmni(r: Rarity): boolean {
  const i = RARITY_ORDER.indexOf(r);
  return i >= 0 && i < OMNI_INDEX;
}

// ─── Tolerant animal lookup (multi-word + case/punct-insensitive) ─────────────
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const ANIMAL_LOOKUP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const a of ANIMALS) {
    map[norm(a.id)] = a.id;
    map[norm(a.name)] = a.id;
  }
  return map;
})();
function resolveAnimalId(query: string): string | null {
  if (!query) return null;
  return ANIMAL_LOOKUP[norm(query)] ?? null;
}

function parseAnimalAndCount(args: string[], owned: number | null): { id: string | null; count: number; name: string } {
  if (args.length === 0) return { id: null, count: 1, name: "" };
  const last = args[args.length - 1].toLowerCase();
  let nameTokens = args;
  let count = 1;
  if (last === "all") {
    nameTokens = args.slice(0, -1);
    count = owned ?? 1;
  } else if (/^\d+$/.test(last)) {
    nameTokens = args.slice(0, -1);
    count = Math.max(1, parseInt(last, 10));
  }
  const name = nameTokens.join(" ").trim();
  return { id: resolveAnimalId(name), count, name };
}

function poolForArea(area: HuntArea): Animal[] {
  if (area === "volcanic")      return VOLCANIC_HUNT_POOL;
  if (area === "space")         return SPACE_HUNT_POOL;
  if (area === "heaven")        return HEAVEN_HUNT_POOL;
  if (area === "void_unknown")  return VOID_UNKNOWN_HUNT_POOL;
  if (area === "infinite_void") return INFINITE_VOID_HUNT_POOL;
  return HUNT_POOL;
}

// Rarities that trigger the ULTRA RARE CATCH banner on manual hunts.
const ULTRA_RARE_RARITIES = new Set<Rarity>([
  "ethereal", "divine", "omni", "glitched",
  "inferno", "cosmic", "void", "secret",
  "supreme", "transcendent",
]);

function rollWithRareRush(area: HuntArea, luck: number, manual: boolean): Animal {
  const boost = eventBonus("rare");
  if (boost <= 1) return rollAnimalInArea(area, luck, manual);
  const rolls: Animal[] = Array.from({ length: boost }, () => rollAnimalInArea(area, luck, manual));
  rolls.sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  return rolls[0];
}

export async function cmdHunt(message: Message): Promise<void> {
  const u = getUser(message.author.id);
  const now = Date.now();
  const cdMult = bestHuntCdMultiplier(message.author.id);
  // VOID ASCENSION (v6): area trait — volcanic adds a "Heat" cooldown penalty.
  const cooldown = Math.floor(BASE_HUNT_COOLDOWN_MS * cdMult) + huntCooldownPenaltyMs(u.huntArea);
  if (now - u.lastHunt < cooldown) {
    const left = Math.ceil((cooldown - (now - u.lastHunt)) / 1000);
    await replyEmbed(message, warnEmbed(message, "Slow Down!", `${emoji("hourglass")} Hunt again in **${left}s**.`));
    return;
  }

  // ─── VOID ASCENSION (v6) — Easter egg: hungry bot steals if no daily ─────
  if (now - (u.lastDaily ?? 0) > DAY_MS && Math.random() < NO_DAILY_STEAL_CHANCE) {
    updateUser(message.author.id, (x) => { x.lastHunt = now; });
    const e = baseEmbed(message, COLOR.warn)
      .setTitle("🦊 SNATCHED!")
      .setDescription([
        `*A wild Lowo darts in and snatches your catch right out of your hands!*`,
        `> "Tee-hee! You forgot \`lowo daily\` again — finder's keepers!"`,
      ].join("\n"))
      .addFields({ name: "Tip", value: "Claim `lowo daily` regularly so the bot doesn't get hungry." });
    await replyEmbed(message, e);
    return;
  }

  // Defensive: stage-hunt bug — snap u.huntArea back to "default" if the user
  // somehow has a huntArea they haven't unlocked (data drift, old saves, etc).
  // Without this, the picker pool is empty and hunts silently fail.
  let area: HuntArea = u.huntArea;
  if (area !== "default" && !u.unlockedAreas.includes(area)) {
    area = "default";
    updateUser(message.author.id, (x) => { x.huntArea = "default"; });
  }
  // VOID CORRUPTIONS (v6.2) — Infinite Void requires a corrupted pet on the team.
  if (area === "infinite_void" && !teamHasCorruptedPet(u)) {
    await replyEmbed(message, warnEmbed(message, "👾 The Void Rejects You",
      [
        "*The Infinite Void recoils — none of your pets are corrupted enough to enter.*",
        "",
        "Add at least one **👾 corrupted pet** to your team *(`lowo team add <pet>`)*, or run `lowo corrupt <pet>` first.",
      ].join("\n")));
    return;
  }
  let drops = eventBonus("hunt") > 1 ? Math.round(eventBonus("hunt")) : 1;
  // Triple Drop gamepass: 25% chance per hunt to roll one bonus animal.
  if (u.gamepasses["gp_triple_drop"] && Math.random() < 0.25) drops += 1;
  // VOID CORRUPTIONS — Chaos Shard relic: +10% chance to drop a bonus animal.
  if (hasRelic(message.author.id, "chaos_shard") && Math.random() < 0.10) drops += 1;
  // VOID SHOP — Void Lure: consumed on the next Infinite-Void hunt for +2 drops.
  if (area === "infinite_void" && consumeVoidLureIfPresent(message.author.id)) {
    drops += 2;
  }
  const autohuntOn = isAutohuntActive(message.author.id);
  const isManual = !autohuntOn; // manual hunters get buffed rarity weights + 2× pity
  let luck = luckMultiplier(u.arcuesUnlocked, u.luckUntil, u.megaLuckUntil, autohuntOn);
  const lucky = eventBonus("luck"); if (lucky > 1) luck *= lucky;
  // Pet-attribute team luck (above-ethereal pets) + enchantment team luck.
  luck *= teamAttributeLuck(u.team);
  luck *= teamEnchantLuck(message.author.id);
  // VOID ASCENSION (v6) — area trait: heaven grants +10% luck.
  luck *= huntLuckMultiplier(area);
  // VOID CORRUPTIONS — Void Eye relic: +10% global luck.
  if (hasRelic(message.author.id, "void_eye")) luck *= 1.10;
  // OP Dino Summon Stone temporarily boosts Dino Leo chance via overall luck.
  if (Date.now() < u.dinoSummonUntil) luck *= 5;
  const caught: Animal[] = [];
  const caughtMutations: Array<{ id: string; mutation: string | null }> = [];
  let pityTriggered = false;

  for (let i = 0; i < drops; i++) {
    let a = rollWithRareRush(area, luck, isManual);
    const currentPity = (u.pity ?? 0) + caught.filter((c) => c.rarity !== "legendary").length;
    // Pity Pro gamepass halves the pity threshold (from 200 → 100).
    const pityCap = u.gamepasses["gp_pity_pro"] ? Math.floor(PITY_THRESHOLD / 2) : PITY_THRESHOLD;
    if (currentPity >= pityCap) {
      const pool = poolForArea(area);
      const legendaries = pool.filter((x) => x.rarity === "legendary");
      if (legendaries.length) { a = legendaries[Math.floor(Math.random() * legendaries.length)]; pityTriggered = true; }
    }
    // VOID CORRUPTIONS — Cursed Compass relic: +0.05% chance per hunt to flip
    // a non-secret catch into a random SECRET pet. Skipped in Infinite Void
    // (its pool excludes secrets by design).
    if (area !== "infinite_void" && a.rarity !== "secret" &&
        hasRelic(message.author.id, "cursed_compass") &&
        Math.random() < CURSED_COMPASS_SECRET_CHANCE) {
      const candidates = SECRET_PET_IDS.map((sid) => ANIMAL_BY_ID[sid]).filter(Boolean) as Animal[];
      if (candidates.length) a = candidates[Math.floor(Math.random() * candidates.length)];
    }
    caught.push(a);
    // Mutation roll — only when one of the 10 mutation events is active.
    const mut = maybeRollMutationDuringEvent();
    caughtMutations.push({ id: a.id, mutation: mut?.id ?? null });
  }

  let cashGained = 0;
  let arcuesJustUnlocked = false;
  // HOTFIX: track which catches were auto-sold for the result message.
  const autoSellSet = getAutoSellRarities(message.author.id);
  const autoSoldFlags: boolean[] = caught.map((a) => autoSellSet.has(a.rarity));
  let aboveOmniBonus = 0;
  updateUser(message.author.id, (x) => {
    x.lastHunt = now;
    x.lastHuntArea = area;
    x.huntsTotal = (x.huntsTotal ?? 0) + caught.length;
    const before = (x.huntsTotal - caught.length);
    const newMilestones = Math.floor(x.huntsTotal / HUNTS_PER_LOWOCASH) - Math.floor(before / HUNTS_PER_LOWOCASH);
    if (newMilestones > 0) { x.lowoCash += newMilestones; cashGained = newMilestones; }
    for (let idx = 0; idx < caught.length; idx++) {
      const a = caught[idx];
      // HOTFIX: above-omni catches grant +1 Lowo Cash each (regardless of autosell).
      if (isAboveOmni(a.rarity)) { x.lowoCash += 1; aboveOmniBonus += 1; }
      // Dex always credited even if auto-sold so progress isn't lost.
      if (!x.dex.includes(a.id)) x.dex.push(a.id);
      if (area === "volcanic"     && !x.volcanicDex.includes(a.id))    x.volcanicDex.push(a.id);
      if (area === "space"        && !x.spaceDex.includes(a.id))       x.spaceDex.push(a.id);
      if (area === "heaven"       && !x.heavenDex.includes(a.id))      x.heavenDex.push(a.id);
      if (area === "void_unknown" && !x.voidUnknownDex.includes(a.id)) x.voidUnknownDex.push(a.id);
      if (area === "infinite_void" && !x.infiniteVoidDex.includes(a.id)) x.infiniteVoidDex.push(a.id);
      // Auto-sell skips zoo storage entirely.
      if (!autoSoldFlags[idx]) {
        x.zoo[a.id] = (x.zoo[a.id] ?? 0) + 1;
      }
      if (a.rarity === "legendary") x.pity = 0;
      else x.pity = (x.pity ?? 0) + (isManual ? 2 : 1);
      if (a.id === "arcues" && !x.arcuesUnlocked) { x.arcuesUnlocked = true; arcuesJustUnlocked = true; }
      // Persist mutation if one rolled this hunt (only if kept in zoo)
      const mid = caughtMutations[idx]?.mutation;
      if (!autoSoldFlags[idx] && mid && !x.mutations[a.id]) {
        x.mutations[a.id] = { mutationId: mid, appliedAt: Date.now() };
      }
    }
  });
  for (const a of caught) onHuntCaught(message.author.id, a.id);

  // ETERNAL ELEMENTS — Nature drop. isManual already computed above (0% on autohunt).
  const droppedElement = tryDropElement(message.author.id, "eternal_nature", isManual);

  // Apply auto-sell credits AFTER the main updateUser block so each call uses
  // the freshly-updated user state (multipliers + lifetimeCowoncy track).
  let autoSellTotal = 0;
  for (let idx = 0; idx < caught.length; idx++) {
    if (autoSoldFlags[idx]) autoSellTotal += autoSellOne(message.author.id, caught[idx].id);
  }

  // ─── VOID ASCENSION (v6) — sentient pets get mood + loyalty + find bonus ─
  const finds = onHuntForTeam(message.author.id, u.team);

  // After updating dex, check if a new area is now unlocked.
  const { newlyUnlocked } = refreshAreaUnlocks(message.author.id);

  const ev = activeEvent();
  const areaTag = `[${AREA_BY_ID[area].emoji} ${AREA_BY_ID[area].name}]`;

  // ─── Build extras footer-line (events, milestones, finds, unlocks) ──────
  const notes: string[] = [];
  if (ev) notes.push(`${ev.emoji} *${ev.name} active*`);
  if (cashGained > 0)     notes.push(`${emoji("cash")} **+${cashGained}** Lowo Cash *(50-hunt milestone!)*`);
  if (aboveOmniBonus > 0) notes.push(`${emoji("cash")} **+${aboveOmniBonus}** Lowo Cash *(above-omni bonus!)*`);
  if (autoSellTotal > 0)  notes.push(`${emoji("sell")} Auto-sold for **${autoSellTotal.toLocaleString()}** ${emoji("cowoncy")} cowoncy`);
  if (arcuesJustUnlocked) notes.push(`${emoji("rocket")} **ARCUES UNLOCKED!** Permanent +5% Luck & +10% Essence`);
  if (newlyUnlocked.length) notes.push(`${emoji("flag")} **AREA UNLOCKED:** ${newlyUnlocked.map((id) => `${AREA_BY_ID[id].emoji} **${AREA_BY_ID[id].name}**`).join(", ")}`);
  for (const f of finds) notes.push(`💖 ${f.petEmoji} **${f.petName}** found a hidden ${f.emoji} **${f.name}**!`);
  if (droppedElement) notes.push(`🌿 ⚡ **ABSOLUTE DROP** — **Eternal Element of Nature** unearthed! Check \`lowo elements\`.`);

  // Single catch → compact text (anti-embed protocol v6.3).
  if (caught.length === 1) {
    const a = caught[0];
    const mTag = caughtMutations[0]?.mutation ? ` ${mutationLabel(caughtMutations[0]!.mutation!)}` : "";
    const flags: string[] = [];
    if (pityTriggered)     flags.push("🎯 **PITY!**");
    if (autoSoldFlags[0])  flags.push("💸 *auto-sold*");
    const flagStr = flags.length ? `  ${flags.join("  ")}` : "";
    const ultraBanner = (isManual && ULTRA_RARE_RARITIES.has(a.rarity))
      ? "🌌 **[ULTRA RARE CATCH]** 🌌\n" : "";
    const line1 = `${ultraBanner}🏹 ${areaTag} **${message.author.username}** caught **${a.emoji} ${a.name}** \`[ ${a.rarity.toUpperCase()} ]\`${mTag}${flagStr}`;
    const line2 = `❤️ \`${a.hp}\` ⚔️ \`${a.atk}\` 🛡️ \`${a.def}\` 🔮 \`${a.mag}\` • 💰 \`${a.sellPrice.toLocaleString()}\` cwn • ✨ \`${a.essence}\` ess`;
    const parts = [line1, line2];
    if (notes.length) parts.push(notes.join("\n"));
    parts.push("*→ \`lowo zoo\` to view your collection*");
    await message.reply({ content: parts.join("\n"), allowedMentions: { repliedUser: false, parse: [] } });
    if (droppedElement) await broadcastElementDrop(message, droppedElement);
    return;
  }

  // Multi catch → compact text list.
  if (pityTriggered) notes.unshift(`${emoji("pity")} **PITY!** Guaranteed legendary!`);
  const hasUltraInMulti = isManual && caught.some((a) => ULTRA_RARE_RARITIES.has(a.rarity));
  const multiHeader = hasUltraInMulti
    ? `🌌 **[ULTRA RARE CATCH]** 🌌\n✨ **MULTI CATCH ×${caught.length}** ${areaTag}`
    : `✨ **MULTI CATCH ×${caught.length}** ${areaTag}`;
  const catchLines: string[] = [multiHeader];
  for (let i = 0; i < caught.length; i++) {
    const a = caught[i];
    const m = caughtMutations[i]?.mutation;
    const mTag = m ? ` ${mutationLabel(m)}` : "";
    const sold = autoSoldFlags[i] ? " 💸" : "";
    catchLines.push(`**${i + 1}.** ${a.emoji} **${a.name}** \`[ ${a.rarity.toUpperCase()} ]\`${mTag}${sold} • ❤️ \`${a.hp}\` ⚔️ \`${a.atk}\` 🛡️ \`${a.def}\``);
  }
  if (notes.length) catchLines.push(notes.join("\n"));
  await message.reply({ content: catchLines.join("\n"), allowedMentions: { repliedUser: false, parse: [] } });
  if (droppedElement) await broadcastElementDrop(message, droppedElement);
}

// ─── ZOO — paginated to avoid the 6 000-char embed wall (v6.2) ─────────────
const ZOO_PAGE_SIZE = 10;

interface ZooEntry { animal: Animal; count: number }
function buildZooEntries(targetId: string): ZooEntry[] {
  const u = getUser(targetId);
  return Object.entries(u.zoo)
    .filter(([, c]) => c > 0)
    .map(([id, count]) => ({ animal: ANIMAL_BY_ID[id], count }))
    .filter((x) => x.animal)
    .sort((a, b) => {
      const ra = RARITY_ORDER.indexOf(a.animal.rarity);
      const rb = RARITY_ORDER.indexOf(b.animal.rarity);
      if (ra !== rb) return ra - rb; // rarest first
      return a.animal.name.localeCompare(b.animal.name);
    });
}

/**
 * Build a single page of the Zoo. Pure function — takes plain `User` objects
 * so it can be safely called from both message commands and button handlers
 * without needing a `Message` instance.
 *
 * Used by `cmdZoo` and by the `lowo:zoo:` button branch in `src/index.ts`.
 */
export function buildZooPage(
  viewer: User,
  target: User,
  page: number,
): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[]; totalPages: number } {
  const entries = buildZooEntries(target.id);
  const totalPages = Math.max(1, Math.ceil(entries.length / ZOO_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(totalPages - 1, page));
  const start = safePage * ZOO_PAGE_SIZE;
  const slice = entries.slice(start, start + ZOO_PAGE_SIZE);

  const totalAnimals = entries.reduce((a, e) => a + e.count, 0);
  const bestRarity: Rarity = entries.length ? entries[0].animal.rarity : "common";

  const targetUser = getUser(target.id);
  const lines = slice.map((e, i) => {
    const a = e.animal;
    const idx = start + i + 1;
    const cTag = corruptedTag(targetUser, a.id); // 👾 / ⚫ / ""
    return `**${idx}.** ${RARITY_COLOR[a.rarity]} ${a.emoji} **${a.name}**${cTag} ×${e.count.toLocaleString()}  \`[ ${a.rarity.toUpperCase()} ]\``;
  });

  const desc = [
    `🐾 **${val(totalAnimals)}** total animals • **${val(entries.length)}** unique species`,
    "─────────────────────",
    lines.length ? lines.join("\n") : "*This page is empty.*",
  ].join("\n");

  const embed = baseEmbedFor(viewer, rarityColor(bestRarity))
    .setAuthor({ name: `${target.username}'s Zoo`, iconURL: target.displayAvatarURL({ size: 128 }) })
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .setTitle(`${emoji("zoo")} Zoo Collection`)
    .setDescription(desc);

  const components = entries.length > ZOO_PAGE_SIZE
    ? [pagerButtons(ZOO_BUTTON_PREFIX, safePage, totalPages, target.id, viewer.id)]
    : [];
  return { embed, components, totalPages };
}

export async function cmdZoo(message: Message): Promise<void> {
  const target = message.mentions.users.first() ?? message.author;
  const u = getUser(target.id);
  const hasAny = Object.values(u.zoo).some((c) => c > 0);
  if (!hasAny) {
    await replyEmbed(message, warnEmbed(message, `${target.username}'s Zoo is empty`, "Try `lowo hunt`!"));
    return;
  }
  const { embed, components } = buildZooPage(message.author, target, 0);
  await replyEmbed(message, embed, components);
}

export async function cmdSell(message: Message, args: string[]): Promise<void> {
  const u = getUser(message.author.id);
  const peek = parseAnimalAndCount(args, null);
  const owned = peek.id ? (u.zoo[peek.id] ?? 0) : 0;
  const { id, count: rawCount, name } = parseAnimalAndCount(args, owned);
  if (!id) {
    await replyEmbed(message, errorEmbed(message, "Usage", `\`lowo sell <name> [count|all]\` — e.g. \`lowo sell Lowo King\`. *(Got: \`${name || "(empty)"}\`)*`));
    return;
  }
  const a = ANIMAL_BY_ID[id];
  if (owned <= 0) { await replyEmbed(message, errorEmbed(message, "Don't Own", `You don't own any ${a.emoji} ${a.name}.`)); return; }
  const count = Math.max(1, Math.min(owned, rawCount));
  const sellMult = sellMultiplier(message.author.id, a.id);
  const cowoncyMult = eventBonus("cowoncy");
  // VOID CORRUPTIONS — Null Charm relic: +15% sell price.
  const relicMult = hasRelic(message.author.id, "null_charm") ? 1.15 : 1;
  const total = Math.floor(count * a.sellPrice * sellMult * cowoncyMult * relicMult);
  updateUser(message.author.id, (x) => { x.zoo[a.id] -= count; x.cowoncy += total; });
  const tags: string[] = [];
  if (sellMult > 1)     tags.push("Lv 3 perk +25%");
  if (cowoncyMult > 1)  tags.push(`${emoji("cowoncy")} Cowoncy Event ×2`);
  if (relicMult > 1)    tags.push("🌑 Null Charm +15%");
  const e = successEmbed(message, "Sold!", `Sold ${count}× ${a.emoji} **${a.name}**`)
    .setColor(rarityColor(a.rarity))
    .addFields(
      { name: "🪙 Earned",      value: val(total),                   inline: true },
      { name: "📦 Remaining",   value: val(owned - count),           inline: true },
      ...(tags.length ? [{ name: "✨ Bonuses", value: tags.join(" • "), inline: true }] : []),
    );
  await replyEmbed(message, e);
}

export async function cmdSacrifice(message: Message, args: string[]): Promise<void> {
  const u = getUser(message.author.id);
  const peek = parseAnimalAndCount(args, null);
  const owned = peek.id ? (u.zoo[peek.id] ?? 0) : 0;
  const { id, count: rawCount, name } = parseAnimalAndCount(args, owned);
  if (!id) {
    await replyEmbed(message, errorEmbed(message, "Usage", `\`lowo sacrifice <name> [count|all]\` — e.g. \`lowo sac Lowo King\`. *(Got: \`${name || "(empty)"}\`)*`));
    return;
  }
  const a = ANIMAL_BY_ID[id];
  if (owned <= 0) { await replyEmbed(message, errorEmbed(message, "Don't Own", `You don't own any ${a.emoji} ${a.name}.`)); return; }
  const count = Math.max(1, Math.min(owned, rawCount));
  const evMult = eventBonus("essence");
  const perkMult = essenceMultiplier(message.author.id, a.id);
  const arcuesMult = essenceArcuesMultiplier(u.arcuesUnlocked);
  const areaMult = sacrificeAreaMultiplier(u.huntArea);
  // VOID CORRUPTIONS — Glitch Token relic: +25% sacrifice essence.
  const relicMult = hasRelic(message.author.id, "glitch_token") ? 1.25 : 1;
  const total = Math.floor(count * a.essence * evMult * perkMult * arcuesMult * areaMult * relicMult);
  updateUser(message.author.id, (x) => { x.zoo[a.id] -= count; x.essence += total; });
  const tags: string[] = [];
  if (evMult > 1)      tags.push(`${emoji("essence")} Essence Storm ×2`);
  if (perkMult > 1)    tags.push("Lv 10 perk ×2");
  if (arcuesMult > 1)  tags.push(`${emoji("rocket")} Arcues +10%`);
  if (areaMult < 1)    tags.push("☁️ Heaven −20% *(holy place)*");
  if (relicMult > 1)   tags.push("🪙 Glitch Token +25%");
  const e = successEmbed(message, "Sacrificed!", `${count}× ${a.emoji} **${a.name}** → essence`)
    .setColor(rarityColor(a.rarity))
    .addFields(
      { name: "✨ Essence",    value: val(total),         inline: true },
      { name: "📦 Remaining",  value: val(owned - count), inline: true },
      ...(tags.length ? [{ name: "Bonuses", value: tags.join(" • "), inline: true }] : []),
    );
  await replyEmbed(message, e);
}

/**
 * `lowo dex` — full lowodex.
 * `lowo dex <area name | stage 1-5>` — HOTFIX: filter to a specific area's
 * animals (1=Forest, 2=Volcanic, 3=Space, 4=Heaven, 5=Unknown Void).
 * Output is auto-chunked into multiple replies so nothing ever truncates.
 */
export async function cmdLowodex(message: Message, args: string[]): Promise<void> {
  const target = message.mentions.users.first() ?? message.author;
  const u = getUser(target.id);

  // Strip a leading user mention from args so `lowo dex @user 2` still parses.
  const filterArg = args.find((a) => !/^<@!?\d+>$/.test(a));

  // If no area given, show a stage picker instead of flooding with all animals.
  if (!filterArg) {
    const STAGE_LINES = [
      "🗺️ **Which stage's dex do you want to view?**",
      "Reply with: `lowo dex <stage>`",
      "",
      "`lowo dex 1` — 🌲 **Forest** (default area)",
      "`lowo dex 2` — 🌋 **Volcanic**",
      "`lowo dex 3` — 🌌 **Space**",
      "`lowo dex 4` — ☁️ **Heaven**",
      "`lowo dex 5` — 🕳️ **Unknown Void**",
      "",
      "_You can also type the area name, e.g. `lowo dex volcanic` or `lowo dex heaven`._",
    ];
    await message.reply(STAGE_LINES.join("\n"));
    return;
  }

  const areaInfo = resolveAreaArg(filterArg);
  if (!areaInfo) {
    await message.reply([
      `${emoji("fail")} Unknown area \`${filterArg}\`.`,
      `Try: \`1\` Forest, \`2\` Volcanic, \`3\` Space, \`4\` Heaven, \`5\` Unknown Void.`,
      `Example: \`lowo dex 4\` or \`lowo dex heaven\`.`,
    ].join("\n"));
    return;
  }

  const pool: Animal[] = areaInfo.pool;
  const ownedInPool = pool.filter((a) => u.dex.includes(a.id)).length;
  const pct = pool.length === 0 ? 0 : Math.round((ownedInPool / pool.length) * 100);
  const header = areaInfo
    ? `${emoji("dex")} **${target.username}'s Lowodex — ${areaInfo.label}** — ${ownedInPool}/${pool.length} (${pct}%)`
    : `${emoji("dex")} **${target.username}'s Lowodex** — ${ownedInPool}/${pool.length} (${pct}%)`;

  // Group by rarity (rarest first) for readability.
  const grouped: Partial<Record<Rarity, string[]>> = {};
  for (const a of pool) {
    const got = u.dex.includes(a.id);
    const tags: string[] = [];
    if (a.aquatic)   tags.push(emoji("fishCaught"));
    if (a.eventOnly) tags.push(emoji("event"));
    const line = `${got ? emoji("dexFound") : emoji("dexMissing")} ${a.emoji} ${a.name} \`${a.id}\` ${RARITY_COLOR[a.rarity]}${tags.length ? ` ${tags.join("")}` : ""}`;
    (grouped[a.rarity] ??= []).push(line);
  }
  const allLines: string[] = [header];
  for (const r of RARITY_ORDER) {
    const arr = grouped[r];
    if (!arr || arr.length === 0) continue;
    allLines.push(`\n${RARITY_COLOR[r]} **${r.toUpperCase()}** *(${arr.length})*`);
    allLines.push(...arr);
  }

  // Chunk into <=1900-char messages so nothing is ever silently truncated.
  const chunks: string[] = [];
  let buf = "";
  for (const line of allLines) {
    if (buf.length + line.length + 1 > 1900) { chunks.push(buf); buf = ""; }
    buf += (buf ? "\n" : "") + line;
  }
  if (buf) chunks.push(buf);
  await message.reply(chunks[0]);
  const ch = message.channel;
  if ("send" in ch) {
    for (let i = 1; i < chunks.length; i++) await ch.send(chunks[i]).catch(() => {});
  }
}
