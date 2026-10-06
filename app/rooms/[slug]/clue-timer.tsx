"use client";

import { Clock3, Pause, TimerOff } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useCountdown } from "@/hooks/use-countdown";
import type { BuzzState, TimerSettings } from "@/lib/protocol";
import { cn } from "@/lib/utils";

type ClueTimerProps = {
    buzz: BuzzState;
    timer: TimerSettings;
    clockOffset: number;
};

export function ClueTimer({ buzz, timer, clockOffset }: ClueTimerProps) {
    const running = useCountdown(buzz.timerEndsAt, clockOffset);
    const paused = buzz.timerPausedMs !== null;
    const expired = buzz.timerExpired;
    const remainingMs = expired ? 0 : paused ? buzz.timerPausedMs! : running;

    if (remainingMs === null) return null;

    const seconds = Math.ceil(remainingMs / 1000);
    const progress = Math.max(0, Math.min(100, (remainingMs / (timer.seconds * 1000)) * 100));
    const urgent = !paused && !expired && seconds <= 5;

    return (
        <div className="flex w-full flex-col gap-2" aria-live="polite">
            <div className="flex items-center justify-between font-mono text-xs font-semibold uppercase">
                <span className="flex items-center gap-1.5 text-white/80">
                    {expired ? <TimerOff className="size-4" /> : paused ? <Pause className="size-4" /> : <Clock3 className="size-4" />}
                    {expired ? "Time's up" : paused ? "Paused · answering" : "Time left"}
                </span>
                <strong className={cn("text-2xl tabular-nums text-white", urgent && "animate-pulse text-coral")}>
                    {seconds}s
                </strong>
            </div>
            <Progress
                value={progress}
                aria-label="Time remaining"
                className={cn(
                    "[&_[data-slot=progress-track]]:h-2.5 [&_[data-slot=progress-track]]:bg-white/15",
                    "[&_[data-slot=progress-indicator]]:bg-mustard [&_[data-slot=progress-indicator]]:duration-100 [&_[data-slot=progress-indicator]]:ease-linear",
                    urgent && "[&_[data-slot=progress-indicator]]:bg-coral",
                    paused && "opacity-60"
                )}
            />
        </div>
    );
}
