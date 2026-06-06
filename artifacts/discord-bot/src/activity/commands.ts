import {
  EmbedBuilder,
  Message,
  PermissionFlagsBits,
  GuildMember,
  TextChannel,
} from "discord.js";
import { getAllActivityRows, getInactiveUserIds } from "./db.js";

const COLOR_PRIMARY = 0x2f3136;
const COLOR_ACCENT = 0x00ffff;
const INACTIVE_DAYS = 14;

function isAdmin(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

function daysSince(date: Date | null): number {
  if (!date) return Infinity;
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

export async function handleActivityCheck(message: Message): Promise<void> {
  if (!message.guild || !message.member || !isAdmin(message.member)) return;
  await (message.channel as TextChannel).sendTyping();

  const rows = await getAllActivityRows();
  const guildMembers = await message.guild.members.fetch();

  const active: string[] = [];
  const inactive: string[] = [];

  for (const [id, member] of guildMembers) {
    if (member.user.bot) continue;
    const row = rows.find((r) => r.user_id === id);
    if (!row) {
      inactive.push(`<@${id}> (no data)`);
      continue;
    }
    const lastSeen = row.last_message ?? row.last_voice ?? null;
    if (daysSince(lastSeen) <= INACTIVE_DAYS) {
      const d = lastSeen ? `${Math.floor(daysSince(lastSeen))}d ago` : "unknown";
      active.push(`<@${id}> — last seen ${d}, ${row.total_messages} msgs`);
    } else {
      const d = lastSeen ? `${Math.floor(daysSince(lastSeen))}d ago` : "never";
      inactive.push(`<@${id}> — last seen ${d}`);
    }
  }

  const chunks = (arr: string[], size = 15) => {
    const out: string[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const activeChunks = chunks(active);
  const inactiveChunks = chunks(inactive);
  const totalPages = Math.max(activeChunks.length, inactiveChunks.length, 1);

  const embed = new EmbedBuilder()
    .setColor(COLOR_ACCENT)
    .setTitle("📊 Roster Activity Report")
    .setDescription(
      `**${active.length}** locked in, **${inactive.length}** ghosts — last ${INACTIVE_DAYS} days.`,
    )
    .setFooter({ text: `Last Stand • Page 1 of ${totalPages}` });

  if (activeChunks.length > 0)
    embed.addFields({ name: "✅ Active", value: activeChunks[0].join("\n") || "None", inline: false });
  if (inactiveChunks.length > 0)
    embed.addFields({ name: "💤 Inactive", value: inactiveChunks[0].join("\n") || "None", inline: false });

  await message.reply({ embeds: [embed] });

  for (let i = 1; i < totalPages; i++) {
    const pageEmbed = new EmbedBuilder()
      .setColor(COLOR_PRIMARY)
      .setFooter({ text: `Last Stand • Page ${i + 1} of ${totalPages}` });
    if (activeChunks[i])
      pageEmbed.addFields({ name: "✅ Active (cont.)", value: activeChunks[i].join("\n"), inline: false });
    if (inactiveChunks[i])
      pageEmbed.addFields({ name: "💤 Inactive (cont.)", value: inactiveChunks[i].join("\n"), inline: false });
    await (message.channel as TextChannel).send({ embeds: [pageEmbed] });
  }
}

export async function handleKickInactive(message: Message): Promise<void> {
  if (!message.guild || !message.member || !isAdmin(message.member)) return;
  await (message.channel as TextChannel).sendTyping();

  const inactiveIds = await getInactiveUserIds(INACTIVE_DAYS);
  if (inactiveIds.length === 0) {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR_ACCENT)
          .setDescription("Roster's clean. No inactive players to sweep."),
      ],
    });
    return;
  }

  let swept = 0;
  let failed = 0;
  const members = await message.guild.members.fetch();

  for (const uid of inactiveIds) {
    const m = members.get(uid);
    if (!m || m.user.bot) continue;
    try {
      await m.kick("Swept for inactivity (14+ days offline)");
      swept++;
    } catch {
      failed++;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(swept > 0 ? COLOR_ACCENT : COLOR_PRIMARY)
    .setTitle("🧹 Roster Sweep Complete")
    .setDescription(
      `Swept **${swept}** inactive players from the roster.` +
        (failed > 0 ? ` Couldn't reach **${failed}** (likely already gone).` : ""),
    )
    .setFooter({ text: "Last Stand Management" });

  await message.reply({ embeds: [embed] });
}

export async function handleUnverifyInactive(message: Message): Promise<void> {
  if (!message.guild || !message.member || !isAdmin(message.member)) return;
  await (message.channel as TextChannel).sendTyping();

  const unverifiedRole = message.guild.roles.cache.find(
    (r) => r.name.toLowerCase() === "unverified",
  );
  if (!unverifiedRole) {
    await message.reply({
      content: '❌ No role named "unverified" found in this server.',
    });
    return;
  }

  const inactiveIds = await getInactiveUserIds(INACTIVE_DAYS);
  if (inactiveIds.length === 0) {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR_ACCENT)
          .setDescription("No inactive players found. Everyone's showing up."),
      ],
    });
    return;
  }

  const members = await message.guild.members.fetch();
  let processed = 0;
  let failed = 0;

  for (const uid of inactiveIds) {
    const m = members.get(uid);
    if (!m || m.user.bot) continue;
    try {
      const roleIds = m.roles.cache
        .filter((r) => r.id !== message.guild!.id)
        .map((r) => r.id);
      await m.roles.remove(roleIds, "Unverified — inactive 14+ days");
      await m.roles.add(unverifiedRole, "Reset to unverified");
      processed++;
    } catch {
      failed++;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(COLOR_ACCENT)
    .setTitle("🔒 Unverify Sweep Done")
    .setDescription(
      `Reset **${processed}** inactive members back to unverified.` +
        (failed > 0 ? ` **${failed}** couldn't be touched (likely higher role).` : ""),
    )
    .setFooter({ text: "Last Stand Management" });

  await message.reply({ embeds: [embed] });
}
