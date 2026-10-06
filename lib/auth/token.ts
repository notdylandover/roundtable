/**
 * Minimal signed-token helpers (HMAC-SHA256) built on Web Crypto so the same code
 * runs in Next.js route handlers and inside the PartyKit worker.
 * Format: base64url(JSON claims) + "." + base64url(signature)
 */
import type { AuthProvider, SessionUser } from "./types";

export type TokenAudience = "session" | "party" | "oauth" | "internal";

export type TokenClaims = {
    aud: TokenAudience;
    iat: number;
    exp: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const keyCache = new Map<string, Promise<CryptoKey>>();

function getKey(secret: string) {
    let key = keyCache.get(secret);
    if (!key) {
        key = crypto.subtle.importKey(
            "raw",
            encoder.encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign", "verify"]
        );
        keyCache.set(secret, key);
    }
    return key;
}

function bytesToBase64Url(bytes: Uint8Array) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string) {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

export async function signToken<T extends object>(
    payload: T,
    secret: string,
    audience: TokenAudience,
    ttlSeconds: number
) {
    const now = Math.floor(Date.now() / 1000);
    const claims = { ...payload, aud: audience, iat: now, exp: now + ttlSeconds };
    const body = bytesToBase64Url(encoder.encode(JSON.stringify(claims)));
    const signature = await crypto.subtle.sign("HMAC", await getKey(secret), encoder.encode(body));
    return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyToken<T extends object>(
    token: string | null | undefined,
    secret: string,
    audience: TokenAudience
): Promise<(T & TokenClaims) | null> {
    if (!token || !secret) return null;

    const [body, signature, extra] = token.split(".");
    if (!body || !signature || extra !== undefined) return null;

    try {
        const valid = await crypto.subtle.verify(
            "HMAC",
            await getKey(secret),
            base64UrlToBytes(signature),
            encoder.encode(body)
        );
        if (!valid) return null;

        const claims = JSON.parse(decoder.decode(base64UrlToBytes(body))) as T & TokenClaims;
        if (claims.aud !== audience) return null;
        if (typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) return null;
        return claims;
    } catch {
        return null;
    }
}

const PROVIDERS: AuthProvider[] = ["discord", "guest"];

/** Narrows verified claims to a SessionUser, rejecting malformed payloads. */
export function toSessionUser(claims: Partial<SessionUser> | null): SessionUser | null {
    if (!claims) return null;
    const { id, provider, name, avatarUrl } = claims;
    if (typeof id !== "string" || !id) return null;
    if (!provider || !PROVIDERS.includes(provider)) return null;
    if (!id.startsWith(`${provider}:`)) return null;
    if (typeof name !== "string" || !name) return null;
    return {
        id,
        provider,
        name,
        avatarUrl: typeof avatarUrl === "string" && avatarUrl.startsWith("https://") ? avatarUrl : null,
    };
}
