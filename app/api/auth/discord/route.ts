import { NextResponse, type NextRequest } from "next/server";
import { buildDiscordAuthorizeUrl, getDiscordRedirectUri } from "@/lib/auth/discord";
import { safeNextPath } from "@/lib/auth/paths";
import { getAuthSecret, getDiscordConfig, isSecureRequest, OAUTH_STATE_COOKIE } from "@/lib/auth/server";
import { signToken } from "@/lib/auth/token";

const STATE_TTL_SECONDS = 60 * 10;

export async function GET(request: NextRequest) {
    const config = getDiscordConfig();
    const secret = getAuthSecret();
    if (!config || !secret) {
        return NextResponse.redirect(new URL("/?error=discord_unavailable", request.url));
    }

    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    const state = crypto.randomUUID();
    const stateToken = await signToken({ state, next }, secret, "oauth", STATE_TTL_SECONDS);
    const authorizeUrl = buildDiscordAuthorizeUrl(config, getDiscordRedirectUri(request, config), state);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(OAUTH_STATE_COOKIE, stateToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: isSecureRequest(request),
        path: "/api/auth/discord",
        maxAge: STATE_TTL_SECONDS,
    });
    return response;
}
