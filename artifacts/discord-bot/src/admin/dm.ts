import { EmbedBuilder, Message } from "discord.js";
import { eq } from "drizzle-orm";
import { botKvTable } from "@workspace/db/schema";
import { getDb } from "../db.js";
import { isLowoOwner } from "../utility/lowoOwner.js";

const COLOR_PRIMARY = 0x2f3136;
const COLOR_ERROR = 0xff4444;
const COLOR_SUCCESS = 0x57f287;

function dmWhitelistKey(guildId: string): string {
  return `dm:whitelist:${guildId}`;
}

async function getDmWhitelist(guildId: string): Promise<string[]> {
  const rows = await getDb()
    .select()
    .from(botKvTable)
    .where(eq(botKvTable.key, dmWhitelistKey(guildId)));
  return Array.isArray(rows[0]?.value) ? rows[0].value as string[] : [];
}

async function setDmWhitelist(guildId: string, userIds: string[]): Promise<void> {
  await getDb()
    .insert(botKvTable)
    .values({ key: dmWhitelistKey(guildId), value: userIds, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: botKvTable.key,
      set: { value: userIds, updatedAt: new Date() },
    });
}

function isDmOwner(message: Message): boolean {
  return !!message.guild
    && (message.author.id === message.guild.ownerId || isLowoOwner(message.author.id));
}

function mentionedIds(content: string): string[] {
  const ids = new Set<string>();
  for (const match of content.matchAll(/<@!?(\d+)>/g)) {
    ids.add(match[1]);
  }
  return [...ids];
}

async function canUseDm(message: Message): Promise<boolean> {
  if (isDmOwner(message)) return true;
  const guildId = message.guild?.id;
  if (!guildId) return false;
  return (await getDmWhitelist(guildId)).includes(message.author.id);
}

export async function handleDmCommand(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;

  const args = message.content.trim().split(/\s+/);
  // args[0] = "?dm", args[1] = "whitelist" | "all" | mention

  if (args[1]?.toLowerCase() === "whitelist") {
    if (!isDmOwner(message)) {
      await message.reply({ content: "❌ Only the **Lowo owner** or **server owner** can manage the DM whitelist." });
      return;
    }

    const action = args[2]?.toLowerCase();
    if (action !== "add" && action !== "remove" && action !== "list") {
      await message.reply({
        content:
          "❌ Usage:\n" +
          "`?dm whitelist add @user, @user2`\n" +
          "`?dm whitelist remove @user, @user2`\n" +
          "`?dm whitelist list`",
      });
      return;
    }

    const whitelist = await getDmWhitelist(message.guild.id);
    if (action === "list") {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR_PRIMARY)
            .setTitle("DM Whitelist")
            .setDescription(
              whitelist.length
                ? whitelist.map((id) => `<@${id}>`).join("\n")
                : "*No users are whitelisted.*",
            ),
        ],
      });
      return;
    }

    const ids = mentionedIds(message.content);
    if (ids.length === 0) {
      await message.reply({ content: `❌ Please mention at least one user: \`?dm whitelist ${action} @user, @user2\`.` });
      return;
    }

    const changed: string[] = [];
    let next = [...whitelist];
    if (action === "add") {
      for (const id of ids) {
        if (!next.includes(id)) {
          next.push(id);
          changed.push(id);
        }
      }
    } else {
      const removeSet = new Set(ids);
      changed.push(...ids.filter((id) => next.includes(id)));
      next = next.filter((id) => !removeSet.has(id));
    }

    await setDmWhitelist(message.guild.id, next);
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(changed.length ? COLOR_SUCCESS : COLOR_PRIMARY)
          .setDescription(
            changed.length
              ? `${action === "add" ? "✅ Added" : "✅ Removed"} ${changed.map((id) => `<@${id}>`).join(", ")}`
              : "ℹ️ No whitelist entries changed.",
          ),
      ],
    });
    return;
  }

  if (!(await canUseDm(message))) {
    await message.reply({ content: "❌ You don't have permission to use this." });
    return;
  }
  // args[0] = "?dm", args[1] = "all" | mention, rest = message text

  if (args.length < 3) {
    await message.reply({
      content:
        "❌ Usage:\n" +
        "`?dm all <message>` — DM every member in the server\n" +
        "`?dm @user <message>` — DM a specific member\n" +
        "`?dm whitelist add/remove @user, @user2` — Manage the DM whitelist (owners only)",
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

    let sent = 0;
    let failed = 0;

    for (const [, member] of members) {
      if (member.user.bot) continue;
      try {
        await member.send({ content: text });
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
        "`?dm @user <message>` — DM a specific member\n" +
        "`?dm whitelist add/remove @user, @user2` — Manage the DM whitelist (owners only)",
    });
    return;
  }

  // Strip "?dm" and the mention from the raw content to get the message text
  const mentionPattern = /^<@!?\d+>\s*/;
  const afterCommand = message.content.trim().replace(/^\S+\s+/, ""); // remove "?dm"
  const text = afterCommand.replace(mentionPattern, "").trim();

  if (!text) {
    await message.reply({ content: "❌ Please provide a message to send." });
    return;
  }

  try {
    await mentionedUser.send({ content: text });
    await message.reply({ content: `✅ DM sent to **${mentionedUser.username}**.` });
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
