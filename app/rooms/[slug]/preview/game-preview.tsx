"use client";

import { MotionConfig } from "framer-motion";
import { DoorOpen, Radio, WifiOff } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { createPartySocket, parseServerMessage, type ConnectionStatus } from "@/lib/party-client";
import type { RoomState } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { PickerChip, StageBody, stageShowsDeltas, stageShowsScores } from "../stage/game-stage";
import { ScoreRail } from "../stage/scores";

const subscribeNoop = () => () => undefined;

function useBrowserHost() {
    return useSyncExternalStore(subscribeNoop, () => window.location.host, () => "");
}

export function GamePreview({ slug }: { slug: string }) {
    const host = useBrowserHost();
    const [room, setRoom] = useState<RoomState | null>(null);
    const [clockOffset, setClockOffset] = useState(0);
    const [status, setStatus] = useState<ConnectionStatus>("connecting");
    const [gone, setGone] = useState<"missing" | "deleted" | null>(null);

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

    const joinUrl = host ? `${host}/rooms/${slug}` : undefined;

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
    } else {
        stage = <StageBody room={room} clockOffset={clockOffset} joinUrl={joinUrl} />;
    }

    return (
        <MotionConfig reducedMotion="user">
            <main className="dark relative flex h-dvh flex-col overflow-hidden bg-[#070b1f] text-white">
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
                        {room && <PickerChip room={room} />}
                        {joinUrl && room?.phase !== "lobby" && (
                            <span className="hidden rounded-full border border-white/15 bg-white/5 px-4 py-2 font-mono text-xs text-white/70 md:inline">
                                Join at <strong className="text-white">{joinUrl}</strong>
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

                <section className="@container relative min-h-0 flex-1 px-6 pb-2 lg:px-10" aria-live="polite">
                    <div className="relative h-full">{stage}</div>
                </section>

                {room && !gone && stageShowsScores(room) && (
                    <footer className="@container relative px-6 pb-6 lg:px-10">
                        <ScoreRail room={room} showDeltas={stageShowsDeltas(room)} />
                    </footer>
                )}
            </main>
        </MotionConfig>
    );
}
