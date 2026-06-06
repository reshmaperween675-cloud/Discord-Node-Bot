const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI ?? "";

export function buildOAuthUrl(guildId: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds.join",
    state: guildId,
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

function basicAuth(): string {
  return Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
}

export async function exchangeCode(code: string): Promise<TokenResponse | null> {
  try {
    const res = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth()}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!res.ok) {
      console.error("[OAUTH] Token exchange failed:", res.status, await res.text());
      return null;
    }
    return (await res.json()) as TokenResponse;
  } catch (err) {
    console.error("[OAUTH] exchangeCode error:", err);
    return null;
  }
}

export async function refreshAccessToken(rt: string): Promise<TokenResponse | null> {
  try {
    const res = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth()}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: rt,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as TokenResponse;
  } catch {
    return null;
  }
}

export async function getDiscordUser(
  accessToken: string,
): Promise<{ id: string; username: string } | null> {
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as { id: string; username: string };
  } catch {
    return null;
  }
}

export async function addUserToGuild(
  userId: string,
  accessToken: string,
  guildId: string,
  roleIds: string[] = [],
): Promise<boolean> {
  const botToken =
    process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "";
  const body: Record<string, unknown> = { access_token: accessToken };
  if (roleIds.length > 0) body.roles = roleIds;
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function addRoleToMember(
  guildId: string,
  userId: string,
  roleId: string,
): Promise<boolean> {
  const botToken =
    process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "";
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`,
      {
        method: "PUT",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: "{}",
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function removeRoleFromMember(
  guildId: string,
  userId: string,
  roleId: string,
): Promise<boolean> {
  const botToken =
    process.env.DISCORD_BOT_TOKEN ?? process.env.DISCORD_TOKEN ?? "";
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${roleId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bot ${botToken}` },
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
