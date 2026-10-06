"use client";

import PartySocket from "partysocket";
import type { ServerMessage } from "./protocol";

const PRODUCTION_PARTY_HOST = "roundtable-api.dylandover.dev";
const DEVELOPMENT_PARTY_HOST = "localhost:1999";

/** `NEXT_PUBLIC_PARTYKIT_HOST` overrides the default: the deployed worker in production builds, `wrangler dev` otherwise. */
export const PARTY_HOST =
    process.env.NEXT_PUBLIC_PARTYKIT_HOST ||
    (process.env.NODE_ENV === "production" ? PRODUCTION_PARTY_HOST : DEVELOPMENT_PARTY_HOST);

export type ConnectionStatus = "connecting" | "live" | "offline";

async function fetchPartyToken() {
    try {
        const response = await fetch("/api/auth/party-token", { cache: "no-store" });
        if (!response.ok) return "";
        const payload = (await response.json()) as { token?: string };
        return payload.token ?? "";
    } catch {
        return "";
    }
}

/**
 * Opens a PartySocket. Authenticated sockets fetch a fresh short-lived token on every
 * (re)connect, so long-lived tabs keep working after the previous token expires.
 */
export function createPartySocket({
    room,
    query = {},
    authenticated = true,
}: {
    room: string;
    query?: Record<string, string>;
    authenticated?: boolean;
}) {
    return new PartySocket({
        host: PARTY_HOST,
        room,
        query: authenticated ? async () => ({ ...query, token: await fetchPartyToken() }) : query,
    });
}

export function parseServerMessage(data: unknown): ServerMessage | null {
    if (typeof data !== "string") return null;
    try {
        return JSON.parse(data) as ServerMessage;
    } catch {
        return null;
    }
}
