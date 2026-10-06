"use client";

import { Check, Crown, Eye, Pencil, Radio, ShieldCheck, Users, X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PrimaryTeamId, RoomPlayer, RoomState, TeamId } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { PlayerActions } from "./player-actions";
import { TEAM_ORDER, teamName, type Send, type Viewer } from "./viewer";

const TEAM_TONES: Record<TeamId, string> = {
    sun: "bg-mustard",
    moon: "bg-aqua",
    spectators: "bg-white",
};

function RoleIcon({ label, children }: { label: string; children: ReactNode }) {
    return (
        <Tooltip>
            <TooltipTrigger render={<span className="flex shrink-0 items-center" aria-label={label} />}>
                {children}
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

export function PlayerRoles({ player, viewerId }: { player: RoomPlayer; viewerId: string | null }) {
    return (
        <span className="flex items-center gap-1.5 text-ink/70 [&_svg]:size-3.5">
            {player.userId === viewerId && (
                <Badge variant="outline" className="h-4 border-ink/20 px-1.5 text-[9px]">
                    You
                </Badge>
            )}
            {player.isOwner && (
                <RoleIcon label="Room owner">
                    <Crown className="text-amber-600" />
                </RoleIcon>
            )}
            {player.isHost && (
                <RoleIcon label="Host">
                    <Radio className="text-coral" />
                </RoleIcon>
            )}
            {player.isAdmin && (
                <RoleIcon label="Admin">
                    <ShieldCheck className="text-violet-600" />
                </RoleIcon>
            )}
        </span>
    );
}

type TeamColumnProps = {
    team: TeamId;
    room: RoomState;
    viewer: Viewer;
    send: Send;
};

function TeamColumn({ team, room, viewer, send }: TeamColumnProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const isSpectator = team === "spectators";
    const name = teamName(room, team);
    const players = room.players.filter((player) => player.team === team);
    const currentTeam = room.players.find((player) => player.userId === viewer.userId)?.team;
    const isCurrentTeam = currentTeam === team;
    const locked = !isSpectator && room.privacy === "host_assigned" && !viewer.canAssign;
    const full = !isSpectator && players.length >= room.maxPlayersPerTeam;

    function submit(event: FormEvent) {
        event.preventDefault();
        if (isSpectator || draft.trim().length < 2) return;
        send({ type: "rename_team", team: team as PrimaryTeamId, name: draft.trim() });
        setEditing(false);
    }

    return (
        <Card className="gap-0 rounded-xl border-2 border-ink py-0 text-ink shadow-[4px_4px_0_var(--ink)] ring-0">
            <CardHeader className={cn("flex items-center gap-3 border-b-2 border-ink py-4", TEAM_TONES[team])}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white font-pixel-square text-xl">
                    {isSpectator ? <Eye className="size-5" /> : team === "sun" ? "A" : "B"}
                </span>
                <div className="min-w-0 flex-1">
                    <span className="font-mono text-[10px] font-semibold text-ink/60 uppercase">
                        {isSpectator ? "Observation deck" : "Primary team"}
                    </span>
                    {editing ? (
                        <form className="mt-1 flex items-center gap-1" onSubmit={submit}>
                            <Input
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                maxLength={24}
                                autoFocus
                                aria-label="Team name"
                                className="h-8 border-2 border-ink bg-white text-sm"
                            />
                            <Button type="submit" size="icon" variant="success" aria-label="Save team name">
                                <Check />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" aria-label="Cancel" onClick={() => setEditing(false)}>
                                <X />
                            </Button>
                        </form>
                    ) : (
                        <CardTitle className="truncate text-xl font-bold">{name}</CardTitle>
                    )}
                </div>
                {viewer.canConfigure && !isSpectator && !editing && (
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Rename ${name}`}
                        onClick={() => {
                            setDraft(name);
                            setEditing(true);
                        }}
                    >
                        <Pencil />
                    </Button>
                )}
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-3 py-4">
                <div className="flex items-center gap-2 font-mono text-xs text-ink/60">
                    <Users className="size-4" />
                    {players.length}
                    {!isSpectator && ` / ${room.maxPlayersPerTeam}`} {players.length === 1 ? "person" : "people"}
                </div>
                <ul className="flex min-h-40 flex-col gap-2">
                    {players.map((player) => (
                        <li
                            key={player.userId}
                            className="flex items-center gap-2.5 rounded-lg border-2 border-ink/10 bg-white px-2.5 py-2"
                        >
                            <UserAvatar name={player.name} avatarUrl={player.avatarUrl} seed={player.userId} size="sm" />
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                {player.name}
                                {player.displayNumber && (
                                    <sup className="ml-0.5 font-mono text-[9px] text-ink/50">{player.displayNumber}</sup>
                                )}
                            </span>
                            <PlayerRoles player={player} viewerId={viewer.userId} />
                            <PlayerActions player={player} room={room} viewer={viewer} send={send} />
                        </li>
                    ))}
                    {players.length === 0 && (
                        <li className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-ink/15 text-xs text-ink/40">
                            No one here yet
                        </li>
                    )}
                </ul>
            </CardContent>

            <CardFooter className="border-t-2 border-ink p-3">
                <Button
                    className="h-11 w-full border-2 border-ink text-sm"
                    variant={isCurrentTeam ? "outline" : "default"}
                    disabled={isCurrentTeam || locked || (full && !isCurrentTeam)}
                    onClick={() => send({ type: "join_team", team })}
                >
                    {isCurrentTeam ? <Check /> : isSpectator ? <Eye /> : <Radio />}
                    {isCurrentTeam
                        ? "You are here"
                        : locked
                            ? "Host assigns teams"
                            : full
                                ? "Team is full"
                                : isSpectator
                                    ? "Spectate"
                                    : "Join team"}
                </Button>
            </CardFooter>
        </Card>
    );
}

export function TeamsBoard({ room, viewer, send }: { room: RoomState; viewer: Viewer; send: Send }) {
    return (
        <section className="grid gap-5 px-4 py-8 sm:px-8 md:grid-cols-2 xl:grid-cols-3" aria-label="Room teams">
            {TEAM_ORDER.map((team) => (
                <TeamColumn key={team} team={team} room={room} viewer={viewer} send={send} />
            ))}
        </section>
    );
}
