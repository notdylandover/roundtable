"use client";

import { MotionConfig } from "framer-motion";
import { Flag, House, Radio, RefreshCw, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getContestants, playerLabel, type GamePhase, type RoomState } from "@/lib/protocol";
import { BoardEditor } from "./board-editor";
import { FinalSettings } from "./final-settings";
import { GameRules } from "./game-rules";
import { PlayerActions } from "./player-actions";
import { PickerChip, StageBody, stageShowsDeltas, stageShowsScores } from "./stage/game-stage";
import { ScoreRail } from "./stage/scores";
import { TimerSettings } from "./timer-settings";
import type { Send, Viewer } from "./viewer";

type BuzzInProps = {
    room: RoomState;
    viewer: Viewer;
    clockOffset: number;
    send: Send;
};

const PHASE_LABEL: Record<GamePhase, string> = {
    lobby: "Lobby",
    playing: "Board",
    final: "Final Buzz In",
    finished: "Game over",
};

/** Owner/host controls for moving the game along, shown under the stage once the game has started. */
function GameToolbar({ room, viewer, send }: Omit<BuzzInProps, "clockOffset">) {
    const playing = room.phase === "playing";
    const canRestart = viewer.isGameMaster || viewer.isAdmin;
    const hasScores = getContestants(room).some((player) => player.score !== 0);
    if (room.phase === "lobby" || (!viewer.isGameMaster && !canRestart)) return null;

    return (
        <Card className="flex-row flex-wrap items-center gap-2 rounded-xl border-2 border-ink px-4 py-3 text-ink shadow-[4px_4px_0_var(--ink)] ring-0">
            <span className="mr-auto font-mono text-xs font-semibold uppercase">Game controls</span>
            {playing && viewer.isHost && hasScores && (
                <ConfirmDialog
                    trigger={
                        <Button variant="outline" size="lg">
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
            {playing && viewer.isHost && room.buzz.usedQuestionIds.length > 0 && (
                <ConfirmDialog
                    trigger={
                        <Button variant="outline" size="lg">
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
            {playing && viewer.isGameMaster && (
                <ConfirmDialog
                    trigger={
                        <Button variant="outline" size="lg" disabled={Boolean(room.buzz.activeQuestionId)}>
                            <Flag /> End board now
                        </Button>
                    }
                    icon={<Flag />}
                    title="Skip the rest of the board?"
                    description={
                        room.final.enabled
                            ? "Unplayed clues are skipped and the Final Buzz In starts right away."
                            : "Unplayed clues are skipped and everyone goes to the winner screen."
                    }
                    confirmLabel="End board"
                    onConfirm={() => send({ type: "finish_board" })}
                />
            )}
            {canRestart && (
                <ConfirmDialog
                    trigger={
                        <Button variant="outline" size="lg">
                            <House /> Back to lobby
                        </Button>
                    }
                    icon={<House />}
                    destructive={room.phase !== "finished"}
                    title={room.phase === "finished" ? "Start a new game?" : "End this game and return to the lobby?"}
                    description="Scores reset to 0, every clue goes back on the board, and everyone returns to the lobby."
                    confirmLabel="Back to lobby"
                    onConfirm={() => send({ type: "new_game" })}
                />
            )}
        </Card>
    );
}

export function BuzzIn({ room, viewer, clockOffset, send }: BuzzInProps) {
    const host = room.players.find((player) => player.isHost);
    const renderActions = viewer.canConfigure
        ? (player: RoomState["players"][number]) => (
            <PlayerActions player={player} room={room} viewer={viewer} send={send} showTeams={false} />
        )
        : undefined;

    return (
        <section className="flex flex-col gap-6 px-4 py-8 sm:px-8" aria-label="Buzz In game">
            <MotionConfig reducedMotion="user">
                <div className="dark @container relative overflow-hidden rounded-2xl border-2 border-ink bg-[#070b1f] text-white shadow-[6px_6px_0_var(--ink)]">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(27,49,196,0.45),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(242,95,76,0.18),transparent_55%)]"
                    />
                    <div className="relative flex flex-wrap items-center justify-between gap-3 px-4 pt-4 @3xl:px-6">
                        <div className="flex items-center gap-3">
                            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[11px] tracking-[0.25em] text-white/60 uppercase">
                                Buzz In · {PHASE_LABEL[room.phase]}
                            </span>
                            {host && room.phase !== "lobby" && (
                                <span className="hidden items-center gap-2 text-xs text-white/60 @xl:flex">
                                    <UserAvatar name={host.name} avatarUrl={host.avatarUrl} seed={host.userId} size="sm" />
                                    Hosted by {playerLabel(host)} <Radio className="size-3.5 text-coral" />
                                </span>
                            )}
                        </div>
                        <PickerChip room={room} viewerId={viewer.userId} />
                    </div>

                    <div className="relative h-[clamp(32rem,72dvh,52rem)] p-3 @3xl:px-6 @3xl:py-4" aria-live="polite">
                        <StageBody room={room} clockOffset={clockOffset} viewer={viewer} send={send} renderActions={renderActions} />
                    </div>

                    {stageShowsScores(room) && (
                        <div className="relative px-3 pb-4 @3xl:px-6 @3xl:pb-6">
                            <ScoreRail room={room} showDeltas={stageShowsDeltas(room)} viewerId={viewer.userId} renderActions={renderActions} />
                        </div>
                    )}
                </div>
            </MotionConfig>

            <GameToolbar room={room} viewer={viewer} send={send} />

            {viewer.isGameMaster && <BoardEditor room={room} send={send} />}
            {viewer.isGameMaster && (
                <div className="grid items-start gap-6 lg:grid-cols-2">
                    <GameRules room={room} send={send} />
                    <FinalSettings final={room.final} send={send} />
                    {viewer.isHost && <TimerSettings timer={room.timer} send={send} />}
                </div>
            )}
        </section>
    );
}
