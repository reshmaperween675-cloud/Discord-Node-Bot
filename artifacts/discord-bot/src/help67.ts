import { EmbedBuilder, Message, PermissionFlagsBits } from "discord.js";

const COLOR_PRIMARY = 0x2f3136;
const COLOR_ACCENT = 0x00ffff;

export async function handleHelp67(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply({ content: "You don't have permission to use this." });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(COLOR_ACCENT)
    .setTitle("LS Admin Command Directory")
    .setDescription(
      "Advanced admin tools for the Last Stand roster. These run on the `?` prefix — no slash command slots used.",
    )
    .addFields(
      {
        name: "📊 Activity Management",
        value: [
          "`?activitycheck` — Pull the full active/inactive breakdown of the roster.",
          "`?kickinactive` — Sweep all ghost members who haven't shown up in 14 days.",
          "`?unverifyinactive` — Strip inactive members back to unverified status.",
        ].join("\n"),
      },
      {
        name: "🔐 Verification & Backup",
        value: [
          "`?setupverification` — Deploy the OAuth2 verification panel in this channel.",
          "`?addauthplayers` — **Disaster recovery.** Force-pull all backed-up members back into the server.",
          "`?backupstats` — Check how many players we can recover if the server goes down.",
        ].join("\n"),
      },
      {
        name: "🚨 Emergency Tools",
        value: [
          "`?emergency_lockdown` — Lock every channel instantly. Stops raids cold.",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Last Stand Management • Admin Tools" })
    .setColor(COLOR_PRIMARY);

  await message.reply({ embeds: [embed] });
}
