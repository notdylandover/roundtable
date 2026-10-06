"use client";

import { ArrowLeft, Check, Copy, DoorOpen, MonitorPlay, Radio, Trash2, UserX, Users, WifiOff, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type PartySocket from "partysocket";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { useSession } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { createPartySocket, parseServerMessage, type ConnectionStatus } from "@/lib/party-client";
import type { ClientMessage, RoomState } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { BuzzIn } from "./buzz-in";
import { OwnerControls } from "./owner-controls";
import { TeamsBoard } from "./teams-board";
import { getViewer } from "./viewer";

type GoneReason = "missing" | "deleted" | "removed";

const GONE_COPY: Record<GoneReason, { title: string; description: string; icon: typeof DoorOpen }> = {
    missing: {
        title: "This room doesn't exist",
        description: "It may have been deleted, or the link has a typo.",
        icon: DoorOpen,
    },
    deleted: {
        title: "This room was deleted",
        description: "An admin closed this table. Pick another one from the lobby.",
        icon: Trash2,
    },
    removed: {
        title: "You were removed from this room",
        description: "The room owner or an admin removed you. You can still join other tables.",
        icon: UserX,
    },
};

function GoneScreen({ reason }: { reason: GoneReason }) {
    const copy = GONE_COPY[reason];
    const Icon = copy.icon;
    return (
        <Empty className="mx-4 my-16 min-h-80 border-2 border-dashed border-ink/25 bg-white/60 sm:mx-8">
            <EmptyHeader>
                <EmptyMedia variant="icon" className="size-12 rounded-full border-2 border-ink bg-white">
                    <Icon className="size-5" />
                </EmptyMedia>
                <EmptyTitle className="text-2xl font-bold">{copy.title}</EmptyTitle>
                <EmptyDescription className="text-sm">{copy.description}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Link href="/rooms" className={buttonVariants({ size: "lg" })}>
                    <ArrowLeft /> Back to rooms
                </Link>
            </EmptyContent>
        </Empty>
    );
}

export function RoomClient({ slug }: { slug: string }) {
    const router = useRouter();
    const { session } = useSession();
    const userId = session?.user.id ?? null;
    const userName = session?.user.name;
    const isAdmin = session?.isAdmin === true;
    const socketRef = useRef<PartySocket | null>(null);
    const presenceRef = useRef<PartySocket | null>(null);
    const deletingRef = useRef(false);
    const lastNameRef = useRef(userName);
    const [room, setRoom] = useState<RoomState | null>(null);
    const [clockOffset, setClockOffset] = useState(0);
    const [status, setStatus] = useState<ConnectionStatus>("connecting");
    const [gone, setGone] = useState<GoneReason | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const roomSocket = createPartySocket({ room: slug });
        // A lobby connection tagged with this room keeps the lobby's player counts accurate.
        const presenceSocket = createPartySocket({ room: "lobby", query: { room: slug } });
        socketRef.current = roomSocket;
        presenceRef.current = presenceSocket;

        const closeAll = () => {
            roomSocket.close();
            presenceSocket.close();
        };
        const leave = (reason: GoneReason) => {
            closeAll();
            setGone(reason);
        };
        const signIn = () => {
            closeAll();
            router.replace(`/?next=${encodeURIComponent(`/rooms/${slug}`)}`);
        };

        const onRoomMessage = (event: MessageEvent) => {
            const message = parseServerMessage(event.data);
            if (!message) return;
            switch (message.type) {
                case "room_state":
                    setRoom(message.room);
                    setClockOffset(message.serverTime - Date.now());
                    break;
                case "error":
                    toast.add({ title: message.message, type: "error" });
                    break;
                case "notice":
                    toast.add({ title: message.message, type: "success" });
                    break;
                case "auth_required":
                    signIn();
                    break;
                case "room_missing":
                    leave("missing");
                    break;
                case "room_deleted":
                    if (deletingRef.current) {
                        closeAll();
                        router.replace("/rooms");
                    } else {
                        leave("deleted");
                    }
                    break;
                case "removed":
                    leave("removed");
                    break;
            }
        };
        const onPresenceMessage = (event: MessageEvent) => {
            const message = parseServerMessage(event.data);
            if (message?.type === "notice") toast.add({ title: message.message, type: "success" });
            if (message?.type === "error") toast.add({ title: message.message, type: "error" });
            if (message?.type === "auth_required") signIn();
        };
        const onOpen = () => setStatus("live");
        const onClose = () => setStatus("offline");

        roomSocket.addEventListener("open", onOpen);
        roomSocket.addEventListener("close", onClose);
        roomSocket.addEventListener("message", onRoomMessage);
        presenceSocket.addEventListener("message", onPresenceMessage);
        return () => {
            socketRef.current = null;
            presenceRef.current = null;
            closeAll();
        };
    }, [router, slug]);

    // Guests can rename themselves mid-game; push the new name to the room.
    useEffect(() => {
        if (!userName || userName === lastNameRef.current) return;
        lastNameRef.current = userName;
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: "set_name", name: userName } satisfies ClientMessage));
        }
    }, [userName]);

    const send = useCallback((message: ClientMessage) => {
        if (socketRef.current?.readyState !== WebSocket.OPEN) {
            toast.add({ title: "Reconnecting to the room. Try again in a moment.", type: "error" });
            return;
        }
        socketRef.current.send(JSON.stringify(message));
    }, []);

    function deleteRoom() {
        if (presenceRef.current?.readyState !== WebSocket.OPEN) {
            toast.add({ title: "Reconnecting to the lobby. Try again in a moment.", type: "error" });
            return;
        }
        deletingRef.current = true;
        presenceRef.current.send(JSON.stringify({ type: "delete_room", slug } satisfies ClientMessage));
    }

    async function copyInvite() {
        await navigator.clipboard.writeText(`${window.location.origin}/rooms/${slug}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    }

    const header = (
        <AppHeader
            status={gone ? undefined : status}
            leading={
                <>
                    <Link href="/rooms" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-10 gap-1.5 text-sm")}>
                        <ArrowLeft /> Rooms
                    </Link>
                    <Separator orientation="vertical" className="h-6 bg-ink/20" />
                    <span className="truncate font-mono text-[11px] font-semibold text-ink/60 uppercase">Room / {slug}</span>
                </>
            }
        />
    );

    if (gone || !room) {
        return (
            <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col border-x-2 border-ink/10">
                {header}
                {gone ? (
                    <GoneScreen reason={gone} />
                ) : (
                    <div className="flex flex-1 items-center justify-center gap-3 font-mono text-xs text-ink/60 uppercase">
                        <Spinner className="size-5" /> Joining the room…
                    </div>
                )}
            </div>
        );
    }

    const viewer = getViewer(room, userId, isAdmin);
    const subtitle = viewer.isOwner
        ? "You own this room"
        : viewer.isHost
            ? "You're hosting"
            : viewer.isAdmin
                ? "Admin view"
                : room.gameMode === "buzz_in"
                    ? "Get ready to buzz"
                    : "Choose where you want to sit";

    return (
        <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col border-x-2 border-ink/10 pb-16">
            {header}

            <section className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-ink px-4 pt-10 pb-8 sm:px-8">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge
                            variant="outline"
                            className={cn(
                                "h-6 gap-1.5 border-2 px-2.5 font-mono text-[10px] uppercase",
                                status === "live" ? "border-pine/30 bg-green-100 text-pine" : "border-destructive/30 bg-destructive/10 text-destructive"
                            )}
                        >
                            {status === "live" ? <Radio /> : <WifiOff />}
                            {status === "live" ? "Room live" : status === "offline" ? "Reconnecting" : "Joining"}
                        </Badge>
                        <Badge variant="outline" className="h-6 gap-1.5 border-2 border-ink/15 bg-white px-2.5 font-mono text-[10px] uppercase">
                            {room.gameMode === "buzz_in" ? <Zap /> : <Users />}
                            {room.gameMode === "buzz_in" ? "Buzz In" : "Teams"}
                        </Badge>
                    </div>
                    <h1 className="mt-4 text-5xl leading-[0.95] font-bold tracking-tight break-words sm:text-7xl">{room.title}</h1>
                    <p className="mt-3 font-mono text-xs text-ink/60">
                        {room.players.length} connected · {subtitle}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {room.gameMode === "buzz_in" && (
                        <a
                            href={`/rooms/${slug}/preview`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(buttonVariants({ size: "lg" }), "h-11 border-2 border-ink px-4 text-sm shadow-[3px_3px_0_var(--coral)]")}
                        >
                            <MonitorPlay /> Open preview
                        </a>
                    )}
                    <Button variant="outline" size="lg" className="h-11 border-2 border-ink bg-white px-4 text-sm" onClick={copyInvite}>
                        {copied ? <Check /> : <Copy />}
                        {copied ? "Copied" : "Copy invite"}
                    </Button>
                </div>
            </section>

            <OwnerControls room={room} viewer={viewer} send={send} onDeleteRoom={deleteRoom} />

            {room.gameMode === "buzz_in" ? (
                <BuzzIn room={room} viewer={viewer} clockOffset={clockOffset} send={send} />
            ) : (
                <TeamsBoard room={room} viewer={viewer} send={send} />
            )}
        </div>
    );
}
