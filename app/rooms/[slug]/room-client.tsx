"use client";

import { ArrowLeft, Check, DoorOpen, Link2, LogOut, MonitorPlay, Settings2, Trash2, UserX, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { useSession } from "@/components/session-provider";
import { UserMenu } from "@/components/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import type { RoomState } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { useRoomSession, type GoneReason } from "../room-session";
import { BuzzIn } from "./buzz-in";
import { RoomSettings, hasRoomSettings } from "./room-settings";
import { RoomTopBar, ToolbarButton, type ToolbarTone } from "./room-toolbar";
import { TeamsBoard } from "./teams-board";
import { getViewer, type Viewer } from "./viewer";

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
        <Empty className="mx-4 my-16 min-h-80 w-auto border-2 border-dashed border-ink/25 bg-white/60 sm:mx-8">
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

type RoomActionsProps = {
    tone: ToolbarTone;
    room: RoomState;
    viewer: Viewer;
    settingsOpen: boolean;
    onOpenSettings: () => void;
    onLeave: () => void;
};

/** Preview, invite, settings, leave, and account buttons for the right side of the top bar. */
function RoomActions({ tone, room, viewer, settingsOpen, onOpenSettings, onLeave }: RoomActionsProps) {
    const [copied, setCopied] = useState(false);

    async function copyInvite() {
        await navigator.clipboard.writeText(`${window.location.origin}/rooms/${room.slug}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    }

    return (
        <>
            {room.gameMode === "buzz_in" && (
                <ToolbarButton
                    tone={tone}
                    label="Open big-screen preview"
                    icon={<MonitorPlay />}
                    href={`/rooms/${room.slug}/preview`}
                    external
                    className="hidden @2xl:flex"
                />
            )}
            <ToolbarButton
                tone={tone}
                label={copied ? "Invite link copied" : "Copy invite link"}
                icon={copied ? <Check /> : <Link2 />}
                active={copied}
                onClick={copyInvite}
            />
            {hasRoomSettings(room, viewer) && (
                <ToolbarButton tone={tone} label="Room settings" icon={<Settings2 />} active={settingsOpen} onClick={onOpenSettings} />
            )}
            <ToolbarButton tone={tone} label="Leave room" icon={<LogOut />} danger onClick={onLeave} />
            <span className={cn("mx-0.5 hidden h-6 w-px @2xl:block", tone === "dark" ? "bg-white/15" : "bg-ink/20")} aria-hidden="true" />
            <UserMenu compact />
        </>
    );
}

export function RoomClient({ slug }: { slug: string }) {
    const router = useRouter();
    const { session } = useSession();
    const userId = session?.user.id ?? null;
    const isAdmin = session?.isAdmin === true;
    const roomSession = useRoomSession();
    const { join, leave, send, deleteRoom } = roomSession;
    const current = roomSession.slug === slug;
    const room = current ? roomSession.room : null;
    const gone = current ? roomSession.gone : null;
    const status = current ? roomSession.status : "connecting";
    const clockOffset = roomSession.clockOffset;
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Stays connected after leaving this page; only "Leave" disconnects.
    useEffect(() => {
        join(slug);
    }, [join, slug]);

    function leaveRoom() {
        leave();
        router.push("/rooms");
    }

    if (gone || !room) {
        return (
            <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col border-x-2 border-ink/10">
                <AppHeader
                    status={gone ? undefined : status}
                    leading={
                        <>
                            <Link href="/rooms" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-12 gap-1.5 text-sm")}>
                                <ArrowLeft /> Rooms
                            </Link>
                            <Separator orientation="vertical" />
                            <span className="truncate font-mono text-xs font-semibold text-ink/60 uppercase">Room / {slug}</span>
                        </>
                    }
                />
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
    const actionProps = { room, viewer, settingsOpen, onOpenSettings: () => setSettingsOpen(true), onLeave: leaveRoom };
    // Rendered after either layout so it stays open when the owner switches game modes.
    const settings = hasRoomSettings(room, viewer) && (
        <RoomSettings room={room} viewer={viewer} send={send} onDeleteRoom={deleteRoom} open={settingsOpen} onOpenChange={setSettingsOpen} />
    );

    if (room.gameMode === "buzz_in") {
        return (
            <>
                <BuzzIn
                    room={room}
                    viewer={viewer}
                    clockOffset={clockOffset}
                    send={send}
                    status={status}
                    actions={<RoomActions tone="dark" {...actionProps} />}
                />
                {settings}
            </>
        );
    }

    return (
        <>
            <div className="@container flex min-h-dvh flex-col">
                <RoomTopBar
                    tone="light"
                    title={room.title}
                    status={status}
                    className="sticky top-0 border-b-2 border-ink bg-white/90 backdrop-blur"
                    details={
                        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border-2 border-ink/15 bg-white px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase @xl:flex">
                            <Users className="size-3" /> Teams · {room.players.length} here
                        </span>
                    }
                >
                    <RoomActions tone="light" {...actionProps} />
                </RoomTopBar>
                <div className="mx-auto w-full max-w-7xl">
                    <TeamsBoard room={room} viewer={viewer} send={send} />
                </div>
            </div>
            {settings}
        </>
    );
}
