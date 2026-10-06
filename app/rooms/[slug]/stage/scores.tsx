"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { getContestants, playerLabel, type RoomPlayer, type RoomState } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { AnimatedScore } from "./primitives";

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

function ScoreCard({ player, rank, leader, buzzed, isViewer, showDeltas, actions }: {
    player: RoomPlayer;
    rank: number;
    leader: boolean;
    buzzed: boolean;
    isViewer: boolean;
    showDeltas: boolean;
    actions?: ReactNode;
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
                "relative flex max-w-xs min-w-44 flex-1 basis-0 items-center gap-3 rounded-xl border-2 px-3 py-2.5 backdrop-blur @5xl:px-4 @5xl:py-3",
                buzzed
                    ? "border-coral bg-coral/25 shadow-[0_0_40px_rgba(242,95,76,0.45)]"
                    : leader
                        ? "border-mustard/70 bg-white/8"
                        : "border-white/10 bg-white/5",
                isViewer && !buzzed && "ring-2 ring-aqua/70 ring-offset-2 ring-offset-[#070b1f]"
            )}
        >
            <span className="w-4 font-mono text-xs text-white/40">{rank}</span>
            <UserAvatar name={player.name} avatarUrl={player.avatarUrl} seed={player.userId} size="lg" className="ring-2 ring-white/20" />
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-white/80 @5xl:text-base">
                    {leader && <Trophy className="size-3.5 shrink-0 text-mustard" />}
                    <span className="truncate">{playerLabel(player)}</span>
                    {isViewer && <span className="shrink-0 font-mono text-[10px] text-aqua uppercase">You</span>}
                </span>
                <AnimatedScore value={player.score} className="font-pixel-square text-2xl leading-none @5xl:text-4xl" />
            </span>
            {actions}
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

type ScoreRailProps = {
    room: RoomState;
    showDeltas: boolean;
    viewerId?: string | null;
    renderActions?: (player: RoomPlayer) => ReactNode;
};

export function ScoreRail({ room, showDeltas, viewerId = null, renderActions }: ScoreRailProps) {
    const contestants = getContestants(room).sort((left, right) => right.score - left.score);
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
            <ol className="flex flex-wrap items-stretch justify-center gap-3 pt-4">
                <AnimatePresence initial={false}>
                    {contestants.map((player, index) => (
                        <ScoreCard
                            key={player.userId}
                            player={player}
                            rank={index + 1}
                            leader={topScore > 0 && player.score === topScore}
                            buzzed={player.userId === room.buzz.buzzedUserId && !room.buzz.answerRevealed}
                            isViewer={player.userId === viewerId}
                            showDeltas={showDeltas}
                            actions={renderActions?.(player)}
                        />
                    ))}
                </AnimatePresence>
            </ol>
        </LayoutGroup>
    );
}
