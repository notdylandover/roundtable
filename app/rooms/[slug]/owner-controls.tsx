"use client";

import { Lock, Settings2, ShieldCheck, Trash2, Unlock, UserCheck, Users, Zap } from "lucide-react";
import type { FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { playerLabel, type GameMode, type RoomPrivacy, type RoomState } from "@/lib/protocol";
import type { Send, Viewer } from "./viewer";

const PRESSED = "aria-pressed:bg-ink aria-pressed:text-white data-pressed:bg-ink data-pressed:text-white";
const LABEL = "font-mono text-[11px] tracking-wider text-ink/70 uppercase";

type OwnerControlsProps = {
    room: RoomState;
    viewer: Viewer;
    send: Send;
    onDeleteRoom: () => void;
};

export function OwnerControls({ room, viewer, send, onDeleteRoom }: OwnerControlsProps) {
    if (!viewer.canConfigure) return null;

    function renameRoom(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        send({ type: "update_room", title: String(form.get("title") ?? "") });
    }

    function setPlayerLimit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        send({ type: "update_room", maxPlayersPerTeam: Number(form.get("maxPlayers")) });
    }

    const hostItems = room.players.map((player) => ({
        value: player.userId,
        label: `${playerLabel(player)}${player.isOwner ? " (owner)" : ""}`,
    }));
    if (room.hostId && !hostItems.some((item) => item.value === room.hostId)) {
        hostItems.unshift({ value: room.hostId, label: "Host (offline)" });
    }

    return (
        <Card className="mx-4 mt-8 gap-0 rounded-xl border-2 border-ink py-0 text-ink shadow-[4px_4px_0_var(--ink)] ring-0 sm:mx-8">
            <CardHeader className="flex flex-wrap items-center gap-3 border-b-2 border-ink bg-paper py-4">
                <span className="flex size-9 items-center justify-center rounded-full border-2 border-ink bg-white">
                    <Settings2 className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <CardTitle className="text-base font-bold">Room setup</CardTitle>
                    <CardDescription>
                        Only the room owner{viewer.isAdmin ? " and admins" : ""} can see these controls.
                    </CardDescription>
                </div>
                {viewer.isAdmin && !viewer.isOwner && (
                    <Badge className="gap-1 bg-violet-600 text-white">
                        <ShieldCheck /> Admin override
                    </Badge>
                )}
            </CardHeader>

            <CardContent className="grid gap-5 py-5 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_0.8fr_1fr_1fr]">
                <form onSubmit={renameRoom} key={room.title}>
                    <Field>
                        <FieldLabel htmlFor="owner-room-name" className={LABEL}>Room name</FieldLabel>
                        <div className="flex gap-2">
                            <Input id="owner-room-name" name="title" defaultValue={room.title} maxLength={40} className="h-9 bg-white" />
                            <Button type="submit" variant="outline" className="h-9">Save</Button>
                        </div>
                    </Field>
                </form>

                <Field>
                    <FieldLabel className={LABEL}>Teams</FieldLabel>
                    <ToggleGroup
                        variant="outline"
                        spacing={0}
                        value={[room.privacy]}
                        onValueChange={(value) => {
                            const privacy = value[0] as RoomPrivacy | undefined;
                            if (privacy && privacy !== room.privacy) send({ type: "update_room", privacy });
                        }}
                        className="w-full"
                    >
                        <ToggleGroupItem value="open" className={`h-9 flex-1 ${PRESSED}`}>
                            <Unlock /> Open
                        </ToggleGroupItem>
                        <ToggleGroupItem value="host_assigned" className={`h-9 flex-1 ${PRESSED}`}>
                            <Lock /> Host assigned
                        </ToggleGroupItem>
                    </ToggleGroup>
                </Field>

                <form onSubmit={setPlayerLimit} key={room.maxPlayersPerTeam}>
                    <Field>
                        <FieldLabel htmlFor="max-team-players" className={LABEL}>Max per team</FieldLabel>
                        <div className="flex gap-2">
                            <Input
                                id="max-team-players"
                                name="maxPlayers"
                                type="number"
                                min={1}
                                max={50}
                                defaultValue={room.maxPlayersPerTeam}
                                className="h-9 bg-white"
                            />
                            <Button type="submit" variant="outline" className="h-9">Set</Button>
                        </div>
                    </Field>
                </form>

                <Field>
                    <FieldLabel className={LABEL}>Room host</FieldLabel>
                    <Select
                        items={hostItems}
                        value={room.hostId || null}
                        onValueChange={(userId) => {
                            if (typeof userId === "string" && userId !== room.hostId) send({ type: "set_host", userId });
                        }}
                    >
                        <SelectTrigger className="w-full bg-white data-[size=default]:h-9">
                            <SelectValue placeholder="Choose a host" />
                        </SelectTrigger>
                        <SelectContent>
                            {hostItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <Field>
                    <FieldLabel className={LABEL}>Game mode</FieldLabel>
                    <ToggleGroup
                        variant="outline"
                        spacing={0}
                        value={[room.gameMode]}
                        onValueChange={(value) => {
                            const gameMode = value[0] as GameMode | undefined;
                            if (gameMode && gameMode !== room.gameMode) send({ type: "update_room", gameMode });
                        }}
                        className="w-full"
                    >
                        <ToggleGroupItem value="teams" className={`h-9 flex-1 ${PRESSED}`}>
                            <Users /> Teams
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="buzz_in"
                            className="h-9 flex-1 aria-pressed:bg-coral aria-pressed:text-ink data-pressed:bg-coral data-pressed:text-ink"
                        >
                            <Zap /> Buzz In
                        </ToggleGroupItem>
                    </ToggleGroup>
                </Field>
            </CardContent>

            {(room.removedCount > 0 || viewer.isAdmin) && (
                <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink py-3">
                    {room.removedCount > 0 ? (
                        <div className="flex flex-wrap items-center gap-3 text-xs text-ink/70">
                            {room.removedCount} removed {room.removedCount === 1 ? "player" : "players"} can&apos;t rejoin.
                            <Button variant="outline" size="sm" onClick={() => send({ type: "clear_removed_players" })}>
                                <UserCheck /> Let them back in
                            </Button>
                        </div>
                    ) : (
                        <span />
                    )}
                    {viewer.isAdmin && (
                        <ConfirmDialog
                            trigger={
                                <Button variant="destructive" size="sm">
                                    <Trash2 /> Delete room
                                </Button>
                            }
                            icon={<Trash2 />}
                            destructive
                            title={`Delete “${room.title}”?`}
                            description="Everyone is disconnected and the room's clues, scores, and settings are erased. This can't be undone."
                            confirmLabel="Delete room"
                            onConfirm={onDeleteRoom}
                        />
                    )}
                </CardFooter>
            )}
        </Card>
    );
}
