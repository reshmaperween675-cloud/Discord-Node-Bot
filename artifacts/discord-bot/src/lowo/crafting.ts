import type { Message } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { getUser, updateUser } from "./storage.js";
import { CRAFT_RECIPES, CRAFT_RECIPE_BY_ID, MINERAL_BY_ID } from "./data.js";
import { emoji } from "./emojis.js";
import { eventBonus } from "./events.js";

const ETERNAL_EARTH_COST = {
  cowoncy: 2_500_000_000,
  essence: 100_000,
  lowoCash: 50_000,
};

async function cmdCraftEternalEarth(message: Message): Promise<void> {
  const u = getUser(message.author.id);
  const els = u.elements ?? {};
  const missing: string[] = [];
  if ((els.eternal_nature     ?? 0) < 1) missing.push("🌿 **Eternal Element of Nature** (0/1)");
  if ((els.eternal_underworld ?? 0) < 1) missing.push("💀 **Eternal Element of Underworld** (0/1)");
  if ((els.eternal_ocean      ?? 0) < 1) missing.push("🌊 **Eternal Element of Ocean** (0/1)");
  if (u.cowoncy  < ETERNAL_EARTH_COST.cowoncy)  missing.push(`💰 **Cowoncy** (${u.cowoncy.toLocaleString()} / ${ETERNAL_EARTH_COST.cowoncy.toLocaleString()})`);
  if (u.essence  < ETERNAL_EARTH_COST.essence)  missing.push(`✨ **Essence** (${u.essence.toLocaleString()} / ${ETERNAL_EARTH_COST.essence.toLocaleString()})`);
  if (u.lowoCash < ETERNAL_EARTH_COST.lowoCash) missing.push(`💎 **Lowo Cash** (${u.lowoCash} / ${ETERNAL_EARTH_COST.lowoCash.toLocaleString()})`);

  if (missing.length > 0) {
    const embed = new EmbedBuilder()
      .setColor(0xFF4444)
      .setTitle("⚡ Supreme Element Integration — Missing Requirements")
      .setDescription(
        `You cannot forge the **Eternal Element of Earth** yet.\n\n**Missing:**\n${missing.map((m) => `• ${m}`).join("\n")}`,
      )
      .setFooter({ text: "Eternal Elements — Endgame Crafting" });
    await message.reply({ embeds: [embed] });
    return;
  }

  updateUser(message.author.id, (x) => {
    x.elements!.eternal_nature     -= 1;
    x.elements!.eternal_underworld -= 1;
    x.elements!.eternal_ocean      -= 1;
    x.cowoncy  -= ETERNAL_EARTH_COST.cowoncy;
    x.essence  -= ETERNAL_EARTH_COST.essence;
    x.lowoCash -= ETERNAL_EARTH_COST.lowoCash;
    x.elements!.eternal_earth = (x.elements!.eternal_earth ?? 0) + 1;
  });

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle("⚡ Supreme Element Integration — FORGED")
    .setDescription(
      [
        `**${message.author.username}** has forged the **⚡ Eternal Element of Earth**.`,
        ``,
        `🌿 Eternal Element of Nature — consumed`,
        `💀 Eternal Element of Underworld — consumed`,
        `🌊 Eternal Element of Ocean — consumed`,
        `💰 2,500,000,000 Cowoncy — deducted`,
        `✨ 100,000 Essence — deducted`,
        `💎 50,000 Lowo Cash — deducted`,
        ``,
        `> 🔱 **The earth element pulses with absolute power.**`,
        `> Use \`lowo summon eternal_king\` to face what awaits *(costs 30,000 🪙 Battle Tokens)*.`,
      ].join("\n"),
    )
    .setThumbnail(message.author.displayAvatarURL({ size: 128 }))
    .setFooter({ text: "Eternal Elements — Endgame Crafting" })
    .setTimestamp();
  await message.reply({ embeds: [embed] });
}

export async function cmdCraft(message: Message, args: string[]): Promise<void> {
  const sub = args[0]?.toLowerCase();
  const u = getUser(message.author.id);

  // ETERNAL ELEMENTS — special supreme recipe not in the normal mineral recipe table
  if (sub === "eternal_earth") { await cmdCraftEternalEarth(message); return; }

  if (!sub || sub === "list") {
    const lines = [`${emoji("craft")} **Crafting Recipes** *(use \`lowo craft <recipeId>\` to forge)*`];
    for (const r of CRAFT_RECIPES) {
      const cost = Object.entries(r.cost)
        .map(([id, n]) => `${MINERAL_BY_ID[id]?.emoji ?? "🪨"}${n}×${MINERAL_BY_ID[id]?.name ?? id}`)
        .join(" + ");
      const can = canCraft(u, r.id) ? "✅" : "❌";
      lines.push(`${can} ${r.emoji} \`${r.id}\` — **${r.name}** *(${r.rarity})*`);
      lines.push(`  Mods: ATK+${r.modsBase.atk} DEF+${r.modsBase.def} MAG+${r.modsBase.mag}`);
      lines.push(`  Cost: ${cost} + ${r.cowoncyCost.toLocaleString()} cowoncy`);
    }
    await message.reply(lines.join("\n").slice(0, 1900));
    return;
  }

  const recipe = CRAFT_RECIPE_BY_ID[sub];
  if (!recipe) { await message.reply(`❌ Unknown recipe \`${sub}\`. Try \`lowo craft list\`.`); return; }
  if (!canCraft(u, recipe.id)) {
    const missing: string[] = [];
    for (const [mid, need] of Object.entries(recipe.cost)) {
      const have = u.minerals[mid] ?? 0;
      if (have < need) missing.push(`${MINERAL_BY_ID[mid]?.emoji ?? "🪨"} ${MINERAL_BY_ID[mid]?.name ?? mid} (${have}/${need})`);
    }
    if (u.cowoncy < recipe.cowoncyCost) missing.push(`💰 cowoncy (${u.cowoncy.toLocaleString()}/${recipe.cowoncyCost.toLocaleString()})`);
    await message.reply(`❌ You can't craft **${recipe.name}** yet. Missing: ${missing.join(", ")}`);
    return;
  }

  // Crafting Surge event yields an extra +1 weapon roll with random mods variance
  const surgeBonus = eventBonus("crafting_surge") > 1;

  const variance = () => 0.85 + Math.random() * 0.30;
  const finalMods = {
    atk: Math.floor(recipe.modsBase.atk * variance()),
    def: Math.floor(recipe.modsBase.def * variance()),
    mag: Math.floor(recipe.modsBase.mag * variance()),
  };

  const id = `${recipe.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

  updateUser(message.author.id, (x) => {
    for (const [mid, n] of Object.entries(recipe.cost)) {
      x.minerals[mid] = (x.minerals[mid] ?? 0) - n;
      if (x.minerals[mid] <= 0) delete x.minerals[mid];
    }
    x.cowoncy -= recipe.cowoncyCost;
    // Push as a regular weapon (so it's equippable) AND record it in craftedWeapons.
    x.weapons.push({ id, rarity: recipe.rarity, mods: finalMods });
    x.craftedWeapons.push({
      id, recipeId: recipe.id, name: recipe.name,
      rarity: recipe.rarity, mods: finalMods,
    });

    if (surgeBonus) {
      const id2 = `${recipe.id}_bonus_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 4)}`;
      const bonusMods = {
        atk: Math.floor(recipe.modsBase.atk * variance()),
        def: Math.floor(recipe.modsBase.def * variance()),
        mag: Math.floor(recipe.modsBase.mag * variance()),
      };
      x.weapons.push({ id: id2, rarity: recipe.rarity, mods: bonusMods });
      x.craftedWeapons.push({
        id: id2, recipeId: recipe.id, name: `${recipe.name} (Surge Bonus)`,
        rarity: recipe.rarity, mods: bonusMods,
      });
    }
  });

  const idx = (getUser(message.author.id).weapons.length - (surgeBonus ? 2 : 1));
  const tail = surgeBonus ? `\n🛠️ **Crafting Surge** active — bonus copy granted!` : "";
  await message.reply(
    `${emoji("craft")} **Crafted ${recipe.emoji} ${recipe.name}** *(${recipe.rarity})*\n` +
    `Mods: ATK+${finalMods.atk} DEF+${finalMods.def} MAG+${finalMods.mag}\n` +
    `_Equip via \`lowo equip <pet> weapon ${idx}\`._${tail}`,
  );
}

function canCraft(u: ReturnType<typeof getUser>, recipeId: string): boolean {
  const r = CRAFT_RECIPE_BY_ID[recipeId];
  if (!r) return false;
  if (u.cowoncy < r.cowoncyCost) return false;
  for (const [mid, need] of Object.entries(r.cost)) {
    if ((u.minerals[mid] ?? 0) < need) return false;
  }
  return true;
}
