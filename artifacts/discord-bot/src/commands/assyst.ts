import type { Message } from "discord.js";
import { EmbedBuilder } from "discord.js";

// ─── Assyst-style commands ────────────────────────────────────────────────────
// Prefix: `?` and `,`  (both work for every command)
// Source-faithful to assyst2 — text/fun/misc commands that don't need the
// external Rust flux image processor.

// ─── 8-ball ───────────────────────────────────────────────────────────────────
const BALL_ANSWERS = [
  "It is certain.", "It is decidedly so.", "Without a doubt.",
  "Yes, definitely.", "You may rely on it.", "As I see it, yes.",
  "Most likely.", "Outlook good.", "Yes.", "Signs point to yes.",
  "Reply hazy, try again.", "Ask again later.", "Better not tell you now.",
  "Cannot predict now.", "Concentrate and ask again.",
  "Don't count on it.", "My reply is no.", "My sources say no.",
  "Outlook not so good.", "Very doubtful.",
];

export async function cmdEightBall(message: Message, args: string[]): Promise<void> {
  const q = args.join(" ").trim();
  if (!q) { await message.reply("Ask me something! `?8b <question>`"); return; }
  const answer = BALL_ANSWERS[Math.floor(Math.random() * BALL_ANSWERS.length)];
  const positive = BALL_ANSWERS.indexOf(answer) < 10;
  const neutral  = BALL_ANSWERS.indexOf(answer) < 15;
  const color = positive ? 0x57f287 : neutral ? 0xfee75c : 0xed4245;
  const e = new EmbedBuilder()
    .setColor(color)
    .setTitle("🎱 Magic 8-Ball")
    .addFields(
      { name: "Question", value: q },
      { name: "Answer",   value: answer },
    );
  await message.reply({ embeds: [e] });
}

// ─── owoify ───────────────────────────────────────────────────────────────────
export async function cmdOwoify(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?owoify <text>`"); return; }
  const result = text
    .replace(/[rl]/g, "w").replace(/[RL]/g, "W")
    .replace(/n([aeiouAEIOU])/g, "ny$1").replace(/N([aeiouAEIOU])/g, "Ny$1")
    .replace(/ove/g, "uv")
    .replace(/!+/g, " owo!").replace(/\. /g, " uwu. ");
  const faces = ["(・`ω´・)", ";;w;;", "owo", "UwU", ">w<", "^w^"];
  await message.reply(`${result} ${faces[Math.floor(Math.random() * faces.length)]}`);
}

// ─── reverse ──────────────────────────────────────────────────────────────────
export async function cmdReverse(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?reverse <text>`"); return; }
  await message.reply([...text].reverse().join(""));
}

// ─── mock (spongebob) ─────────────────────────────────────────────────────────
export async function cmdMock(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?mock <text>`"); return; }
  let out = "";
  let upper = false;
  for (const ch of text) {
    out += upper ? ch.toUpperCase() : ch.toLowerCase();
    if (ch.trim()) upper = !upper;
  }
  await message.reply(out);
}

// ─── clap ─────────────────────────────────────────────────────────────────────
export async function cmdClap(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?clap <text>`"); return; }
  await message.reply(text.split(" ").join(" 👏 "));
}

// ─── upper ────────────────────────────────────────────────────────────────────
export async function cmdUpper(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?upper <text>`"); return; }
  await message.reply(text.toUpperCase());
}

// ─── lower ────────────────────────────────────────────────────────────────────
export async function cmdLower(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  if (!text) { await message.reply("Usage: `?lower <text>`"); return; }
  await message.reply(text.toLowerCase());
}

// ─── roll ─────────────────────────────────────────────────────────────────────
export async function cmdRoll(message: Message, args: string[]): Promise<void> {
  const input = args[0] ?? "6";
  // Support NdM format (e.g. 2d6)
  const diceMatch = /^(\d+)d(\d+)$/.exec(input);
  if (diceMatch) {
    const count = Math.min(Number(diceMatch[1]), 20);
    const sides = Math.min(Number(diceMatch[2]), 1000);
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((s, v) => s + v, 0);
    await message.reply(`🎲 **${rolls.join(", ")}** (total: **${total}**)`);
    return;
  }
  const max = Math.min(Math.max(Number(input) || 6, 2), 1_000_000);
  const result = Math.floor(Math.random() * max) + 1;
  await message.reply(`🎲 **${result}** / ${max}`);
}

// ─── choose ───────────────────────────────────────────────────────────────────
export async function cmdChoose(message: Message, args: string[]): Promise<void> {
  const text = args.join(" ");
  const options = text.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  if (options.length < 2) { await message.reply("Usage: `?choose option1, option2, option3`"); return; }
  const pick = options[Math.floor(Math.random() * options.length)];
  await message.reply(`🤔 I choose... **${pick}**`);
}

// ─── color ────────────────────────────────────────────────────────────────────
export async function cmdColor(message: Message, args: string[]): Promise<void> {
  let hex = args[0]?.replace("#", "") ?? "";
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    await message.reply("Usage: `?color <hex>` — e.g. `?color FF5733`");
    return;
  }
  const num = parseInt(hex, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8)  & 255;
  const b = num & 255;
  const e = new EmbedBuilder()
    .setColor(num)
    .setTitle(`🎨 #${hex.toUpperCase()}`)
    .addFields(
      { name: "Hex",  value: `#${hex.toUpperCase()}`, inline: true },
      { name: "RGB",  value: `rgb(${r}, ${g}, ${b})`, inline: true },
      { name: "Int",  value: String(num),              inline: true },
    )
    .setThumbnail(`https://singlecolorimage.com/get/${hex}/100x100`);
  await message.reply({ embeds: [e] });
}

// ─── avatar ───────────────────────────────────────────────────────────────────
export async function cmdAvatar(message: Message): Promise<void> {
  const target = message.mentions.users.first() ?? message.author;
  const url = target.displayAvatarURL({ size: 1024, extension: "png" });
  const e = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${target.username}'s Avatar`)
    .setImage(url)
    .setURL(url);
  await message.reply({ embeds: [e] });
}

// ─── serverinfo ───────────────────────────────────────────────────────────────
export async function cmdServerInfo(message: Message): Promise<void> {
  const guild = message.guild;
  if (!guild) { await message.reply("This command can only be used in a server."); return; }
  const e = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
    .addFields(
      { name: "Owner",    value: `<@${guild.ownerId}>`,              inline: true },
      { name: "Members",  value: String(guild.memberCount),          inline: true },
      { name: "Channels", value: String(guild.channels.cache.size),  inline: true },
      { name: "Roles",    value: String(guild.roles.cache.size),     inline: true },
      { name: "Created",  value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      { name: "ID",       value: guild.id,                           inline: true },
    );
  await message.reply({ embeds: [e] });
}

// ─── userinfo ─────────────────────────────────────────────────────────────────
export async function cmdUserInfo(message: Message): Promise<void> {
  const target = message.mentions.users.first() ?? message.author;
  const member = message.guild?.members.cache.get(target.id);
  const e = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${target.username}`)
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "ID",       value: target.id,                                              inline: true },
      { name: "Bot",      value: target.bot ? "Yes" : "No",                              inline: true },
      { name: "Created",  value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`,  inline: true },
    );
  if (member) {
    e.addFields(
      { name: "Joined",   value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : "Unknown", inline: true },
      { name: "Nickname", value: member.nickname ?? "None", inline: true },
      { name: "Top Role", value: member.roles.highest.toString(), inline: true },
    );
  }
  await message.reply({ embeds: [e] });
}

// ─── ping ─────────────────────────────────────────────────────────────────────
export async function cmdPing(message: Message): Promise<void> {
  const start = Date.now();
  const m = await message.reply("🏓 Pong!");
  await m.edit(`🏓 Pong! \`${Date.now() - start}ms\``);
}

// ─── remindme ─────────────────────────────────────────────────────────────────
const pendingReminders = new Map<ReturnType<typeof setTimeout>, true>();
export async function cmdRemind(message: Message, args: string[]): Promise<void> {
  const timeStr = args[0];
  const reminder = args.slice(1).join(" ");
  if (!timeStr || !reminder) {
    await message.reply("Usage: `?remindme <time> <message>` — e.g. `?remindme 10m check pizza`\nSupported: `s` (seconds), `m` (minutes), `h` (hours)");
    return;
  }
  const match = /^(\d+)(s|m|h)$/.exec(timeStr.toLowerCase());
  if (!match) {
    await message.reply("❌ Invalid time format. Use `10s`, `5m`, `2h` etc.");
    return;
  }
  const mult: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000 };
  const ms = Number(match[1]) * mult[match[2]];
  if (ms > 24 * 3_600_000) { await message.reply("❌ Max reminder time is 24 hours."); return; }

  await message.reply(`✅ I'll remind you in **${timeStr}**: *${reminder}*`);
  const t = setTimeout(async () => {
    pendingReminders.delete(t);
    await message.author.send(`⏰ **Reminder:** ${reminder}`).catch(async () => {
      if (message.channel && "send" in message.channel) {
        await (message.channel as import("discord.js").TextChannel).send(`⏰ <@${message.author.id}> Reminder: **${reminder}**`).catch(() => {});
      }
    });
  }, ms);
  pendingReminders.set(t, true);
}

// ─── translate (basic — calls MyMemory free API) ─────────────────────────────
export async function cmdTranslate(message: Message, args: string[]): Promise<void> {
  const lang = args[0];
  const text  = args.slice(1).join(" ");
  if (!lang || !text) {
    await message.reply("Usage: `?translate <lang_code> <text>` — e.g. `?translate es hello world`");
    return;
  }
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(lang)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const json = await res.json() as { responseData?: { translatedText?: string }; responseStatus?: number };
    const translated = json?.responseData?.translatedText;
    if (!translated || json.responseStatus !== 200) {
      await message.reply("❌ Translation failed. Check the language code and try again.");
      return;
    }
    await message.reply(`🌐 **${lang.toUpperCase()}:** ${translated}`);
  } catch {
    await message.reply("❌ Translation service unavailable right now.");
  }
}

// ─── define ───────────────────────────────────────────────────────────────────
export async function cmdDefine(message: Message, args: string[]): Promise<void> {
  const word = args[0];
  if (!word) { await message.reply("Usage: `?define <word>`"); return; }
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) { await message.reply(`❌ No definition found for **${word}**.`); return; }
    const data = await res.json() as Array<{ meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string }> }> }>;
    const meaning = data?.[0]?.meanings?.[0];
    const def = meaning?.definitions?.[0];
    if (!def?.definition) { await message.reply(`❌ No definition found for **${word}**.`); return; }
    const e = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📖 ${word}`)
      .setDescription(`**${meaning?.partOfSpeech ?? ""}**\n${def.definition}`)
      .setFooter({ text: "via dictionaryapi.dev" });
    if (def.example) e.addFields({ name: "Example", value: `*${def.example}*` });
    await message.reply({ embeds: [e] });
  } catch {
    await message.reply("❌ Dictionary service unavailable right now.");
  }
}

// ─── coinflip ─────────────────────────────────────────────────────────────────
export async function cmdCoinflip(message: Message): Promise<void> {
  const result = Math.random() < 0.5 ? "🪙 Heads" : "🌑 Tails";
  await message.reply(`**${result}**!`);
}

// ─── dice ─────────────────────────────────────────────────────────────────────
export async function cmdDice(message: Message, args: string[]): Promise<void> {
  return cmdRoll(message, args);
}

// ─── enlarge (repost/reupload an image) ───────────────────────────────────────
export async function cmdEnlarge(message: Message): Promise<void> {
  const attach = message.attachments.first();
  const url = attach?.url ?? message.mentions.users.first()?.displayAvatarURL({ size: 4096, extension: "png" });
  if (!url) {
    await message.reply("Attach an image or mention a user to enlarge their avatar.");
    return;
  }
  const e = new EmbedBuilder().setImage(url).setColor(0x2f3136);
  await message.reply({ embeds: [e] });
}

// ─── tag system ───────────────────────────────────────────────────────────────
const tagStore = new Map<string, string>();
export async function cmdTag(message: Message, args: string[]): Promise<void> {
  const sub = args[0]?.toLowerCase();
  if (!sub) {
    const keys = [...tagStore.keys()];
    if (keys.length === 0) { await message.reply("No tags yet. Create one: `?tag create <name> <content>`"); return; }
    await message.reply(`**Tags:** ${keys.map((k) => `\`${k}\``).join(", ")}`);
    return;
  }
  if (sub === "create" || sub === "add") {
    const name = args[1]?.toLowerCase();
    const content = args.slice(2).join(" ");
    if (!name || !content) { await message.reply("Usage: `?tag create <name> <content>`"); return; }
    tagStore.set(name, content);
    await message.reply(`✅ Tag \`${name}\` created!`);
    return;
  }
  if (sub === "delete" || sub === "remove") {
    const name = args[1]?.toLowerCase();
    if (!name || !tagStore.has(name)) { await message.reply(`❌ Tag not found.`); return; }
    tagStore.delete(name);
    await message.reply(`✅ Tag \`${name}\` deleted.`);
    return;
  }
  const content = tagStore.get(sub);
  if (!content) { await message.reply(`❌ Tag \`${sub}\` not found.`); return; }
  await message.reply(content);
}

// ─── help ─────────────────────────────────────────────────────────────────────
export async function cmdAssystHelp(message: Message): Promise<void> {
  const e = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📖 Assyst Commands")
    .setDescription("Both `?` and `,` prefixes work for all commands.")
    .addFields(
      { name: "🎱 Fun",      value: "`8b` `owoify` `mock` `clap` `reverse` `upper` `lower` `coinflip` `roll` `choose` `ship`" },
      { name: "🔍 Info",     value: "`avatar` `serverinfo` `userinfo` `color` `define` `translate`" },
      { name: "🔧 Utility",  value: "`ping` `remindme` `tag` `enlarge` `help`" },
      { name: "💥 Fun",      value: "`nuke` — *you know what this does*" },
    )
    .setFooter({ text: "Assyst-inspired commands" });
  await message.reply({ embeds: [e] });
}

// ─── MAIN ASSYST ROUTER ───────────────────────────────────────────────────────
type AssystHandler = (message: Message, args: string[]) => Promise<void>;

const ASSYST_HANDLERS: Record<string, AssystHandler> = {
  "8b":        cmdEightBall,   "8ball":     cmdEightBall,
  owoify:      cmdOwoify,
  reverse:     cmdReverse,     rev:         cmdReverse,
  mock:        cmdMock,        spongebob:   cmdMock,
  clap:        cmdClap,
  upper:       cmdUpper,       uppercase:   cmdUpper,
  lower:       cmdLower,       lowercase:   cmdLower,
  roll:        cmdRoll,        dice:        cmdDice,
  choose:      cmdChoose,      pick:        cmdChoose,
  color:       cmdColor,       colour:      cmdColor,
  avatar:      cmdAvatar,      av:          cmdAvatar,  pfp: cmdAvatar,
  serverinfo:  cmdServerInfo,  si:          cmdServerInfo,
  userinfo:    cmdUserInfo,    ui:          cmdUserInfo,
  ping:        cmdPing,
  remindme:    cmdRemind,      remind:      cmdRemind,
  translate:   cmdTranslate,   tr:          cmdTranslate,
  define:      cmdDefine,      def:         cmdDefine,
  coinflip:    cmdCoinflip,    cf:          cmdCoinflip,
  enlarge:     cmdEnlarge,     e:           cmdEnlarge,   repost: cmdEnlarge,
  tag:         cmdTag,
  help:        cmdAssystHelp,
};

export async function handleAssystCommand(message: Message): Promise<boolean> {
  const content = message.content.trim();

  let body: string;
  if (content.startsWith("?") && !content.startsWith("? ")) {
    body = content.slice(1).trim();
  } else if (content.startsWith(",") && !content.startsWith(", ")) {
    body = content.slice(1).trim();
  } else {
    return false;
  }

  if (!body) return false;

  const parts = body.split(/\s+/);
  const sub = parts.shift()!.toLowerCase();
  const args = parts;

  // ?nuke is handled separately in index.ts — skip it here
  if (sub === "nuke") return false;

  const handler = ASSYST_HANDLERS[sub];
  if (!handler) return false;

  try {
    await handler(message, args);
  } catch (err) {
    console.error("[ASSYST]", sub, err);
    await message.reply("⚠️ Something went wrong.").catch(() => {});
  }
  return true;
}
