"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Pause, TimerOff } from "lucide-react";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { useCountdown } from "@/hooks/use-countdown";
import { cn } from "@/lib/utils";

export const SPRING = { type: "spring", stiffness: 140, damping: 22 } as const;

/** Stage buttons: chunky, high-contrast, with a press-in effect. */
export function StageButton({
    tone = "mustard",
    className,
    ...props
}: ComponentProps<typeof motion.button> & { tone?: "mustard" | "coral" | "green" | "ghost" | "white" }) {
    return (
        <motion.button
            type="button"
            whileHover={props.disabled ? undefined : { scale: 1.03 }}
            whileTap={props.disabled ? undefined : { scale: 0.96 }}
            className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 px-5 text-sm font-bold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
                tone === "mustard" && "border-ink bg-mustard text-ink shadow-[3px_3px_0_rgba(0,0,0,0.45)]",
                tone === "coral" && "border-ink bg-coral text-ink shadow-[3px_3px_0_rgba(0,0,0,0.45)]",
                tone === "green" && "border-ink bg-green-400 text-ink shadow-[3px_3px_0_rgba(0,0,0,0.45)]",
                tone === "white" && "border-ink bg-white text-ink shadow-[3px_3px_0_rgba(0,0,0,0.45)]",
                tone === "ghost" && "border-white/25 bg-white/5 text-white hover:bg-white/15",
                className
            )}
            {...props}
        />
    );
}

export function AnimatedScore({ value, className }: { value: number; className?: string }) {
    const motionValue = useMotionValue(value);
    const display = useTransform(motionValue, (latest) => Math.round(latest).toLocaleString());

    useEffect(() => {
        const controls = animate(motionValue, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
        return () => controls.stop();
    }, [motionValue, value]);

    return <motion.span className={cn("tabular-nums", value < 0 && "text-coral", className)}>{display}</motion.span>;
}

export function LoadingDots({ className }: { className?: string }) {
    return (
        <span className={cn("flex gap-2", className)}>
            {[0, 1, 2].map((dot) => (
                <motion.span
                    key={dot}
                    className="size-3 rounded-full bg-mustard"
                    animate={{ opacity: [0.2, 1, 0.2], y: [0, -6, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.18 }}
                />
            ))}
        </span>
    );
}

export function StandBy({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-white/15 p-6 text-center"
        >
            <LoadingDots />
            <h2 className="text-3xl font-bold @5xl:text-6xl">{title}</h2>
            <p className="max-w-md text-white/60">{description}</p>
            {children}
        </motion.div>
    );
}

export function AnimatedPrompt({ text, className }: { text: string; className?: string }) {
    return (
        <motion.h2
            className={cn("max-w-5xl text-center text-2xl leading-tight font-bold text-balance @3xl:text-4xl @6xl:text-6xl", className)}
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035, delayChildren: 0.45 } } }}
        >
            {text.split(/\s+/).map((word, index) => (
                <motion.span
                    key={`${word}-${index}`}
                    className="mr-[0.25em] inline-block"
                    variants={{
                        hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
                        show: { opacity: 1, y: 0, filter: "blur(0px)" },
                    }}
                >
                    {word}
                </motion.span>
            ))}
        </motion.h2>
    );
}

type StageTimerProps = {
    endsAt: number | null;
    pausedMs?: number | null;
    expired?: boolean;
    totalSeconds: number;
    clockOffset: number;
};

/** Ring + bar countdown that drains smoothly between server updates. */
export function StageTimer({ endsAt, pausedMs = null, expired = false, totalSeconds, clockOffset }: StageTimerProps) {
    const running = useCountdown(endsAt, clockOffset, 200);
    const paused = pausedMs !== null;
    const remaining = expired ? 0 : paused ? pausedMs : running;
    if (remaining === null) return null;

    const isRunning = running !== null && !paused && !expired && remaining > 0;
    const fraction = Math.max(0, Math.min(1, remaining / (totalSeconds * 1000)));
    const seconds = Math.ceil(remaining / 1000);
    const timeUp = expired || remaining <= 0;
    const urgent = isRunning && seconds <= 5;
    const color = urgent || timeUp ? "var(--coral)" : "var(--yellow)";
    const drain = isRunning ? { duration: remaining / 1000, ease: "linear" as const } : { duration: 0.3 };

    return (
        <div className="flex w-full max-w-3xl items-center gap-4 @3xl:gap-5">
            <motion.div
                className="relative size-16 shrink-0 @3xl:size-20 @6xl:size-24"
                animate={urgent ? { scale: [1, 1.1, 1] } : timeUp ? { rotate: [0, -6, 6, -4, 4, 0] } : { scale: 1 }}
                transition={urgent ? { duration: 0.7, repeat: Infinity } : { duration: 0.5 }}
            >
                <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="9" />
                    <motion.circle
                        cx="50"
                        cy="50"
                        r="44"
                        fill="none"
                        stroke={color}
                        strokeWidth="9"
                        strokeLinecap="round"
                        initial={{ pathLength: fraction }}
                        animate={{ pathLength: isRunning ? 0 : fraction }}
                        transition={drain}
                    />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-pixel-square text-2xl tabular-nums @3xl:text-3xl @6xl:text-4xl">
                    {timeUp ? <TimerOff className="size-7" /> : paused ? <Pause className="size-7" /> : seconds}
                </span>
            </motion.div>
            <div className="min-w-0 flex-1">
                <div className="mb-2 flex justify-between font-mono text-[11px] tracking-[0.25em] text-white/60 uppercase @3xl:text-xs">
                    <span>{timeUp ? "Time's up" : paused ? "Clock paused" : "Time remaining"}</span>
                    {paused && <span className="tabular-nums">{seconds}s left</span>}
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/15">
                    <motion.div
                        className="h-full origin-left rounded-full"
                        style={{ background: color }}
                        initial={{ scaleX: fraction }}
                        animate={{ scaleX: isRunning ? 0 : fraction }}
                        transition={drain}
                    />
                </div>
            </div>
        </div>
    );
}

const CONFETTI_COLORS = ["var(--yellow)", "var(--coral)", "var(--cyan)", "#4ade80", "#ffffff", "#a78bfa"];

type ConfettiPiece = { left: number; delay: number; duration: number; drift: number; spin: number; size: number; color: string; round: boolean };

function makeConfetti(count: number): ConfettiPiece[] {
    return Array.from({ length: count }, (_, index) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        duration: 3 + Math.random() * 3,
        drift: (Math.random() - 0.5) * 160,
        spin: (Math.random() - 0.5) * 900,
        size: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        round: Math.random() > 0.6,
    }));
}

/** Falling confetti that fills its nearest positioned parent. */
export function Confetti({ count = 70 }: { count?: number }) {
    const [pieces] = useState(() => makeConfetti(count));
    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden [container-type:size]">
            {pieces.map((piece, index) => (
                <motion.span
                    key={index}
                    className={cn("absolute -top-6 block", piece.round ? "rounded-full" : "rounded-[2px]")}
                    style={{
                        left: `${piece.left}%`,
                        width: piece.size,
                        height: piece.round ? piece.size : piece.size * 1.6,
                        background: piece.color,
                    }}
                    initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }}
                    animate={{ y: "110cqh", x: piece.drift, rotate: piece.spin, opacity: [1, 1, 0.8, 0] }}
                    transition={{ duration: piece.duration, delay: piece.delay, repeat: Infinity, repeatDelay: 1.5, ease: "easeIn" }}
                />
            ))}
        </div>
    );
}
