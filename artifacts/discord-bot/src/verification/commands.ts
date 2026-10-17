import { requireLowoOwnerMessage } from "../utility/lowoOwner.js";
import {
  EmbedBuilder,
  Message,
  PermissionFlagsBits,
  GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  TextChannel,
  VoiceChannel,
} from "discord.js";
import { getAllAuthBackups, getAuthBackupCount, getStoredRoles, updateAuthTokens } from "./db.js";
import {
  buildOAuthUrl,
  refreshAccessToken,
  addUserToGuild,
} from "./oauth.js";
import { buildVerifyPanel, DEFAULT_VERIFICATION_PANEL_NAME } from "./panel.js";
import { loadConfig, saveVerificationPanelConfig } from "./setupAuthVerification.js";

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const COLOR_PRIMARY = 0x2f3136;
const COLOR_ACCENT = 0x00ffff;
const COLOR_RED = 0xff4444;

function isAdmin(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

export async function handleSetupVerification(message: Message): Promise<void> {
  if (!message.guild || !message.member || !isAdmin(message.member)) return;

  const oauthUrl = buildOAuthUrl(message.guild.id);
  if (!process.env.DISCORD_CLIENT_ID || !process.env.OAUTH_REDIRECT_URI) {
    await message.reply({
      content:
        "❌ `DISCORD_CLIENT_ID` and `OAUTH_REDIRECT_URI` must be set in Railway env vars before running this.",
    });
    return;
  }

  const config = await loadConfig(message.guild.id).catch(() => null);
  const panelName = config?.panelName || DEFAULT_VERIFICATION_PANEL_NAME;
  const { embed, row } = buildVerifyPanel(message.guild.name, oauthUrl, panelName);

  try {
    await (message.channel as TextChannel).send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
  } catch (err) {
    console.error("[VERIFICATION] Failed to send verification panel:", err);
    await message.reply({ content: "❌ Failed to post the verification panel. Check my **Send Messages** and **Embed Links** permissions in this channel." }).catch(() => {});
  }
}

export async function handleEditVerificationPanel(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!isAdmin(message.member)) {
    await message.reply({ content: "❌ You need **Manage Server** permissions to run this command." });
    return;
  }

  const requestedName = message.content.trim().replace(/^\?editvpanel\b/i, "").trim();
  if (!requestedName) {
    await message.reply({
      content: "Usage: `?editvpanel <Another clan name>`\nUse `?editvpanel default` to restore **Welcome to Last Stand**.",
    });
    return;
  }

  const panelName = requestedName.toLowerCase() === "default"
    ? DEFAULT_VERIFICATION_PANEL_NAME
    : requestedName;
  if (panelName.length > 80) {
    await message.reply({ content: "❌ The clan name must be 80 characters or fewer." });
    return;
  }

  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.OAUTH_REDIRECT_URI) {
    await message.reply({ content: "❌ The verification OAuth settings are incomplete. Ask the bot owner to check the Railway environment." });
    return;
  }

  const config = await loadConfig(message.guild.id).catch((err) => {
    console.error("[AUTH_VERIFY] Failed to load verification config:", err);
    return null;
  });
  if (!config?.verifyChannelId) {
    await message.reply({ content: "❌ Auth verification is not set up for this server. Run `?setupauthverification` first." });
    return;
  }

  const verifyChannel = await message.guild.channels.fetch(config.verifyChannelId).catch(() => null);
  if (!(verifyChannel instanceof TextChannel)) {
    await message.reply({ content: "❌ I couldn't find the configured verification channel." });
    return;
  }

  const oauthUrl = buildOAuthUrl(message.guild.id);
  const { embed, row } = buildVerifyPanel(message.guild.name, oauthUrl, panelName);
  const botId = message.client.user?.id;
  let oldPanel: Message | null = null;

  if (config.verifyPanelMessageId) {
    const savedMessage = await verifyChannel.messages.fetch(config.verifyPanelMessageId).catch(() => null);
    if (savedMessage && botId && savedMessage.author.id === botId) oldPanel = savedMessage;
  }

  if (!oldPanel && botId) {
    const recentMessages = await verifyChannel.messages.fetch({ limit: 50 }).catch(() => null);
    oldPanel = recentMessages?.find((candidate) =>
      candidate.author.id === botId &&
      candidate.embeds.some((existingEmbed) =>
        existingEmbed.title?.startsWith("Welcome to ") &&
        existingEmbed.description?.includes("We verify everyone before giving server access."),
      ),
    ) ?? null;
  }

  let panelMessageId: string;
  try {
    if (oldPanel) {
      await oldPanel.edit({ embeds: [embed], components: [row] });
      panelMessageId = oldPanel.id;
    } else {
      const sent = await verifyChannel.send({ embeds: [embed], components: [row] });
      panelMessageId = sent.id;
    }
  } catch (err) {
    console.error("[AUTH_VERIFY] Failed to edit verification panel:", err);
    await message.reply({ content: "❌ Couldn't update the verification panel. Check the bot's permissions in the verification channel." });
    return;
  }

  try {
    await saveVerificationPanelConfig(message.guild.id, panelName, panelMessageId);
  } catch (err) {
    console.error("[AUTH_VERIFY] Failed to save verification panel settings:", err);
    await message.reply({ content: "⚠️ The panel was updated, but its new name couldn't be saved for future setups." });
    return;
  }

  await message.reply({ content: `✅ Verification panel updated in <#${verifyChannel.id}>: **Welcome to ${panelName}**.` });
}

export async function handleAddAuthPlayers(message: Message): Promise<void> {
  if (!message.guild || !message.member || !isAdmin(message.member)) return;
  await (message.channel as TextChannel).sendTyping();

  const guildId = message.guild.id;
  const rows = await getAllAuthBackups(guildId);

  if (rows.length === 0) {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR_PRIMARY)
          .setDescription("No backed-up players found in the database."),
      ],
    });
    return;
  }

  // Load stored config so we use the correct role IDs (not fragile name lookup)
  const config = await loadConfig(guildId).catch(() => null);

  const statusMsg = await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR_ACCENT)
        .setDescription(
          `⏳ Pulling **${rows.length}** backed-up players back in. This takes a moment…`,
        ),
    ],
  });

  let recovered = 0;
  let failed = 0;
  let refreshed = 0;

  const skipIds = new Set<string>([config?.unverifiedRoleId].filter((id): id is string => !!id));

  for (const row of rows) {
    let token = row.access_token;

    // Refresh if expired
    if (new Date(row.token_expiry) < new Date()) {
      const newTokens = await refreshAccessToken(row.refresh_token);
      if (!newTokens) { failed++; await sleep(300); continue; }
      token = newTokens.access_token;
      refreshed++;
      await updateAuthTokens(
        row.user_id,
        guildId,
        newTokens.access_token,
        newTokens.refresh_token,
        newTokens.expires_in,
      ).catch(() => {});
    }

    // Restore all previously snapshotted roles + verified role from config
    const stored = await getStoredRoles(row.user_id, guildId).catch(() => [] as string[]);
    const roleIds = [
      ...stored.filter(id => !skipIds.has(id)),
      ...(config?.verifiedRoleId ? [config.verifiedRoleId] : []),
    ];

    const ok = await addUserToGuild(row.user_id, token, guildId, roleIds);
    if (ok) recovered++;
    else failed++;

    // Avoid Discord rate limits when processing large member lists
    await sleep(500);
  }

  const embed = new EmbedBuilder()
    .setColor(recovered > 0 ? COLOR_ACCENT : COLOR_RED)
    .setTitle("🛡️ Disaster Recovery Complete")
    .setDescription(
      `Pulled **${recovered}** players back into the server.` +
        (refreshed > 0 ? ` Refreshed **${refreshed}** expired tokens.` : "") +
        (failed > 0 ? ` **${failed}** couldn't be recovered (tokens dead or user left willingly).` : ""),
    )
    .addFields(
      { name: "Role Assigned", value: config?.verifiedRoleId ? "Verified + previous roles" : "No config found — run `?setupauthverification` first", inline: true },
    )
    .setFooter({ text: "Last Stand Management • OAuth2 Backup System" });

  await statusMsg.edit({ embeds: [embed] });
}

export async function handleEmergencyLockdown(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!requireLowoOwnerMessage(message)) return;
  await (message.channel as TextChannel).sendTyping();

  const everyoneRole = message.guild.roles.everyone;
  let locked = 0;
  let failed = 0;

  for (const [, channel] of message.guild.channels.cache) {
    if (channel.type === ChannelType.GuildCategory) continue;

    try {
      if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
        const tc = channel as TextChannel;
        await tc.permissionOverwrites.edit(everyoneRole, {
          SendMessages: false,
          AddReactions: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
        });
        locked++;
      } else if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
        const vc = channel as VoiceChannel;
        await vc.permissionOverwrites.edit(everyoneRole, {
          Connect: false,
          Speak: false,
        });
        locked++;
      }
    } catch {
      failed++;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(COLOR_RED)
    .setTitle("🚨 EMERGENCY LOCKDOWN ACTIVE")
    .setDescription(
      `Locked **${locked}** channels. Server is closed.` +
        (failed > 0 ? ` Couldn't reach **${failed}** channels (check bot permissions).` : ""),
    )
    .addFields({
      name: "To Lift",
      value: "Manually restore @everyone permissions or use your server's unlock flow.",
    })
    .setFooter({ text: "Last Stand Management • Emergency Protocol" });

  await message.reply({ embeds: [embed] });
}

export async function handleBackupStats(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!requireLowoOwnerMessage(message)) return;

  const guildId = message.guild.id;
  const count = await getAuthBackupCount(guildId);
  const rows = await getAllAuthBackups(guildId);
  const now = new Date();
  const valid = rows.filter((r) => new Date(r.token_expiry) > now).length;
  const expired = rows.length - valid;

  const embed = new EmbedBuilder()
    .setColor(COLOR_ACCENT)
    .setTitle("🗄️ OAuth2 Backup Status")
    .setDescription(
      `We can recover **${count}** players if the server gets nuked.`,
    )
    .addFields(
      { name: "Total Backed Up", value: String(count), inline: true },
      { name: "Valid Tokens", value: String(valid), inline: true },
      { name: "Needs Refresh", value: String(expired), inline: true },
    )
    .addFields({
      name: "Note",
      value:
        "Expired tokens auto-refresh during `?addauthplayers`. As long as the refresh token is alive (30 days), recovery still works.",
    })
    .setFooter({ text: "Last Stand Management • OAuth2 Backup System" });

  await message.reply({ embeds: [embed] });
}
