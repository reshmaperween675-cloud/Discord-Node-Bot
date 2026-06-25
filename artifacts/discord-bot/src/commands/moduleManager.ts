import { Message, EmbedBuilder, TextChannel, NewsChannel, ThreadChannel } from "discord.js";
import { getPool } from "../persistence.js";

export interface CustomModule {
  prefix: string;
  command: string;
  message: string;
  reply: boolean;
  embed: boolean;
}

type ModuleRow = { modules: CustomModule[] };

const KV_KEY = (guildId: string) => `custom_modules:${guildId}`;

async function loadModules(guildId: string): Promise<CustomModule[]> {
  const db = getPool();
  const res = await db.query<{ value: ModuleRow }>(
    "SELECT value FROM bot_kv WHERE key = $1",
    [KV_KEY(guildId)]
  );
  return res.rows[0]?.value?.modules ?? [];
}

async function saveModules(guildId: string, modules: CustomModule[]): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO bot_kv (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [KV_KEY(guildId), JSON.stringify({ modules })]
  );
}

function isAdmin(message: Message): boolean {
  return !!message.member?.permissions.has("Administrator");
}

function parseBool(token: string | undefined, fallback: boolean): boolean {
  if (token === "true") return true;
  if (token === "false") return false;
  return fallback;
}

export async function handleModuleCommand(message: Message): Promise<void> {
  if (!message.guild) {
    await message.reply("This command can only be used in a server.").catch(() => {});
    return;
  }

  if (!isAdmin(message)) {
    await message.reply("❌ You need **Administrator** permission to manage modules.").catch(() => {});
    return;
  }

  const content = message.content.trim();
  const parts = content.split(/\s+/);
  const sub = parts[1]?.toLowerCase();

  if (sub === "create") {
    await handleCreate(message, parts.slice(2));
  } else if (sub === "list") {
    await handleList(message);
  } else if (sub === "delete") {
    await handleDelete(message, parts.slice(2));
  } else {
    await message.reply(
      "**Module Manager — Usage:**\n" +
      "`?m create <prefix> <command> <message> [reply: true/false] [embed: true/false]`\n" +
      "`?m list` — Show all custom modules\n" +
      "`?m delete <prefix> <command>` — Remove a module\n\n" +
      "**Examples:**\n" +
      "`?m create ? raahh RAAHH!! true false`\n" +
      "`?m create ~ nuke you got nuked lol true true`"
    ).catch(() => {});
  }
}

async function handleCreate(message: Message, args: string[]): Promise<void> {
  if (args.length < 3) {
    await message.reply(
      "❌ Not enough arguments.\n" +
      "Usage: `?m create <prefix> <command> <message> [reply: true/false] [embed: true/false]`\n" +
      "Example: `?m create ? raahh RAAHH!! true false`"
    ).catch(() => {});
    return;
  }

  const prefix = args[0];
  const command = args[1];

  let remaining = args.slice(2);

  let embed = false;
  let reply = true;

  if (remaining.length >= 1 && (remaining[remaining.length - 1] === "true" || remaining[remaining.length - 1] === "false")) {
    embed = parseBool(remaining[remaining.length - 1], false);
    remaining = remaining.slice(0, -1);
  }

  if (remaining.length >= 1 && (remaining[remaining.length - 1] === "true" || remaining[remaining.length - 1] === "false")) {
    reply = parseBool(remaining[remaining.length - 1], true);
    remaining = remaining.slice(0, -1);
  }

  const msg = remaining.join(" ");

  if (!msg) {
    await message.reply("❌ Message cannot be empty.").catch(() => {});
    return;
  }

  const trigger = prefix + command;
  if (trigger.length > 50) {
    await message.reply("❌ Prefix + command combined must be 50 characters or less.").catch(() => {});
    return;
  }

  const guildId = message.guild!.id;
  const modules = await loadModules(guildId);

  const existing = modules.findIndex(
    (m) => m.prefix === prefix && m.command.toLowerCase() === command.toLowerCase()
  );

  const mod: CustomModule = { prefix, command, message: msg, reply, embed };

  if (existing !== -1) {
    modules[existing] = mod;
    await saveModules(guildId, modules);
    await message.reply(
      `✅ Module \`${trigger}\` updated.\n` +
      `> Message: **${msg}**\n` +
      `> Reply: \`${reply}\` · Embed: \`${embed}\``
    ).catch(() => {});
  } else {
    modules.push(mod);
    await saveModules(guildId, modules);
    await message.reply(
      `✅ Module \`${trigger}\` created!\n` +
      `> Message: **${msg}**\n` +
      `> Reply: \`${reply}\` · Embed: \`${embed}\``
    ).catch(() => {});
  }
}

async function handleList(message: Message): Promise<void> {
  const guildId = message.guild!.id;
  const modules = await loadModules(guildId);

  if (modules.length === 0) {
    await message.reply("No custom modules created yet. Use `?m create` to add one.").catch(() => {});
    return;
  }

  const lines = modules.map(
    (m, i) =>
      `\`${i + 1}.\` **${m.prefix}${m.command}** — "${m.message}" ` +
      `[reply: ${m.reply}, embed: ${m.embed}]`
  );

  const embed = new EmbedBuilder()
    .setTitle(`Custom Modules — ${message.guild!.name}`)
    .setDescription(lines.join("\n"))
    .setColor(0x2f3136)
    .setFooter({ text: `${modules.length} module${modules.length === 1 ? "" : "s"}` });

  await message.reply({ embeds: [embed] }).catch(() => {});
}

async function handleDelete(message: Message, args: string[]): Promise<void> {
  if (args.length < 2) {
    await message.reply("Usage: `?m delete <prefix> <command>`\nExample: `?m delete ? raahh`").catch(() => {});
    return;
  }

  const [prefix, command] = args;
  const guildId = message.guild!.id;
  const modules = await loadModules(guildId);

  const idx = modules.findIndex(
    (m) => m.prefix === prefix && m.command.toLowerCase() === command.toLowerCase()
  );

  if (idx === -1) {
    await message.reply(`❌ No module found for trigger \`${prefix}${command}\`.`).catch(() => {});
    return;
  }

  modules.splice(idx, 1);
  await saveModules(guildId, modules);
  await message.reply(`✅ Module \`${prefix}${command}\` deleted.`).catch(() => {});
}

export async function runCustomModules(message: Message): Promise<boolean> {
  if (!message.guild) return false;

  let modules: CustomModule[];
  try {
    modules = await loadModules(message.guild.id);
  } catch {
    return false;
  }

  const content = message.content;

  for (const mod of modules) {
    const trigger = mod.prefix + mod.command;
    if (!content.toLowerCase().startsWith(trigger.toLowerCase())) continue;

    const ch = message.channel;
    const canSend = "send" in ch && typeof (ch as TextChannel).send === "function";

    if (mod.embed) {
      const embed = new EmbedBuilder()
        .setDescription(mod.message)
        .setColor(0x2f3136);

      if (mod.reply) {
        await message.reply({ embeds: [embed] }).catch(() => {});
      } else if (canSend) {
        await (ch as TextChannel | NewsChannel | ThreadChannel).send({ embeds: [embed] }).catch(() => {});
      }
    } else {
      if (mod.reply) {
        await message.reply(mod.message).catch(() => {});
      } else if (canSend) {
        await (ch as TextChannel | NewsChannel | ThreadChannel).send(mod.message).catch(() => {});
      }
    }

    return true;
  }

  return false;
}
