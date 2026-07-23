import type { Message, Guild, GuildMember, Role } from "discord.js";
import { PermissionFlagsBits } from "discord.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function parseDuration(str: string): number | null {
  const map: Record<string, number> = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000 };
  const re = /(\d+)\s*([dhms])/gi;
  let ms = 0, found = false;
  let match: RegExpExecArray | null;
  while ((match = re.exec(str)) !== null) {
    found = true;
    ms += parseInt(match[1], 10) * (map[match[2].toLowerCase()] ?? 0);
  }
  return found ? ms : null;
}

async function resolveMember(guild: Guild, arg: string): Promise<GuildMember | null> {
  const id = arg.replace(/[<@!>]/g, "");
  if (!id || !/^\d+$/.test(id)) return null;
  try { return await guild.members.fetch(id); } catch { return null; }
}

async function resolveRole(guild: Guild, arg: string): Promise<Role | null> {
  const mentionId = arg.match(/^<@&(\d+)>$/)?.[1];
  if (mentionId) return guild.roles.cache.get(mentionId) ?? null;
  if (/^\d+$/.test(arg)) return guild.roles.cache.get(arg) ?? null;
  return guild.roles.cache.find(r => r.name.toLowerCase() === arg.toLowerCase()) ?? null;
}

function send(message: Message, text: string): void {
  (message.channel as { send: Function }).send({ content: text, allowedMentions: { parse: [] } }).catch(() => {});
}

function del(message: Message): void {
  message.delete().catch(() => {});
}

// ── ,kick <@user> [reason] ────────────────────────────────────────────────────
export async function handleKickCmd(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return;

  const args = message.content.trim().split(/\s+/).slice(1);
  del(message);

  if (!args[0]) { send(message, "Usage: ,kick <@user> [reason]"); return; }

  const target = await resolveMember(message.guild, args[0]);
  if (!target) { send(message, "user not found"); return; }
  if (!target.kickable) { send(message, "can't kick that user"); return; }

  const reason = args.slice(1).join(" ") || undefined;
  await target.kick(reason);
  send(message, `${target.user.username} kicked${reason ? ` — ${reason}` : ""}`);
}

// ── ,ban <@user> [reason] ─────────────────────────────────────────────────────
export async function handleBanCmd(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return;

  const args = message.content.trim().split(/\s+/).slice(1);
  del(message);

  if (!args[0]) { send(message, "Usage: ,ban <@user> [reason]"); return; }

  const target = await resolveMember(message.guild, args[0]);
  if (!target) { send(message, "user not found"); return; }
  if (!target.bannable) { send(message, "can't ban that user"); return; }

  const reason = args.slice(1).join(" ") || undefined;
  await target.ban({ reason });
  send(message, `${target.user.username} banned${reason ? ` — ${reason}` : ""}`);
}

// ── ,timeout / ,to <@user> <duration> [reason] ───────────────────────────────
export async function handleTimeoutCmd(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return;

  const args = message.content.trim().split(/\s+/).slice(1);
  del(message);

  if (args.length < 2) { send(message, "Usage: ,timeout <@user> <duration>  e.g. 30m, 1h, 2d"); return; }

  const target = await resolveMember(message.guild, args[0]);
  if (!target) { send(message, "user not found"); return; }

  const ms = parseDuration(args[1]);
  if (!ms || ms <= 0) { send(message, "invalid duration — use 30m, 1h, 2d etc."); return; }
  if (ms > 28 * 86_400_000) { send(message, "max timeout is 28 days"); return; }

  const reason = args.slice(2).join(" ") || undefined;
  await target.timeout(ms, reason);
  send(message, `${target.user.username} timed out for ${args[1]}${reason ? ` — ${reason}` : ""}`);
}

// ── ,removetimeout / ,rto <@user> ────────────────────────────────────────────
export async function handleRemoveTimeoutCmd(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return;

  const args = message.content.trim().split(/\s+/).slice(1);
  del(message);

  if (!args[0]) { send(message, "Usage: ,removetimeout <@user>"); return; }

  const target = await resolveMember(message.guild, args[0]);
  if (!target) { send(message, "user not found"); return; }

  await target.timeout(null);
  send(message, `timeout removed from ${target.user.username}`);
}

// ── ,role / ,r ───────────────────────────────────────────────────────────────
// ,role <@user> <role>            → add role to user
// ,role all <role>                → add role to every member
// ,role remove/r <@user> <role>  → remove role from user
// ,r <@user> <role>              → shortcut add
// ,r all <role>                  → shortcut all
// ,r remove/r <@user> <role>    → shortcut remove

export async function handleRoleCmd(message: Message): Promise<void> {
  if (!message.guild || !message.member) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return;

  const args = message.content.trim().split(/\s+/).slice(1);
  del(message);

  if (!args[0]) {
    send(message, "Usage:\n,role <@user> <role>\n,role all <role>\n,role remove <@user> <role>");
    return;
  }

  const sub = args[0].toLowerCase();

  // ── remove
  if (sub === "remove" || sub === "r") {
    if (args.length < 3) { send(message, "Usage: ,role remove <@user> <role>"); return; }
    const target = await resolveMember(message.guild, args[1]);
    if (!target) { send(message, "user not found"); return; }
    const role = await resolveRole(message.guild, args.slice(2).join(" "));
    if (!role) { send(message, "role not found"); return; }
    if (!target.roles.cache.has(role.id)) { send(message, `${target.user.username} doesn't have that role`); return; }
    await target.roles.remove(role);
    send(message, `${role.name} removed from ${target.user.username}`);
    return;
  }

  // ── all
  if (sub === "all") {
    if (!args[1]) { send(message, "Usage: ,role all <role>"); return; }
    const role = await resolveRole(message.guild, args.slice(1).join(" "));
    if (!role) { send(message, "role not found"); return; }
    const members = await message.guild.members.fetch();
    let count = 0;
    for (const [, m] of members) {
      if (!m.roles.cache.has(role.id)) {
        await m.roles.add(role).catch(() => {});
        count++;
      }
    }
    send(message, `${role.name} added to ${count} member${count !== 1 ? "s" : ""}`);
    return;
  }

  // ── add: ,role <@user> <role>
  if (args.length < 2) { send(message, "Usage: ,role <@user> <role>"); return; }
  const target = await resolveMember(message.guild, args[0]);
  if (!target) { send(message, "user not found"); return; }
  const role = await resolveRole(message.guild, args.slice(1).join(" "));
  if (!role) { send(message, "role not found"); return; }
  await target.roles.add(role);
  send(message, `${role.name} → ${target.user.username}`);
}
