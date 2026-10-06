import { NextResponse, type NextRequest } from "next/server";
import {
    createSessionToken,
    getAuthSecret,
    getSessionUser,
    isSameOriginRequest,
    SESSION_COOKIE,
    sessionCookieOptions,
} from "@/lib/auth/server";
import type { ClientSession, SessionUser } from "@/lib/auth/types";
import { collapseWhitespace, validateDisplayName } from "@/lib/names";

export async function POST(request: NextRequest) {
    if (!isSameOriginRequest(request)) {
        return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
    }
    if (!getAuthSecret()) {
        return NextResponse.json(
            { error: "Sign-in isn't configured on this server (AUTH_SECRET is missing)." },
            { status: 500 }
        );
    }

    const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? collapseWhitespace(body.name) : "";
    const error = validateDisplayName(name);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const existing = await getSessionUser();
    const user: SessionUser = {
        id: existing?.provider === "guest" ? existing.id : `guest:${crypto.randomUUID()}`,
        provider: "guest",
        name,
        avatarUrl: null,
    };

    const session: ClientSession = { user, isAdmin: false };
    const response = NextResponse.json({ session });
    response.cookies.set(SESSION_COOKIE, await createSessionToken(user), sessionCookieOptions(request));
    return response;
}
