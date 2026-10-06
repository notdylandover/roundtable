"use client";

import { motion } from "framer-motion";
import { Crown, RotateCcw, Trophy } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { getContestants, playerLabel, rankPlayers, type RoomPlayer, type RoomState } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import type { Send, Viewer } from "../viewer";
import { AnimatedScore, Confetti, StageButton } from "./primitives";

type WinnerStageProps = {
    room: RoomState;
    viewer?: Viewer;
    send?: Send;
};

function ordinal(rank: number) {
    const suffix = rank % 100 >= 11 && rank % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[rank % 10] ?? "th";
    return `${rank}${suffix}`;
}

const PODIUM_STYLE: Record<number, { height: string; color: string; delay: number }> = {
    1: { height: "h-32 @3xl:h-44", color: "bg-mustard", delay: 0.9 },
    2: { height: "h-24 @3xl:h-32", color: "bg-slate-300", delay: 0.5 },
    3: { height: "h-16 @3xl:h-24", color: "bg-amber-600", delay: 0.2 },
};

function PodiumSpot({ player, rank, isViewer }: { player: RoomPlayer; rank: number; isViewer: boolean }) {
    const style = PODIUM_STYLE[Math.min(rank, 3)];
    const champion = rank === 1;

    return (
        <div className="flex w-28 flex-col items-center @3xl:w-40">
            <motion.div
                initial={{ opacity: 0, y: -60, scale: 0.5 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 16, delay: style.delay + 0.35 }}
                className="relative mb-2 flex flex-col items-center gap-1.5"
            >
                {champion && (
                    <motion.span
                        animate={{ y: [0, -6, 0], rotate: [-8, 8, -8] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute -top-8 @3xl:-top-10"
                    >
                        <Crown className="size-8 fill-mustard text-mustard drop-shadow-[0_0_12px_rgba(244,203,59,0.8)] @3xl:size-10" />
                    </motion.span>
                )}
                <UserAvatar
                    name={player.name}
                    avatarUrl={player.avatarUrl}
                    seed={player.userId}
                    size="lg"
                    className={cn(
                        "ring-4",
                        champion ? "size-16 ring-mustard @3xl:size-24" : "size-12 ring-white/30 @3xl:size-16",
                        isViewer && "ring-aqua"
                    )}
                />
                <span className={cn("max-w-full truncate font-bold", champion ? "text-base @3xl:text-xl" : "text-sm @3xl:text-base")}>
                    {playerLabel(player)}
                </span>
                <AnimatedScore value={player.score} className="font-pixel-square text-xl @3xl:text-3xl" />
            </motion.div>
            <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ type: "spring", stiffness: 120, damping: 16, delay: style.delay }}
                className={cn(
                    "flex w-full origin-bottom items-start justify-center rounded-t-xl border-2 border-b-0 border-ink pt-2 font-pixel-square text-3xl text-ink shadow-[inset_0_-8px_0_rgba(0,0,0,0.15)] @3xl:text-5xl",
                    style.height,
                    style.color
                )}
            >
                {rank}
            </motion.div>
        </div>
    );
}

export function WinnerStage({ room, viewer, send }: WinnerStageProps) {
    const [confirmNewGame, setConfirmNewGame] = useState(false);
    const ranked = rankPlayers(getContestants(room));
    const podium = ranked.slice(0, 3);
    // Second place on the left, the winner in the middle, third on the right.
    const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean);
    const rest = ranked.slice(3);
    const winners = ranked.filter((entry) => entry.rank === 1);
    const mine = ranked.find((entry) => entry.player.userId === viewer?.userId);
    const canRestart = Boolean(send && viewer && (viewer.isGameMaster || viewer.isAdmin));

    const headline =
        winners.length === 0
            ? "Game over"
            : winners.length > 1
                ? "It's a tie!"
                : mine?.rank === 1
                    ? "You win!"
                    : `${playerLabel(winners[0].player)} wins!`;

    return (
        <div className="relative flex h-full flex-col items-center gap-4 overflow-y-auto px-2 py-4 text-center @3xl:gap-6 @3xl:py-6">
            {winners.length > 0 && <Confetti />}
            <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/3 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(244,203,59,0.18),transparent_30%,rgba(244,203,59,0.18),transparent_60%,rgba(244,203,59,0.18),transparent)]"
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            />

            <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 1.3 }}
                className="relative flex flex-col items-center gap-1"
            >
                <Trophy className="size-8 text-mustard @3xl:size-10" />
                <h2 className="text-4xl font-black tracking-tight text-balance @3xl:text-6xl @6xl:text-7xl">{headline}</h2>
                {mine && mine.rank > 1 && (
                    <p className="font-mono text-sm text-white/60">You finished {ordinal(mine.rank)} with {mine.player.score.toLocaleString()} points</p>
                )}
            </motion.div>

            {podiumOrder.length > 0 ? (
                <div className="relative mt-8 flex items-end justify-center gap-2 @3xl:mt-12 @3xl:gap-4">
                    {podiumOrder.map((entry) => (
                        <PodiumSpot key={entry.player.userId} player={entry.player} rank={entry.rank} isViewer={entry.player.userId === viewer?.userId} />
                    ))}
                </div>
            ) : (
                <p className="relative text-white/60">No players finished this game.</p>
            )}

            {rest.length > 0 && (
                <ol className="relative flex w-full max-w-md flex-col gap-1.5">
                    {rest.map((entry, index) => (
                        <motion.li
                            key={entry.player.userId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.8 + index * 0.08 }}
                            className={cn(
                                "flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2",
                                entry.player.userId === viewer?.userId && "border-aqua/60"
                            )}
                        >
                            <span className="w-8 font-mono text-xs text-white/50">{ordinal(entry.rank)}</span>
                            <UserAvatar name={entry.player.name} avatarUrl={entry.player.avatarUrl} seed={entry.player.userId} size="sm" />
                            <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{playerLabel(entry.player)}</span>
                            <span className={cn("font-pixel-square text-lg tabular-nums", entry.player.score < 0 && "text-coral")}>
                                {entry.player.score.toLocaleString()}
                            </span>
                        </motion.li>
                    ))}
                </ol>
            )}

            {canRestart && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 2 } }} className="relative pb-2">
                    <StageButton tone="mustard" onClick={() => setConfirmNewGame(true)}>
                        <RotateCcw /> Back to the lobby
                    </StageButton>
                    <ConfirmDialog
                        open={confirmNewGame}
                        onOpenChange={setConfirmNewGame}
                        icon={<RotateCcw />}
                        title="Start a new game?"
                        description="Scores reset to 0, every clue goes back on the board, and everyone returns to the lobby."
                        confirmLabel="Back to lobby"
                        onConfirm={() => send?.({ type: "new_game" })}
                    />
                </motion.div>
            )}
        </div>
    );
}
