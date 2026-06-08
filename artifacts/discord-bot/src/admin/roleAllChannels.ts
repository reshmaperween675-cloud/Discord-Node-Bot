import {
  Message,
  PermissionFlagsBits,
  OverwriteType,
  EmbedBuilder,
  GuildMember,
  type PermissionOverwriteOptions,
} from "discord.js";

const COLOR_ACCENT  = 0x00ffff;
const COLOR_PRIMARY = 0x2f3136;
const COLOR_WARN    = 0xffaa00;
const COLOR_ERROR   = 0xff4444;

// ── Permission key aliases (lowercase → discord.js PermissionOverwriteOptions key) ──
const PERM_ALIASES: Record<string, keyof PermissionOverwriteOptions> = {
  // View / access
  viewchannel:         "ViewChannel",
  view:                "ViewChannel",
  // Text
  sendmessages:        "SendMessages",
  send:                "SendMessages",
  sendthreadmessages:  "SendMessagesInThreads",
  readmessagehistory:  "ReadMessageHistory",
  history:             "ReadMessageHistory",
  addreactions:        "AddReactions",
  reactions:           "AddReactions",
  attachfiles:         "AttachFiles",
  attach:              "AttachFiles",
  embedlinks:          "EmbedLinks",
  embed:               "EmbedLinks",
  mentioneveryone:     "MentionEveryone",
  mention:             "MentionEveryone",
  managemessages:      "ManageMessages",
  managechannels:      "ManageChannels",
  managechannel:       "ManageChannels",
  useexternalemojis:   "UseExternalEmojis",
  externalemojis:      "UseExternalEmojis",
  createpublicthreads: "CreatePublicThreads",
  createprivatethreads:"CreatePrivateThreads",
  sendttsmessages:     "SendTTSMessages",
  tts:                 "SendTTSMessages",
  useslashcommands:    "UseApplicationCommands",
  slashcommands:       "UseApplicationCommands",
  useapplicationcommands: "UseApplicationCommands",
  // Voice
  connect:             "Connect",
  speak:               "Speak",
  stream:              "Stream",
  usevoiceactivity:    "UseVAD",
  vad:                 "UseVAD",
  mutemembers:         "MuteMembers",
  mute:                "MuteMembers",
  deafenmembers:       "DeafenMembers",
  deafen:              "DeafenMembers",
  movemembers:         "MoveMembers",
  move:                "MoveMembers",
  priorityspeaker:     "PrioritySpeaker",
  requesttospeak:      "RequestToSpeak",
};

function parseValue(v: string): boolean | null {
  const low = v.toLowerCase();
  if (low === "true"  || low === "allow" || low === "yes" || low === "on")  return true;
  if (low === "false" || low === "deny"  || low === "no"  || low === "off") return false;
  if (low === "null"  || low === "inherit" || low === "neutral")             return null;
  return undefined as unknown as boolean | null;
}

// Build a human-readable summary of parsed permissions
function formatPerms(opts: PermissionOverwriteOptions): string {
  return Object.entries(opts)
    .map(([k, v]) => {
      const icon = v === true ? "✅" : v === false ? "❌" : "⬜";
      return `${icon} **${k}**: ${v === null ? "inherit" : String(v)}`;
    })
    .join("\n");
}

export async function handleRoleAllCandc(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!(message.member as GuildMember).permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply({ content: "❌ You need **Manage Server** permission to use this." });
    return;
  }

  const raw  = message.content.trim();
  const parts = raw.split(/\s+/);
  // parts[0] = "?roleallcandc"
  // parts[1] = mention (<@&ID>) or <@ID>
  // parts[2..] = "remove" OR permission flags like "ViewChannel:true"

  if (parts.length < 3) {
    await message.reply({
      content:
        "❌ Usage:\n" +
        "`?roleallcandc <@role> <perm:value> [perm:value ...]` — set permissions on all channels & categories\n" +
        "`?roleallcandc <@role> remove` — remove this role's overwrite from all channels & categories\n\n" +
        "**Available permission keys** (case-insensitive):\n" +
        "`ViewChannel` · `SendMessages` · `ReadMessageHistory` · `AddReactions` · `AttachFiles` · `EmbedLinks` · " +
        "`MentionEveryone` · `ManageMessages` · `ManageChannels` · `UseApplicationCommands` · " +
        "`Connect` · `Speak` · `Stream` · `UseVAD` · `MuteMembers` · `DeafenMembers` · `MoveMembers` · `PrioritySpeaker`\n\n" +
        "**Values**: `true` (allow) · `false` (deny) · `null` (inherit)\n\n" +
        "**Example**: `?roleallcandc @Members ViewChannel:true SendMessages:false`",
    });
    return;
  }

  // Resolve role from first mention
  const role = message.mentions.roles.first();
  if (!role) {
    await message.reply({ content: "❌ Please mention a valid role. Example: `?roleallcandc @Members ViewChannel:true`" });
    return;
  }

  const flagArgs = parts.slice(2); // everything after the mention

  // ── REMOVE mode ───────────────────────────────────────────────────────────
  if (flagArgs.length === 1 && flagArgs[0].toLowerCase() === "remove") {
    const progressMsg = await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR_PRIMARY)
          .setTitle("⚙️ Removing role overwrites…")
          .setDescription(`Removing **@${role.name}** permission overwrites from every channel and category…`),
      ],
    });

    const channels = await message.guild.channels.fetch();
    let success = 0;
    let failed  = 0;
    const failedNames: string[] = [];

    for (const [, channel] of channels) {
      if (!channel) continue;
      try {
        await channel.permissionOverwrites.delete(
          role,
          `?roleallcandc remove by ${message.author.tag}`,
        );
        success++;
      } catch {
        failed++;
        if (failedNames.length < 10) failedNames.push(`#${channel.name}`);
      }
    }

    const lines = [`✅ Removed overwrite from **${success}** channel${success !== 1 ? "s" : ""}/categor${success !== 1 ? "ies" : "y"}`];
    if (failed > 0) {
      lines.push(`⚠️ Skipped **${failed}** (bot lacks permission there)`);
      if (failedNames.length > 0) {
        lines.push(`\`${failedNames.join("`, `")}${failed > 10 ? `\` + ${failed - 10} more` : "`"}`);
      }
    }

    await progressMsg.edit({
      embeds: [
        new EmbedBuilder()
          .setColor(failed > 0 ? COLOR_WARN : COLOR_ACCENT)
          .setTitle(failed > 0 ? "Done (partial)" : "✅ Done")
          .setDescription(lines.join("\n"))
          .setFooter({ text: `@${role.name} overwrites removed from all channels & categories` })
          .setTimestamp(),
      ],
    });
    return;
  }

  // ── APPLY mode — parse permission flags ───────────────────────────────────
  const opts: PermissionOverwriteOptions = {};
  const unknownFlags: string[] = [];
  const badValueFlags: string[] = [];

  for (const arg of flagArgs) {
    const colonIdx = arg.indexOf(":");
    if (colonIdx === -1) {
      unknownFlags.push(arg);
      continue;
    }
    const rawKey = arg.slice(0, colonIdx).toLowerCase();
    const rawVal = arg.slice(colonIdx + 1);

    const permKey = PERM_ALIASES[rawKey];
    if (!permKey) {
      unknownFlags.push(arg);
      continue;
    }

    const value = parseValue(rawVal);
    if (value === undefined) {
      badValueFlags.push(arg);
      continue;
    }

    (opts as Record<string, boolean | null>)[permKey] = value;
  }

  if (unknownFlags.length > 0 || badValueFlags.length > 0) {
    const lines: string[] = [];
    if (unknownFlags.length  > 0) lines.push(`❌ Unknown flags: \`${unknownFlags.join("`, `")}\``);
    if (badValueFlags.length > 0) lines.push(`❌ Bad values (use \`true\`, \`false\`, or \`null\`): \`${badValueFlags.join("`, `")}\``);
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR_ERROR)
          .setTitle("Invalid flags")
          .setDescription(lines.join("\n")),
      ],
    });
    return;
  }

  if (Object.keys(opts).length === 0) {
    await message.reply({ content: "❌ No valid permissions provided." });
    return;
  }

  const progressMsg = await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR_PRIMARY)
        .setTitle("⚙️ Updating channel permissions…")
        .setDescription(
          `Applying **@${role.name}** overwrites to every channel and category…\n\n` +
          formatPerms(opts),
        ),
    ],
  });

  const channels = await message.guild.channels.fetch();
  let success = 0;
  let failed  = 0;
  const failedNames: string[] = [];

  for (const [, channel] of channels) {
    if (!channel) continue;
    try {
      await channel.permissionOverwrites.edit(
        role,
        opts,
        { reason: `?roleallcandc by ${message.author.tag}`, type: OverwriteType.Role },
      );
      success++;
    } catch {
      failed++;
      if (failedNames.length < 10) failedNames.push(`#${channel.name}`);
    }
  }

  const lines = [`✅ Updated **${success}** channel${success !== 1 ? "s" : ""}/categor${success !== 1 ? "ies" : "y"}`];
  if (failed > 0) {
    lines.push(`⚠️ Skipped **${failed}** (bot lacks permission there)`);
    if (failedNames.length > 0) {
      lines.push(`\`${failedNames.join("`, `")}${failed > 10 ? `\` + ${failed - 10} more` : "`"}`);
    }
  }

  await progressMsg.edit({
    embeds: [
      new EmbedBuilder()
        .setColor(failed > 0 ? COLOR_WARN : COLOR_ACCENT)
        .setTitle(failed > 0 ? "Done (partial)" : "✅ Done")
        .setDescription(lines.join("\n") + "\n\n**Permissions applied:**\n" + formatPerms(opts))
        .setFooter({ text: `@${role.name} · all channels & categories` })
        .setTimestamp(),
    ],
  });
}
