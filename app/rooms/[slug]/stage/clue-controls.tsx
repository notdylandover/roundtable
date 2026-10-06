"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Eye, Lock, SendHorizontal, SkipForward, TimerOff, TimerReset, XCircle, Zap } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { Kbd } from "@/components/ui/kbd";
import { playerLabel, type ActiveClue, type RoomState } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import type { Send, Viewer } from "../viewer";
import { StageButton } from "./primitives";

function TypedAnswerForm({ send }: { send: Send }) {
    const [text, setText] = useState("");
    const [lockedIn, setLockedIn] = useState<string | null>(null);

    function submit(event: FormEvent) {
        event.preventDefault();
        const answer = text.trim();
        if (!answer) return;
        send({ type: "submit_answer", text: answer });
        setLockedIn(answer);
    }

    if (lockedIn) {
        return (
            <p className="flex items-center gap-2 text-sm text-white/70">
                <Lock className="size-4" /> Locked in: <strong className="text-white">{lockedIn}</strong> — waiting for the host
            </p>
        );
    }

    return (
        <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={submit}
            className="flex w-full max-w-md gap-2"
        >
            <input
                autoFocus
                value={text}
                maxLength={160}
                onChange={(event) => setText(event.target.value)}
                placeholder="Type your answer"
                aria-label="Your answer"
                className="h-12 min-w-0 flex-1 rounded-xl border-2 border-white/25 bg-black/30 px-4 text-base text-white placeholder:text-white/40 focus:border-mustard focus:outline-none"
            />
            <StageButton type="submit" disabled={!text.trim()} className="h-12">
                <SendHorizontal /> Lock in
            </StageButton>
        </motion.form>
    );
}

function AttemptsList({ room }: { room: RoomState }) {
    return (
        <div className="w-full max-w-xl rounded-xl border-2 border-white/15 bg-black/25 p-3 text-left">
            <p className="mb-2 font-mono text-[10px] font-semibold tracking-widest text-white/50 uppercase">
                Typed answers · players can&apos;t see these
            </p>
            <ul className="flex flex-col gap-1.5">
                {room.buzz.attempts.map((attempt, index) => {
                    const player = room.players.find((candidate) => candidate.userId === attempt.userId);
                    return (
                        <motion.li
                            key={`${attempt.userId}-${index}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={cn(
                                "flex items-center gap-2.5 rounded-lg border-2 bg-white/5 px-3 py-1.5",
                                attempt.result === "pending" && "border-coral",
                                attempt.result === "correct" && "border-green-400/60",
                                attempt.result === "incorrect" && "border-white/10 opacity-60"
                            )}
                        >
                            <UserAvatar name={player?.name ?? "?"} avatarUrl={player?.avatarUrl ?? null} seed={attempt.userId} size="sm" />
                            <span className="text-xs font-semibold text-white/60">{player ? playerLabel(player) : "Player"}</span>
                            <span className={cn("min-w-0 flex-1 truncate font-bold", attempt.result === "incorrect" && "line-through")}>
                                {attempt.text}
                            </span>
                            <span className="font-mono text-[10px] text-white/50 uppercase">
                                {attempt.result === "pending" ? "Needs judging" : attempt.result}
                            </span>
                        </motion.li>
                    );
                })}
            </ul>
        </div>
    );
}

/** Buzzer, typed answers, and host judging controls shown inside the clue overlay. */
export function ClueControls({ room, viewer, send, question }: { room: RoomState; viewer: Viewer; send: Send; question: ActiveClue }) {
    const { buzz } = room;
    const typed = room.rules.answerMode === "typed";
    const buzzedPlayer = room.players.find((player) => player.userId === buzz.buzzedUserId);
    const me = room.players.find((player) => player.userId === viewer.userId);
    const excluded = viewer.userId ? buzz.excludedUserIds.includes(viewer.userId) : false;
    const pendingAttempt = buzz.attempts.find((attempt) => attempt.userId === buzz.buzzedUserId && attempt.result === "pending");
    const canBuzz =
        !viewer.isGameMaster && Boolean(me) && !buzz.buzzedUserId && !buzz.answerRevealed && !buzz.timerExpired && !excluded;
    const iBuzzed = buzzedPlayer?.userId === viewer.userId && !buzz.answerRevealed;

    useEffect(() => {
        if (!canBuzz) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.code !== "Space" || event.repeat) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest("input, textarea, select, button, a, [role=button], [contenteditable=true]")) return;
            event.preventDefault();
            send({ type: "buzz" });
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [canBuzz, send]);

    return (
        <div className="flex w-full flex-col items-center gap-3">
            {!viewer.isGameMaster && me && (
                <AnimatePresence mode="wait">
                    {iBuzzed ? (
                        <motion.div key="answering" className="flex w-full flex-col items-center gap-2" exit={{ opacity: 0 }}>
                            <span className="text-sm font-bold text-mustard">
                                {typed ? "You buzzed in — type your answer!" : "You buzzed in — answer out loud!"}
                            </span>
                            {typed && <TypedAnswerForm key={`${question.id}-${buzz.excludedUserIds.length}`} send={send} />}
                        </motion.div>
                    ) : buzz.answerRevealed || buzzedPlayer ? null : buzz.timerExpired ? (
                        <motion.span key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 font-semibold text-coral">
                            <TimerOff className="size-4" /> Time&apos;s up — buzzers are locked
                        </motion.span>
                    ) : (
                        <motion.div
                            key="buzzer"
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.6, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                            className="flex flex-col items-center gap-2"
                        >
                            <motion.button
                                type="button"
                                onClick={() => send({ type: "buzz" })}
                                disabled={!canBuzz}
                                whileHover={canBuzz ? { scale: 1.04 } : undefined}
                                whileTap={canBuzz ? { scale: 0.9 } : undefined}
                                animate={canBuzz ? { boxShadow: ["0 0 0 0 rgba(242,95,76,0.7)", "0 0 0 18px rgba(242,95,76,0)"] } : undefined}
                                transition={canBuzz ? { duration: 1.4, repeat: Infinity } : undefined}
                                className="flex h-16 w-72 max-w-full items-center justify-center gap-3 rounded-full border-4 border-white bg-coral text-2xl font-black text-ink disabled:border-white/30 disabled:bg-white/10 disabled:text-white/50 @3xl:h-20 @3xl:text-3xl"
                            >
                                <Zap className="size-7 fill-current" />
                                {excluded ? "You're out this clue" : "Buzz in"}
                            </motion.button>
                            {canBuzz && (
                                <span className="text-xs text-white/50">
                                    or press <Kbd>Space</Kbd>
                                </span>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {!viewer.isGameMaster && typed && buzzedPlayer && !iBuzzed && !buzz.answerRevealed && (
                <span className="text-xs text-white/50">{playerLabel(buzzedPlayer)} is guessing...</span>
            )}

            {viewer.isGameMaster && typed && buzz.attempts.length > 0 && <AttemptsList room={room} />}

            {viewer.isGameMaster && !viewer.isHost && !buzz.answerRevealed && (
                <span className="text-xs text-white/50">The host runs the clue.</span>
            )}

            {viewer.isHost && (
                <div className="flex flex-wrap justify-center gap-2 border-t border-white/10 pt-3">
                    {typed && buzzedPlayer && !buzz.answerRevealed && !pendingAttempt && (
                        <p className="w-full text-center text-xs text-white/50">
                            Waiting for {playerLabel(buzzedPlayer)} to type an answer. You can still judge now.
                        </p>
                    )}
                    {buzzedPlayer && !buzz.answerRevealed && (
                        <>
                            <StageButton tone="green" onClick={() => send({ type: "judge_buzz", correct: true })}>
                                <CheckCircle2 /> Correct (+{question.value})
                            </StageButton>
                            <StageButton tone="coral" onClick={() => send({ type: "judge_buzz", correct: false })}>
                                <XCircle /> Incorrect (−{question.value})
                            </StageButton>
                        </>
                    )}
                    {!buzz.answerRevealed && (
                        <StageButton tone="ghost" onClick={() => send({ type: "reveal_answer" })}>
                            <Eye /> Reveal answer
                        </StageButton>
                    )}
                    {room.timer.enabled && !buzz.answerRevealed && (
                        <StageButton tone="ghost" onClick={() => send({ type: "restart_timer" })}>
                            <TimerReset /> Restart timer
                        </StageButton>
                    )}
                    <StageButton tone={buzz.answerRevealed ? "mustard" : "white"} onClick={() => send({ type: "end_question" })}>
                        <SkipForward /> Close clue
                    </StageButton>
                </div>
            )}
        </div>
    );
}
