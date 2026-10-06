"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Gavel, KeyRound, Lock, SendHorizontal, Sparkles, Trophy, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { useCountdown } from "@/hooks/use-countdown";
import { getContestants, playerLabel, type FinalEntry, type FinalRound, type RoomPlayer, type RoomState } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import type { Send, Viewer } from "../viewer";
import { AnimatedPrompt, LoadingDots, StageButton, StageTimer } from "./primitives";

type FinalStageProps = {
    room: RoomState;
    clockOffset: number;
    viewer?: Viewer;
    send?: Send;
};

const INPUT =
    "h-12 w-full rounded-xl border-2 border-white/20 bg-black/30 px-4 text-base text-white placeholder:text-white/40 focus:border-mustard focus:outline-none disabled:opacity-50";

function FinalTitle() {
    return (
        <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
            className="flex items-center gap-3"
        >
            <motion.span animate={{ rotate: [0, 15, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                <Sparkles className="size-6 text-mustard @3xl:size-8" />
            </motion.span>
            <h2 className="bg-[linear-gradient(90deg,var(--yellow),#fff,var(--yellow))] bg-[length:200%_100%] bg-clip-text font-pixel-square text-3xl text-transparent motion-safe:animate-[shimmer_3s_linear_infinite] @3xl:text-5xl @6xl:text-6xl">
                Final Buzz In
            </h2>
            <motion.span animate={{ rotate: [0, -15, 10, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}>
                <Sparkles className="size-6 text-mustard @3xl:size-8" />
            </motion.span>
        </motion.div>
    );
}

function FinalAnswerForm({ maxWager, round, clockOffset, send }: { maxWager: number; round: FinalRound; clockOffset: number; send: Send }) {
    const [wagerText, setWagerText] = useState("0");
    const [answer, setAnswer] = useState("");
    const remaining = useCountdown(round.endsAt, clockOffset, 250);
    const timeUp = remaining !== null && remaining <= 0;
    const parsed = Math.round(Number(wagerText));
    const wager = Number.isFinite(parsed) ? Math.max(0, Math.min(maxWager, parsed)) : 0;
    const quickWagers = [
        { label: "None", value: 0 },
        { label: "Half", value: Math.floor(maxWager / 2) },
        { label: "All in", value: maxWager },
    ];

    function submit(event: FormEvent) {
        event.preventDefault();
        const text = answer.trim();
        if (!text || timeUp) return;
        send({ type: "submit_final", wager, answer: text });
    }

    return (
        <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.8 } }}
            className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl border-2 border-white/15 bg-white/5 p-4 text-left backdrop-blur @3xl:p-5"
        >
            <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-36 flex-1 flex-col gap-1.5">
                    <span className="font-mono text-[11px] tracking-widest text-white/60 uppercase">
                        Your wager · max {maxWager.toLocaleString()}
                    </span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={maxWager}
                        step={100}
                        value={wagerText}
                        disabled={maxWager <= 0 || timeUp}
                        onChange={(event) => setWagerText(event.target.value)}
                        onBlur={() => setWagerText(String(wager))}
                        className={cn(INPUT, "font-pixel-square text-2xl")}
                        aria-label="Wager"
                    />
                </label>
                <div className="flex gap-1.5">
                    {quickWagers.map((option) => (
                        <button
                            key={option.label}
                            type="button"
                            disabled={maxWager <= 0 || timeUp}
                            onClick={() => setWagerText(String(option.value))}
                            className={cn(
                                "h-12 rounded-xl border-2 px-3 text-xs font-bold transition-colors disabled:opacity-40",
                                wager === option.value ? "border-mustard bg-mustard text-ink" : "border-white/20 bg-white/5 text-white hover:bg-white/15"
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>
            {maxWager <= 0 && (
                <p className="text-xs text-white/60">You need points to wager, but you can still answer for bragging rights.</p>
            )}
            <div className="flex gap-2">
                <input
                    value={answer}
                    maxLength={160}
                    disabled={timeUp}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="Type your answer"
                    aria-label="Your answer"
                    className={INPUT}
                />
                <StageButton type="submit" tone="mustard" className="h-12 shrink-0" disabled={!answer.trim() || timeUp}>
                    <SendHorizontal /> Lock in
                </StageButton>
            </div>
        </motion.form>
    );
}

function EntryRow({ player, entry, index, mode, send }: {
    player: RoomPlayer;
    entry: FinalEntry | undefined;
    index: number;
    mode: "live" | "judge" | "reveal";
    send?: Send;
}) {
    const reveal = mode === "reveal";
    // Results are revealed one player at a time.
    const delay = reveal ? 0.6 + index * 0.9 : index * 0.05;
    const wager = entry?.wager ?? 0;
    const correct = entry?.result === "correct";
    const judged = entry && entry.result !== "pending";

    return (
        <motion.li
            layout
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24, delay }}
            className={cn(
                "relative flex items-center gap-3 rounded-xl border-2 px-3 py-2.5",
                reveal && judged ? (correct ? "border-green-400/60 bg-green-400/10" : "border-coral/60 bg-coral/10") : "border-white/10 bg-white/5"
            )}
        >
            <UserAvatar name={player.name} avatarUrl={player.avatarUrl} seed={player.userId} size="lg" className="ring-2 ring-white/20" />
            <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-xs font-semibold text-white/60">{playerLabel(player)}</div>
                <div className={cn("truncate text-lg font-bold", !entry && "text-white/40 italic")}>
                    {entry ? entry.answer || "—" : mode === "live" ? "Thinking…" : "No answer"}
                </div>
            </div>
            {entry && entry.wager !== null && (
                <span className="shrink-0 font-mono text-xs text-white/60">
                    Wager <strong className="font-pixel-square text-lg text-white">{wager.toLocaleString()}</strong>
                </span>
            )}
            {mode === "judge" && entry && send && (
                <div className="flex shrink-0 gap-1.5">
                    <button
                        type="button"
                        aria-label={`Mark ${playerLabel(player)} correct`}
                        onClick={() => send({ type: "judge_final", userId: player.userId, correct: true })}
                        className={cn(
                            "flex size-10 items-center justify-center rounded-full border-2 transition-colors",
                            entry.result === "correct" ? "border-ink bg-green-400 text-ink" : "border-white/20 text-white hover:bg-green-400/20"
                        )}
                    >
                        <Check className="size-5" />
                    </button>
                    <button
                        type="button"
                        aria-label={`Mark ${playerLabel(player)} incorrect`}
                        onClick={() => send({ type: "judge_final", userId: player.userId, correct: false })}
                        className={cn(
                            "flex size-10 items-center justify-center rounded-full border-2 transition-colors",
                            entry.result === "incorrect" ? "border-ink bg-coral text-ink" : "border-white/20 text-white hover:bg-coral/20"
                        )}
                    >
                        <X className="size-5" />
                    </button>
                </div>
            )}
            {reveal && entry && (
                <motion.span
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15, delay: delay + 0.45 }}
                    className={cn(
                        "flex shrink-0 items-center gap-1 rounded-full border-2 border-ink px-3 py-1 font-pixel-square text-lg text-ink",
                        correct ? "bg-green-400" : "bg-coral"
                    )}
                >
                    {correct ? <Check className="size-4" /> : <X className="size-4" />}
                    {correct ? "+" : "−"}
                    {wager.toLocaleString()}
                </motion.span>
            )}
        </motion.li>
    );
}

export function FinalStage({ room, clockOffset, viewer, send }: FinalStageProps) {
    const round = room.finalRound;
    if (!round) return null;

    const isGameMaster = Boolean(viewer?.isGameMaster);
    const contestants = getContestants(room);
    const entryFor = (userId: string) => round.entries.find((entry) => entry.userId === userId);
    const me = viewer && !isGameMaster ? contestants.find((player) => player.userId === viewer.userId) : undefined;
    const myEntry = me ? entryFor(me.userId) : undefined;
    const lockedCount = contestants.filter((player) => entryFor(player.userId)).length;
    const pendingJudging = round.entries.some((entry) => entry.result === "pending");
    // Everyone who locked in, plus (for the host) players who didn't answer.
    const rows = contestants.filter((player) => isGameMaster || round.stage === "revealed" || entryFor(player.userId));

    return (
        <div className="relative flex h-full flex-col items-center gap-4 overflow-y-auto rounded-2xl bg-[radial-gradient(ellipse_at_top,rgba(244,203,59,0.18),transparent_60%)] px-2 py-4 text-center @3xl:gap-6 @3xl:px-6 @3xl:py-6">
            <FinalTitle />
            <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
                className="rounded-full bg-board px-4 py-1.5 text-xs font-bold tracking-wide uppercase shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)] @3xl:text-sm"
            >
                {round.category}
            </motion.span>

            <AnimatedPrompt key={round.prompt} text={round.prompt} className="@6xl:text-5xl" />

            {isGameMaster && round.stage !== "revealed" && (
                <span className="flex items-center gap-2 rounded-full border-2 border-dashed border-white/30 bg-black/20 px-4 py-1.5 text-sm">
                    <KeyRound className="size-4 text-mustard" />
                    <span className="font-mono text-[10px] tracking-widest text-white/60 uppercase">Answer</span>
                    <strong>{round.answer}</strong>
                </span>
            )}

            {round.stage === "answering" && (
                <div className="flex w-full justify-center">
                    <StageTimer endsAt={round.endsAt} totalSeconds={room.final.seconds} clockOffset={clockOffset} />
                </div>
            )}

            <AnimatePresence mode="wait">
                {round.stage === "revealed" && (
                    <motion.div
                        key="answer"
                        initial={{ rotateX: 90, opacity: 0, y: 30 }}
                        animate={{ rotateX: 0, opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 160, damping: 18 }}
                        style={{ transformPerspective: 900 }}
                        className="rounded-2xl border-4 border-ink bg-mustard px-8 py-4 text-ink shadow-[8px_8px_0_rgba(0,0,0,0.35)]"
                    >
                        <div className="font-mono text-xs font-bold tracking-[0.3em] uppercase">Correct answer</div>
                        <div className="text-3xl font-black @3xl:text-5xl">{round.answer}</div>
                    </motion.div>
                )}
            </AnimatePresence>

            {round.stage === "answering" && me && send && !myEntry && (
                <FinalAnswerForm maxWager={Math.max(0, me.score)} round={round} clockOffset={clockOffset} send={send} />
            )}

            {me && myEntry && round.stage !== "revealed" && (
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border-2 border-green-400/50 bg-green-400/10 px-5 py-3"
                >
                    <Lock className="size-5 text-green-300" />
                    <span className="text-sm text-white/70">Locked in:</span>
                    <strong className="text-lg">{myEntry.answer}</strong>
                    <span className="font-mono text-xs text-white/60">
                        wager <strong className="font-pixel-square text-base text-white">{(myEntry.wager ?? 0).toLocaleString()}</strong>
                    </span>
                </motion.div>
            )}

            {round.stage === "answering" && (
                <div className="flex flex-col items-center gap-2">
                    <span className="font-mono text-xs tracking-widest text-white/50 uppercase">
                        {lockedCount}/{contestants.length} locked in
                    </span>
                    {!isGameMaster && (
                        <ul className="flex flex-wrap justify-center gap-2">
                            {contestants.map((player) => {
                                const locked = Boolean(entryFor(player.userId));
                                return (
                                    <motion.li
                                        key={player.userId}
                                        animate={locked ? { scale: [1, 1.25, 1], opacity: 1 } : { opacity: 0.35 }}
                                        transition={{ duration: 0.4 }}
                                        className="relative"
                                        title={playerLabel(player)}
                                    >
                                        <UserAvatar name={player.name} avatarUrl={player.avatarUrl} seed={player.userId} className={cn("ring-2", locked ? "ring-green-400" : "ring-white/20")} />
                                        {locked && (
                                            <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-green-400 text-ink">
                                                <Lock className="size-2.5" />
                                            </span>
                                        )}
                                    </motion.li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}

            {round.stage === "judging" && !isGameMaster && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3 py-2">
                    <LoadingDots />
                    <span className="flex items-center gap-2 text-lg font-bold">
                        <Gavel className="size-5 text-mustard" /> The host is judging answers…
                    </span>
                </motion.div>
            )}

            {(isGameMaster || round.stage === "revealed") && rows.length > 0 && (
                <ul className="flex w-full max-w-2xl flex-col gap-2">
                    {rows.map((player, index) => (
                        <EntryRow
                            key={player.userId}
                            player={player}
                            entry={entryFor(player.userId)}
                            index={index}
                            mode={round.stage === "revealed" ? "reveal" : round.stage === "judging" ? "judge" : "live"}
                            send={send}
                        />
                    ))}
                </ul>
            )}

            {isGameMaster && send && (
                <div className="flex flex-wrap justify-center gap-2 pb-2">
                    {round.stage === "answering" && (
                        <StageButton tone="ghost" onClick={() => send({ type: "lock_final" })}>
                            <Lock /> Close answers now
                        </StageButton>
                    )}
                    {round.stage === "judging" && (
                        <StageButton tone="mustard" disabled={pendingJudging} onClick={() => send({ type: "reveal_final" })}>
                            <Sparkles /> {pendingJudging ? "Judge every answer to reveal" : "Reveal results"}
                        </StageButton>
                    )}
                    {round.stage === "revealed" && (
                        <StageButton tone="green" onClick={() => send({ type: "end_game" })}>
                            <Trophy /> Show the winner
                        </StageButton>
                    )}
                </div>
            )}
        </div>
    );
}
