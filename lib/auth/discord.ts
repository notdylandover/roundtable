import "server-only";
import type { SessionUser } from "./types";

const DISCORD_API = "https://discord.com/api/v10";
const NAME_MAX_LENGTH = 32;

type DiscordConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string | null;
};

type DiscordUser = {
    id: string;
    username: string;
    avatar: string | null;
    discriminator?: string;
};

export function getDiscordRedirectUri(request: Request, config: DiscordConfig) {
    return config.redirectUri ?? new URL("/api/auth/discord/callback", request.url).toString();
}

export function buildDiscordAuthorizeUrl(config: DiscordConfig, redirectUri: string, state: string) {
    const url = new URL("https://discord.com/oauth2/authorize");
    url.search = new URLSearchParams({
        client_id: config.clientId,
        response_type: "code",
        // `identify` only exposes the username and avatar — no email, guilds, or other data.
        scope: "identify",
        redirect_uri: redirectUri,
        state,
        prompt: "none",
    }).toString();
    return url;
}

export async function exchangeDiscordCode(config: DiscordConfig, code: string, redirectUri: string) {
    const response = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            client_id: config.clientId,
            client_secret: config.clientSecret,
        }),
        cache: "no-store",
    });
    if (!response.ok) throw new Error(`Discord token exchange failed (${response.status})`);
    const payload = (await response.json()) as { access_token?: string };
    if (!payload.access_token) throw new Error("Discord token exchange returned no access token");
    return payload.access_token;
}

export async function fetchDiscordUser(accessToken: string) {
    const response = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
    });
    if (!response.ok) throw new Error(`Discord user lookup failed (${response.status})`);
    const user = (await response.json()) as DiscordUser;
    if (!/^\d{5,25}$/.test(user.id) || !user.username) throw new Error("Discord returned an invalid user");
    return user;
}

function discordAvatarUrl(user: DiscordUser) {
    if (user.avatar && /^(a_)?[a-f0-9]+$/i.test(user.avatar)) {
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
    }
    const legacyDiscriminator = user.discriminator && user.discriminator !== "0" ? Number(user.discriminator) : null;
    const index = legacyDiscriminator !== null && Number.isFinite(legacyDiscriminator)
        ? legacyDiscriminator % 5
        : Number((BigInt(user.id) >> BigInt(22)) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export function sessionUserFromDiscord(user: DiscordUser): SessionUser {
    return {
        id: `discord:${user.id}`,
        provider: "discord",
        name: user.username.slice(0, NAME_MAX_LENGTH),
        avatarUrl: discordAvatarUrl(user),
    };
}
