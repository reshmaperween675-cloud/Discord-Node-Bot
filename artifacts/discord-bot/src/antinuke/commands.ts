import type { Message } from "discord.js";
import { EmbedBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import {
  getConfig,
  saveConfig,
  getWhitelist,
  saveWhitelist,
  DEFAULT_THRESHOLDS,
} from "./store.js";

const COLOR_OK  = 0x00FFFF;
const COLOR_ERR = 0xFF4444;
const COLOR_INF = 0x2F3136;

function requireManageGuild(message: Message): boolean {
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    message.reply({ embeds: [
      new EmbedBuilder()
        .setColor(COLOR_ERR)
        .setDescription("❌ You need **Manage Server** permission to use anti-nuke commands."),
    ]}).catch(() => {});
    return false;
  }
  return true;
}

export async function handleAntiNukeCommand(message: Message): Promise<void> {
  if (!message.guild) return;
  if (!requireManageGuild(message)) return;

  const parts = message.content.trim().split(/\s+/);
  const sub   = parts[1]?.toLowerCase();

  // ── ?antinuke ─────────────────────────────────────────────────────────────
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
            ? "✅ Anti-Nuke system **enabled**. The bot will now monitor this server."
            : "⛔ Anti-Nuke system **disabled**.",
        ),
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
          .setDescription("❌ Please mention a valid text channel. Example: `?antinuke log #security-logs`"),
      ]});
      return;
    }
    const cfg = await getConfig(guildId);
    cfg.logChannelId = channel.id;
    await saveConfig(guildId, cfg);
    await message.reply({ embeds: [
      new EmbedBuilder().setColor(COLOR_OK)
        .setDescription(`✅ Anti-Nuke alerts will be sent to <#${channel.id}>.`),
    ]});
    return;
  }

  // ── ?antinuke whitelist add/remove/list ───────────────────────────────────
  if (sub === "whitelist") {
    const action = parts[2]?.toLowerCase();
    const target = message.mentions.users.first() ?? (parts[3] ? { id: parts[3] } : null);
    const whitelist = await getWhitelist(guildId);

    if (action === "add") {
      if (!target) {
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_ERR)
          .setDescription("❌ Please mention a user. Example: `?antinuke whitelist add @user`")] });
        return;
      }
      whitelist.add(target.id);
      await saveWhitelist(guildId, whitelist);
      await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_OK)
        .setDescription(`✅ <@${target.id}> added to the Anti-Nuke whitelist. Their actions will be ignored.`)] });
      return;
    }

    if (action === "remove") {
      if (!target) {
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_ERR)
          .setDescription("❌ Please mention a user. Example: `?antinuke whitelist remove @user`")] });
        return;
      }
      whitelist.delete(target.id);
      await saveWhitelist(guildId, whitelist);
      await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_OK)
        .setDescription(`✅ <@${target.id}> removed from the Anti-Nuke whitelist.`)] });
      return;
    }

    if (action === "list" || !action) {
      const ids = [...whitelist];
      await message.reply({ embeds: [
        new EmbedBuilder()
          .setColor(COLOR_INF)
          .setTitle("🛡️ Anti-Nuke Whitelist")
          .setDescription(
            ids.length === 0
              ? "*No users whitelisted. The guild owner and the bot are always exempt.*"
              : ids.map(id => `<@${id}> (\`${id}\`)`).join("\n"),
          )
          .setFooter({ text: "Guild owner + bot are always exempt — no need to add them" }),
      ]});
      return;
    }

    await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR_ERR)
      .setDescription("❌ Unknown whitelist action. Use `add`, `remove`, or `list`.")]});
    return;
  }

  // ── ?antinuke status ──────────────────────────────────────────────────────
  if (sub === "status") {
    const cfg = await getConfig(guildId);
    const whitelist = await getWhitelist(guildId);
    const statusIcon = cfg.enabled ? "🟢" : "🔴";
    const logRef = cfg.logChannelId ? `<#${cfg.logChannelId}>` : "*not set*";

    const thresholdLines = (Object.entries(cfg.thresholds) as [string, { count: number; window: number }][])
      .map(([k, v]) => `• \`${k}\`: **${v.count}** actions in **${v.window / 1000}s**`)
      .join("\n");

    await message.reply({ embeds: [
      new EmbedBuilder()
        .setColor(cfg.enabled ? COLOR_OK : COLOR_ERR)
        .setTitle(`${statusIcon} Anti-Nuke Status — ${message.guild.name}`)
        .addFields(
          { name: "Status",       value: cfg.enabled ? "**Enabled**" : "**Disabled**", inline: true },
          { name: "Log Channel",  value: logRef,                                        inline: true },
          { name: "Whitelisted",  value: `${whitelist.size} user(s)`,                  inline: true },
          { name: "Thresholds",   value: thresholdLines,                                inline: false },
        )
        .setFooter({ text: "?antinuke help — full command list" }),
    ]});
    return;
  }

  // ── ?antinuke thresholds ──────────────────────────────────────────────────
  if (sub === "thresholds") {
    const lines = (Object.entries(DEFAULT_THRESHOLDS) as [string, { count: number; window: number }][])
      .map(([k, v]) => `• \`${k}\` — **${v.count}** actions in **${v.window / 1000}s**`)
      .join("\n");
    await message.reply({ embeds: [
      new EmbedBuilder()
        .setColor(COLOR_INF)
        .setTitle("⚡ Anti-Nuke Thresholds")
        .setDescription(lines)
        .setFooter({ text: "Thresholds are fixed. Contact the developer to adjust them." }),
    ]});
    return;
  }

  await message.reply({ embeds: [buildHelpEmbed()] });
}

function buildHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2F3136)
    .setTitle("🛡️ Anti-Nuke — Command Reference")
    .setDescription("Protects the server against rogue staff mass-deleting channels, roles, or banning members.")
    .addFields({
      name: "Commands",
      value: [
        "`?antinuke enable` — Activate the system",
        "`?antinuke disable` — Deactivate the system",
        "`?antinuke log #channel` — Set the alert log channel",
        "`?antinuke whitelist add @user` — Trust a staff member",
        "`?antinuke whitelist remove @user` — Revoke trust",
        "`?antinuke whitelist list` — Show all trusted users",
        "`?antinuke status` — Full status + thresholds",
        "`?antinuke thresholds` — Show action thresholds",
      ].join("\n"),
    })
    .addFields({
      name: "How it works",
      value:
        "The bot monitors every channel delete, role delete, ban, and guild update in real time. " +
        "If any staff member hits the threshold (e.g. 3 channel deletes in 10 seconds), their roles are " +
        "immediately stripped and they are banned. An alert embed is sent to your log channel and DM'd to the server owner.",
    })
    .setFooter({ text: "Guild owner + bot are always exempt from anti-nuke checks" });
}
