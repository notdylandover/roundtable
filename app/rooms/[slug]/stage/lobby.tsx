"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Crown, LayoutGrid, Play, Radio, Sparkles, Undo2, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { boardProgress, getContestants, playerLabel, type RoomPlayer, type RoomState } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import type { Send, Viewer } from "../viewer";
import { StageButton } from "./primitives";

type LobbyStageProps = {
    room: RoomState;
    viewer?: Viewer;
    send?: Send;
    /** Shown on the big screen so people can join from their phones. */
    joinUrl?: string;
    renderActions?: (player: RoomPlayer) => ReactNode;
};

export function LobbyStage({ room, viewer, send, joinUrl, renderActions }: LobbyStageProps) {
    const [confirmStart, setConfirmStart] = useState(false);
    const contestants = getContestants(room);
    const hosts = room.players.filter((player) => player.isHost || player.isOwner);
    const progress = boardProgress(room.board);
    const readyCount = contestants.filter((player) => room.readyUserIds.includes(player.userId)).length;
    const allReady = contestants.length > 0 && readyCount === contestants.length;
    const me = viewer ? contestants.find((player) => player.userId === viewer.userId) : undefined;
    const meReady = Boolean(me && room.readyUserIds.includes(me.userId));
    const canStart = Boolean(send && viewer && (viewer.isGameMaster || viewer.isAdmin));
    const title = !progress.full ? "Setting up the board" : allReady ? "Everyone's ready!" : "Waiting for players";

    function start() {
        if (allReady) send?.({ type: "start_game" });
        else setConfirmStart(true);
    }

    return (
        <div className="flex h-full flex-col items-center gap-5 overflow-y-auto px-1 py-4 text-center @3xl:gap-7 @3xl:py-8">
            <div className="flex flex-col items-center gap-2">
                <motion.span
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[11px] tracking-[0.3em] text-white/60 uppercase"
                >
                    Lobby
                </motion.span>
                <AnimatePresence mode="wait">
                    <motion.h2
                        key={title}
                        initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -16, filter: "blur(6px)" }}
                        transition={{ type: "spring", stiffness: 220, damping: 24 }}
                        className="text-3xl font-black tracking-tight text-balance @3xl:text-5xl @6xl:text-7xl"
                    >
                        {title}
                    </motion.h2>
                </AnimatePresence>
                {joinUrl && (
                    <p className="mt-1 font-mono text-sm text-white/60 @3xl:text-base">
                        Join at <strong className="text-mustard">{joinUrl}</strong>
                    </p>
                )}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
                <span
                    className={cn(
                        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold @3xl:text-sm",
                        progress.full ? "border-green-400/40 bg-green-400/15 text-green-300" : "border-white/15 bg-white/5 text-white/70"
                    )}
                >
                    <LayoutGrid className="size-4" />
                    {progress.full ? `Board ready · ${room.board.length} categories` : `Board ${progress.filled}/${progress.total} clues`}
                    {!progress.full && (
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/15">
                            <motion.span
                                className="block h-full origin-left rounded-full bg-mustard"
                                initial={false}
                                animate={{ scaleX: progress.total ? progress.filled / progress.total : 0 }}
                            />
                        </span>
                    )}
                </span>
                <span
                    className={cn(
                        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold @3xl:text-sm",
                        allReady ? "border-green-400/40 bg-green-400/15 text-green-300" : "border-white/15 bg-white/5 text-white/70"
                    )}
                >
                    <Users className="size-4" /> {readyCount}/{contestants.length} ready
                </span>
                {room.final.enabled && (
                    <span className="flex items-center gap-2 rounded-full border border-mustard/40 bg-mustard/10 px-3 py-1.5 text-xs font-semibold text-mustard @3xl:text-sm">
                        <Sparkles className="size-4" /> Final Buzz In · {room.final.seconds}s
                    </span>
                )}
                {hosts.map((host) => (
                    <span
                        key={host.userId}
                        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pr-3 pl-1 text-xs font-semibold text-white/70 @3xl:text-sm"
                    >
                        <UserAvatar name={host.name} avatarUrl={host.avatarUrl} seed={host.userId} size="sm" />
                        {playerLabel(host)}
                        {host.isHost ? <Radio className="size-3.5 text-coral" /> : <Crown className="size-3.5 text-mustard" />}
                    </span>
                ))}
            </div>

            <ul className="grid w-full max-w-5xl grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 @3xl:gap-4">
                <AnimatePresence initial={false}>
                    {contestants.map((player, index) => {
                        const ready = room.readyUserIds.includes(player.userId);
                        const isMe = player.userId === viewer?.userId;
                        return (
                            <motion.li
                                key={player.userId}
                                layout
                                initial={{ opacity: 0, scale: 0.6, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.6 }}
                                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                                className={cn(
                                    "relative flex flex-col items-center gap-2 rounded-2xl border-2 px-3 pt-5 pb-3 transition-colors",
                                    ready ? "border-green-400/70 bg-green-400/10" : "border-white/10 bg-white/5",
                                    isMe && "ring-2 ring-aqua/70 ring-offset-2 ring-offset-[#070b1f]"
                                )}
                            >
                                <motion.div
                                    animate={ready ? { y: [0, -6, 0] } : { y: [0, -3, 0] }}
                                    transition={{ duration: ready ? 0.9 : 2.4, repeat: Infinity, delay: index * 0.2, ease: "easeInOut" }}
                                >
                                    <UserAvatar
                                        name={player.name}
                                        avatarUrl={player.avatarUrl}
                                        seed={player.userId}
                                        size="lg"
                                        className={cn("size-14 ring-2", ready ? "ring-green-400" : "ring-white/20")}
                                    />
                                </motion.div>
                                <span className="w-full truncate text-sm font-bold">
                                    {playerLabel(player)}
                                    {isMe && <span className="ml-1 font-mono text-[10px] text-aqua uppercase">You</span>}
                                </span>
                                <span className={cn("font-mono text-[10px] tracking-widest uppercase", ready ? "text-green-300" : "text-white/40")}>
                                    {ready ? "Ready" : "Not ready"}
                                </span>
                                {renderActions && <span className="absolute top-1 left-1">{renderActions(player)}</span>}
                                <AnimatePresence>
                                    {ready && (
                                        <motion.span
                                            initial={{ scale: 0, rotate: -90 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            exit={{ scale: 0, rotate: 90 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 18 }}
                                            className="absolute -top-2.5 -right-2.5 flex size-7 items-center justify-center rounded-full border-2 border-ink bg-green-400 text-ink"
                                        >
                                            <Check className="size-4" strokeWidth={3} />
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </motion.li>
                        );
                    })}
                </AnimatePresence>
                {contestants.length === 0 && (
                    <li className="col-span-full rounded-2xl border-2 border-dashed border-white/15 px-4 py-8 font-mono text-xs tracking-widest text-white/40 uppercase">
                        Waiting for players to join
                    </li>
                )}
            </ul>

            {send && me && (
                <motion.div
                    animate={meReady ? { scale: 1 } : { scale: [1, 1.04, 1] }}
                    transition={meReady ? undefined : { duration: 1.6, repeat: Infinity }}
                >
                    <StageButton
                        tone={meReady ? "green" : "mustard"}
                        className="h-14 px-8 text-lg"
                        onClick={() => send({ type: "set_ready", ready: !meReady })}
                    >
                        {meReady ? <Check /> : <Play />}
                        {meReady ? "Ready!" : "I'm ready"}
                        {meReady && (
                            <span className="ml-1 flex items-center gap-1 font-mono text-[10px] font-semibold uppercase opacity-60">
                                <Undo2 className="size-3!" /> Undo
                            </span>
                        )}
                    </StageButton>
                </motion.div>
            )}

            {canStart && (
                <div className="flex flex-col items-center gap-2">
                    <StageButton
                        tone={allReady ? "green" : "mustard"}
                        className="h-14 px-8 text-lg"
                        disabled={!progress.full || contestants.length === 0}
                        onClick={start}
                    >
                        <Play /> Start game
                    </StageButton>
                    <span className="text-xs text-white/50">
                        {!progress.full
                            ? `Fill every clue to start (${progress.filled}/${progress.total}).`
                            : contestants.length === 0
                                ? "Waiting for at least one player."
                                : allReady
                                    ? "Everyone's ready."
                                    : `${contestants.length - readyCount} not ready yet. You can start anyway.`}
                    </span>
                    <ConfirmDialog
                        open={confirmStart}
                        onOpenChange={setConfirmStart}
                        icon={<Play />}
                        title="Start without everyone ready?"
                        description={`${readyCount} of ${contestants.length} players are ready. Everyone in the room still plays.`}
                        confirmLabel="Start anyway"
                        onConfirm={() => send?.({ type: "start_game", force: true })}
                    />
                </div>
            )}
        </div>
    );
}
