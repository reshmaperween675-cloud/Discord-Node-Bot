import { Message, EmbedBuilder, TextChannel } from "discord.js";

const CATEGORIES = ["waifu", "neko", "trap", "blowjob", "anal"] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchNsfwGif(category: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.waifu.pics/nsfw/${category}`);
    if (!res.ok) return null;
    const data = await res.json() as { url: string };
    return data.url ?? null;
  } catch {
    return null;
  }
}

export async function handleNsfwCommand(message: Message): Promise<void> {
  const channel = message.channel as TextChannel;

  if (!("nsfw" in channel) || !channel.nsfw) {
    await message.reply("🔞 This command can only be used in NSFW channels.");
    return;
  }

  const category = pick(CATEGORIES);
  const url = await fetchNsfwGif(category);

  if (!url) {
    await message.reply("❌ Couldn't fetch a gif right now. Try again.");
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xff0055)
    .setImage(url)
    .setFooter({ text: `🔞 ${category}` });

  await message.reply({ embeds: [embed] });
}
