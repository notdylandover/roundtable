"use client";

import {
    CheckCircle2,
    Eye,
    KeyRound,
    Lock,
    RefreshCw,
    RotateCcw,
    SendHorizontal,
    SkipForward,
    TimerReset,
    TimerOff,
    Trophy,
    XCircle,
    Zap,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { findClue, playerLabel, type ActiveClue as ActiveClueData, type RoomPlayer, type RoomState } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { ClueTimer } from "./clue-timer";
import { GameRules } from "./game-rules";
import { PlayerActions } from "./player-actions";
import { BoardEditor } from "./board-editor";
import { PlayerRoles } from "./teams-board";
import { TimerSettings } from "./timer-settings";
import type { Send, Viewer } from "./viewer";

type BuzzInProps = {
    room: RoomState;
    viewer: Viewer;
    clockOffset: number;
    send: Send;
};

function Scoreboard({ room, viewer, send, contestants }: Omit<BuzzInProps, "clockOffset"> & { contestants: RoomPlayer[] }) {
    const host = room.players.find((player) => player.isHost);

    return (
        <Card className="gap-0 rounded-xl border-2 border-ink py-0 text-ink shadow-[4px_4px_0_var(--ink)] ring-0">
            <div className="flex flex-wrap items-center gap-3 border-b-2 border-ink px-4 py-3">
                <Trophy className="size-4" />
                <span className="font-mono text-xs font-semibold uppercase">Scoreboard</span>
                {host && (
                    <Badge variant="outline" className="gap-1.5 border-ink/20">
                        <UserAvatar name={host.name} avatarUrl={host.avatarUrl} seed={host.userId} size="sm" className="size-4" />
                        Hosted by {playerLabel(host)}
                    </Badge>
                )}
                {viewer.isHost && contestants.some((player) => player.score !== 0) && (
                    <ConfirmDialog
                        trigger={
                            <Button variant="ghost" size="sm" className="ml-auto">
                                <RotateCcw /> Reset scores
                            </Button>
                        }
                        icon={<RotateCcw />}
                        title="Reset every score to 0?"
                        description="Clues stay where they are; only the scoreboard is cleared."
                        confirmLabel="Reset scores"
                        onConfirm={() => send({ type: "reset_scores" })}
                    />
                )}
            </div>
            <ol className="flex gap-2 overflow-x-auto p-3">
                {contestants.map((player, index) => (
                    <li
                        key={player.userId}
                        className={cn(
                            "flex min-w-48 items-center gap-2.5 rounded-lg border-2 px-3 py-2",
                            player.userId === room.buzz.buzzedUserId && !room.buzz.answerRevealed
                                ? "border-coral bg-coral/15"
                                : "border-ink/10 bg-white"
                        )}
                    >
                        <span className="w-4 font-mono text-[10px] text-ink/40">{index + 1}</span>
                        <UserAvatar name={player.name} avatarUrl={player.avatarUrl} seed={player.userId} size="sm" />
                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-semibold">{playerLabel(player)}</span>
                                <PlayerRoles player={player} viewerId={viewer.userId} />
                            </span>
                        </span>
                        <strong className={cn("font-mono text-lg tabular-nums", player.score < 0 && "text-destructive")}>
                            {player.score}
                        </strong>
                        <PlayerActions player={player} room={room} viewer={viewer} send={send} showTeams={false} />
                    </li>
                ))}
                {contestants.length === 0 && (
                    <li className="px-1 py-2 text-sm text-ink/50">Waiting for players to join…</li>
                )}
            </ol>
        </Card>
    );
}

function ClueBoard({ room, viewer, send }: Omit<BuzzInProps, "clockOffset">) {
    const hasClues = room.board.some((category) => category.clues.some((clue) => clue.filled));
    const picker = room.rules.pickMode === "player" ? room.players.find((player) => player.userId === room.pickerUserId) : undefined;
    const isPicker = Boolean(picker) && picker?.userId === viewer.userId;
    const canPick = viewer.isHost || isPicker;
    const heading = isPicker
        ? "Your pick! Choose a category and clue"
        : picker
            ? `${playerLabel(picker)} is choosing a clue`
            : viewer.isHost
                ? "Choose a clue"
                : "Waiting for the host to pick a clue";

    return (
        <Card
            className={cn(
                "gap-0 overflow-hidden rounded-xl border-2 border-ink py-0 text-ink shadow-[4px_4px_0_var(--ink)] ring-0",
                isPicker && "shadow-[4px_4px_0_var(--coral)]"
            )}
        >
            <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink px-4 py-3", isPicker ? "bg-mustard" : "bg-white")}>
                <div className="flex items-center gap-3">
                    {picker && (
                        <UserAvatar name={picker.name} avatarUrl={picker.avatarUrl} seed={picker.userId} className="ring-2 ring-ink" />
                    )}
                    <div>
                        <span className="font-mono text-[10px] font-semibold text-ink/60 uppercase">
                            {room.rules.pickMode === "player" ? "Buzz In · players pick" : "Buzz In"}
                        </span>
                        <h2 className="text-xl font-bold">{heading}</h2>
                    </div>
                </div>
                {viewer.isHost && room.buzz.usedQuestionIds.length > 0 && (
                    <ConfirmDialog
                        trigger={
                            <Button variant="outline" size="sm">
                                <RefreshCw /> Reset board
                            </Button>
                        }
                        icon={<RefreshCw />}
                        title="Put every clue back on the board?"
                        description="Used clues become playable again. Scores are not changed."
                        confirmLabel="Reset board"
                        onConfirm={() => send({ type: "reset_board" })}
                    />
                )}
            </div>

            {hasClues ? (
                <div className="overflow-x-auto bg-ink p-2">
                    <div
                        className="grid gap-2"
                        style={{ gridTemplateColumns: `repeat(${room.board.length}, minmax(8.5rem, 1fr))` }}
                    >
                        {room.board.map((category) => (
                            <div className="flex flex-col gap-2" key={category.id}>
                                <div className="flex min-h-16 items-center justify-center rounded-md bg-board px-2 text-center text-xs font-bold text-white uppercase">
                                    {category.name}
                                </div>
                                {category.clues.map((clue) => {
                                    const used = room.buzz.usedQuestionIds.includes(clue.id);
                                    const playable = clue.filled && !used;
                                    return (
                                        <Button
                                            key={clue.id}
                                            disabled={!canPick || !playable}
                                            onClick={() => send({ type: "select_question", questionId: clue.id })}
                                            className={cn(
                                                "h-16 rounded-md bg-board font-pixel-square text-2xl text-mustard hover:bg-board/80 disabled:opacity-100",
                                                !playable && "bg-board/25 text-white/25"
                                            )}
                                        >
                                            {playable ? clue.value : "—"}
                                        </Button>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <Empty className="min-h-56 rounded-none">
                    <EmptyHeader>
                        <EmptyMedia className="font-mono text-5xl font-bold text-line">00</EmptyMedia>
                        <EmptyTitle className="text-lg font-bold">No clues yet</EmptyTitle>
                        <EmptyDescription className="text-sm">
                            {viewer.isGameMaster
                                ? "Fill in the board below, or load prefilled categories."
                                : "The host is still building the board."}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
        </Card>
    );
}

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
            <p className="flex items-center gap-2 text-sm text-ink/70">
                <Lock className="size-4" /> Locked in: <strong className="text-ink">{lockedIn}</strong> — waiting for the host
            </p>
        );
    }

    return (
        <form onSubmit={submit} className="flex w-full max-w-md gap-2">
            <Input
                autoFocus
                value={text}
                maxLength={160}
                onChange={(event) => setText(event.target.value)}
                placeholder="Type your answer"
                aria-label="Your answer"
                className="h-11 border-2 border-ink bg-cream text-base md:text-base"
            />
            <Button type="submit" disabled={!text.trim()} className="h-11 border-2 border-ink px-4 text-sm">
                <SendHorizontal /> Lock in
            </Button>
        </form>
    );
}

function AttemptsList({ room }: { room: RoomState }) {
    return (
        <div className="rounded-lg border-2 border-ink/15 bg-paper p-3">
            <p className="mb-2 font-mono text-[10px] font-semibold text-ink/60 uppercase">Typed answers · players can&apos;t see these</p>
            <ul className="flex flex-col gap-2">
                {room.buzz.attempts.map((attempt, index) => {
                    const player = room.players.find((candidate) => candidate.userId === attempt.userId);
                    return (
                        <li
                            key={`${attempt.userId}-${index}`}
                            className={cn(
                                "flex items-center gap-2.5 rounded-md border-2 bg-white px-3 py-2",
                                attempt.result === "pending" && "border-coral",
                                attempt.result === "correct" && "border-pine/50",
                                attempt.result === "incorrect" && "border-ink/10 opacity-70"
                            )}
                        >
                            <UserAvatar
                                name={player?.name ?? "?"}
                                avatarUrl={player?.avatarUrl ?? null}
                                seed={attempt.userId}
                                size="sm"
                            />
                            <span className="text-xs font-semibold text-ink/60">{player ? playerLabel(player) : "Player"}</span>
                            <span className={cn("min-w-0 flex-1 truncate text-base font-bold", attempt.result === "incorrect" && "line-through")}>
                                {attempt.text}
                            </span>
                            <Badge
                                variant="outline"
                                className={cn(
                                    "border-ink/15",
                                    attempt.result === "correct" && "border-pine/40 bg-green-100 text-pine",
                                    attempt.result === "incorrect" && "border-destructive/30 bg-destructive/10 text-destructive"
                                )}
                            >
                                {attempt.result === "pending" ? "Needs judging" : attempt.result === "correct" ? "Correct" : "Incorrect"}
                            </Badge>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function ActiveClue({ room, viewer, clockOffset, send, question }: BuzzInProps & { question: ActiveClueData }) {
    const typed = room.rules.answerMode === "typed";
    const pendingAttempt = room.buzz.attempts.find(
        (attempt) => attempt.userId === room.buzz.buzzedUserId && attempt.result === "pending"
    );
    const { buzz } = room;
    const buzzedPlayer = room.players.find((player) => player.userId === buzz.buzzedUserId);
    const me = room.players.find((player) => player.userId === viewer.userId);
    const excluded = viewer.userId ? buzz.excludedUserIds.includes(viewer.userId) : false;
    const outPlayers = room.players.filter((player) => buzz.excludedUserIds.includes(player.userId));
    const showTimer = buzz.timerEndsAt !== null || buzz.timerPausedMs !== null || buzz.timerExpired;
    const canBuzz =
        !viewer.isGameMaster && Boolean(me) && !buzz.buzzedUserId && !buzz.answerRevealed && !buzz.timerExpired && !excluded;

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
        <Card className="gap-0 overflow-hidden rounded-xl border-2 border-ink py-0 text-ink shadow-[4px_4px_0_var(--ink)] ring-0">
            <div className="flex flex-col gap-6 bg-board px-5 pt-4 pb-8 text-white sm:px-8">
                <div className="flex items-center justify-between gap-3">
                    <Badge className="h-6 bg-white/15 px-3 text-xs text-white uppercase">{question.category}</Badge>
                    <strong className="font-pixel-square text-4xl text-mustard">{question.value}</strong>
                </div>
                <h2 className="mx-auto max-w-3xl text-center text-3xl leading-tight font-bold text-balance sm:text-4xl">
                    {question.prompt}
                </h2>
                {showTimer && (
                    <div className="mx-auto w-full max-w-xl">
                        <ClueTimer key={`${question.id}-${buzz.timerEndsAt}`} buzz={buzz} timer={room.timer} clockOffset={clockOffset} />
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-4 bg-white p-5 sm:px-8">
                {viewer.isGameMaster && !buzz.answerRevealed && (
                    <Alert className="border-2 border-dashed border-ink/20 bg-paper">
                        <KeyRound />
                        <AlertTitle>Answer · players can&apos;t see this</AlertTitle>
                        <AlertDescription className="text-base font-semibold text-ink">{question.answer}</AlertDescription>
                    </Alert>
                )}

                {buzz.answerRevealed && (
                    <div className="rounded-lg border-2 border-ink bg-mustard px-4 py-3">
                        <span className="font-mono text-[10px] font-semibold uppercase">Correct answer</span>
                        <p className="text-2xl font-bold">{question.answer}</p>
                    </div>
                )}

                <div className="flex min-h-24 flex-col items-center justify-center gap-2 text-center">
                    {buzzedPlayer && buzz.answerRevealed ? (
                        <div className="flex items-center gap-3 rounded-full border-2 border-ink bg-green-300 px-5 py-2.5 shadow-[3px_3px_0_var(--ink)]">
                            <CheckCircle2 className="size-5" />
                            <UserAvatar name={buzzedPlayer.name} avatarUrl={buzzedPlayer.avatarUrl} seed={buzzedPlayer.userId} size="sm" />
                            <span className="text-lg font-bold">
                                {buzzedPlayer.userId === viewer.userId ? "You got it!" : `${playerLabel(buzzedPlayer)} got it!`} +{question.value}
                            </span>
                        </div>
                    ) : buzzedPlayer ? (
                        <>
                            <div className="flex items-center gap-3 rounded-full border-2 border-ink bg-coral px-5 py-2.5 shadow-[3px_3px_0_var(--ink)]">
                                <Zap className="size-5" />
                                <UserAvatar name={buzzedPlayer.name} avatarUrl={buzzedPlayer.avatarUrl} seed={buzzedPlayer.userId} size="sm" />
                                <span className="text-lg font-bold">
                                    {buzzedPlayer.userId !== viewer.userId
                                        ? `${playerLabel(buzzedPlayer)} buzzed first`
                                        : typed
                                            ? "You buzzed in — type your answer!"
                                            : "You buzzed in — answer out loud!"}
                                </span>
                            </div>
                            {typed && buzzedPlayer.userId === viewer.userId && (
                                <TypedAnswerForm key={`${question.id}-${buzz.excludedUserIds.length}`} send={send} />
                            )}
                            {typed && buzzedPlayer.userId !== viewer.userId && !viewer.isGameMaster && (
                                <span className="text-xs text-ink/50">They&apos;re typing their answer…</span>
                            )}
                        </>
                    ) : buzz.answerRevealed ? (
                        <span className="text-sm text-ink/60">This clue is finished.</span>
                    ) : buzz.timerExpired ? (
                        <span className="flex items-center gap-2 font-semibold text-destructive">
                            <TimerOff className="size-4" /> Time&apos;s up — buzzers are locked
                        </span>
                    ) : viewer.isGameMaster ? (
                        <span className="text-sm text-ink/60">Waiting for someone to buzz in…</span>
                    ) : (
                        <>
                            <Button
                                onClick={() => send({ type: "buzz" })}
                                disabled={!canBuzz}
                                className="h-20 w-full max-w-sm rounded-full border-2 border-ink bg-coral text-2xl font-bold text-ink shadow-[5px_5px_0_var(--ink)] hover:bg-coral/85 active:translate-x-1 active:translate-y-1 active:shadow-none [&_svg:not([class*='size-'])]:size-7"
                            >
                                <Zap />
                                {excluded ? "You're out this clue" : "Buzz in"}
                            </Button>
                            {canBuzz && (
                                <span className="text-xs text-ink/50">
                                    or press <Kbd>Space</Kbd>
                                </span>
                            )}
                        </>
                    )}
                </div>

                {viewer.isGameMaster && typed && buzz.attempts.length > 0 && <AttemptsList room={room} />}

                {outPlayers.length > 0 && !buzz.answerRevealed && (
                    <p className="text-center text-xs text-ink/60">
                        Out this clue: {outPlayers.map((player) => playerLabel(player)).join(", ")}
                    </p>
                )}

                {viewer.isHost && (
                    <div className="flex flex-wrap justify-center gap-2 border-t-2 border-ink/10 pt-4">
                        {typed && buzzedPlayer && !buzz.answerRevealed && !pendingAttempt && (
                            <p className="w-full text-center text-xs text-ink/60">
                                Waiting for {playerLabel(buzzedPlayer)} to type an answer. You can still judge now.
                            </p>
                        )}
                        {buzzedPlayer && !buzz.answerRevealed && (
                            <>
                                <Button variant="success" size="lg" onClick={() => send({ type: "judge_buzz", correct: true })}>
                                    <CheckCircle2 /> Correct (+{question.value})
                                </Button>
                                <Button variant="destructive" size="lg" onClick={() => send({ type: "judge_buzz", correct: false })}>
                                    <XCircle /> Incorrect (−{question.value})
                                </Button>
                            </>
                        )}
                        {!buzz.answerRevealed && (
                            <Button variant="outline" size="lg" onClick={() => send({ type: "reveal_answer" })}>
                                <Eye /> Reveal answer
                            </Button>
                        )}
                        {room.timer.enabled && !buzz.answerRevealed && (
                            <Button variant="outline" size="lg" onClick={() => send({ type: "restart_timer" })}>
                                <TimerReset /> Restart timer
                            </Button>
                        )}
                        <Button size="lg" onClick={() => send({ type: "end_question" })}>
                            <SkipForward /> Close clue
                        </Button>
                    </div>
                )}
            </div>
        </Card>
    );
}

export function BuzzIn({ room, viewer, clockOffset, send }: BuzzInProps) {
    const activeQuestion = findClue(room.board, room.buzz.activeQuestionId);
    // The owner and host can see answers, so they don't compete.
    const contestants = room.players
        .filter((player) => !player.isHost && !player.isOwner)
        .sort((left, right) => right.score - left.score);

    return (
        <section className="flex flex-col gap-6 px-4 py-8 sm:px-8" aria-label="Buzz In game">
            <Scoreboard room={room} viewer={viewer} send={send} contestants={contestants} />

            {activeQuestion ? (
                <ActiveClue room={room} viewer={viewer} clockOffset={clockOffset} send={send} question={activeQuestion} />
            ) : (
                <ClueBoard room={room} viewer={viewer} send={send} />
            )}

            {viewer.isGameMaster && <BoardEditor room={room} send={send} />}
            {viewer.isGameMaster && (
                <div className="grid items-start gap-6 lg:grid-cols-2">
                    <GameRules room={room} send={send} />
                    {viewer.isHost && <TimerSettings timer={room.timer} send={send} />}
                </div>
            )}
        </section>
    );
}
