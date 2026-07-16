import type { Message, TextChannel, Client } from "discord.js";
import { EmbedBuilder, ChannelType, OverwriteType, PermissionFlagsBits } from "discord.js";
import {
  getConfig,
  saveConfig,
  getWhitelistData,
  saveWhitelistData,
} from "./store.js";
import type { PunishAction } from "./store.js";
import { getSnap, clearSnap } from "./snapshot.js";

const COLOR_OK  = 0x00FFFF;
const COLOR_ERR = 0xFF4444;
const COLOR_INF = 0x2F3136;
const COLOR_WIN = 0x00FF99;
const COLOR_WRN = 0xFF8C00;

function isAdmin(message: Message): boolean {
  if (!message.guild || !message.member) return false;
  return (
    message.author.id === message.guild.ownerId ||
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

// ─── RESTORE ──────────────────────────────────────────────────────────────────
async function runRestore(message: Message, client: Client, offenderId: string): Promise<void> {
  const guild = message.guild!;

  if (message.author.id !== guild.ownerId) {
    await message.reply({ embeds: [
      new EmbedBuilder().setColor(COLOR_ERR)
        .setDescription("only the server owner can run a restore"),
    ]});
    return;
  }

  const snap = getSnap(guild.id, offenderId);
  if (!snap) {
    await message.reply({ embeds: [
      new EmbedBuilder().setColor(COLOR_ERR)
        .setDescription(
          "no snapshot found for that user\n\n" +
          "snapshots get saved when antinuke fires and cleared after a restore — they're also lost if the bot restarts",
        ),
    ]});
    return;
  }

  const status = await message.reply({ embeds: [
    new EmbedBuilder().setColor(0xFFAA00)
      .setTitle("restoring...")
      .setDescription(
        `working on **${snap.roles.length}** role(s), **${snap.channels.length}** channel(s) ` +
        `and unbanning **${snap.bans.length}** member(s) — hang tight`,
      ),
  ]});

  let rolesOk = 0, rolesFail = 0;
  let chOk = 0, chFail = 0;
  let unbanOk = 0, unbanFail = 0, dmOk = 0;

  // ── 1. Recreate roles ─────────────────────────────────────────────────────
  const roleIdMap   = new Map<string, string>();
  const sortedRoles = [...snap.roles].sort((a, b) => a.position - b.position);

  for (const r of sortedRoles) {
    try {
      let icon: Buffer | undefined;
      if (r.iconURL) {
        try {
          const ir = await fetch(r.iconURL, { signal: AbortSignal.timeout(5_000) });
          if (ir.ok) icon = Buffer.from(await ir.arrayBuffer());
        } catch { /* icon optional */ }
      }
      const created = await guild.roles.create({
        name:        r.name,
        color:       r.color,
        hoist:       r.hoist,
        mentionable: r.mentionable,
        permissions: BigInt(r.permissions),
        ...(icon           ? { icon }                         : {}),
        ...(r.unicodeEmoji ? { unicodeEmoji: r.unicodeEmoji } : {}),
        reason: `Anti-Nuke restore — role deleted by <@${offenderId}>`,
      });
      roleIdMap.set(r.id, created.id);
      rolesOk++;
    } catch (e) {
      console.error(`[RESTORE] Role "${r.name}" failed:`, e);
      rolesFail++;
    }
  }

  // ── 2. Recreate channels ──────────────────────────────────────────────────
  const categories  = snap.channels.filter(c => c.type === ChannelType.GuildCategory);
  const others      = snap.channels.filter(c => c.type !== ChannelType.GuildCategory);
  const allOrdered  = [
    ...categories.sort((a, b) => a.position - b.position),
    ...others.sort((a, b) => a.position - b.position),
  ];
  const channelIdMap = new Map<string, string>();

  for (const ch of allOrdered) {
    try {
      const permissionOverwrites = ch.overwrites.map((ow) => ({
        id:    roleIdMap.get(ow.id) ?? ow.id,
        type:  ow.type as OverwriteType,
        allow: BigInt(ow.allow),
        deny:  BigInt(ow.deny),
      }));
      const parent = ch.parentId ? (channelIdMap.get(ch.parentId) ?? null) : null;
      const opts: Parameters<typeof guild.channels.create>[0] = {
        name:               ch.name,
        type:               ch.type as ChannelType.GuildText,
        position:           ch.position,
        permissionOverwrites,
        reason: `Anti-Nuke restore — channel deleted by <@${offenderId}>`,
        ...(parent                              ? { parent }                               : {}),
        ...(ch.topic                            ? { topic: ch.topic }                      : {}),
        ...(ch.nsfw                             ? { nsfw: ch.nsfw }                        : {}),
        ...(ch.rateLimitPerUser                 ? { rateLimitPerUser: ch.rateLimitPerUser } : {}),
        ...(ch.bitrate !== null                 ? { bitrate: ch.bitrate }                  : {}),
        ...(ch.userLimit !== null && ch.userLimit > 0 ? { userLimit: ch.userLimit }       : {}),
      };
      const created = await guild.channels.create(opts);
      channelIdMap.set(ch.id, created.id);
      chOk++;
    } catch (e) {
      console.error(`[RESTORE] Channel "${ch.name}" failed:`, e);
      chFail++;
    }
  }

  // ── 3. Unban members ──────────────────────────────────────────────────────
  const inviteSource = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.viewable,
  ) as TextChannel | undefined;

  for (const ban of snap.bans) {
    try {
      await guild.members.unban(ban.userId, `Anti-Nuke restore — wrongfully banned by <@${offenderId}>`);
      unbanOk++;

      let inviteUrl = `https://discord.gg/${guild.id}`;
      if (inviteSource) {
        try {
          const inv = await inviteSource.createInvite({
            maxAge: 0, maxUses: 1, unique: true, reason: "Anti-Nuke restore",
          });
          inviteUrl = inv.url;
        } catch { /* use fallback */ }
      }

      try {
        const user    = await client.users.fetch(ban.userId);
        const dmEmbed = new EmbedBuilder()
          .setColor(COLOR_WIN)
          .setTitle(`sorry about that — ${guild.name}`)
          .setThumbnail(guild.iconURL({ size: 256 }))
          .setDescription(
            `hey ${ban.username}\n\n` +
            `someone got into the server and went on a banning spree — you got caught in it, which wasn't your fault at all\n\n` +
            `you've been unbanned, come back whenever you're ready\n\n` +
            `**[rejoin ${guild.name}](${inviteUrl})**\n` +
            `*(this link is just for you)*`,
          )
          .setFooter({ text: guild.name })
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] });
        dmOk++;
      } catch { /* DMs closed — unban still happened */ }
    } catch (e) {
      console.error(`[RESTORE] Unban ${ban.userId} failed:`, e);
      unbanFail++;
    }
  }

  clearSnap(guild.id, offenderId);

  await status.edit({ embeds: [
    new EmbedBuilder()
      .setColor(COLOR_WIN)
      .setTitle("restore done")
      .setDescription(`dealt with <@${offenderId}>`)
      .addFields(
        {
          name: "roles",
          value: `recreated **${rolesOk}**${rolesFail > 0 ? ` — **${rolesFail}** failed` : ""}`,
          inline: true,
        },
        {
          name: "channels",
          value: `recreated **${chOk}**${chFail > 0 ? ` — **${chFail}** failed` : ""}`,
          inline: true,
        },
        {
          name: "unbans",
          value: `unbanned **${unbanOk}**, dm'd **${dmOk}**${unbanFail > 0 ? ` — **${unbanFail}** failed` : ""}`,
          inline: true,
        },
        {
          name: "heads up",
          value: "role positions might be a little off, fix them manually if needed — restore only works when punishment is set to strip",
        },
      )
      .setTimestamp(),
  ]});
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function resolveTarget(message: Message, parts: string[], offset: number) {
  return message.mentions.users.first() ?? (parts[offset] ? { id: parts[offset] } : null);
}

// ─── MAIN COMMAND ROUTER ──────────────────────────────────────────────────────

export async function handleAntiNukeCommand(message: Message, client: Client): Promise<void> {
  if (!message.guild) return;
  if (!isAdmin(message)) {
    await message.reply({ embeds: [
      new EmbedBuilder().setColor(COLOR_ERR)
        .setDescription("you need admin perms to use antinuke commands"),
    ]});
    return;
  }

  const parts = message.content.trim().split(/\s+/);
  const sub   = parts[1]?.toLowerCase();

  if (!sub || sub === "help") {
    await message.reply({ embeds: [buildHelpEmbed()] });
    return;
  }

  const guildId = message.guild.id;

  // ── ?antinuke enable / disable ────────────────────────────────────────────
  if (sub === "enable" || sub === "disable") {
    const cfg = await getConfig(guildId);
    cfg.enabled = sub === "enable";
    await saveConfig(guildId, cfg);
    await message.reply({ embeds: [
      new EmbedBuilder()
        .setColor(cfg.enabled ? COLOR_OK : COLOR_ERR)
        .setDescription(
          cfg.enabled
            ? "antinuke is on, watching for anything suspicious"
            : "antinuke is off",
        ),
    ]});
    return;
  }

  // ── ?antinuke setpunish ban|kick|strip ────────────────────────────────────
  if (sub === "setpunish") {
    const choice = parts[2]?.toLowerCase();
    const valid: PunishAction[] = ["ban", "kick", "strip"];
    if (!choice || !valid.includes(choice as PunishAction)) {
      await message.reply({ embeds: [
        new EmbedBuilder().setColor(COLOR_ERR).setDescription(
          "pick one of these\n\n" +
          "`?antinuke setpunish ban` — perma ban the offender\n" +
          "`?antinuke setpunish kick` — kick them (they can come back but lose access immediately)\n" +
          "`?antinuke setpunish strip` — take all their roles away, reversible with restore\n\n" +
          "bots always get banned no matter what you pick here",
        ),
      ]});
      return;
    }
    const cfg = await getConfig(guildId);
    cfg.punishAction = choice as PunishAction;
    await saveConfig(guildId, cfg);
    const desc: Record<PunishAction, string> = {
      ban:   "punishment set to ban — offenders get permanently banned when they cross the line",
      kick:  "punishment set to kick — offenders get kicked from the server",
      strip: "punishment set to strip — offenders lose all their roles, use `?antinuke restore @user` to undo it",
    };
    await message.reply({ embeds: [
      new EmbedBuilder().setColor(COLOR_OK).setDescription(desc[cfg.punishAction]),
    ]});
    return;
  }

  // ── ?antinuke log #channel ────────────────────────────────────────────────
  if (sub === "log") {
    const channel = message.mentions.channels.first()
                 ?? (parts[2] ? message.guild.channels.cache.get(parts[2]) : undefined);
    if (!channel || channel.type !== ChannelType.GuildText) {
      await message.reply({ embeds: [
        new EmbedBuilder().setColor(COLOR_ERR)
          .setDescription("mention a text channel — example: `?antinuke log #security-logs`"),
      ]});
      return;
    }
    const cfg = await getConfig(guildId);
    cfg.logChannelId = channel.id;
    await saveConfig(guildId, cfg);
    await message.reply({ embeds: [
      new EmbedBuilder().setColor(COLOR_OK)
        .setDescription(`logs will go to <#${channel.id}>`),
    ]});
    return;
  }

  // ── ?antinuke logs p add/remove/list ─────────────────────────────────────
  if (sub === "logs") {
    const action   = parts[2]?.toLowerCase();
    const modifier = parts[3]?.toLowerCase();

    if (action !== "p") {
      await message.reply({ embeds: [
        new EmbedBuilder().setColor(COLOR_ERR).setDescription(
          "not sure what you meant — here's what you can do\n\n" +
          "`?antinuke logs p add @user`\n`?antinuke logs p remove @user`\n`?antinuke logs p list`",
        ),
      ]});
      return;
    }

    const cfg = await getConfig(guildId);
    cfg.logPingIds ??= [];

    if (modifier === "add") {
      const target = resolveTarget(message, parts, 4);
      if (!target) {
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_ERR)
          .setDescription("mention who you want to add — example: `?antinuke logs p add @user`")] });
        return;
      }
      if (!cfg.logPingIds.includes(target.id)) {
        cfg.logPingIds.push(target.id);
        await saveConfig(guildId, cfg);
      }
      await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_OK)
        .setDescription(`<@${target.id}> will get pinged whenever antinuke fires`)] });
      return;
    }

    if (modifier === "remove") {
      const target = resolveTarget(message, parts, 4);
      if (!target) {
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_ERR)
          .setDescription("mention who you want to remove — example: `?antinuke logs p remove @user`")] });
        return;
      }
      cfg.logPingIds = cfg.logPingIds.filter(id => id !== target.id);
      await saveConfig(guildId, cfg);
      await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_OK)
        .setDescription(`<@${target.id}> won't be pinged anymore`)] });
      return;
    }

    const ids    = cfg.logPingIds;
    const logRef = cfg.logChannelId ? `<#${cfg.logChannelId}>` : "*not set*";
    await message.reply({ embeds: [
      new EmbedBuilder().setColor(COLOR_INF).setTitle("log pings")
        .addFields(
          { name: "log channel", value: logRef, inline: false },
          {
            name: "who gets pinged",
            value: ids.length === 0
              ? "*nobody yet — add someone with `?antinuke logs p add @user`*"
              : ids.map(id => `<@${id}> (\`${id}\`)`).join("\n"),
            inline: false,
          },
        ),
    ]});
    return;
  }

  // ── ?antinuke whitelist [@user | add/remove/list @user] ───────────────────
  if (sub === "whitelist") {
    const action = parts[2]?.toLowerCase();
    const wl     = await getWhitelistData(guildId);

    const isDirect = !!message.mentions.users.size && action !== "remove" && action !== "list";

    if (action === "add" || isDirect) {
      const target = resolveTarget(message, parts, 3);
      if (!target) {
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_ERR)
          .setDescription("mention who you want to whitelist — example: `?antinuke whitelist @user`")] });
        return;
      }
      wl.immune.delete(target.id);
      wl.lenient.add(target.id);
      await saveWhitelistData(guildId, wl);
      await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_OK)
        .setTitle("lenient whitelist updated")
        .setDescription(
          `<@${target.id}> is now on the lenient whitelist\n\n` +
          `they can do up to **10 bans/kicks/deletes a minute** before their roles get stripped — they won't be banned or kicked`,
        )] });
      return;
    }

    if (action === "remove") {
      const target = resolveTarget(message, parts, 3);
      if (!target) {
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_ERR)
          .setDescription("mention who you want to remove — example: `?antinuke whitelist remove @user`")] });
        return;
      }
      const wasThere = wl.lenient.has(target.id) || wl.immune.has(target.id);
      wl.lenient.delete(target.id);
      wl.immune.delete(target.id);
      await saveWhitelistData(guildId, wl);
      await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_OK)
        .setDescription(
          wasThere
            ? `<@${target.id}> is off the whitelist, back to normal limits`
            : `<@${target.id}> wasn't on the whitelist`,
        )] });
      return;
    }

    // list
    const lenientIds = [...wl.lenient];
    const immuneIds  = [...wl.immune];
    await message.reply({ embeds: [
      new EmbedBuilder().setColor(COLOR_INF)
        .setTitle("whitelist")
        .addFields(
          {
            name: "lenient — higher limits, strip only",
            value: lenientIds.length === 0
              ? "*nobody*"
              : lenientIds.map(id => `<@${id}> (\`${id}\`)`).join("\n"),
            inline: false,
          },
          {
            name: "immune — completely ignored",
            value: immuneIds.length === 0
              ? "*nobody*"
              : immuneIds.map(id => `<@${id}> (\`${id}\`)`).join("\n"),
            inline: false,
          },
        )
        .setFooter({ text: "server owner and this bot are always exempt, no need to add them" }),
    ]});
    return;
  }

  // ── ?antinuke whitelist-i [@user | add/remove/list @user] ─────────────────
  if (sub === "whitelist-i") {
    const action = parts[2]?.toLowerCase();
    const wl     = await getWhitelistData(guildId);

    const isDirect = !!message.mentions.users.size && action !== "remove" && action !== "list";

    if (action === "add" || isDirect) {
      const target = resolveTarget(message, parts, 3);
      if (!target) {
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_ERR)
          .setDescription("mention who you want to add — example: `?antinuke whitelist-i @user`")] });
        return;
      }
      wl.lenient.delete(target.id);
      wl.immune.add(target.id);
      await saveWhitelistData(guildId, wl);
      await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_WRN)
        .setTitle("immune whitelist updated")
        .setDescription(
          `<@${target.id}> is now fully immune — antinuke won't touch them no matter what they do\n\n` +
          `only add people you fully trust here`,
        )] });
      return;
    }

    if (action === "remove") {
      const target = resolveTarget(message, parts, 3);
      if (!target) {
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_ERR)
          .setDescription("mention who you want to remove — example: `?antinuke whitelist-i remove @user`")] });
        return;
      }
      const wasThere = wl.immune.has(target.id);
      wl.immune.delete(target.id);
      await saveWhitelistData(guildId, wl);
      await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_OK)
        .setDescription(
          wasThere
            ? `<@${target.id}> is off the immune whitelist, back to normal limits`
            : `<@${target.id}> wasn't on the immune whitelist`,
        )] });
      return;
    }

    // list (redirect to whitelist list)
    const lenientIds = [...wl.lenient];
    const immuneIds  = [...wl.immune];
    await message.reply({ embeds: [
      new EmbedBuilder().setColor(COLOR_INF)
        .setTitle("whitelist")
        .addFields(
          {
            name: "lenient — higher limits, strip only",
            value: lenientIds.length === 0
              ? "*nobody*"
              : lenientIds.map(id => `<@${id}> (\`${id}\`)`).join("\n"),
            inline: false,
          },
          {
            name: "immune — completely ignored",
            value: immuneIds.length === 0
              ? "*nobody*"
              : immuneIds.map(id => `<@${id}> (\`${id}\`)`).join("\n"),
            inline: false,
          },
        )
        .setFooter({ text: "server owner and this bot are always exempt, no need to add them" }),
    ]});
    return;
  }

  // ── ?antinuke status ──────────────────────────────────────────────────────
  if (sub === "status") {
    const cfg        = await getConfig(guildId);
    const wl         = await getWhitelistData(guildId);
    const logRef     = cfg.logChannelId ? `<#${cfg.logChannelId}>` : "*not set*";
    const pingIds    = cfg.logPingIds ?? [];
    const pingsRef   = pingIds.length > 0 ? pingIds.map(id => `<@${id}>`).join(", ") : "*none*";
    const punishLabels: Record<PunishAction, string> = {
      ban: "ban (permanent)", kick: "kick", strip: "strip (reversible)",
    };

    const thresholdLines = (Object.entries(cfg.thresholds) as [string, { count: number; window: number }][])
      .map(([k, v]) => `\`${k}\` — **${v.count}** in **${v.window / 1000}s**`)
      .join("\n");

    await message.reply({ embeds: [
      new EmbedBuilder()
        .setColor(cfg.enabled ? COLOR_OK : COLOR_ERR)
        .setTitle(`antinuke status — ${message.guild.name}`)
        .addFields(
          { name: "status",      value: cfg.enabled ? "**on**" : "**off**",           inline: true },
          { name: "punishment",  value: punishLabels[cfg.punishAction],                inline: true },
          { name: "log channel", value: logRef,                                         inline: true },
          {
            name: "lenient whitelist",
            value: wl.lenient.size > 0 ? `${wl.lenient.size} user(s)` : "*nobody*",
            inline: true,
          },
          {
            name: "immune whitelist",
            value: wl.immune.size > 0 ? `${wl.immune.size} user(s)` : "*nobody*",
            inline: true,
          },
          { name: "log pings",  value: pingsRef,        inline: false },
          { name: "thresholds", value: thresholdLines,  inline: false },
        )
        .setFooter({ text: "bots always get banned regardless of the punishment setting" }),
    ]});
    return;
  }

  // ── ?antinuke restore @user ───────────────────────────────────────────────
  if (sub === "restore") {
    const target = message.mentions.users.first();
    if (!target) {
      await message.reply({ embeds: [
        new EmbedBuilder().setColor(COLOR_ERR)
          .setDescription("mention who you want to restore — example: `?antinuke restore @user`"),
      ]});
      return;
    }
    await runRestore(message, client, target.id);
    return;
  }

  await message.reply({ embeds: [buildHelpEmbed()] });
}

function buildHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2F3136)
    .setTitle("antinuke commands")
    .setDescription(
      "uses audit logs for instant detection with zero delay\n" +
      "bots get banned on their first destructive action, no threshold needed",
    )
    .addFields(
      {
        name: "setup",
        value: [
          "`?antinuke enable` — turn on monitoring",
          "`?antinuke disable` — turn it off",
          "`?antinuke log #channel` — set where logs go",
          "`?antinuke logs p add @user` — ping someone on every log",
          "`?antinuke logs p remove @user` — stop pinging them",
          "`?antinuke logs p list` — see who gets pinged",
        ].join("\n"),
      },
      {
        name: "punishment",
        value: [
          "`?antinuke setpunish strip` — remove all roles, default, reversible",
          "`?antinuke setpunish kick` — kick from server",
          "`?antinuke setpunish ban` — permanent ban",
          "*bots always get banned no matter what you set here*",
        ].join("\n"),
      },
      {
        name: "lenient whitelist — trusted staff with higher limits",
        value: [
          "`?antinuke whitelist @user` — add someone",
          "`?antinuke whitelist add @user` — same thing",
          "`?antinuke whitelist remove @user` — remove from all tiers",
          "`?antinuke whitelist list` — see both tiers",
          "*10+ bans/kicks/deletes in 60s triggers a strip, no bans or kicks for these guys*",
        ].join("\n"),
      },
      {
        name: "immune whitelist — fully bypasses antinuke",
        value: [
          "`?antinuke whitelist-i @user` — add someone",
          "`?antinuke whitelist-i add @user` — same thing",
          "`?antinuke whitelist-i remove @user` — remove",
          "*their actions get completely ignored, no limits, no punishment*",
        ].join("\n"),
      },
      {
        name: "info and restore",
        value: [
          "`?antinuke status` — full status and thresholds",
          "`?antinuke restore @user` — undo damage, owner only, strip mode only",
        ].join("\n"),
      },
      {
        name: "what gets monitored",
        value:
          "`channelDelete/Create` `roleDelete/Create` `ban` `kick` " +
          "`guildUpdate` `webhookCreate` `emojiDelete` and webhook message spam",
      },
    )
    .setFooter({ text: "server owner and this bot are always exempt" });
}
