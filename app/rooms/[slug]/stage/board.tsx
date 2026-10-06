"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Check, KeyRound, Zap } from "lucide-react";
import { useState, type ReactNode } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { playerLabel, type ActiveClue, type RoomState } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { AnimatedPrompt, SPRING, StageTimer } from "./primitives";

const boardVariants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.025 } },
};

const tileVariants: Variants = {
    hidden: { opacity: 0, y: 24, scale: 0.92 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

const TILE =
    "flex min-h-11 flex-1 items-center justify-center font-pixel-square text-xl shadow-[inset_0_-5px_0_rgba(0,0,0,0.25)] @3xl:min-h-14 @3xl:text-3xl @6xl:text-5xl";

type BoardProps = {
    room: RoomState;
    /** When set, playable tiles become buttons. */
    onPick?: (clueId: string) => void;
};

export function Board({ room, onPick }: BoardProps) {
    // Tiles that re-mount after a clue closes shouldn't replay the intro.
    const [introDone, setIntroDone] = useState(false);
    const activeId = room.buzz.activeQuestionId;

    return (
        <motion.div
            className="grid h-full gap-1.5 @3xl:gap-2 @6xl:gap-3"
            style={{ gridTemplateColumns: `repeat(${room.board.length}, minmax(0, 1fr))` }}
            variants={boardVariants}
            initial={introDone ? false : "hidden"}
            animate="show"
            onAnimationComplete={() => setIntroDone(true)}
        >
            {room.board.map((category) => (
                <div key={category.id} className="flex min-h-0 flex-col gap-1.5 @3xl:gap-2 @6xl:gap-3">
                    <motion.div
                        variants={tileVariants}
                        className="flex min-h-12 items-center justify-center rounded-lg bg-board px-1.5 text-center text-[10px] leading-tight font-black tracking-wide break-words uppercase shadow-[inset_0_-5px_0_rgba(0,0,0,0.25)] @3xl:min-h-18 @3xl:rounded-xl @3xl:px-3 @3xl:text-sm @6xl:text-lg"
                    >
                        {category.name}
                    </motion.div>
                    {category.clues.map((clue) => {
                        if (clue.id === activeId) {
                            return <div key={clue.id} className="min-h-11 flex-1 rounded-xl bg-white/5 @3xl:min-h-14" />;
                        }
                        const playable = clue.filled && !room.buzz.usedQuestionIds.includes(clue.id);
                        const pickable = playable && Boolean(onPick) && !activeId;
                        return (
                            <motion.button
                                key={clue.id}
                                type="button"
                                layoutId={`clue-${clue.id}`}
                                variants={tileVariants}
                                transition={SPRING}
                                style={{ borderRadius: 12 }}
                                disabled={!pickable}
                                aria-label={playable ? `${category.name} for ${clue.value}` : `${category.name}, used`}
                                onClick={() => pickable && onPick?.(clue.id)}
                                whileHover={pickable ? { scale: 1.05, y: -2 } : undefined}
                                whileTap={pickable ? { scale: 0.95 } : undefined}
                                className={cn(
                                    TILE,
                                    playable ? "bg-board text-mustard [text-shadow:3px_3px_0_rgba(0,0,0,0.45)]" : "bg-board/20 text-transparent",
                                    pickable ? "cursor-pointer hover:bg-[#2640e0] focus-visible:ring-4 focus-visible:ring-mustard focus-visible:outline-none" : "cursor-default"
                                )}
                            >
                                {playable ? clue.value : ""}
                            </motion.button>
                        );
                    })}
                </div>
            ))}
        </motion.div>
    );
}

type ClueOverlayProps = {
    room: RoomState;
    question: ActiveClue;
    clockOffset: number;
    /** Shown to the owner and host before the answer is revealed. */
    answerKey?: string;
    /** Player or host controls under the prompt. */
    children?: ReactNode;
};

export function ClueOverlay({ room, question, clockOffset, answerKey, children }: ClueOverlayProps) {
    const { buzz } = room;
    const buzzedPlayer = room.players.find((player) => player.userId === buzz.buzzedUserId);
    const correctPlayer = buzz.answerRevealed ? buzzedPlayer : undefined;
    const answeringPlayer = buzz.answerRevealed ? undefined : buzzedPlayer;
    const outPlayers = room.players.filter((player) => buzz.excludedUserIds.includes(player.userId));
    const showTimer = !buzz.answerRevealed && (buzz.timerEndsAt !== null || buzz.timerPausedMs !== null || buzz.timerExpired);

    return (
        <motion.div
            layoutId={`clue-${question.id}`}
            transition={SPRING}
            style={{ borderRadius: 20 }}
            className="absolute inset-0 z-20 overflow-hidden bg-board shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
        >
            <AnimatePresence>
                {answeringPlayer && (
                    <motion.div
                        key={`flash-${answeringPlayer.userId}`}
                        className="pointer-events-none absolute inset-0 bg-coral"
                        initial={{ opacity: 0.6 }}
                        animate={{ opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.7 }}
                    />
                )}
            </AnimatePresence>

            <motion.div
                className="relative flex h-full flex-col gap-4 overflow-y-auto p-5 @3xl:gap-6 @3xl:p-8 @6xl:p-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.3 } }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
                <div className="flex items-center justify-between gap-4">
                    <span className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold tracking-wide uppercase @3xl:text-sm @6xl:text-lg">
                        {question.category}
                    </span>
                    <span className="font-pixel-square text-4xl text-mustard @3xl:text-5xl @6xl:text-7xl">{question.value}</span>
                </div>

                <div className="flex min-h-24 flex-1 flex-col items-center justify-center gap-4">
                    <AnimatedPrompt text={question.prompt} />
                    {answerKey && !buzz.answerRevealed && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0, transition: { delay: 0.6 } }}
                            className="flex items-center gap-2 rounded-full border-2 border-dashed border-white/30 bg-black/20 px-4 py-1.5 text-sm"
                        >
                            <KeyRound className="size-4 text-mustard" />
                            <span className="font-mono text-[10px] tracking-widest text-white/60 uppercase">Answer</span>
                            <strong>{answerKey}</strong>
                        </motion.div>
                    )}
                </div>

                <div className="relative flex flex-col items-center justify-end gap-4 @3xl:gap-5">
                    <AnimatePresence mode="popLayout">
                        {answeringPlayer && (
                            <motion.div
                                key={`buzz-${answeringPlayer.userId}`}
                                initial={{ scale: 0.4, opacity: 0, rotate: -4 }}
                                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                exit={{ scale: 0.85, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 420, damping: 18 }}
                                className="flex items-center gap-3 rounded-full border-4 border-white bg-coral py-2 pr-6 pl-3 text-ink shadow-[0_0_60px_rgba(242,95,76,0.6)] @3xl:gap-4 @3xl:py-3 @3xl:pr-8 @3xl:pl-4"
                            >
                                <Zap className="size-6 fill-ink @3xl:size-8" />
                                <UserAvatar name={answeringPlayer.name} avatarUrl={answeringPlayer.avatarUrl} seed={answeringPlayer.userId} size="lg" className="ring-2 ring-ink" />
                                <span className="text-xl font-black @3xl:text-3xl @6xl:text-4xl">{playerLabel(answeringPlayer)}</span>
                                <span className="font-mono text-xs font-bold tracking-widest uppercase @3xl:text-sm">
                                    {room.rules.answerMode === "typed" ? "is guessing..." : "buzzed in"}
                                </span>
                            </motion.div>
                        )}

                        {buzz.answerRevealed && (
                            <motion.div
                                key="answer"
                                initial={{ rotateX: 90, opacity: 0, y: 30 }}
                                animate={{ rotateX: 0, opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ type: "spring", stiffness: 160, damping: 18 }}
                                style={{ transformPerspective: 900 }}
                                className="flex flex-col items-center gap-3"
                            >
                                <div className="rounded-2xl border-4 border-ink bg-mustard px-8 py-4 text-center text-ink shadow-[8px_8px_0_rgba(0,0,0,0.35)] @3xl:px-10 @3xl:py-5">
                                    <div className="font-mono text-xs font-bold tracking-[0.3em] uppercase">Correct answer</div>
                                    <div className="text-3xl font-black @3xl:text-4xl @6xl:text-6xl">{question.answer}</div>
                                </div>
                                {correctPlayer && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0, transition: { delay: 0.35 } }}
                                        className="flex items-center gap-2 rounded-full bg-green-400 px-4 py-1.5 font-bold text-ink"
                                    >
                                        <Check className="size-5" /> {playerLabel(correctPlayer)} +{question.value}
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence mode="popLayout">
                        {showTimer && (
                            <motion.div
                                key={`${buzz.timerEndsAt}-${buzz.timerPausedMs}-${buzz.timerExpired}`}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                                className="flex w-full justify-center"
                            >
                                <StageTimer
                                    endsAt={buzz.timerEndsAt}
                                    pausedMs={buzz.timerPausedMs}
                                    expired={buzz.timerExpired}
                                    totalSeconds={room.timer.seconds}
                                    clockOffset={clockOffset}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {outPlayers.length > 0 && !buzz.answerRevealed && (
                        <div className="flex flex-wrap justify-center gap-2 font-mono text-xs text-white/50 uppercase">
                            Out this clue:
                            {outPlayers.map((player) => (
                                <span key={player.userId} className="line-through decoration-coral decoration-2">
                                    {playerLabel(player)}
                                </span>
                            ))}
                        </div>
                    )}

                    {children}
                </div>
            </motion.div>
        </motion.div>
    );
}
