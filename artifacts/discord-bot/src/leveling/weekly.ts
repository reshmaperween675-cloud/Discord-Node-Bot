import { Client, EmbedBuilder, TextChannel } from "discord.js";
import {
  getAllUsers,
  resetWeeklyXp,
  getLastWeeklyReset,
  setLastWeeklyReset,
  recordWeeklyHistory,
  getGuildConfig,
} from "./db.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Weekly Reset Logic ───────────────────────────────────────────────────────

export async function runWeeklyReset(client: Client): Promise<void> {
  const now = Date.now();
  const last = await getLastWeeklyReset();
  if (now - last < SEVEN_DAYS_MS) return;

  console.log("[WEEKLY] Running weekly XP reset...");
  await setLastWeeklyReset(now);

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const all = (await getAllUsers(guildId))
        .filter((u) => u.weeklyXp > 0)
        .sort((a, b) => b.weeklyXp - a.weeklyXp);

      const winners = all.slice(0, 3).map((u) => ({
        userId: u.userId,
        weeklyXp: u.weeklyXp,
      }));

      const weekLabel = new Date(last).toISOString().split("T")[0];
      await recordWeeklyHistory({ week: weekLabel, guildId, winners });

      const config = await getGuildConfig(guildId);
      if (config.announcements && winners.length > 0) {
        const medals = ["🥇", "🥈", "🥉"];
        const lines = await Promise.all(
          winners.map(async (w, idx) => {
            let name = `<@${w.userId}>`;
            try {
              const member = await guild.members.fetch(w.userId).catch(() => null);
              if (member) name = member.displayName;
            } catch { /* ignore */ }
            return `${medals[idx]}  **${name}**  ·  ${w.weeklyXp.toLocaleString()} XP`;
          })
        );

        const embed = new EmbedBuilder()
          .setColor(0xfaa61a)
          .setTitle("◈  WEEKLY WINNERS")
          .setDescription(
            `The week has ended. Here are this week's top members!\n\n${lines.join("\n")}`
          )
          .setFooter({ text: `Week of ${weekLabel}  ·  Last Stand Management` })
          .setTimestamp();

        let channel: TextChannel | null = null;
        if (config.levelUpChannelId) {
          try {
            channel = (await guild.channels.fetch(config.levelUpChannelId)) as TextChannel | null;
          } catch { /* ignore */ }
        }
        if (!channel) {
          channel =
            (guild.channels.cache.find(
              (c) =>
                c.isTextBased() &&
                (c.name.includes("general") ||
                  c.name.includes("level") ||
                  c.name.includes("chat") ||
                  c.name.includes("announcement"))
            ) as TextChannel | undefined) ?? null;
        }

        if (channel) {
          await channel.send({ embeds: [embed] }).catch((err) =>
            console.error("[WEEKLY] Failed to post winners:", err)
          );
        }
      }

      await resetWeeklyXp(guildId);
      console.log(`[WEEKLY] Reset weekly XP for guild ${guildId}`);
    } catch (err) {
      console.error(`[WEEKLY] Error processing guild ${guildId}:`, err);
    }
  }
}

// ─── Scheduler — checks every hour ───────────────────────────────────────────

export function startWeeklyResetScheduler(client: Client): void {
  const ONE_HOUR = 60 * 60 * 1000;

  const tick = () => {
    runWeeklyReset(client).catch((err) =>
      console.error("[WEEKLY] Scheduler error:", err)
    );
  };

  tick();
  setInterval(tick, ONE_HOUR);
  console.log("[WEEKLY] Weekly reset scheduler started.");
}
