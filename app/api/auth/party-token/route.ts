import { NextResponse } from "next/server";
import { createPartyToken, getSessionUser } from "@/lib/auth/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "You're not signed in." }, { status: 401, headers: NO_STORE });
    }
    return NextResponse.json({ token: await createPartyToken(user) }, { headers: NO_STORE });
}
