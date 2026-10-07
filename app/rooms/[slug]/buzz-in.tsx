"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Flag, Gamepad2, House, Pencil, Radio, RefreshCw, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { UserAvatar } from "@/components/user-avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGameAudio } from "@/hooks/use-game-audio";
import type { ConnectionStatus } from "@/lib/party-client";
import { getContestants, playerLabel, type GamePhase, type RoomState } from "@/lib/protocol";
import { BoardEditor } from "./board-editor";
import { PlayerActions } from "./player-actions";
import { RoomTopBar, ToolbarButton, toolbarButtonClass } from "./room-toolbar";
import { PickerChip, StageBody, stageShowsDeltas, stageShowsScores } from "./stage/game-stage";
import { ScoreRail } from "./stage/scores";
import type { Send, Viewer } from "./viewer";

type BuzzInProps = {
    room: RoomState;
    viewer: Viewer;
    clockOffset: number;
    send: Send;
    status: ConnectionStatus;
    /** Shared room buttons (preview, invite, settings, leave, account) for the top bar. */
    actions: ReactNode;
};

const PHASE_LABEL: Record<GamePhase, string> = {
    lobby: "Lobby",
    playing: "Board",
    final: "Final Buzz In",
    finished: "Game over",
};

type GameAction = "reset_scores" | "reset_board" | "finish_board" | "new_game";

/** Owner/host controls for moving the game along, tucked into a top-bar menu once the game has started. */
function GameMenu({ room, viewer, send }: Pick<BuzzInProps, "room" | "viewer" | "send">) {
    const [confirming, setConfirming] = useState<GameAction | null>(null);
    const playing = room.phase === "playing";
    const hasScores = getContestants(room).some((player) => player.score !== 0);
    const items = [
        playing && viewer.isHost && hasScores && { action: "reset_scores" as const, label: "Reset scores", icon: RotateCcw },
        playing && viewer.isHost && room.buzz.usedQuestionIds.length > 0 && { action: "reset_board" as const, label: "Reset board", icon: RefreshCw },
        playing && viewer.isGameMaster && { action: "finish_board" as const, label: "End board now", icon: Flag, disabled: Boolean(room.buzz.activeQuestionId) },
        (viewer.isGameMaster || viewer.isAdmin) && {
            action: "new_game" as const,
            label: room.phase === "finished" ? "New game" : "Back to lobby",
            icon: House,
        },
    ].filter((item) => item !== false);
    if (room.phase === "lobby" || items.length === 0) return null;

    const confirmCopy: Record<GameAction, { title: string; description: string; confirmLabel: string; destructive?: boolean }> = {
        reset_scores: {
            title: "Reset every score to 0?",
            description: "Clues stay where they are; only the scoreboard is cleared.",
            confirmLabel: "Reset scores",
        },
        reset_board: {
            title: "Put every clue back on the board?",
            description: "Used clues become playable again. Scores are not changed.",
            confirmLabel: "Reset board",
        },
        finish_board: {
            title: "Skip the rest of the board?",
            description: room.final.enabled
                ? "Unplayed clues are skipped and the Final Buzz In starts right away."
                : "Unplayed clues are skipped and everyone goes to the winner screen.",
            confirmLabel: "End board",
        },
        new_game: {
            title: room.phase === "finished" ? "Start a new game?" : "End this game and return to the lobby?",
            description: "Scores reset to 0, every clue goes back on the board, and everyone returns to the lobby.",
            confirmLabel: "Back to lobby",
            destructive: room.phase !== "finished",
        },
    };
    const copy = confirming ? confirmCopy[confirming] : null;

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger render={<button type="button" aria-label="Game controls" className={toolbarButtonClass("dark")} />}>
                    <Gamepad2 />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Game controls</DropdownMenuLabel>
                        {items.map((item) => (
                            <DropdownMenuItem
                                key={item.action}
                                disabled={"disabled" in item && item.disabled}
                                variant={item.action === "new_game" && room.phase !== "finished" ? "destructive" : "default"}
                                onClick={() => setConfirming(item.action)}
                            >
                                <item.icon /> {item.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            {copy && (
                <ConfirmDialog
                    open
                    onOpenChange={(open) => !open && setConfirming(null)}
                    icon={<Gamepad2 />}
                    destructive={copy.destructive}
                    title={copy.title}
                    description={copy.description}
                    confirmLabel={copy.confirmLabel}
                    onConfirm={() => {
                        if (confirming) send({ type: confirming });
                        setConfirming(null);
                    }}
                />
            )}
        </>
    );
}

/** The Buzz In room: a full-screen stage with a compact top bar. */
export function BuzzIn({ room, viewer, clockOffset, send, status, actions }: BuzzInProps) {
    useGameAudio(room);
    const [editing, setEditing] = useState(false);
    const [seen, setSeen] = useState({ phase: room.phase, clue: room.buzz.activeQuestionId });
    // Drop out of edit mode when a clue opens or the phase changes so the owner/host doesn't miss it.
    if (seen.phase !== room.phase || seen.clue !== room.buzz.activeQuestionId) {
        setSeen({ phase: room.phase, clue: room.buzz.activeQuestionId });
        if (seen.phase !== room.phase || room.buzz.activeQuestionId) setEditing(false);
    }

    const host = room.players.find((player) => player.isHost);
    const canEdit = viewer.isGameMaster && (room.phase === "lobby" || room.phase === "playing");
    const showEditor = editing && canEdit;
    const renderActions = viewer.canConfigure
        ? (player: RoomState["players"][number]) => (
            <PlayerActions player={player} room={room} viewer={viewer} send={send} showTeams={false} />
        )
        : undefined;

    return (
        <MotionConfig reducedMotion="user">
            <div className="dark @container relative flex h-dvh flex-col overflow-hidden bg-[#070b1f] text-white [color-scheme:dark]">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(27,49,196,0.45),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(242,95,76,0.18),transparent_55%)]"
                />

                <RoomTopBar
                    tone="dark"
                    title={room.title}
                    status={status}
                    details={
                        <>
                            {(showEditor || room.phase !== "lobby") && (
                                <span className="hidden shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[10px] tracking-[0.25em] text-white/60 uppercase @xl:inline">
                                    {showEditor ? "Editing board" : PHASE_LABEL[room.phase]}
                                </span>
                            )}
                            {host && room.phase !== "lobby" && (
                                <span className="hidden min-w-0 items-center gap-2 text-xs text-white/60 @5xl:flex">
                                    <UserAvatar name={host.name} avatarUrl={host.avatarUrl} seed={host.userId} size="sm" />
                                    <span className="truncate">Hosted by {playerLabel(host)}</span>
                                    <Radio className="size-3.5 shrink-0 text-coral" />
                                </span>
                            )}
                        </>
                    }
                >
                    {!showEditor && <PickerChip room={room} viewerId={viewer.userId} />}
                    {canEdit && (
                        <ToolbarButton
                            tone="dark"
                            label={showEditor ? "Done editing" : "Edit board"}
                            icon={<Pencil />}
                            active={showEditor}
                            showLabel
                            onClick={() => setEditing(!showEditor)}
                        />
                    )}
                    <GameMenu room={room} viewer={viewer} send={send} />
                    {actions}
                </RoomTopBar>

                <main className="relative min-h-0 flex-1 px-3 pb-3 @3xl:px-6 @3xl:pb-4" aria-live="polite">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={showEditor ? "editor" : "stage"}
                            className="relative h-full"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.25 }}
                        >
                            {showEditor ? (
                                <BoardEditor room={room} send={send} />
                            ) : (
                                <StageBody
                                    room={room}
                                    clockOffset={clockOffset}
                                    viewer={viewer}
                                    send={send}
                                    renderActions={renderActions}
                                    onEditBoard={canEdit ? () => setEditing(true) : undefined}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </main>

                {stageShowsScores(room) && !showEditor && (
                    <footer className="relative px-3 pb-3 @3xl:px-6 @3xl:pb-5">
                        <ScoreRail room={room} showDeltas={stageShowsDeltas(room)} viewerId={viewer.userId} renderActions={renderActions} />
                    </footer>
                )}
            </div>
        </MotionConfig>
    );
}
