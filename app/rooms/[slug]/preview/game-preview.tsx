"use client";

import {
    AnimatePresence,
    LayoutGroup,
    MotionConfig,
    animate,
    motion,
    useMotionValue,
    useTransform,
    type Variants,
} from "framer-motion";
import { Check, DoorOpen, Pause, Radio, TimerOff, Trophy, WifiOff, Zap } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { Spinner } from "@/components/ui/spinner";
import { useCountdown } from "@/hooks/use-countdown";
import { createPartySocket, parseServerMessage, type ConnectionStatus } from "@/lib/party-client";
import { findClue, playerLabel, type ActiveClue, type RoomPlayer, type RoomState } from "@/lib/protocol";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 140, damping: 22 } as const;

const boardVariants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.025 } },
};

const tileVariants: Variants = {
    hidden: { opacity: 0, y: 24, scale: 0.92 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

const subscribeNoop = () => () => undefined;

function useBrowserHost() {
    return useSyncExternalStore(subscribeNoop, () => window.location.host, () => "");
}

/* ---------- Scores ---------- */

function AnimatedScore({ value }: { value: number }) {
    const motionValue = useMotionValue(value);
    const display = useTransform(motionValue, (latest) => Math.round(latest).toLocaleString());

    useEffect(() => {
        const controls = animate(motionValue, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
        return () => controls.stop();
    }, [motionValue, value]);

    return (
        <motion.span className={cn("font-pixel-square text-3xl leading-none tabular-nums lg:text-4xl", value < 0 && "text-coral")}>
            {display}
        </motion.span>
    );
}

let nextDeltaId = 0;

function DeltaChip({ amount, onDone }: { amount: number; onDone: () => void }) {
    useEffect(() => {
        const timeout = window.setTimeout(onDone, 1600);
        return () => window.clearTimeout(timeout);
    }, [onDone]);

    return (
        <motion.span
            initial={{ opacity: 0, y: 12, scale: 0.7 }}
            animate={{ opacity: 1, y: -30, scale: 1 }}
            exit={{ opacity: 0, y: -48, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className={cn(
                "pointer-events-none absolute -top-3 right-3 z-10 rounded-full border-2 border-ink px-3 py-0.5 font-pixel-square text-xl text-ink shadow-[3px_3px_0_rgba(0,0,0,0.4)]",
                amount > 0 ? "bg-green-400" : "bg-coral"
            )}
        >
            {amount > 0 ? `+${amount}` : amount}
        </motion.span>
    );
}

function ScoreCard({ player, rank, leader, buzzed, showDeltas }: {
    player: RoomPlayer;
    rank: number;
    leader: boolean;
    buzzed: boolean;
    showDeltas: boolean;
}) {
    const [previousScore, setPreviousScore] = useState(player.score);
    const [deltas, setDeltas] = useState<Array<{ id: number; amount: number }>>([]);

    if (player.score !== previousScore) {
        setPreviousScore(player.score);
        if (showDeltas) {
            const amount = player.score - previousScore;
            setDeltas((current) => [...current, { id: nextDeltaId++, amount }]);
        }
    }

    return (
        <motion.li
            layout
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0, scale: buzzed ? 1.04 : 1 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className={cn(
                "relative flex max-w-xs min-w-0 flex-1 basis-0 items-center gap-3 rounded-xl border-2 px-4 py-3 backdrop-blur",
                buzzed
                    ? "border-coral bg-coral/25 shadow-[0_0_40px_rgba(242,95,76,0.45)]"
                    : leader
                        ? "border-mustard/70 bg-white/8"
                        : "border-white/10 bg-white/5"
            )}
        >
            <span className="w-4 font-mono text-xs text-white/40">{rank}</span>
            <UserAvatar name={player.name} avatarUrl={player.avatarUrl} seed={player.userId} size="lg" className="ring-2 ring-white/20" />
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-white/80 lg:text-base">
                    {leader && <Trophy className="size-3.5 shrink-0 text-mustard" />}
                    <span className="truncate">{playerLabel(player)}</span>
                </span>
                <AnimatedScore value={player.score} />
            </span>
            <AnimatePresence>
                {deltas.map((delta) => (
                    <DeltaChip
                        key={delta.id}
                        amount={delta.amount}
                        onDone={() => setDeltas((current) => current.filter((item) => item.id !== delta.id))}
                    />
                ))}
            </AnimatePresence>
        </motion.li>
    );
}

function ScoreRail({ room, showDeltas }: { room: RoomState; showDeltas: boolean }) {
    const contestants = room.players.filter((player) => !player.isHost && !player.isOwner).sort((left, right) => right.score - left.score);
    const topScore = contestants[0]?.score ?? 0;

    if (contestants.length === 0) {
        return (
            <p className="rounded-xl border-2 border-dashed border-white/15 px-4 py-5 text-center font-mono text-xs tracking-widest text-white/40 uppercase">
                Waiting for players to join
            </p>
        );
    }

    return (
        <LayoutGroup id="scores">
            <ol className="flex items-stretch gap-3 pt-4">
                <AnimatePresence initial={false}>
                    {contestants.map((player, index) => (
                        <ScoreCard
                            key={player.userId}
                            player={player}
                            rank={index + 1}
                            leader={topScore > 0 && player.score === topScore}
                            buzzed={player.userId === room.buzz.buzzedUserId && !room.buzz.answerRevealed}
                            showDeltas={showDeltas}
                        />
                    ))}
                </AnimatePresence>
            </ol>
        </LayoutGroup>
    );
}

/* ---------- Timer ---------- */

function PreviewTimer({ room, clockOffset }: { room: RoomState; clockOffset: number }) {
    const { buzz, timer } = room;
    const running = useCountdown(buzz.timerEndsAt, clockOffset, 200);
    const paused = buzz.timerPausedMs !== null;
    const expired = buzz.timerExpired;
    const remaining = expired ? 0 : paused ? buzz.timerPausedMs! : running;
    if (remaining === null) return null;

    const isRunning = running !== null && !paused && !expired;
    const fraction = Math.max(0, Math.min(1, remaining / (timer.seconds * 1000)));
    const seconds = Math.ceil(remaining / 1000);
    const urgent = isRunning && seconds <= 5;
    const color = urgent || expired ? "var(--coral)" : "var(--yellow)";
    const drain = isRunning ? { duration: remaining / 1000, ease: "linear" as const } : { duration: 0.3 };

    return (
        <div className="flex w-full max-w-3xl items-center gap-5">
            <motion.div
                className="relative size-20 shrink-0 lg:size-24"
                animate={urgent ? { scale: [1, 1.1, 1] } : expired ? { rotate: [0, -6, 6, -4, 4, 0] } : { scale: 1 }}
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
                <span className="absolute inset-0 flex items-center justify-center font-pixel-square text-3xl tabular-nums lg:text-4xl">
                    {expired ? <TimerOff className="size-8" /> : paused ? <Pause className="size-8" /> : seconds}
                </span>
            </motion.div>
            <div className="min-w-0 flex-1">
                <div className="mb-2 flex justify-between font-mono text-xs tracking-[0.25em] text-white/60 uppercase">
                    <span>{expired ? "Time's up" : paused ? "Clock paused" : "Time remaining"}</span>
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

/* ---------- Clue overlay ---------- */

function AnimatedPrompt({ text }: { text: string }) {
    return (
        <motion.h2
            className="max-w-5xl text-center text-4xl leading-tight font-bold text-balance lg:text-6xl"
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

function ClueOverlay({ room, question, clockOffset }: { room: RoomState; question: ActiveClue; clockOffset: number }) {
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
                className="relative flex h-full flex-col gap-6 p-8 lg:p-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.3 } }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
                <div className="flex items-center justify-between gap-4">
                    <span className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold tracking-wide uppercase lg:text-lg">
                        {question.category}
                    </span>
                    <span className="font-pixel-square text-5xl text-mustard lg:text-7xl">{question.value}</span>
                </div>

                <div className="flex min-h-0 flex-1 items-center justify-center">
                    <AnimatedPrompt text={question.prompt} />
                </div>

                <div className="relative flex min-h-36 flex-col items-center justify-end gap-5">
                    <AnimatePresence mode="popLayout">
                        {answeringPlayer && (
                            <motion.div
                                key={`buzz-${answeringPlayer.userId}`}
                                initial={{ scale: 0.4, opacity: 0, rotate: -4 }}
                                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                exit={{ scale: 0.85, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 420, damping: 18 }}
                                className="flex items-center gap-4 rounded-full border-4 border-white bg-coral py-3 pr-8 pl-4 text-ink shadow-[0_0_60px_rgba(242,95,76,0.6)]"
                            >
                                <Zap className="size-8 fill-ink" />
                                <UserAvatar name={answeringPlayer.name} avatarUrl={answeringPlayer.avatarUrl} seed={answeringPlayer.userId} size="lg" className="ring-2 ring-ink" />
                                <span className="text-3xl font-black lg:text-4xl">{playerLabel(answeringPlayer)}</span>
                                <span className="font-mono text-sm font-bold tracking-widest uppercase">
                                    {room.rules.answerMode === "typed" ? "is typing…" : "buzzed in"}
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
                                <div className="rounded-2xl border-4 border-ink bg-mustard px-10 py-5 text-center text-ink shadow-[8px_8px_0_rgba(0,0,0,0.35)]">
                                    <div className="font-mono text-xs font-bold tracking-[0.3em] uppercase">Correct answer</div>
                                    <div className="text-4xl font-black lg:text-6xl">{question.answer}</div>
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
                                <PreviewTimer room={room} clockOffset={clockOffset} />
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
                </div>
            </motion.div>
        </motion.div>
    );
}

/* ---------- Board ---------- */

function Board({ room, introDone, onIntroDone }: { room: RoomState; introDone: boolean; onIntroDone: () => void }) {
    const activeId = room.buzz.activeQuestionId;

    return (
        <motion.div
            className="grid h-full gap-2 lg:gap-3"
            style={{ gridTemplateColumns: `repeat(${room.board.length}, minmax(0, 1fr))` }}
            variants={boardVariants}
            initial={introDone ? false : "hidden"}
            animate="show"
            onAnimationComplete={onIntroDone}
        >
            {room.board.map((category) => (
                <div key={category.id} className="flex min-h-0 flex-col gap-2 lg:gap-3">
                    <motion.div
                        variants={tileVariants}
                        className="flex min-h-18 items-center justify-center rounded-xl bg-board px-3 text-center text-sm font-black tracking-wide uppercase shadow-[inset_0_-5px_0_rgba(0,0,0,0.25)] lg:text-lg"
                    >
                        {category.name}
                    </motion.div>
                    {category.clues.map((clue) => {
                        if (clue.id === activeId) {
                            return <div key={clue.id} className="min-h-14 flex-1 rounded-xl bg-white/5" />;
                        }
                        const playable = clue.filled && !room.buzz.usedQuestionIds.includes(clue.id);
                        return (
                            <motion.div
                                key={clue.id}
                                layoutId={`clue-${clue.id}`}
                                variants={tileVariants}
                                transition={SPRING}
                                style={{ borderRadius: 12 }}
                                className={cn(
                                    "flex min-h-14 flex-1 items-center justify-center font-pixel-square text-3xl shadow-[inset_0_-5px_0_rgba(0,0,0,0.25)] lg:text-5xl",
                                    playable ? "bg-board text-mustard [text-shadow:3px_3px_0_rgba(0,0,0,0.45)]" : "bg-board/20 text-transparent"
                                )}
                            >
                                {playable ? clue.value : ""}
                            </motion.div>
                        );
                    })}
                </div>
            ))}
        </motion.div>
    );
}

function StandBy({ title, description }: { title: string; description: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-white/15 text-center"
        >
            <span className="flex gap-2">
                {[0, 1, 2].map((dot) => (
                    <motion.span
                        key={dot}
                        className="size-3 rounded-full bg-mustard"
                        animate={{ opacity: [0.2, 1, 0.2], y: [0, -6, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.18 }}
                    />
                ))}
            </span>
            <h2 className="text-4xl font-bold lg:text-6xl">{title}</h2>
            <p className="max-w-md text-white/60">{description}</p>
        </motion.div>
    );
}

/* ---------- Page ---------- */

export function GamePreview({ slug }: { slug: string }) {
    const host = useBrowserHost();
    const [room, setRoom] = useState<RoomState | null>(null);
    const [clockOffset, setClockOffset] = useState(0);
    const [status, setStatus] = useState<ConnectionStatus>("connecting");
    const [gone, setGone] = useState<"missing" | "deleted" | null>(null);
    const [introDone, setIntroDone] = useState(false);

    useEffect(() => {
        const socket = createPartySocket({ room: slug, query: { view: "preview" }, authenticated: false });
        const onOpen = () => setStatus("live");
        const onClose = () => setStatus("offline");
        const onMessage = (event: MessageEvent) => {
            const message = parseServerMessage(event.data);
            if (message?.type === "preview_state") {
                setRoom(message.room);
                setClockOffset(message.serverTime - Date.now());
            }
            if (message?.type === "room_missing" || message?.type === "room_deleted") {
                socket.close();
                setGone(message.type === "room_missing" ? "missing" : "deleted");
            }
        };
        socket.addEventListener("open", onOpen);
        socket.addEventListener("close", onClose);
        socket.addEventListener("message", onMessage);
        return () => socket.close();
    }, [slug]);

    const activeQuestion = room ? findClue(room.board, room.buzz.activeQuestionId) : null;
    const picker =
        room && room.gameMode === "buzz_in" && room.rules.pickMode === "player" && !activeQuestion
            ? room.players.find((player) => player.userId === room.pickerUserId)
            : undefined;

    let stage: ReactNode;
    if (gone) {
        stage = (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <DoorOpen className="size-12 text-white/40" />
                <h2 className="text-4xl font-bold">{gone === "deleted" ? "This room was deleted" : "Room not found"}</h2>
                <p className="text-white/60">Close this window and pick another table.</p>
            </div>
        );
    } else if (!room) {
        stage = (
            <div className="flex h-full items-center justify-center gap-3 font-mono text-sm tracking-widest text-white/60 uppercase">
                <Spinner className="size-5" /> Connecting to the room
            </div>
        );
    } else if (room.gameMode !== "buzz_in") {
        stage = <StandBy title="Stand by" description="The board appears as soon as the room switches to Buzz In." />;
    } else if (!room.board.some((category) => category.clues.some((clue) => clue.filled))) {
        stage = <StandBy title="Waiting for clues" description="The host is still writing the board." />;
    } else {
        stage = (
            <LayoutGroup id="board">
                <Board room={room} introDone={introDone} onIntroDone={() => setIntroDone(true)} />
                <AnimatePresence>
                    {activeQuestion && (
                        <ClueOverlay key={activeQuestion.id} room={room} question={activeQuestion} clockOffset={clockOffset} />
                    )}
                </AnimatePresence>
            </LayoutGroup>
        );
    }

    return (
        <MotionConfig reducedMotion="user">
            <main className="relative flex h-dvh flex-col overflow-hidden bg-[#070b1f] text-white">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(27,49,196,0.45),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(242,95,76,0.18),transparent_55%)]"
                />

                <header className="relative flex items-center justify-between gap-6 px-6 py-4 lg:px-10">
                    <div className="flex min-w-0 items-center gap-4">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-white bg-blue-400 font-pixel-square text-xl text-ink">
                            R
                        </span>
                        <div className="min-w-0">
                            <span className="font-mono text-[11px] tracking-[0.3em] text-white/50 uppercase">Roundtable · Buzz In</span>
                            <h1 className="truncate text-2xl font-bold lg:text-3xl">{room?.title ?? "Game preview"}</h1>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                        <AnimatePresence>
                            {picker && (
                                <motion.span
                                    key={picker.userId}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="flex items-center gap-2 rounded-full bg-mustard py-1 pr-4 pl-1 text-sm font-bold text-ink"
                                >
                                    <UserAvatar name={picker.name} avatarUrl={picker.avatarUrl} seed={picker.userId} size="sm" />
                                    {playerLabel(picker)} picks next
                                </motion.span>
                            )}
                        </AnimatePresence>
                        {host && (
                            <span className="hidden rounded-full border border-white/15 bg-white/5 px-4 py-2 font-mono text-xs text-white/70 md:inline">
                                Join at <strong className="text-white">{host}/rooms/{slug}</strong>
                            </span>
                        )}
                        <span
                            className={cn(
                                "flex items-center gap-2 rounded-full px-3 py-2 font-mono text-[11px] font-semibold uppercase",
                                status === "live" ? "bg-green-400/15 text-green-300" : "bg-coral/15 text-coral"
                            )}
                        >
                            {status === "live" ? <Radio className="size-3.5" /> : <WifiOff className="size-3.5" />}
                            {status === "live" ? "Live" : status === "offline" ? "Reconnecting" : "Connecting"}
                        </span>
                    </div>
                </header>

                <section className="relative min-h-0 flex-1 px-6 pb-2 lg:px-10" aria-live="polite">
                    <div className="relative h-full">{stage}</div>
                </section>

                <footer className="relative px-6 pb-6 lg:px-10">
                    {room && !gone && <ScoreRail room={room} showDeltas={Boolean(activeQuestion)} />}
                </footer>
            </main>
        </MotionConfig>
    );
}
