"use client";

import { Eye, MoreHorizontal, Radio, UserX } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { playerLabel, type RoomPlayer, type RoomState } from "@/lib/protocol";
import { TEAM_ORDER, teamName, type Send, type Viewer } from "./viewer";

type PlayerActionsProps = {
    player: RoomPlayer;
    room: RoomState;
    viewer: Viewer;
    send: Send;
    showTeams?: boolean;
};

export function PlayerActions({ player, room, viewer, send, showTeams = true }: PlayerActionsProps) {
    const [confirmRemove, setConfirmRemove] = useState(false);
    const isSelf = player.userId === viewer.userId;
    const moveTargets = showTeams && viewer.canAssign ? TEAM_ORDER.filter((team) => team !== player.team) : [];
    const canMakeHost = viewer.canConfigure && !player.isHost;
    const canRemove = viewer.canConfigure && !isSelf && (!player.isAdmin || viewer.isAdmin);
    const label = playerLabel(player);

    if (moveTargets.length === 0 && !canMakeHost && !canRemove) return null;

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={`Manage ${label}`} />}
                >
                    <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                    {moveTargets.length > 0 && (
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Move {label} to</DropdownMenuLabel>
                            {moveTargets.map((team) => (
                                <DropdownMenuItem
                                    key={team}
                                    onClick={() => send({ type: "assign_team", userId: player.userId, team })}
                                >
                                    {team === "spectators" ? (
                                        <Eye />
                                    ) : (
                                        <span className="flex size-3.5 items-center justify-center font-mono text-[10px] font-bold">
                                            {team === "sun" ? "A" : "B"}
                                        </span>
                                    )}
                                    {teamName(room, team)}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                    )}
                    {canMakeHost && (
                        <>
                            {moveTargets.length > 0 && <DropdownMenuSeparator />}
                            <DropdownMenuItem onClick={() => send({ type: "set_host", userId: player.userId })}>
                                <Radio /> Make host
                            </DropdownMenuItem>
                        </>
                    )}
                    {canRemove && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setConfirmRemove(true)}>
                                <UserX /> Remove from room
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            {canRemove && (
                <ConfirmDialog
                    open={confirmRemove}
                    onOpenChange={setConfirmRemove}
                    icon={<UserX />}
                    destructive
                    title={`Remove ${label}?`}
                    description="They'll be disconnected and can't rejoin until you let removed players back in from Room setup."
                    confirmLabel="Remove player"
                    onConfirm={() => send({ type: "remove_player", userId: player.userId })}
                />
            )}
        </>
    );
}
