import "server-only";
import { cookies } from "next/headers";
import { isAdminUser } from "./admins";
import { signToken, toSessionUser, verifyToken } from "./token";
import type { ClientSession, SessionUser } from "./types";

export const SESSION_COOKIE = "roundtable_session";
export const OAUTH_STATE_COOKIE = "roundtable_oauth";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const PARTY_TOKEN_TTL_SECONDS = 60 * 10;

export class AuthConfigError extends Error { }

export function getAuthSecret() {
    const secret = process.env.AUTH_SECRET;
    if (!secret || secret.length < 32) return null;
    return secret;
}

export function requireAuthSecret() {
    const secret = getAuthSecret();
    if (!secret) {
        throw new AuthConfigError("AUTH_SECRET must be set to a random string of at least 32 characters.");
    }
    return secret;
}

export function getDiscordConfig() {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret, redirectUri: process.env.DISCORD_REDIRECT_URI || null };
}

export function isDiscordEnabled() {
    return getDiscordConfig() !== null && getAuthSecret() !== null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
    const secret = getAuthSecret();
    if (!secret) return null;
    const store = await cookies();
    const claims = await verifyToken<SessionUser>(store.get(SESSION_COOKIE)?.value, secret, "session");
    return toSessionUser(claims);
}

export async function getClientSession(): Promise<ClientSession | null> {
    const user = await getSessionUser();
    return user ? { user, isAdmin: isAdminUser(user) } : null;
}

export function isSecureRequest(request: Request) {
    const forwardedProto = request.headers.get("x-forwarded-proto");
    if (forwardedProto) return forwardedProto.split(",")[0].trim() === "https";
    return new URL(request.url).protocol === "https:";
}

export function createSessionToken(user: SessionUser) {
    return signToken(user, requireAuthSecret(), "session", SESSION_TTL_SECONDS);
}

export function sessionCookieOptions(request: Request) {
    return {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: isSecureRequest(request),
        path: "/",
        maxAge: SESSION_TTL_SECONDS,
    };
}

/** Short-lived token the browser passes to PartyKit, which verifies it with the same secret. */
export function createPartyToken(user: SessionUser) {
    return signToken(user, requireAuthSecret(), "party", PARTY_TOKEN_TTL_SECONDS);
}

/** Rejects cross-site browser requests for state-changing endpoints. */
export function isSameOriginRequest(request: Request) {
    const origin = request.headers.get("origin");
    if (!origin) return true;
    try {
        const originHost = new URL(origin).host;
        const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")];
        return hosts.some((host) => host?.split(",")[0].trim() === originHost);
    } catch {
        return false;
    }
}
