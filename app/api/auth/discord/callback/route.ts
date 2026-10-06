import { NextResponse, type NextRequest } from "next/server";
import {
    exchangeDiscordCode,
    fetchDiscordUser,
    getDiscordRedirectUri,
    sessionUserFromDiscord,
} from "@/lib/auth/discord";
import { safeNextPath } from "@/lib/auth/paths";
import {
    createSessionToken,
    getAuthSecret,
    getDiscordConfig,
    OAUTH_STATE_COOKIE,
    SESSION_COOKIE,
    sessionCookieOptions,
} from "@/lib/auth/server";
import { verifyToken } from "@/lib/auth/token";

function redirectWithError(request: NextRequest, code: string) {
    const response = NextResponse.redirect(new URL(`/?error=${code}`, request.url));
    response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth/discord" });
    return response;
}

export async function GET(request: NextRequest) {
    const config = getDiscordConfig();
    const secret = getAuthSecret();
    if (!config || !secret) return redirectWithError(request, "discord_unavailable");

    const params = request.nextUrl.searchParams;
    if (params.get("error")) return redirectWithError(request, "discord_denied");

    const code = params.get("code");
    const state = params.get("state");
    const stored = await verifyToken<{ state: string; next: string }>(
        request.cookies.get(OAUTH_STATE_COOKIE)?.value,
        secret,
        "oauth"
    );
    if (!code || !state || !stored || stored.state !== state) {
        return redirectWithError(request, "discord_state");
    }

    try {
        const accessToken = await exchangeDiscordCode(config, code, getDiscordRedirectUri(request, config));
        const user = sessionUserFromDiscord(await fetchDiscordUser(accessToken));

        const response = NextResponse.redirect(new URL(safeNextPath(stored.next), request.url));
        response.cookies.set(SESSION_COOKIE, await createSessionToken(user), sessionCookieOptions(request));
        response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth/discord" });
        return response;
    } catch (error) {
        console.error("Discord sign-in failed:", error);
        return redirectWithError(request, "discord_failed");
    }
}
