"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CirclePlus, Search, ShieldCheck, Trash2, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type PartySocket from "partysocket";
import { useDeferredValue, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { AppHeader } from "@/components/app-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useSession } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createRoomSlug } from "@/lib/names";
import { createPartySocket, parseServerMessage, type ConnectionStatus } from "@/lib/party-client";
import type { ClientMessage, RoomSummary } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { useRoomSession, type RoomOrigin } from "./room-session";

const CARD_TONES = ["#ffffff", "#fff5d2", "#dcf3f5"];
const CREATE_TONE = "#f25f4c";

type RoomCardProps = {
    room: RoomSummary;
    index: number;
    isAdmin: boolean;
    joined: boolean;
    onDelete: (slug: string) => void;
    onOpen: (slug: string, origin: RoomOrigin) => void;
};

function RoomCard({ room, index, isAdmin, joined, onDelete, onOpen }: RoomCardProps) {
    const live = room.playerCount > 0;
    const tone = CARD_TONES[index % CARD_TONES.length];
    const cardRef = useRef<HTMLDivElement>(null);

    function open(event: MouseEvent<HTMLAnchorElement>) {
        // Let new-tab and other modified clicks behave like normal links.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const rect = cardRef.current?.getBoundingClientRect();
        if (!rect) return;
        event.preventDefault();
        onOpen(room.slug, { rect, tone, title: room.title });
    }

    return (
        <motion.li
            layout
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.04 }}
        >
            <Card
                ref={cardRef}
                style={{ backgroundColor: tone }}
                className={cn(
                    "group relative h-full min-h-56 justify-between gap-6 rounded-xl border-2 border-ink p-5 text-ink shadow-[4px_4px_0_var(--ink)] ring-0 transition-[translate,box-shadow] duration-150 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-aqua hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_var(--ink)]",
                    joined && "ring-3 ring-pine/60"
                )}
            >
                <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase">
                    <span className={cn("size-2 rounded-full", live ? "bg-pine ring-3 ring-pine/20" : "bg-line")} />
                    {joined ? "You're here" : live ? "In session" : "Waiting"}
                    <Badge variant="outline" className="ml-auto border-ink/25 bg-white/70 text-ink">
                        {room.gameMode === "buzz_in" ? <Zap /> : <Users />}
                        {room.gameMode === "buzz_in" ? "Buzz In" : "Teams"}
                    </Badge>
                </div>

                <div className="min-w-0">
                    <h3 className="text-2xl leading-tight font-bold break-words">
                        <Link href={`/rooms/${room.slug}`} onClick={open} className="outline-none after:absolute after:inset-0">
                            {room.title}
                        </Link>
                    </h3>
                    <p className="mt-1 truncate font-mono text-[10px] text-ink/50">{room.slug}</p>
                </div>

                <div className="flex items-end justify-between gap-3">
                    <div className="flex items-baseline gap-1.5">
                        <Users className="size-4 self-center" />
                        <strong className="text-3xl tabular-nums">{room.playerCount}</strong>
                        <span className="font-mono text-[10px] text-ink/50 uppercase">
                            {room.playerCount === 1 ? "player" : "players"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <ConfirmDialog
                                trigger={
                                    <Button
                                        variant="destructive"
                                        size="icon-lg"
                                        className="relative z-10 size-9 rounded-full border-2 border-destructive/30"
                                        aria-label={`Delete ${room.title}`}
                                    >
                                        <Trash2 />
                                    </Button>
                                }
                                icon={<Trash2 />}
                                destructive
                                title={`Delete “${room.title}”?`}
                                description="Everyone inside is disconnected and the room's clues, scores, and settings are erased. This can't be undone."
                                confirmLabel="Delete room"
                                onConfirm={() => onDelete(room.slug)}
                            />
                        )}
                        <span className="flex size-9 items-center justify-center rounded-full border-2 border-ink bg-white transition-colors group-hover:bg-ink group-hover:text-white">
                            <ArrowUpRight className="size-4" />
                        </span>
                    </div>
                </div>
            </Card>
        </motion.li>
    );
}

export function RoomsLobby() {
    const router = useRouter();
    const { session } = useSession();
    const { slug: joinedSlug, room: joinedRoom, enterRoom } = useRoomSession();
    const isAdmin = session?.isAdmin === true;
    const socketRef = useRef<PartySocket | null>(null);
    const creatingRef = useRef(false);
    const createButtonRef = useRef<HTMLButtonElement>(null);
    const enterRoomRef = useRef(enterRoom);
    const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>("connecting");
    const [query, setQuery] = useState("");
    const [roomTitle, setRoomTitle] = useState("");
    const [creating, setCreating] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const deferredQuery = useDeferredValue(query.trim().toLowerCase());

    useEffect(() => {
        enterRoomRef.current = enterRoom;
    }, [enterRoom]);

    useEffect(() => {
        const socket = createPartySocket({ room: "lobby" });
        socketRef.current = socket;

        const stopCreating = () => {
            creatingRef.current = false;
            setCreating(false);
        };
        const onOpen = () => setStatus("live");
        const onClose = () => setStatus("offline");
        const onMessage = (event: MessageEvent) => {
            const message = parseServerMessage(event.data);
            if (!message) return;
            if (message.type === "lobby_state") setRooms(message.rooms);
            if (message.type === "room_created") {
                const rect = createButtonRef.current?.getBoundingClientRect();
                enterRoomRef.current(
                    message.room.slug,
                    rect ? { rect, tone: CREATE_TONE, title: message.room.title } : undefined
                );
            }
            if (message.type === "notice") toast.add({ title: message.message, type: "success" });
            if (message.type === "error") {
                if (creatingRef.current) {
                    setFormError(message.message);
                    stopCreating();
                } else {
                    toast.add({ title: message.message, type: "error" });
                }
            }
            if (message.type === "auth_required") {
                socket.close();
                router.replace("/?next=/rooms");
            }
        };

        socket.addEventListener("open", onOpen);
        socket.addEventListener("close", onClose);
        socket.addEventListener("message", onMessage);
        return () => {
            socketRef.current = null;
            socket.close();
        };
    }, [router]);

    function send(message: ClientMessage) {
        if (socketRef.current?.readyState !== WebSocket.OPEN) {
            toast.add({ title: "The lobby is reconnecting. Try again in a moment.", type: "error" });
            return false;
        }
        socketRef.current.send(JSON.stringify(message));
        return true;
    }

    function createRoom(event: FormEvent) {
        event.preventDefault();
        const title = roomTitle.replace(/\s+/g, " ").trim();
        if (title.length < 3 || title.length > 40) {
            setFormError("Room names must be between 3 and 40 characters.");
            return;
        }
        setFormError(null);
        if (send({ type: "create_room", title, slug: createRoomSlug(title) })) {
            creatingRef.current = true;
            setCreating(true);
        }
    }

    const visibleRooms = (rooms ?? []).filter((room) =>
        deferredQuery ? `${room.title} ${room.slug}`.toLowerCase().includes(deferredQuery) : true
    );
    const playersOnline = (rooms ?? []).reduce((total, room) => total + room.playerCount, 0);

    return (
        <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col border-x-2 border-ink/10">
            <AppHeader status={status} />

            <section className="flex flex-wrap items-end justify-between gap-6 px-4 pt-12 pb-10 sm:px-8 sm:pt-16">
                <div>
                    <p className="font-mono text-xs tracking-widest text-ink/60 uppercase">
                        Welcome{session ? `, ${session.user.name}` : ""}
                    </p>
                    <h1 className="mt-3 text-5xl leading-[0.95] font-bold tracking-tight sm:text-7xl">Open tables</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                        <Tooltip>
                            <TooltipTrigger render={<Badge className="h-7 gap-1.5 bg-violet-600 px-3 text-xs text-white" />}>
                                <ShieldCheck /> Admin mode
                            </TooltipTrigger>
                            <TooltipContent>You can delete any room and manage any table.</TooltipContent>
                        </Tooltip>
                    )}
                    <Badge variant="outline" className="h-7 border-2 border-ink bg-white px-3 font-mono text-xs">
                        {rooms?.length ?? 0} {rooms?.length === 1 ? "room" : "rooms"} · {playersOnline} online
                    </Badge>
                </div>
            </section>

            <section
                className="grid gap-6 border-y-2 border-ink bg-coral px-4 py-6 sm:px-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
                aria-label="Room controls"
            >
                <form onSubmit={createRoom}>
                    <Field data-invalid={Boolean(formError)}>
                        <FieldLabel htmlFor="room-title" className="font-mono text-[11px] tracking-wider uppercase">
                            Start a room
                        </FieldLabel>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                                id="room-title"
                                value={roomTitle}
                                onChange={(event) => {
                                    setRoomTitle(event.target.value);
                                    setFormError(null);
                                }}
                                maxLength={40}
                                placeholder="Friday finals"
                                aria-invalid={Boolean(formError)}
                                className="h-12 border-2 border-ink bg-cream px-3 text-sm md:text-sm"
                            />
                            <Button
                                ref={createButtonRef}
                                type="submit"
                                disabled={creating}
                                className="h-12 border-2 border-ink px-5 text-sm shadow-[3px_3px_0_var(--ink)]"
                            >
                                {creating ? <Spinner /> : <CirclePlus />}
                                {creating ? "Opening…" : "Create room"}
                            </Button>
                        </div>
                        {formError && <FieldError className="font-semibold text-ink">{formError}</FieldError>}
                    </Field>
                </form>

                <Field>
                    <FieldLabel htmlFor="room-search" className="font-mono text-[11px] tracking-wider uppercase">
                        Find a room
                    </FieldLabel>
                    <InputGroup className="h-12 border-2 border-ink bg-cream">
                        <InputGroupAddon>
                            <Search className="size-4" />
                        </InputGroupAddon>
                        <InputGroupInput
                            id="room-search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search by name"
                            className="text-sm md:text-sm"
                        />
                    </InputGroup>
                </Field>
            </section>

            <section className={cn("flex-1 px-4 pt-10 sm:px-8", joinedSlug && joinedRoom ? "pb-40" : "pb-20")}>
                {rooms === null ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[0, 1, 2].map((index) => (
                            <Skeleton key={index} className="h-56 rounded-xl border-2 border-ink/10 bg-ink/5" />
                        ))}
                    </div>
                ) : visibleRooms.length > 0 ? (
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <AnimatePresence initial={false} mode="popLayout">
                            {visibleRooms.map((room, index) => (
                                <RoomCard
                                    key={room.slug}
                                    room={room}
                                    index={index}
                                    isAdmin={isAdmin}
                                    joined={room.slug === joinedSlug && joinedRoom !== null}
                                    onDelete={(slug) => send({ type: "delete_room", slug })}
                                    onOpen={enterRoom}
                                />
                            ))}
                        </AnimatePresence>
                    </ul>
                ) : (
                    <Empty className="min-h-64 border-2 border-dashed border-ink/25 bg-white/50">
                        <EmptyHeader>
                            <EmptyMedia className="font-mono text-5xl font-bold text-line">00</EmptyMedia>
                            <EmptyTitle className="text-xl font-bold">
                                {query ? "No matching rooms" : "The floor is yours"}
                            </EmptyTitle>
                            <EmptyDescription className="text-sm">
                                {query ? "Try a broader search." : "Create the first room and invite your crew."}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
            </section>
        </div>
    );
}
