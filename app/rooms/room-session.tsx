"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, DoorOpen, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type PartySocket from "partysocket";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { createPartySocket, parseServerMessage, type ConnectionStatus } from "@/lib/party-client";
import type { ClientMessage, GamePhase, RoomState } from "@/lib/protocol";
import { ROOM_EXPAND, ROOM_EXPAND_LABEL, ROOM_REVEAL, ROOM_REVEAL_TIMEOUT_MS } from "@/lib/transitions";

export type GoneReason = "missing" | "deleted" | "removed";

/** Where the expand-into-room animation starts. */
export type RoomOrigin = { rect: DOMRect; tone: string; title: string };

type RoomSessionValue = {
    /** The room this tab is connected to, even while browsing the lobby. */
    slug: string | null;
    room: RoomState | null;
    clockOffset: number;
    status: ConnectionStatus;
    gone: GoneReason | null;
    /** Connects to a room. Joining a different room leaves the current one. */
    join: (slug: string) => void;
    /** Disconnects from the room. Callers handle navigation. */
    leave: () => void;
    /** Joins and navigates, expanding from `origin` when given. */
    enterRoom: (slug: string, origin?: RoomOrigin) => void;
    send: (message: ClientMessage) => void;
    deleteRoom: () => void;
};

const RoomSessionContext = createContext<RoomSessionValue | null>(null);

export function useRoomSession() {
    const context = useContext(RoomSessionContext);
    if (!context) throw new Error("useRoomSession must be used within RoomSessionProvider.");
    return context;
}

const GONE_TOAST: Record<GoneReason, string> = {
    missing: "That room no longer exists.",
    deleted: "The room you were in was deleted.",
    removed: "You were removed from the room.",
};

const PHASE_LABEL: Record<GamePhase, string> = {
    lobby: "In the lobby",
    playing: "Game in progress",
    final: "Final Buzz In",
    finished: "Game over",
};

type Target = { slug: string; attempt: number };

type Transition = RoomOrigin & {
    id: number;
    slug: string;
    viewport: { width: number; height: number };
    stage: "expanding" | "covering" | "revealing";
};

const FULL_SCREEN = "inset(0px 0px 0px 0px round 0px)";

function clipFrom(rect: DOMRect, viewport: Transition["viewport"], grow = 0) {
    const top = rect.top - grow;
    const right = viewport.width - rect.right - grow;
    const bottom = viewport.height - rect.bottom - grow;
    const left = rect.left - grow;
    return `inset(${top}px ${right}px ${bottom}px ${left}px round ${12 + grow}px)`;
}

function RoomTransitionOverlay({
    transition,
    revealing,
    onExpanded,
    onDone,
}: {
    transition: Transition;
    revealing: boolean;
    onExpanded: () => void;
    onDone: () => void;
}) {
    const target = revealing ? { clipPath: FULL_SCREEN, opacity: 0 } : { clipPath: FULL_SCREEN, opacity: 1 };
    const timing = revealing ? ROOM_REVEAL : ROOM_EXPAND;

    return (
        <div aria-hidden="true" className="pointer-events-auto fixed inset-0 z-[60]">
            {/* The ink layer is 2px larger so the tile keeps its border while it grows. */}
            <motion.div
                className="absolute inset-0 bg-ink"
                initial={{ clipPath: clipFrom(transition.rect, transition.viewport, 2), opacity: 1 }}
                animate={target}
                transition={timing}
            />
            <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center text-ink"
                style={{ backgroundColor: transition.tone }}
                initial={{ clipPath: clipFrom(transition.rect, transition.viewport), opacity: 1 }}
                animate={target}
                transition={timing}
                onAnimationComplete={() => (revealing ? onDone() : onExpanded())}
            >
                <motion.div
                    className="flex flex-col items-center gap-5"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={ROOM_EXPAND_LABEL}
                >
                    <span className="font-mono text-xs tracking-widest text-ink/60 uppercase">Room</span>
                    <h2 className="max-w-4xl text-5xl leading-[0.95] font-bold tracking-tight break-words sm:text-7xl">
                        {transition.title}
                    </h2>
                    <span className="flex items-center gap-2 font-mono text-xs text-ink/60 uppercase">
                        <Spinner className="size-4" /> Joining
                    </span>
                </motion.div>
            </motion.div>
        </div>
    );
}

/** Bottom drawer on the lobby that keeps the room you're in one tap away. */
function ActiveRoomDrawer({
    room,
    onReturn,
    onLeave,
}: {
    room: RoomState;
    onReturn: (origin: RoomOrigin) => void;
    onLeave: () => void;
}) {
    const [open, setOpen] = useState(true);
    const popupRef = useRef<HTMLDivElement>(null);

    function returnToRoom() {
        const rect = popupRef.current?.getBoundingClientRect();
        if (rect) onReturn({ rect, tone: "#f4cb3b", title: room.title });
    }

    return (
        <>
            <Drawer open={open} onOpenChange={setOpen} modal={false} disablePointerDismissal swipeDirection="down">
                <DrawerContent
                    ref={popupRef}
                    className="mx-auto max-w-2xl border-2 border-ink bg-mustard text-ink shadow-[4px_4px_0_var(--ink)]"
                >
                    <div className="flex flex-wrap items-center gap-4 p-4">
                        <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white">
                            <Users className="size-5" />
                            <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-pine motion-safe:animate-pulse" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <DrawerDescription className="font-mono text-[10px] font-semibold tracking-widest text-ink/70 uppercase">
                                You&apos;re still in
                            </DrawerDescription>
                            <DrawerTitle className="truncate text-lg font-bold text-ink">{room.title}</DrawerTitle>
                            <p className="font-mono text-[11px] text-ink/70">
                                {room.players.length} connected · {room.gameMode === "buzz_in" ? PHASE_LABEL[room.phase] : "Teams"}
                            </p>
                        </div>
                        <div className="flex w-full gap-2 sm:w-auto">
                            <Button variant="outline" size="lg" className="h-11 flex-1 border-2 border-ink bg-white px-4 text-sm" onClick={onLeave}>
                                <DoorOpen /> Leave
                            </Button>
                            <Button size="lg" className="h-11 flex-1 border-2 border-ink px-4 text-sm shadow-[3px_3px_0_var(--ink)]" onClick={returnToRoom}>
                                Return to room <ArrowRight />
                            </Button>
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
            <AnimatePresence>
                {!open && (
                    <motion.button
                        type="button"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        onClick={() => setOpen(true)}
                        className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-ink bg-mustard py-2 pr-4 pl-2 text-sm font-bold text-ink shadow-[3px_3px_0_var(--ink)]"
                    >
                        <span className="size-2.5 rounded-full bg-pine motion-safe:animate-pulse" />
                        In {room.title}
                    </motion.button>
                )}
            </AnimatePresence>
        </>
    );
}

export function RoomSessionProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();
    const { session } = useSession();
    const userName = session?.user.name;

    const [target, setTarget] = useState<Target | null>(null);
    const [room, setRoom] = useState<RoomState | null>(null);
    const [clockOffset, setClockOffset] = useState(0);
    const [status, setStatus] = useState<ConnectionStatus>("connecting");
    const [gone, setGone] = useState<GoneReason | null>(null);
    const [transition, setTransition] = useState<Transition | null>(null);

    const socketRef = useRef<PartySocket | null>(null);
    const presenceRef = useRef<PartySocket | null>(null);
    const deletingRef = useRef(false);
    const lastNameRef = useRef(userName);
    const pathnameRef = useRef(pathname);
    // Mirrors state for stable callbacks; updated eagerly in `join` so repeated calls in one tick agree.
    const latestRef = useRef<{ target: Target | null; gone: GoneReason | null }>({ target, gone });

    useEffect(() => {
        pathnameRef.current = pathname;
    }, [pathname]);
    useEffect(() => {
        latestRef.current = { target, gone };
    }, [target, gone]);

    const reset = useCallback((next: Target | null) => {
        latestRef.current = { target: next, gone: null };
        setTarget(next);
        setRoom(null);
        setGone(null);
        setStatus("connecting");
    }, []);

    const join = useCallback(
        (slug: string) => {
            const current = latestRef.current;
            if (current.target?.slug === slug && !current.gone) return;
            reset({ slug, attempt: (current.target?.attempt ?? 0) + 1 });
        },
        [reset]
    );

    const leave = useCallback(() => reset(null), [reset]);

    useEffect(() => {
        if (!target) return;
        const { slug } = target;
        const roomSocket = createPartySocket({ room: slug });
        // A lobby connection tagged with this room keeps the lobby's player counts accurate.
        const presenceSocket = createPartySocket({ room: "lobby", query: { room: slug } });
        socketRef.current = roomSocket;
        presenceRef.current = presenceSocket;
        deletingRef.current = false;

        const closeAll = () => {
            roomSocket.close();
            presenceSocket.close();
        };
        const end = (reason: GoneReason) => {
            closeAll();
            if (pathnameRef.current === `/rooms/${slug}`) {
                latestRef.current = { target, gone: reason };
                setGone(reason);
            } else {
                toast.add({ title: GONE_TOAST[reason], type: "error" });
                reset(null);
            }
        };
        const signIn = () => {
            closeAll();
            reset(null);
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
                    end("missing");
                    break;
                case "room_deleted":
                    if (deletingRef.current) {
                        closeAll();
                        reset(null);
                        router.replace("/rooms");
                    } else {
                        end("deleted");
                    }
                    break;
                case "removed":
                    end("removed");
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
    }, [target, router, reset]);

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

    const deleteRoom = useCallback(() => {
        const slug = latestRef.current.target?.slug;
        if (!slug || presenceRef.current?.readyState !== WebSocket.OPEN) {
            toast.add({ title: "Reconnecting to the lobby. Try again in a moment.", type: "error" });
            return;
        }
        deletingRef.current = true;
        presenceRef.current.send(JSON.stringify({ type: "delete_room", slug } satisfies ClientMessage));
    }, []);

    const enterRoom = useCallback(
        (slug: string, origin?: RoomOrigin) => {
            // Connect right away so the room is usually ready by the time the tile fills the screen.
            join(slug);
            const href = `/rooms/${slug}`;
            if (!origin || reduceMotion) {
                router.push(href);
                return;
            }
            router.prefetch(href);
            setTransition({
                ...origin,
                id: Date.now(),
                slug,
                viewport: { width: window.innerWidth, height: window.innerHeight },
                stage: "expanding",
            });
        },
        [join, reduceMotion, router]
    );

    function onExpanded() {
        if (!transition || transition.stage !== "expanding") return;
        const { id, slug } = transition;
        setTransition({ ...transition, stage: "covering" });
        router.push(`/rooms/${slug}`);
        window.setTimeout(() => {
            setTransition((current) => (current?.id === id ? { ...current, stage: "revealing" } : current));
        }, ROOM_REVEAL_TIMEOUT_MS);
    }

    const roomLoaded =
        transition !== null &&
        pathname === `/rooms/${transition.slug}` &&
        target?.slug === transition.slug &&
        (room !== null || gone !== null);
    const revealing = transition?.stage === "revealing" || (transition?.stage === "covering" && roomLoaded);

    const value: RoomSessionValue = {
        slug: target?.slug ?? null,
        room,
        clockOffset,
        status,
        gone,
        join,
        leave,
        enterRoom,
        send,
        deleteRoom,
    };

    const showDrawer = pathname === "/rooms" && target !== null && room !== null && gone === null && transition === null;

    return (
        <RoomSessionContext.Provider value={value}>
            {children}
            {showDrawer && (
                <ActiveRoomDrawer
                    key={target.slug}
                    room={room}
                    onReturn={(origin) => enterRoom(target.slug, origin)}
                    onLeave={() => {
                        toast.add({ title: `You left ${room.title}.`, type: "success" });
                        leave();
                    }}
                />
            )}
            {transition && (
                <RoomTransitionOverlay
                    key={transition.id}
                    transition={transition}
                    revealing={revealing}
                    onExpanded={onExpanded}
                    onDone={() => setTransition(null)}
                />
            )}
        </RoomSessionContext.Provider>
    );
}
