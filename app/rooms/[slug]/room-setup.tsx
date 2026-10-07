"use client";

import { Lock, Settings2, Trash2, Unlock, UserCheck, Users, Zap } from "lucide-react";
import type { FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { playerLabel, type GameMode, type RoomPrivacy, type RoomState } from "@/lib/protocol";
import { SETTINGS_LABEL as LABEL, SETTINGS_PRESSED as PRESSED, SettingsSection } from "./settings-section";
import type { Send, Viewer } from "./viewer";

type RoomSetupProps = {
    room: RoomState;
    viewer: Viewer;
    send: Send;
    onDeleteRoom: () => void;
};

/** Name, mode, teams, and host. Only the room owner and admins can change these. */
export function RoomSetup({ room, viewer, send, onDeleteRoom }: RoomSetupProps) {
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
        <div className="flex flex-col gap-4">
            <SettingsSection
                icon={<Settings2 />}
                title="Room setup"
                description={`Only the room owner${viewer.isAdmin ? " and admins" : ""} can change these.`}
            >
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
                    <FieldDescription>The host runs each clue and judges answers.</FieldDescription>
                </Field>

                <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
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
                                    className="h-9 w-20 bg-white"
                                />
                                <Button type="submit" variant="outline" className="h-9">Set</Button>
                            </div>
                        </Field>
                    </form>
                </div>
            </SettingsSection>

            {(room.removedCount > 0 || viewer.isAdmin) && (
                <div className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-ink/25 p-4">
                    {room.removedCount > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink/70">
                            {room.removedCount} removed {room.removedCount === 1 ? "player" : "players"} can&apos;t rejoin.
                            <Button variant="outline" size="sm" onClick={() => send({ type: "clear_removed_players" })}>
                                <UserCheck /> Let them back in
                            </Button>
                        </div>
                    )}
                    {viewer.isAdmin && (
                        <ConfirmDialog
                            trigger={
                                <Button variant="destructive" size="sm" className="self-start">
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
                </div>
            )}
        </div>
    );
}
