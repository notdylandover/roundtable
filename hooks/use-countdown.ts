"use client";

import { useEffect, useState } from "react";

/**
 * Milliseconds left until `endsAt` (a server timestamp). `clockOffset` is
 * `serverTime - clientTime`, so local clock drift doesn't skew the countdown.
 */
export function useCountdown(endsAt: number | null, clockOffset = 0, intervalMs = 100) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (endsAt === null) return;
        const tick = () => setNow(Date.now());
        const frame = requestAnimationFrame(tick);
        const interval = window.setInterval(tick, intervalMs);
        return () => {
            cancelAnimationFrame(frame);
            window.clearInterval(interval);
        };
    }, [endsAt, intervalMs]);

    if (endsAt === null) return null;
    return Math.max(0, endsAt - (now + clockOffset));
}
