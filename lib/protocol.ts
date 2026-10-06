import type { AuthProvider } from "./auth/types";

export type PrimaryTeamId = "sun" | "moon";
export type TeamId = PrimaryTeamId | "spectators";
export type RoomPrivacy = "open" | "host_assigned";
export type GameMode = "teams" | "buzz_in";
/** What happens when the clue timer runs out with no correct answer. */
export type TimerExpiryAction = "reveal" | "lock";
/** Players say their answer out loud, or type it for the owner/host to read. */
export type AnswerMode = "spoken" | "typed";
/** Who picks the next clue: the host, or the last player to answer correctly. */
export type PickMode = "host" | "player";

export type GameRules = {
    answerMode: AnswerMode;
    pickMode: PickMode;
};

export type AnswerAttempt = {
    userId: string;
    text: string;
    result: "pending" | "correct" | "incorrect";
};

export const TIMER_MIN_SECONDS = 5;
export const TIMER_MAX_SECONDS = 180;
export const TIMER_PRESETS = [10, 15, 30, 60] as const;

/** Buzz In flow: players gather in the lobby, play the board, then the optional Final Buzz In, then see the winner. */
export type GamePhase = "lobby" | "playing" | "final" | "finished";
/** Where the Final Buzz In question comes from. */
export type FinalSource = "custom" | "random";

export const FINAL_MIN_SECONDS = 15;
export const FINAL_MAX_SECONDS = 300;
export const FINAL_DEFAULT_SECONDS = 60;
export const FINAL_PRESETS = [30, 60, 90, 120] as const;

export type FinalSettings = {
    enabled: boolean;
    seconds: number;
    source: FinalSource;
    /** The custom question. Hidden ("") from everyone but the owner and host. */
    category: string;
    prompt: string;
    answer: string;
};

export type FinalEntry = {
    userId: string;
    /** Other players' wagers and answers are hidden (null / "") until results are revealed. */
    wager: number | null;
    answer: string;
    result: "pending" | "correct" | "incorrect";
};

export type FinalRound = {
    stage: "answering" | "judging" | "revealed";
    category: string;
    prompt: string;
    /** Hidden ("") from players until results are revealed. */
    answer: string;
    /** Server timestamp when answering closes. */
    endsAt: number | null;
    /** One entry per player who locked in. */
    entries: FinalEntry[];
};

export type BoardClue = {
    id: string;
    value: number;
    /** Hidden ("") from players until the clue is on screen. */
    prompt: string;
    /** Hidden ("") from players until the answer is revealed. */
    answer: string;
    /** Whether the clue has a question and answer, so it can be played. */
    filled: boolean;
};

export type BoardCategory = {
    id: string;
    name: string;
    prefilledId: string | null;
    clues: BoardClue[];
};

/** A clue together with its category name, e.g. the one currently on screen. */
export type ActiveClue = BoardClue & { category: string };

export function boardProgress(board: BoardCategory[]) {
    const clues = board.flatMap((category) => category.clues);
    const filled = clues.filter((clue) => clue.filled).length;
    return { filled, total: clues.length, full: clues.length > 0 && filled === clues.length };
}

/** Players who compete: everyone except the owner and host, who can see the answers. */
export function getContestants(room: Pick<RoomState, "players">) {
    return room.players.filter((player) => !player.isHost && !player.isOwner);
}

export function findClue(board: BoardCategory[], clueId: string | null): ActiveClue | null {
    if (!clueId) return null;
    for (const category of board) {
        const clue = category.clues.find((candidate) => candidate.id === clueId);
        if (clue) return { ...clue, category: category.name };
    }
    return null;
}

export type BuzzState = {
    activeQuestionId: string | null;
    buzzedUserId: string | null;
    excludedUserIds: string[];
    answerRevealed: boolean;
    usedQuestionIds: string[];
    /** Server timestamp when the running clue timer ends. */
    timerEndsAt: number | null;
    /** Time left while the timer is paused because a player buzzed in. */
    timerPausedMs: number | null;
    /** Time ran out without a correct answer; buzzers stay locked. */
    timerExpired: boolean;
    /** Typed answers for the clue on screen. Only the owner and host receive them. */
    attempts: AnswerAttempt[];
};

export type TimerSettings = {
    enabled: boolean;
    seconds: number;
    expiryAction: TimerExpiryAction;
};

export type RoomSummary = {
    slug: string;
    title: string;
    playerCount: number;
    updatedAt: number;
    gameMode: GameMode;
};

export type RoomPlayer = {
    userId: string;
    name: string;
    avatarUrl: string | null;
    provider: AuthProvider;
    displayNumber?: number;
    team: TeamId;
    isOwner: boolean;
    isHost: boolean;
    isAdmin: boolean;
    score: number;
};

export type RoomState = {
    slug: string;
    title: string;
    ownerId: string;
    hostId: string;
    teamNames: Record<PrimaryTeamId, string>;
    privacy: RoomPrivacy;
    maxPlayersPerTeam: number;
    gameMode: GameMode;
    timer: TimerSettings;
    rules: GameRules;
    /** In "player" pick mode, who chooses the next clue (null: the host). */
    pickerUserId: string | null;
    players: RoomPlayer[];
    board: BoardCategory[];
    buzz: BuzzState;
    removedCount: number;
    phase: GamePhase;
    /** Players who marked themselves ready in the lobby. */
    readyUserIds: string[];
    final: FinalSettings;
    finalRound: FinalRound | null;
};

export type ClientMessage =
    | { type: "create_room"; slug: string; title: string }
    | { type: "delete_room"; slug: string }
    | { type: "set_name"; name: string }
    | { type: "join_team"; team: TeamId }
    | { type: "rename_team"; team: PrimaryTeamId; name: string }
    | { type: "update_room"; title?: string; privacy?: RoomPrivacy; maxPlayersPerTeam?: number; gameMode?: GameMode }
    | { type: "assign_team"; userId: string; team: TeamId }
    | { type: "set_host"; userId: string }
    | { type: "remove_player"; userId: string }
    | { type: "clear_removed_players" }
    | { type: "update_timer"; enabled: boolean; seconds: number; expiryAction: TimerExpiryAction }
    | { type: "restart_timer" }
    | { type: "update_rules"; answerMode?: AnswerMode; pickMode?: PickMode }
    | { type: "submit_answer"; text: string }
    | { type: "set_category_count"; count: number }
    | { type: "rename_category"; categoryId: string; name: string }
    | { type: "update_clue"; clueId: string; value: number; prompt: string; answer: string }
    | { type: "use_prefilled_category"; categoryId: string; prefilledId: string }
    | { type: "use_prefilled_board" }
    | { type: "clear_category"; categoryId: string }
    | { type: "select_question"; questionId: string }
    | { type: "buzz" }
    | { type: "judge_buzz"; correct: boolean }
    | { type: "reveal_answer" }
    | { type: "end_question" }
    | { type: "reset_scores" }
    | { type: "reset_board" }
    | { type: "set_ready"; ready: boolean }
    /** `force` starts even when some players aren't ready. */
    | { type: "start_game"; force?: boolean }
    | {
        type: "update_final";
        enabled?: boolean;
        seconds?: number;
        source?: FinalSource;
        category?: string;
        prompt?: string;
        answer?: string;
    }
    /** Ends the board early and moves on to the Final Buzz In (or the winner screen). */
    | { type: "finish_board" }
    | { type: "submit_final"; wager: number; answer: string }
    /** Closes Final Buzz In answers before the timer runs out. */
    | { type: "lock_final" }
    | { type: "judge_final"; userId: string; correct: boolean }
    | { type: "reveal_final" }
    | { type: "end_game" }
    /** Clears scores and used clues and returns everyone to the lobby. */
    | { type: "new_game" };

export type ServerMessage =
    | { type: "lobby_state"; rooms: RoomSummary[] }
    | { type: "room_created"; room: RoomSummary }
    | { type: "room_state"; room: RoomState; serverTime: number }
    | { type: "preview_state"; room: RoomState; serverTime: number }
    | { type: "notice"; message: string }
    | { type: "error"; message: string }
    | { type: "auth_required" }
    | { type: "room_missing" }
    | { type: "room_deleted" }
    | { type: "removed" };

export const DEFAULT_TEAM_NAMES: Record<PrimaryTeamId, string> = {
    sun: "Sun Team",
    moon: "Moon Team",
};

/** Always returns fresh arrays so callers can mutate the result safely. */
export function createEmptyBuzz(overrides: Partial<BuzzState> = {}): BuzzState {
    return {
        activeQuestionId: null,
        buzzedUserId: null,
        excludedUserIds: [],
        answerRevealed: false,
        usedQuestionIds: [],
        timerEndsAt: null,
        timerPausedMs: null,
        timerExpired: false,
        attempts: [],
        ...overrides,
    };
}

export function createEmptyRoom(slug: string, title = "Room"): RoomState {
    return {
        slug,
        title,
        ownerId: "",
        hostId: "",
        teamNames: { ...DEFAULT_TEAM_NAMES },
        privacy: "open",
        maxPlayersPerTeam: 8,
        gameMode: "teams",
        timer: { enabled: false, seconds: 30, expiryAction: "reveal" },
        rules: { answerMode: "spoken", pickMode: "host" },
        pickerUserId: null,
        players: [],
        board: [],
        buzz: createEmptyBuzz(),
        removedCount: 0,
        phase: "lobby",
        readyUserIds: [],
        final: createDefaultFinal(),
        finalRound: null,
    };
}

export function createDefaultFinal(): FinalSettings {
    return { enabled: true, seconds: FINAL_DEFAULT_SECONDS, source: "random", category: "", prompt: "", answer: "" };
}

export function isCustomFinalReady(final: Pick<FinalSettings, "prompt" | "answer">) {
    return final.prompt.trim().length >= 2 && final.answer.trim().length >= 1;
}

/** Highest score first; tied players share a rank. */
export function rankPlayers(players: RoomPlayer[]) {
    const sorted = [...players].sort((left, right) => right.score - left.score);
    return sorted.map((player) => ({ player, rank: sorted.findIndex((other) => other.score === player.score) + 1 }));
}

export function playerLabel(player: Pick<RoomPlayer, "name" | "displayNumber">) {
    return `${player.name}${player.displayNumber ? ` ${player.displayNumber}` : ""}`;
}
