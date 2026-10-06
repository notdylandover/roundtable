import type { ClientMessage, PrimaryTeamId, RoomState, TeamId } from "@/lib/protocol";

export type Send = (message: ClientMessage) => void;

/** What the current user is allowed to do in this room (mirrors the server checks). */
export type Viewer = {
    userId: string | null;
    isOwner: boolean;
    isHost: boolean;
    isAdmin: boolean;
    /** Room settings, renaming teams, choosing a host, removing players. */
    canConfigure: boolean;
    /** Moving players between teams. */
    canAssign: boolean;
    /** Owner or host: sees every clue and answer, can edit the board, and can't buzz. */
    isGameMaster: boolean;
};

export function getViewer(room: RoomState, userId: string | null, isAdmin: boolean): Viewer {
    const isOwner = Boolean(userId) && room.ownerId === userId;
    const isHost = Boolean(userId) && room.hostId === userId;
    return {
        userId,
        isOwner,
        isHost,
        isAdmin,
        canConfigure: isOwner || isAdmin,
        canAssign: isOwner || isHost || isAdmin,
        isGameMaster: isOwner || isHost,
    };
}

export const TEAM_ORDER: TeamId[] = ["sun", "moon", "spectators"];

export function teamName(room: RoomState, team: TeamId) {
    return team === "spectators" ? "Spectators" : room.teamNames[team as PrimaryTeamId];
}
