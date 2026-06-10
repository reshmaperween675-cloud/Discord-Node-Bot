import { Message, EmbedBuilder, AttachmentBuilder } from "discord.js";
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let fontsRegistered = false;
let boldFontName = "Impact";

function registerFonts(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;
  try {
    const bold = resolve(__dirname, "../assets/NotoSans-Bold.ttf");
    if (existsSync(bold)) {
      GlobalFonts.registerFromPath(bold, "NotoSansBold");
      boldFontName = "NotoSansBold";
    }
  } catch { /* fonts optional */ }
}

// ── Find an image URL from the message or its reply ───────────────────────
async function findImageUrl(message: Message): Promise<string | null> {
  const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);

  // Current message attachments
  const attach = message.attachments.find(
    (a) => a.contentType?.startsWith("image/") || isImageUrl(a.url),
  );
  if (attach) return attach.url;

  // Replied-to message
  if (message.reference?.messageId) {
    try {
      const ref = await message.channel.messages.fetch(message.reference.messageId);
      const refAttach = ref.attachments.find(
        (a) => a.contentType?.startsWith("image/") || isImageUrl(a.url),
      );
      if (refAttach) return refAttach.url;
      for (const embed of ref.embeds) {
        if (embed.image?.url) return embed.image.url;
        if (embed.thumbnail?.url) return embed.thumbnail.url;
      }
    } catch { /* ignore fetch errors */ }
  }

  return null;
}

// ── Word-wrap helper ───────────────────────────────────────────────────────
function wrapText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ── Constants ─────────────────────────────────────────────────────────────
const MAX_IMG_W = 800;
const FONT_SIZE  = 38;
const PAD_X      = 28;
const PAD_Y      = 22;
const LINE_H     = Math.round(FONT_SIZE * 1.28);

// ── Main command handler ───────────────────────────────────────────────────
export async function handleCaptionCommand(message: Message): Promise<void> {
  const parts = message.content.trim().split(/\s+/);
  const captionText = parts.slice(1).join(" ").trim();

  if (!captionText) {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff4444)
          .setDescription(
            "❌ Provide caption text.\n" +
            "**Usage:** `?caption <text>` — reply to or attach an image.\n" +
            "**Example:** `?caption pov: what my lil bro watches`",
          ),
      ],
    });
    return;
  }

  const imageUrl = await findImageUrl(message);
  if (!imageUrl) {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff4444)
          .setDescription(
            "❌ No image found.\n" +
            "Attach an image to your message, or reply to a message that has one.",
          ),
      ],
    });
    return;
  }

  try {
    // Fetch source image
    const imgRes = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DiscordBot/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!imgRes.ok) throw new Error(`Image fetch: ${imgRes.status}`);
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());

    registerFonts();

    const srcImg = await loadImage(imgBuf);

    // Scale image so width ≤ MAX_IMG_W (height proportional)
    const scale  = srcImg.width > MAX_IMG_W ? MAX_IMG_W / srcImg.width : 1;
    const imgW   = Math.round(srcImg.width  * scale);
    const imgH   = Math.round(srcImg.height * scale);

    // Measure text → compute caption bar height
    const measureC = createCanvas(imgW, 50);
    const mctx     = measureC.getContext("2d");
    mctx.font = `bold ${FONT_SIZE}px "${boldFontName}"`;

    // Uppercase for that classic meme look
    const displayText = captionText.toUpperCase();
    const lines  = wrapText(mctx, displayText, imgW - PAD_X * 2);
    const barH   = PAD_Y * 2 + lines.length * LINE_H;

    // Compose final canvas: caption bar on top, image below
    const canvas = createCanvas(imgW, barH + imgH);
    const ctx    = canvas.getContext("2d");

    // White caption bar
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, imgW, barH);

    // Bold black text, centered
    ctx.fillStyle    = "#000000";
    ctx.font         = `bold ${FONT_SIZE}px "${boldFontName}"`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], imgW / 2, PAD_Y + i * LINE_H);
    }

    // Source image below the bar
    ctx.drawImage(srcImg, 0, barH, imgW, imgH);

    const outBuf = canvas.toBuffer("image/png");
    const file   = new AttachmentBuilder(outBuf, { name: "caption.png" });
    await message.reply({ files: [file] });

  } catch (err) {
    console.error("[CAPTION]", err);
    await message.reply("❌ Couldn't generate caption. Try again in a moment.");
  }
}
