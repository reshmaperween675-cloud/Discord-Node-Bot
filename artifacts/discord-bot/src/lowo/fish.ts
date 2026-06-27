import type { Message } from "discord.js";
import { getUser, updateUser } from "./storage.js";
import { rollFish, RARITY_COLOR, luckMultiplier } from "./data.js";
import { onHuntCaught } from "./skills.js";
import { isAutohuntActive } from "./extra.js";
import { eventBonus } from "./events.js";
import { tryDropElement, broadcastElementDrop } from "./elements.js";

const FISH_COOLDOWN_MS = 15_000;

export async function cmdFish(message: Message): Promise<void> {
  const u = getUser(message.author.id);
  const now = Date.now();
  if (u.fishingRod <= 0) {
    await message.reply("🎣 You need a **Fishing Rod**. Buy one with `lowo buy rod`.");
    return;
  }
  if (now - u.lastFish < FISH_COOLDOWN_MS) {
    const left = Math.ceil((FISH_COOLDOWN_MS - (now - u.lastFish)) / 1000);
    await message.reply(`⏳ The water needs to settle. Fish again in **${left}s**.`);
    return;
  }
  let luck = luckMultiplier(u.arcuesUnlocked, u.luckUntil, u.megaLuckUntil, isAutohuntActive(message.author.id));
  const lucky = eventBonus("luck"); if (lucky > 1) luck *= lucky;

  const a = rollFish(luck);
  updateUser(message.author.id, (x) => {
    x.lastFish = now;
    // Fish now go to the aquarium + fishDex (no longer mixed into zoo/dex).
    x.aquarium[a.id] = (x.aquarium[a.id] ?? 0) + 1;
    if (!x.fishDex.includes(a.id)) x.fishDex.push(a.id);
  });
  onHuntCaught(message.author.id, a.id);
  // ETERNAL ELEMENTS — Ocean drop. Fish is always manual (autohunt never fishes).
  const dropped = tryDropElement(message.author.id, "eternal_ocean", true);
  let replyText = `🎣 **${message.author.username}** cast a line and reeled in a ${RARITY_COLOR[a.rarity]} **${a.name}** ${a.emoji} *(${a.rarity})* — *swimming in your* \`lowo aquarium\`.`;
  if (dropped) replyText += `\n🌊 ⚡ **ABSOLUTE DROP** — **Eternal Element of Ocean** surfaced! Check \`lowo elements\`.`;
  await message.reply(replyText);
  if (dropped) await broadcastElementDrop(message, dropped);
}
