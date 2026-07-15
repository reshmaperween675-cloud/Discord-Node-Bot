import { Message, EmbedBuilder } from "discord.js";
import { getConfig, saveConfig, isChannelEnabled } from "./config.js";
import {
  getServerMemory,
  clearServerMemory,
  getUserMemory,
} from "./memory.js";
import { isAiAvailable } from "./ai.js";

function isAdmin(message: Message): boolean {
  return !!message.member?.permissions.has("Administrator");
}

export async function handleChatbotCommand(message: Message): Promise<void> {
  if (!message.guild) {
    await message.reply("This command can only be used in a server.").catch(() => {});
    return;
  }

  const parts = message.content.trim().split(/\s+/);
  const sub = parts[1]?.toLowerCase();

  if (!isAdmin(message)) {
    await message.reply("❌ You need **Administrator** permission to configure the chatbot.").catch(() => {});
    return;
  }

  const guildId = message.guild.id;
  const config = await getConfig(guildId);

  switch (sub) {
    case "enable":
    case "e": {
      if (isChannelEnabled(config, message.channelId)) {
        await message.reply("✅ Chatbot is already enabled in this channel.").catch(() => {});
        return;
      }
      config.enabledChannels.push(message.channelId);
      await saveConfig(config);
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle("🤖 Chatbot Enabled")
          .setDescription(`AI chatbot is now **active** in <#${message.channelId}>.\nIt will reply naturally to conversations — not every message.`)
          .addFields({ name: "Response Rate", value: `${config.respondRate}%`, inline: true })
          .addFields({ name: "Model", value: `\`${config.model}\``, inline: true })
          .setFooter({ text: isAiAvailable() ? "AI ready" : "⚠️ No AI key configured — set OPENROUTER_API_KEY" })
        ],
      }).catch(() => {});
      break;
    }

    case "disable":
    case "d": {
      const idx = config.enabledChannels.indexOf(message.channelId);
      if (idx === -1) {
        await message.reply("❌ Chatbot is not enabled in this channel.").catch(() => {});
        return;
      }
      config.enabledChannels.splice(idx, 1);
      await saveConfig(config);
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle("🔇 Chatbot Disabled")
          .setDescription(`AI chatbot is now **off** in <#${message.channelId}>.`)
        ],
      }).catch(() => {});
      break;
    }

    case "status": {
      const serverMem = await getServerMemory(guildId);
      const activeChannels = config.enabledChannels.map((id) => `<#${id}>`).join(", ") || "None";
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🤖 Chatbot Status")
          .addFields(
            { name: "Active Channels", value: activeChannels },
            { name: "Response Rate", value: `${config.respondRate}%`, inline: true },
            { name: "Model", value: `\`${config.model}\``, inline: true },
            { name: "Bot Name", value: config.botName, inline: true },
            { name: "Ignored Users", value: config.ignoredUsers.length > 0 ? config.ignoredUsers.map((id) => `<@${id}>`).join(", ") : "None", inline: true },
            { name: "AI Available", value: isAiAvailable() ? "✅ Yes" : "❌ No (set OPENROUTER_API_KEY)", inline: true },
            { name: "Server Memory", value: `${serverMem.insideJokes.length} jokes, ${serverMem.notes.length} notes`, inline: true },
          )
          .setFooter({ text: "?chatbot help for all commands" })
        ],
      }).catch(() => {});
      break;
    }

    case "respond": {
      const rate = parseInt(parts[2] ?? "");
      if (isNaN(rate) || rate < 0 || rate > 100) {
        await message.reply("❌ Usage: `?chatbot respond <0-100>` — percentage chance to reply to any message.").catch(() => {});
        return;
      }
      config.respondRate = rate;
      await saveConfig(config);
      await message.reply(`✅ Response rate set to **${rate}%**.`).catch(() => {});
      break;
    }

    case "model": {
      const model = parts[2];
      if (!model) {
        await message.reply(
          "❌ Usage: `?chatbot model <model>`\n\n**Popular OpenRouter models:**\n" +
          "`openai/gpt-4o-mini` (default, fast)\n`openai/gpt-4o` (smarter)\n`anthropic/claude-3-5-haiku` (fast, great)\n`google/gemini-flash-1.5` (fast)\n`meta-llama/llama-3.1-8b-instruct:free` (free)"
        ).catch(() => {});
        return;
      }
      config.model = model;
      await saveConfig(config);
      await message.reply(`✅ Model set to \`${model}\`.`).catch(() => {});
      break;
    }

    case "name": {
      const name = parts.slice(2).join(" ");
      if (!name) {
        await message.reply("❌ Usage: `?chatbot name <name>`").catch(() => {});
        return;
      }
      config.botName = name;
      await saveConfig(config);
      await message.reply(`✅ Bot persona name set to **${name}**.`).catch(() => {});
      break;
    }

    case "prompt": {
      const prompt = parts.slice(2).join(" ");
      if (!prompt) {
        await message.reply("❌ Usage: `?chatbot prompt <text>` — adds extra personality instructions.\nExample: `?chatbot prompt You're obsessed with Minecraft and always bring it up.`").catch(() => {});
        return;
      }
      config.customPrompt = prompt;
      await saveConfig(config);
      await message.reply(`✅ Custom personality prompt set.`).catch(() => {});
      break;
    }

    case "ignore": {
      const target = message.mentions.users.first();
      if (!target) {
        await message.reply("❌ Usage: `?chatbot ignore @user`").catch(() => {});
        return;
      }
      if (!config.ignoredUsers.includes(target.id)) {
        config.ignoredUsers.push(target.id);
        await saveConfig(config);
      }
      await message.reply(`✅ **${target.username}** will now be ignored by the chatbot.`).catch(() => {});
      break;
    }

    case "unignore": {
      const target = message.mentions.users.first();
      if (!target) {
        await message.reply("❌ Usage: `?chatbot unignore @user`").catch(() => {});
        return;
      }
      const idx = config.ignoredUsers.indexOf(target.id);
      if (idx !== -1) config.ignoredUsers.splice(idx, 1);
      await saveConfig(config);
      await message.reply(`✅ **${target.username}** is no longer ignored.`).catch(() => {});
      break;
    }

    case "memory": {
      const serverMem = await getServerMemory(guildId);
      const targetUser = message.mentions.users.first();
      if (targetUser) {
        const userMem = await getUserMemory(guildId, targetUser.id);
        await message.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🧠 Memory — ${targetUser.username}`)
            .addFields(
              { name: "Nickname", value: userMem.nickname ?? "Not set", inline: true },
              { name: "Personality", value: userMem.personality || "Unknown", inline: true },
              { name: "Interests", value: userMem.interests.join(", ") || "None recorded" },
              { name: "Notes", value: userMem.notes.join("\n") || "None" },
            )
          ],
        }).catch(() => {});
      } else {
        await message.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle("🧠 Server Memory")
            .addFields(
              { name: "Inside Jokes", value: serverMem.insideJokes.join("\n") || "None recorded" },
              { name: "Frequent Topics", value: serverMem.frequentTopics.join(", ") || "None" },
              { name: "Events", value: serverMem.events.join("\n") || "None" },
              { name: "Notes", value: serverMem.notes.join("\n") || "None" },
            )
            .setFooter({ text: "?chatbot memory @user to see user-specific memory" })
          ],
        }).catch(() => {});
      }
      break;
    }

    case "clearmemory": {
      await clearServerMemory(guildId);
      await message.reply("🧹 Server memory cleared.").catch(() => {});
      break;
    }

    case "help":
    default: {
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle("🤖 Chatbot — Commands")
          .setDescription("All commands require **Administrator** permission.")
          .addFields({
            name: "Setup",
            value: [
              "`?chatbot enable` / `e` — enable in current channel",
              "`?chatbot disable` / `d` — disable in current channel",
              "`?chatbot status` — view current config",
            ].join("\n"),
          }, {
            name: "Personality",
            value: [
              "`?chatbot respond <0-100>` — response rate (default: 15%)",
              "`?chatbot model <model>` — set AI model",
              "`?chatbot name <name>` — set bot persona name",
              "`?chatbot prompt <text>` — add custom personality instructions",
            ].join("\n"),
          }, {
            name: "Users",
            value: [
              "`?chatbot ignore @user` — bot won't reply to this user",
              "`?chatbot unignore @user` — re-enable replies for user",
            ].join("\n"),
          }, {
            name: "Memory",
            value: [
              "`?chatbot memory` — view server memory",
              "`?chatbot memory @user` — view user memory",
              "`?chatbot clearmemory` — clear server memory",
            ].join("\n"),
          }, {
            name: "Models (requires OPENROUTER_API_KEY)",
            value: [
              "`openai/gpt-4o-mini` — default, fast & cheap",
              "`openai/gpt-4o` — smarter",
              "`anthropic/claude-3-5-haiku` — fast, great personality",
              "`google/gemini-flash-1.5` — fast",
              "`meta-llama/llama-3.1-8b-instruct:free` — free tier",
            ].join("\n"),
          })
          .setFooter({ text: "Set OPENROUTER_API_KEY for best results" })
        ],
      }).catch(() => {});
    }
  }
}
