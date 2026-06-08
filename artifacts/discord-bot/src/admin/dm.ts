import { EmbedBuilder, Message, PermissionFlagsBits } from "discord.js";

const COLOR_PRIMARY = 0x2f3136;
const COLOR_ACCENT = 0x00ffff;
const COLOR_ERROR = 0xff4444;

export async function handleDmCommand(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;

  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply({ content: "❌ You don't have permission to use this." });
    return;
  }

  const args = message.content.trim().split(/\s+/);
  // args[0] = "?dm", args[1] = "all" | mention, rest = message text

  if (args.length < 3) {
    await message.reply({
      content:
        "❌ Usage:\n" +
        "`?dm all <message>` — DM every member in the server\n" +
        "`?dm @user <message>` — DM a specific member",
    });
    return;
  }

  const subcommand = args[1].toLowerCase();

  // ── ?dm all <text> ────────────────────────────────────────────────────────
  if (subcommand === "all") {
    const text = args.slice(2).join(" ").trim();
    if (!text) {
      await message.reply({ content: "❌ Please provide a message to send." });
      return;
    }

    const statusMsg = await message.reply({ content: "📨 Fetching members and sending DMs…" });

    let members;
    try {
      members = await message.guild.members.fetch();
    } catch {
      await statusMsg.edit({ content: "❌ Failed to fetch member list." });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(COLOR_ACCENT)
      .setTitle(`📢 Message from ${message.guild.name}`)
      .setDescription(text)
      .setFooter({ text: `Sent by ${message.member.displayName}` })
      .setTimestamp();

    let sent = 0;
    let failed = 0;

    for (const [, member] of members) {
      if (member.user.bot) continue;
      try {
        await member.send({ embeds: [embed] });
        sent++;
      } catch {
        failed++;
      }
    }

    const resultEmbed = new EmbedBuilder()
      .setColor(COLOR_PRIMARY)
      .setTitle("📨 Mass DM Complete")
      .addFields(
        { name: "✅ Delivered", value: String(sent), inline: true },
        { name: "❌ Failed", value: String(failed), inline: true },
      )
      .setFooter({ text: "Members with DMs disabled are counted as failed." });

    await statusMsg.edit({ content: "", embeds: [resultEmbed] });
    return;
  }

  // ── ?dm @user <text> ─────────────────────────────────────────────────────
  const mentionedUser = message.mentions.users.first();
  if (!mentionedUser) {
    await message.reply({
      content:
        "❌ Usage:\n" +
        "`?dm all <message>` — DM every member in the server\n" +
        "`?dm @user <message>` — DM a specific member",
    });
    return;
  }

  // Text starts after the mention — find where the mention ends in the raw content
  const mentionPattern = /^<@!?\d+>\s*/;
  const afterCommand = message.content.trim().replace(/^\S+\s+/, ""); // remove "?dm"
  const text = afterCommand.replace(mentionPattern, "").trim();

  if (!text) {
    await message.reply({ content: "❌ Please provide a message to send." });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(COLOR_ACCENT)
    .setTitle(`📢 Message from ${message.guild.name}`)
    .setDescription(text)
    .setFooter({ text: `Sent by ${message.member.displayName}` })
    .setTimestamp();

  try {
    await mentionedUser.send({ embeds: [embed] });
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR_PRIMARY)
          .setDescription(`✅ DM sent to **${mentionedUser.username}**.`),
      ],
    });
  } catch {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR_ERROR)
          .setDescription(`❌ Could not DM **${mentionedUser.username}** — they may have DMs disabled.`),
      ],
    });
  }
}
