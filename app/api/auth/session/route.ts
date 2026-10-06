import { NextResponse, type NextRequest } from "next/server";
import {
    createSessionToken,
    getClientSession,
    getSessionUser,
    isSameOriginRequest,
    SESSION_COOKIE,
    sessionCookieOptions,
} from "@/lib/auth/server";
import type { ClientSession } from "@/lib/auth/types";
import { collapseWhitespace, validateDisplayName } from "@/lib/names";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
    return NextResponse.json({ session: await getClientSession() }, { headers: NO_STORE });
}

/** Guests can rename themselves; Discord users always use their Discord username. */
export async function PATCH(request: NextRequest) {
    if (!isSameOriginRequest(request)) {
        return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
    }

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "You're not signed in." }, { status: 401 });
    if (user.provider !== "guest") {
        return NextResponse.json({ error: "Discord users use their Discord username." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
    const name = typeof body?.name === "string" ? collapseWhitespace(body.name) : "";
    const error = validateDisplayName(name);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const nextUser = { ...user, name };
    const session: ClientSession = { user: nextUser, isAdmin: false };
    const response = NextResponse.json({ session });
    response.cookies.set(SESSION_COOKIE, await createSessionToken(nextUser), sessionCookieOptions(request));
    return response;
}

export async function DELETE(request: NextRequest) {
    if (!isSameOriginRequest(request)) {
        return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
    }
    const response = NextResponse.json({ session: null });
    response.cookies.delete(SESSION_COOKIE);
    return response;
}
