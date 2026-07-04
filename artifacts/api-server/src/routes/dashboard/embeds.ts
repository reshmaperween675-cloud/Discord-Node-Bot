import { Router, type IRouter } from "express";
import { db, botKvTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { writeAuditLog } from "../../lib/audit.js";

const router: IRouter = Router();
router.use(requireAuth);

type EmbedFieldData = { name: string; value: string; inline: boolean };
type EmbedData = {
  id: string;
  module: string;
  title: string | null;
  description: string | null;
  color: number | null;
  footer: string | null;
  thumbnail: string | null;
  image: string | null;
  fields: EmbedFieldData[];
};

// Default embed catalog — known embeds across all modules
const DEFAULT_EMBEDS: EmbedData[] = [
  { id: "leveling.rank", module: "Leveling", title: "Rank Card", description: "{user} is level **{level}** with **{xp}** XP.", color: 0x5865f2, footer: "Keep chatting to level up!", thumbnail: null, image: null, fields: [{ name: "XP Progress", value: "{xp}/{nextXp}", inline: true }, { name: "Server Rank", value: "#{rank}", inline: true }] },
  { id: "leveling.levelup", module: "Leveling", title: "Level Up!", description: "Congratulations {user}! You reached **Level {level}**!", color: 0xffd700, footer: null, thumbnail: null, image: null, fields: [] },
  { id: "leveling.leaderboard", module: "Leveling", title: "XP Leaderboard", description: "Top members by XP in this server.", color: 0x5865f2, footer: "Page {page}/{total}", thumbnail: null, image: null, fields: [] },
  { id: "utility.warn", module: "Moderation", title: "Warning Issued", description: "{moderator} warned {user}.", color: 0xff9800, footer: "Warning #{count}", thumbnail: null, image: null, fields: [{ name: "Reason", value: "{reason}", inline: false }] },
  { id: "utility.announce", module: "Utility", title: "Announcement", description: "{content}", color: 0x5865f2, footer: "Announced by {author}", thumbnail: null, image: null, fields: [] },
  { id: "utility.poll", module: "Utility", title: "{question}", description: "React to vote!", color: 0x2f3136, footer: "Poll by {author}", thumbnail: null, image: null, fields: [] },
  { id: "utility.attendance", module: "Utility", title: "Attendance Marked", description: "Attendance recorded for {user}.", color: 0x57f287, footer: null, thumbnail: null, image: null, fields: [{ name: "Event", value: "{event}", inline: true }] },
  { id: "raids.start", module: "Raids", title: "Raid Started", description: "A raid has begun against **{opponent}**!", color: 0xed4245, footer: null, thumbnail: null, image: null, fields: [{ name: "Raid #", value: "{number}", inline: true }, { name: "Started By", value: "{author}", inline: true }] },
  { id: "raids.end", module: "Raids", title: "Raid Ended", description: "The raid against **{opponent}** has concluded.", color: 0x57f287, footer: null, thumbnail: null, image: null, fields: [{ name: "Result", value: "{result}", inline: true }, { name: "Top Performers", value: "{performers}", inline: false }] },
  { id: "training.end", module: "Training", title: "Training Session Complete", description: "Training session #{number} has ended.", color: 0x00b0f4, footer: "Hosted by {host}", thumbnail: null, image: null, fields: [{ name: "Duration", value: "{duration}", inline: true }, { name: "MVP", value: "{mvp}", inline: true }] },
  { id: "tournament.open", module: "Tournaments", title: "{about}", description: "{rules}", color: 0xffd700, footer: "Tournament by {host}", thumbnail: null, image: null, fields: [{ name: "Date", value: "{date}", inline: true }, { name: "Prize", value: "{prize}", inline: true }, { name: "Max Participants", value: "{max}", inline: true }] },
  { id: "lowo.hunt", module: "Lowo", title: "Hunting Results", description: "You went on a hunt!", color: 0x57f287, footer: "Use lowo zoo to see your animals", thumbnail: null, image: null, fields: [{ name: "Found", value: "{animals}", inline: true }] },
  { id: "lowo.battle", module: "Lowo", title: "Battle!", description: "{user1} challenges {user2}!", color: 0xed4245, footer: null, thumbnail: null, image: null, fields: [{ name: "Winner", value: "{winner}", inline: true }] },
  { id: "lowo.profile", module: "Lowo", title: "{username}'s Profile", description: null, color: 0x5865f2, footer: null, thumbnail: null, image: null, fields: [{ name: "Cowoncy", value: "{balance}", inline: true }, { name: "Level", value: "{level}", inline: true }, { name: "Animals", value: "{count}", inline: true }] },
  { id: "lowo.slots", module: "Lowo", title: "Slot Machine", description: "{result}", color: 0xffd700, footer: null, thumbnail: null, image: null, fields: [{ name: "Wager", value: "{wager}", inline: true }, { name: "Payout", value: "{payout}", inline: true }] },
  { id: "mewo.ai", module: "Mewo", title: "AI Response", description: "{response}", color: 0x5865f2, footer: "Powered by {model}", thumbnail: null, image: null, fields: [] },
  { id: "mewo.help", module: "Mewo", title: "Mewo Help", description: "Available modules and commands.", color: 0x5865f2, footer: "mewo help <module> for details", thumbnail: null, image: null, fields: [] },
  { id: "antinuke.alert", module: "Anti-Nuke", title: "Anti-Nuke Alert", description: "Suspicious activity detected from {user}.", color: 0xed4245, footer: null, thumbnail: null, image: null, fields: [{ name: "Action", value: "{action}", inline: true }, { name: "Count", value: "{count}/{threshold}", inline: true }] },
  { id: "verification.success", module: "Verification", title: "Verification Complete", description: "Welcome, {user}! You have been verified.", color: 0x57f287, footer: null, thumbnail: null, image: null, fields: [] },
  { id: "economy.balance", module: "Economy", title: "{user}'s Balance", description: null, color: 0xffd700, footer: null, thumbnail: null, image: null, fields: [{ name: "Wallet", value: "${wallet}", inline: true }, { name: "Bank", value: "${bank}", inline: true }, { name: "Total", value: "${total}", inline: true }] },
];

async function getOverride(id: string): Promise<Partial<EmbedData> | null> {
  const row = await db
    .select()
    .from(botKvTable)
    .where(eq(botKvTable.key, `dashboard:embed:${id}`))
    .limit(1);
  return row[0] ? (row[0].value as Partial<EmbedData>) : null;
}

function mergeEmbed(base: EmbedData, override: Partial<EmbedData> | null, lastModifiedAt?: Date, lastModifiedBy?: string) {
  return {
    id: base.id,
    module: base.module,
    title: override?.title !== undefined ? override.title : base.title,
    description: override?.description !== undefined ? override.description : base.description,
    color: override?.color !== undefined ? override.color : base.color,
    footer: override?.footer !== undefined ? override.footer : base.footer,
    thumbnail: override?.thumbnail !== undefined ? override.thumbnail : base.thumbnail,
    image: override?.image !== undefined ? override.image : base.image,
    fields: override?.fields !== undefined ? override.fields : base.fields,
    isDefault: override === null,
    lastModified: lastModifiedAt ? lastModifiedAt.toISOString() : null,
    lastModifiedBy: lastModifiedBy ?? null,
  };
}

router.get("/embeds", async (req, res): Promise<void> => {
  try {
    const overrideRows = await db
      .select()
      .from(botKvTable)
      .where(sql`${botKvTable.key} LIKE 'dashboard:embed:%'`);

    const overrideMap = new Map(
      overrideRows.map((r: typeof overrideRows[0]) => [r.key.replace("dashboard:embed:", ""), { value: r.value as Partial<EmbedData>, updatedAt: r.updatedAt }]),
    );

    const embeds = DEFAULT_EMBEDS.map((base) => {
      const ov = overrideMap.get(base.id);
      return mergeEmbed(base, ov?.value ?? null, ov?.updatedAt ?? undefined);
    });

    res.json(embeds);
  } catch (err) {
    req.log.error({ err }, "Failed to list embeds");
    res.status(500).json({ error: "Failed to list embeds" });
  }
});

router.get("/embeds/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = decodeURIComponent(rawId);
  const base = DEFAULT_EMBEDS.find((e) => e.id === id);
  if (!base) {
    res.status(404).json({ error: "Embed not found" });
    return;
  }
  const override = await getOverride(id);
  res.json(mergeEmbed(base, override));
});

router.put("/embeds/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = decodeURIComponent(rawId);
  const base = DEFAULT_EMBEDS.find((e) => e.id === id);
  if (!base) {
    res.status(404).json({ error: "Embed not found" });
    return;
  }

  const key = `dashboard:embed:${id}`;
  const existingRow = await db.select().from(botKvTable).where(eq(botKvTable.key, key)).limit(1);
  const before = existingRow[0]?.value ?? {};

  const updated = req.body as Partial<EmbedData>;

  await db
    .insert(botKvTable)
    .values({ key, value: updated })
    .onConflictDoUpdate({ target: botKvTable.key, set: { value: updated } });

  await writeAuditLog({
    action: `embed.updated:${id}`,
    userId: req.session.userId!,
    username: req.session.username!,
    before: before as Record<string, unknown>,
    after: updated as Record<string, unknown>,
  });

  res.json(mergeEmbed(base, updated, new Date(), req.session.username));
});

router.delete("/embeds/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = decodeURIComponent(rawId);
  const key = `dashboard:embed:${id}`;

  const existingRow = await db.select().from(botKvTable).where(eq(botKvTable.key, key)).limit(1);
  if (existingRow[0]) {
    await db.delete(botKvTable).where(eq(botKvTable.key, key));
    await writeAuditLog({
      action: `embed.reset:${id}`,
      userId: req.session.userId!,
      username: req.session.username!,
      before: existingRow[0].value as Record<string, unknown>,
      after: {},
    });
  }

  res.json({ ok: true, message: "Embed reset to default" });
});

export default router;
