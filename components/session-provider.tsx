"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ClientSession } from "@/lib/auth/types";

type SessionContextValue = {
    session: ClientSession | null;
    updateSession: (session: ClientSession | null) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
    initialSession,
    children,
}: {
    initialSession: ClientSession | null;
    children: ReactNode;
}) {
    const [session, setSession] = useState(initialSession);
    const [previousInitial, setPreviousInitial] = useState(initialSession);

    // A server refresh re-renders the layout with the latest cookie-backed session.
    if (initialSession !== previousInitial) {
        setPreviousInitial(initialSession);
        setSession(initialSession);
    }

    const value = useMemo(() => ({ session, updateSession: setSession }), [session]);
    return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession() {
    const context = useContext(SessionContext);
    if (!context) throw new Error("useSession must be used inside <SessionProvider>.");
    return context;
}
