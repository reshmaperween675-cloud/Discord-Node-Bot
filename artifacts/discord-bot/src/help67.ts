import { EmbedBuilder, Message } from "discord.js";
import { requireLowoOwnerMessage } from "./utility/lowoOwner.js";

const COLOR_PRIMARY = 0x2f3136;
const COLOR_ACCENT = 0x00ffff;

export async function handleHelp67(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!requireLowoOwnerMessage(message)) return;

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
      {
        name: "📨 Direct Messages",
        value: [
          "`?dm all <message>` — DM every member in the server.",
          "`?dm @user <message>` — DM a specific member privately.",
        ].join("\n"),
      },
      {
        name: "🔧 Role Permissions — All Channels & Categories",
        value: [
          "`?roleallcandc <@role> <perm:value> [perm:value ...]` — Apply permission overwrites to every channel and category.",
          "`?roleallcandc <@role> remove` — Remove that role's overwrites from every channel and category.",
          "",
          "**Perm keys**: `ViewChannel` · `SendMessages` · `ReadMessageHistory` · `AddReactions` · `AttachFiles` · `EmbedLinks` · `MentionEveryone` · `ManageMessages` · `Connect` · `Speak` · `Stream` · `UseVAD` · `MuteMembers` · `DeafenMembers` · `MoveMembers`",
          "**Values**: `true` (allow) · `false` (deny) · `null` (inherit)",
          "",
          "**Example**: `?roleallcandc @Members ViewChannel:true SendMessages:false`",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Last Stand Management • Admin Tools" })
    .setColor(COLOR_PRIMARY);

  await message.reply({ embeds: [embed] });
}
