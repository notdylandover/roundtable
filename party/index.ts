import {
    Server as PartyServer,
    getServerByName,
    routePartykitRequest,
    type Connection,
    type ConnectionContext,
} from "partyserver";
import { isAdminUser } from "../lib/auth/admins";
import { DEFAULT_ANSWER_LENIENCY, isAnswerLeniency, type AnswerLeniency } from "../lib/answer-match";
import { signToken, toSessionUser, verifyToken } from "../lib/auth/token";
import type { AuthProvider, SessionUser } from "../lib/auth/types";
import { collapseWhitespace, containsBlockedWord, validateDisplayName } from "../lib/names";
import {
    CLUES_PER_CATEGORY,
    DEFAULT_CATEGORIES,
    MAX_CATEGORIES,
    MAX_CLUE_VALUE,
    MIN_CATEGORIES,
    MIN_CLUE_VALUE,
    createBlankBoard,
    createBlankCategory,
    createCategoryFromPrefilled,
    getPrefilledCategory,
    isBoardFull,
    isClueFilled,
    pickFinalQuestion,
    pickRandomPrefilled,
    type BoardCategoryData,
} from "../lib/buzz-in";
import {
    DEFAULT_TEAM_NAMES,
    FINAL_MAX_SECONDS,
    FINAL_MIN_SECONDS,
    createDefaultFinal,
    createEmptyBuzz,
    isCustomFinalReady,
    TIMER_MAX_SECONDS,
    TIMER_MIN_SECONDS,
    type AnswerMode,
    type BoardCategory,
    type BuzzState,
    type ClientMessage,
    type FinalRound,
    type FinalSettings,
    type GameMode,
    type GamePhase,
    type PickMode,
    type PrimaryTeamId,
    type RoomPlayer,
    type RoomPrivacy,
    type RoomState,
    type RoomSummary,
    type ServerMessage,
    type TeamId,
    type TimerExpiryAction,
} from "../lib/protocol";

type Identity = {
    userId: string;
    name: string;
    avatarUrl: string | null;
    provider: AuthProvider;
    isAdmin: boolean;
};

type LobbyConnectionState = Identity & { kind: "lobby"; roomSlug?: string };
type GameConnectionState = Identity & { kind: "game"; team: TeamId };
type PreviewConnectionState = { kind: "preview" };
type ConnectionState = LobbyConnectionState | GameConnectionState | PreviewConnectionState;

type GamePlayer = { connection: Connection<ConnectionState>; state: GameConnectionState };

interface Env {
    /** Durable Object binding; partyserver routes `/parties/main/:room` here (binding name in kebab-case). */
    Main: DurableObjectNamespace<Server>;
    AUTH_SECRET?: string;
}

type StoredRoomSummary = Omit<RoomSummary, "playerCount" | "gameMode"> & { gameMode?: GameMode };

type StoredRoomSettings = {
    slug: string;
    title: string;
    ownerId: string;
    hostId: string;
    teamNames: Record<PrimaryTeamId, string>;
    privacy: RoomPrivacy;
    maxPlayersPerTeam: number;
    gameMode: GameMode;
    timerEnabled: boolean;
    timerSeconds: number;
    timerExpiryAction: TimerExpiryAction;
    answerMode: AnswerMode;
    pickMode: PickMode;
    answerLeniency: AnswerLeniency;
    pickerUserId: string | null;
    board: BoardCategoryData[];
    buzz: BuzzState;
    scores: Record<string, number>;
    removedUserIds: string[];
    phase: GamePhase;
    readyUserIds: string[];
    final: FinalSettings;
    finalRound: FinalRound | null;
};

type InternalRequest =
    | { action: "initialize"; title?: string; ownerId?: string }
    | { action: "destroy" }
    | { action: "refresh_room"; slug?: string };

const PRIMARY_TEAMS: PrimaryTeamId[] = ["sun", "moon"];
const TEAMS: TeamId[] = ["sun", "moon", "spectators"];
/** After a wrong answer the clock resumes with at least this much time left. */
const MIN_RESUME_MS = 3000;
/** How long an absent owner/host keeps their role before it is handed to someone present. */
const ROLE_GRACE_MS = 30_000;

const CLOSE_AUTH = 4001;
const CLOSE_REMOVED = 4003;
const CLOSE_MISSING = 4004;
const CLOSE_DELETED = 4010;

/** For public, lobby-visible text such as room titles and team names. */
function cleanText(value: unknown, fallback: string, maxLength: number) {
    if (typeof value !== "string") return fallback;
    const cleaned = collapseWhitespace(value).slice(0, maxLength);
    if (
        cleaned.length < 2 ||
        /(.)\1{4,}/i.test(cleaned) ||
        /https?:|www\.|\.com\b/i.test(cleaned) ||
        containsBlockedWord(cleaned)
    ) {
        return fallback;
    }
    return cleaned;
}

/** For host-authored clue content, where numbers like "100000" must survive. */
function cleanContent(value: unknown, maxLength: number) {
    return typeof value === "string" ? collapseWhitespace(value).slice(0, maxLength) : "";
}

function cleanSlug(value: unknown) {
    if (typeof value !== "string") return "";
    return value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48);
}

function titleFromSlug(slug: string) {
    return slug
        .split("-")
        .filter(Boolean)
        .map((word) => word[0]?.toUpperCase() + word.slice(1))
        .join(" ") || "Untitled room";
}

function clampSeconds(value: unknown, fallback: number, min = TIMER_MIN_SECONDS, max = TIMER_MAX_SECONDS) {
    const seconds = Math.round(Number(value));
    if (!Number.isFinite(seconds)) return fallback;
    return Math.max(min, Math.min(max, seconds));
}

function isPrimaryTeam(team: TeamId): team is PrimaryTeamId {
    return PRIMARY_TEAMS.includes(team as PrimaryTeamId);
}

type LegacyQuestion = { id: string; category: string; prompt: string; answer: string; value: number };

/** Rooms created before the board existed stored a flat list of custom questions. */
function migrateLegacyQuestions(stored: object): BoardCategoryData[] | null {
    const questions = (stored as { questions?: LegacyQuestion[] }).questions;
    if (!questions?.length) return null;

    const byCategory = new Map<string, LegacyQuestion[]>();
    for (const question of questions) {
        byCategory.set(question.category, [...(byCategory.get(question.category) ?? []), question]);
    }
    const board = [...byCategory.entries()].slice(0, MAX_CATEGORIES).map(([name, list], index) => {
        const category = createBlankCategory(index);
        category.name = name;
        [...list]
            .sort((left, right) => left.value - right.value)
            .slice(0, CLUES_PER_CATEGORY)
            .forEach((question, row) => {
                // Keep the old id so "used" markers survive.
                category.clues[row] = { id: question.id, value: question.value, prompt: question.prompt, answer: question.answer };
            });
        return category;
    });
    while (board.length < DEFAULT_CATEGORIES) board.push(createBlankCategory(board.length));
    return board;
}

function bearerToken(request: Request) {
    const header = request.headers.get("authorization") ?? "";
    return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

/** Durable Object stubs need an absolute URL; the host is ignored. */
const INTERNAL_URL = "https://internal/";

export class Server extends PartyServer<Env> {
    private get secret() {
        const value = this.env.AUTH_SECRET;
        return typeof value === "string" ? value : "";
    }

    private get isLobby() {
        return this.name === "lobby";
    }

    /** `this.name` can throw for alarms scheduled before the name was persisted, so alarm code paths use the stored slug. */
    private safeRoomId() {
        try {
            return this.name;
        } catch {
            return "";
        }
    }

    async onConnect(connection: Connection<ConnectionState>, context: ConnectionContext) {
        const url = new URL(context.request.url);

        if (this.isLobby) {
            const identity = await this.authenticate(url);
            if (!identity) return this.reject(connection, { type: "auth_required" }, CLOSE_AUTH, "Sign in required");
            connection.setState({
                ...identity,
                kind: "lobby",
                roomSlug: cleanSlug(url.searchParams.get("room")) || undefined,
            });
            await this.broadcastLobby();
            return;
        }

        const settings = await this.loadSettings();
        if (!settings) return this.reject(connection, { type: "room_missing" }, CLOSE_MISSING, "Room not found");

        if (url.searchParams.get("view") === "preview") {
            connection.setState({ kind: "preview" });
            this.send(connection, {
                type: "preview_state",
                room: this.redactAnswers(this.buildRoomState(settings)),
                serverTime: Date.now(),
            });
            return;
        }

        const identity = await this.authenticate(url);
        if (!identity) return this.reject(connection, { type: "auth_required" }, CLOSE_AUTH, "Sign in required");
        if (settings.removedUserIds.includes(identity.userId) && !identity.isAdmin) {
            return this.reject(connection, { type: "removed" }, CLOSE_REMOVED, "Removed from room");
        }

        if (!settings.ownerId) {
            settings.ownerId = identity.userId;
            settings.hostId ||= identity.userId;
            await this.saveSettings(settings);
        }

        const existing = this.gamePlayers().find((player) => player.state.userId === identity.userId);
        connection.setState({ ...identity, kind: "game", team: existing?.state.team ?? "spectators" });
        await this.broadcastRoom(settings);
    }

    async onMessage(sender: Connection<ConnectionState>, rawMessage: string | ArrayBuffer | ArrayBufferView) {
        if (typeof rawMessage !== "string") return;

        let message: ClientMessage;
        try {
            message = JSON.parse(rawMessage) as ClientMessage;
        } catch {
            this.send(sender, { type: "error", message: "That request was not valid." });
            return;
        }

        if (this.isLobby) {
            await this.handleLobbyMessage(message, sender);
        } else {
            await this.handleRoomMessage(message, sender);
        }
    }

    async onClose(connection: Connection<ConnectionState>) {
        if (this.isLobby) {
            await this.broadcastLobby();
            return;
        }

        const departed = connection.state;
        if (departed?.kind !== "game") return;
        const settings = await this.loadSettings();
        if (!settings) return;

        const sameUserRemains = this.gamePlayers().some(
            (player) => player.connection.id !== connection.id && player.state.userId === departed.userId
        );
        const heldRole = settings.ownerId === departed.userId || settings.hostId === departed.userId;
        if (!sameUserRemains && heldRole) {
            // Give the owner/host a moment to come back (page refresh, flaky network) before handing roles off.
            setTimeout(() => void this.reassignAbsentRoles(), ROLE_GRACE_MS);
        }
        await this.broadcastRoom(settings);
    }

    private async reassignAbsentRoles() {
        const settings = await this.loadSettings();
        if (!settings) return;
        const connected = this.gamePlayers()
            .map((player) => player.state.userId)
            .filter((userId) => !settings.removedUserIds.includes(userId));
        if (connected.length === 0) return;

        let changed = false;
        if (!connected.includes(settings.ownerId)) {
            settings.ownerId = connected[0];
            changed = true;
        }
        if (!connected.includes(settings.hostId)) {
            settings.hostId = settings.ownerId;
            if (settings.buzz.buzzedUserId === settings.hostId) this.resumeAfterBuzz(settings);
            changed = true;
        }
        if (changed) await this.saveAndBroadcast(settings);
    }

    async onAlarm() {
        // Only game rooms schedule alarms.
        const settings = await this.loadSettings();
        if (!settings) return;

        const now = Date.now();
        let changed = false;
        const buzz = settings.buzz;
        if (buzz.activeQuestionId && !buzz.answerRevealed && buzz.timerEndsAt && buzz.timerEndsAt <= now) {
            buzz.timerEndsAt = null;
            buzz.timerPausedMs = null;
            buzz.timerExpired = true;
            if (settings.timerExpiryAction === "reveal") buzz.answerRevealed = true;
            changed = true;
        }

        const round = settings.finalRound;
        if (settings.phase === "final" && round?.stage === "answering" && round.endsAt && round.endsAt <= now) {
            round.stage = "judging";
            round.endsAt = null;
            changed = true;
        }

        if (changed) {
            await this.saveAndBroadcast(settings);
        } else {
            await this.scheduleAlarm(settings);
        }
    }

    async onRequest(request: Request) {
        if (request.method === "GET") {
            if (this.isLobby) return Response.json({ ok: true });
            const settings = await this.loadSettings();
            if (!settings) return Response.json({ error: "Room not found" }, { status: 404 });
            return Response.json({ title: settings.title, gameMode: settings.gameMode });
        }

        if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

        const rawBody = await request.text();
        // Mutating HTTP actions are only accepted from our own parties (signed internal token).
        const authorized = await verifyToken<{ from: string }>(bearerToken(request), this.secret, "internal");
        if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });

        let payload: InternalRequest | null = null;
        try {
            payload = JSON.parse(rawBody) as InternalRequest;
        } catch {
            payload = null;
        }
        if (!payload) return Response.json({ error: "Bad request" }, { status: 400 });

        if (this.isLobby) {
            if (payload.action === "refresh_room") await this.refreshLobbyRoom(cleanSlug(payload.slug));
            return Response.json({ ok: true });
        }

        if (payload.action === "initialize") {
            const existing = await this.loadSettings();
            if (!existing) {
                const settings = this.defaultSettings();
                settings.title = cleanText(payload.title, settings.title, 40);
                if (typeof payload.ownerId === "string" && payload.ownerId) {
                    settings.ownerId = payload.ownerId;
                    settings.hostId = payload.ownerId;
                }
                await this.saveSettings(settings);
            }
        }
        if (payload.action === "destroy") await this.destroyRoom();
        return Response.json({ ok: true });
    }

    private async authenticate(url: URL): Promise<Identity | null> {
        if (!this.secret) {
            console.error("AUTH_SECRET is not configured for the party worker; every connection will be rejected.");
            return null;
        }
        const claims = await verifyToken<SessionUser>(url.searchParams.get("token"), this.secret, "party");
        const user = toSessionUser(claims);
        if (!user) return null;
        return {
            userId: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            provider: user.provider,
            isAdmin: isAdminUser(user),
        };
    }

    private reject(connection: Connection, message: ServerMessage, code: number, reason: string) {
        this.send(connection, message);
        connection.close(code, reason);
    }

    private async handleLobbyMessage(message: ClientMessage, sender: Connection<ConnectionState>) {
        const state = sender.state;
        if (state?.kind !== "lobby") return;

        if (message.type === "create_room") {
            const slug = cleanSlug(message.slug);
            if (slug.length < 3 || slug === "lobby") {
                this.send(sender, { type: "error", message: "Use at least 3 letters for the room." });
                return;
            }

            const rooms = await this.getStoredRooms();
            if (rooms.some((room) => room.slug === slug)) {
                this.send(sender, { type: "error", message: "That room name is already taken." });
                return;
            }

            const title = cleanText(message.title, "Untitled room", 40);
            const response = await this.internalFetch(slug, { action: "initialize", title, ownerId: state.userId });
            if (!response?.ok) {
                this.send(sender, { type: "error", message: "Couldn't open that room. Try again." });
                return;
            }

            const room: StoredRoomSummary = { slug, title, updatedAt: Date.now(), gameMode: "teams" };
            rooms.push(room);
            await this.ctx.storage.put("rooms", rooms);
            this.send(sender, { type: "room_created", room: { ...room, gameMode: "teams", playerCount: 0 } });
            await this.broadcastLobby();
            return;
        }

        if (message.type === "delete_room") {
            if (!state.isAdmin) {
                this.send(sender, { type: "error", message: "Only admins can delete rooms." });
                return;
            }
            const slug = cleanSlug(message.slug);
            if (!slug || slug === "lobby") return;

            const rooms = await this.getStoredRooms();
            const target = rooms.find((room) => room.slug === slug);
            await this.ctx.storage.put("rooms", rooms.filter((room) => room.slug !== slug));
            await this.internalFetch(slug, { action: "destroy" });
            this.send(sender, { type: "notice", message: `Deleted "${target?.title ?? slug}".` });
            await this.broadcastLobby();
        }
    }

    private async handleRoomMessage(message: ClientMessage, sender: Connection<ConnectionState>) {
        const state = sender.state;
        if (state?.kind !== "game") return;
        const settings = await this.loadSettings();
        if (!settings) return;

        const isOwner = settings.ownerId === state.userId;
        const isHost = settings.hostId === state.userId;
        const isAdmin = state.isAdmin;
        const canConfigure = isOwner || isAdmin;
        const canAssign = isOwner || isHost || isAdmin;
        // The owner and host can see answers (to build the board), so neither may buzz.
        const seesAnswers = isOwner || isHost;
        const canEditBoard = seesAnswers;
        const buzz = settings.buzz;
        const deny = (text: string) => this.send(sender, { type: "error", message: text });

        switch (message.type) {
            case "set_name": {
                if (state.provider !== "guest") return;
                const name = collapseWhitespace(String(message.name ?? ""));
                if (validateDisplayName(name)) return deny("That name isn't allowed.");
                this.updateUserConnections(state.userId, (current) => ({ ...current, name }));
                await this.broadcastRoom(settings);
                return;
            }

            case "join_team": {
                if (!TEAMS.includes(message.team)) return;
                if (message.team !== "spectators" && settings.privacy === "host_assigned" && !canAssign) {
                    return deny("The host assigns teams in this room.");
                }
                if (!this.canJoinTeam(message.team, settings, state.userId)) return deny("That team is full.");
                this.updateUserConnections(state.userId, (current) => ({ ...current, team: message.team }));
                await this.broadcastRoom(settings);
                return;
            }

            case "rename_team": {
                if (!canConfigure || !PRIMARY_TEAMS.includes(message.team)) {
                    return deny("Only the room owner can rename teams.");
                }
                settings.teamNames[message.team] = cleanText(message.name, DEFAULT_TEAM_NAMES[message.team], 24);
                await this.saveAndBroadcast(settings);
                return;
            }

            case "update_room": {
                if (!canConfigure) return deny("Only the room owner can change room settings.");

                const previousTitle = settings.title;
                const previousMode = settings.gameMode;
                if (message.title !== undefined) settings.title = cleanText(message.title, settings.title, 40);
                if (message.privacy === "open" || message.privacy === "host_assigned") {
                    if (settings.privacy !== message.privacy && message.privacy === "host_assigned") {
                        for (const player of this.gamePlayers()) {
                            player.connection.setState({ ...player.state, team: "spectators" });
                        }
                    }
                    settings.privacy = message.privacy;
                }
                if (message.maxPlayersPerTeam !== undefined) {
                    const requestedMax = Math.round(Number(message.maxPlayersPerTeam));
                    if (Number.isFinite(requestedMax)) {
                        settings.maxPlayersPerTeam = Math.max(1, Math.min(50, requestedMax));
                        this.moveTeamOverflowToSpectators(settings.maxPlayersPerTeam);
                    }
                }
                if ((message.gameMode === "teams" || message.gameMode === "buzz_in") && message.gameMode !== previousMode) {
                    settings.gameMode = message.gameMode;
                    settings.buzz = createEmptyBuzz({ usedQuestionIds: buzz.usedQuestionIds });
                    settings.phase = "lobby";
                    settings.readyUserIds = [];
                    settings.finalRound = null;
                }

                await this.saveAndBroadcast(settings);
                if (settings.title !== previousTitle || settings.gameMode !== previousMode) await this.notifyLobby();
                return;
            }

            case "assign_team": {
                if (!canAssign || !TEAMS.includes(message.team)) return deny("Only the owner or host can assign teams.");
                if (!this.gamePlayers().some((player) => player.state.userId === message.userId)) return;
                if (!this.canJoinTeam(message.team, settings, message.userId)) return deny("That team is full.");
                this.updateUserConnections(message.userId, (current) => ({ ...current, team: message.team }));
                await this.broadcastRoom(settings);
                return;
            }

            case "set_host": {
                if (!canConfigure) return deny("Only the room owner can choose a host.");
                if (!this.gamePlayers().some((player) => player.state.userId === message.userId)) return;
                settings.hostId = message.userId;
                if (buzz.buzzedUserId === message.userId) buzz.buzzedUserId = null;
                await this.saveAndBroadcast(settings);
                return;
            }

            case "remove_player": {
                if (!canConfigure) return deny("Only the room owner or an admin can remove players.");
                if (message.userId === state.userId) return deny("You can't remove yourself.");
                const targets = this.gamePlayers().filter((player) => player.state.userId === message.userId);
                const target = targets[0]?.state;
                if (!target) return;
                if (target.isAdmin && !isAdmin) return deny("Admins can't be removed from rooms.");

                if (!settings.removedUserIds.includes(target.userId)) settings.removedUserIds.push(target.userId);
                if (settings.ownerId === target.userId) settings.ownerId = state.userId;
                if (settings.hostId === target.userId) settings.hostId = settings.ownerId;
                if (buzz.buzzedUserId === target.userId) this.resumeAfterBuzz(settings);
                if (settings.pickerUserId === target.userId) settings.pickerUserId = null;

                await this.saveSettings(settings);
                for (const player of targets) {
                    this.send(player.connection, { type: "removed" });
                    player.connection.close(CLOSE_REMOVED, "Removed from room");
                }
                await this.broadcastRoom(settings);
                this.send(sender, { type: "notice", message: `Removed ${target.name} from the room.` });
                return;
            }

            case "clear_removed_players": {
                if (!canConfigure) return deny("Only the room owner or an admin can do that.");
                settings.removedUserIds = [];
                await this.saveAndBroadcast(settings);
                this.send(sender, { type: "notice", message: "Removed players can join again." });
                return;
            }

            case "update_timer": {
                if (!isHost) return deny("Only the host can change the timer.");
                const wasEnabled = settings.timerEnabled;
                settings.timerEnabled = Boolean(message.enabled);
                settings.timerSeconds = clampSeconds(message.seconds, settings.timerSeconds);
                if (message.expiryAction === "reveal" || message.expiryAction === "lock") {
                    settings.timerExpiryAction = message.expiryAction;
                }
                // Toggling applies to the clue on screen; duration changes apply from the next clue
                // (or when the host restarts the timer).
                if (buzz.activeQuestionId && !buzz.answerRevealed && wasEnabled !== settings.timerEnabled) {
                    if (settings.timerEnabled) {
                        this.startTimer(settings);
                    } else {
                        buzz.timerEndsAt = null;
                        buzz.timerPausedMs = null;
                        buzz.timerExpired = false;
                    }
                }
                await this.saveAndBroadcast(settings);
                return;
            }

            case "restart_timer": {
                if (!isHost || !settings.timerEnabled || !buzz.activeQuestionId || buzz.answerRevealed) return;
                this.startTimer(settings);
                await this.saveAndBroadcast(settings);
                return;
            }

            case "set_category_count": {
                if (!canEditBoard) return deny("Only the room owner or host can edit the board.");
                const count = Math.round(Number(message.count));
                if (!Number.isFinite(count) || count < MIN_CATEGORIES || count > MAX_CATEGORIES) return;
                const removed = settings.board.slice(count);
                if (removed.some((category) => this.categoryHasActiveClue(settings, category))) {
                    return deny("Close the clue on screen before removing its category.");
                }
                while (settings.board.length < count) settings.board.push(createBlankCategory(settings.board.length));
                settings.board = settings.board.slice(0, count);
                this.pruneUsedClues(settings);
                await this.saveAndBroadcast(settings);
                return;
            }

            case "rename_category": {
                if (!canEditBoard) return deny("Only the room owner or host can edit the board.");
                const category = settings.board.find((candidate) => candidate.id === message.categoryId);
                const name = cleanContent(message.name, 40);
                if (!category || !name) return;
                category.name = name;
                await this.saveAndBroadcast(settings);
                return;
            }

            case "update_clue": {
                if (!canEditBoard) return deny("Only the room owner or host can edit the board.");
                if (message.clueId === buzz.activeQuestionId) return deny("You can't edit the clue that's on screen.");
                const clue = settings.board.flatMap((category) => category.clues).find((candidate) => candidate.id === message.clueId);
                if (!clue) return;
                clue.prompt = cleanContent(message.prompt, 240);
                clue.answer = cleanContent(message.answer, 160);
                const value = Math.round(Number(message.value));
                if (Number.isFinite(value)) clue.value = Math.max(MIN_CLUE_VALUE, Math.min(MAX_CLUE_VALUE, value));
                await this.saveAndBroadcast(settings);
                return;
            }

            case "use_prefilled_category": {
                if (!canEditBoard) return deny("Only the room owner or host can edit the board.");
                const index = settings.board.findIndex((candidate) => candidate.id === message.categoryId);
                const prefilled = getPrefilledCategory(String(message.prefilledId));
                if (index < 0 || !prefilled) return;
                if (this.categoryHasActiveClue(settings, settings.board[index])) {
                    return deny("Close the clue on screen before replacing its category.");
                }
                settings.board[index] = createCategoryFromPrefilled(prefilled);
                this.pruneUsedClues(settings);
                await this.saveAndBroadcast(settings);
                return;
            }

            case "use_prefilled_board": {
                if (!canEditBoard) return deny("Only the room owner or host can edit the board.");
                if (buzz.activeQuestionId) return deny("Close the clue on screen before replacing the board.");
                const picks = pickRandomPrefilled(settings.board.length);
                settings.board = settings.board.map((category, index) =>
                    picks[index] ? createCategoryFromPrefilled(picks[index]) : category
                );
                this.pruneUsedClues(settings);
                await this.saveAndBroadcast(settings);
                return;
            }

            case "clear_category": {
                if (!canEditBoard) return deny("Only the room owner or host can edit the board.");
                const index = settings.board.findIndex((candidate) => candidate.id === message.categoryId);
                if (index < 0) return;
                if (this.categoryHasActiveClue(settings, settings.board[index])) {
                    return deny("Close the clue on screen before clearing its category.");
                }
                settings.board[index] = createBlankCategory(index);
                this.pruneUsedClues(settings);
                await this.saveAndBroadcast(settings);
                return;
            }

            case "update_rules": {
                if (!canEditBoard) return deny("Only the room owner or host can change the game rules.");
                if (message.answerMode === "spoken" || message.answerMode === "typed") {
                    settings.answerMode = message.answerMode;
                }
                if (message.pickMode === "host" || message.pickMode === "player") {
                    settings.pickMode = message.pickMode;
                }
                if (isAnswerLeniency(message.leniency)) {
                    settings.answerLeniency = message.leniency;
                }
                await this.saveAndBroadcast(settings);
                return;
            }

            case "select_question": {
                const isPicker = settings.pickMode === "player" && settings.pickerUserId === state.userId;
                if ((!isHost && !isPicker) || settings.gameMode !== "buzz_in" || settings.phase !== "playing" || buzz.activeQuestionId) return;
                const clue = this.findBoardClue(settings, message.questionId);
                if (!clue || !isClueFilled(clue) || buzz.usedQuestionIds.includes(clue.id)) return;
                settings.buzz = createEmptyBuzz({ activeQuestionId: clue.id, usedQuestionIds: buzz.usedQuestionIds });
                if (settings.timerEnabled) this.startTimer(settings);
                await this.saveAndBroadcast(settings);
                return;
            }

            case "submit_answer": {
                if (settings.answerMode !== "typed" || buzz.buzzedUserId !== state.userId || buzz.answerRevealed) return;
                if (buzz.attempts.some((attempt) => attempt.userId === state.userId && attempt.result === "pending")) {
                    return deny("Your answer is already locked in.");
                }
                const text = cleanContent(message.text, 160);
                if (!text) return deny("Type an answer first.");
                buzz.attempts.push({ userId: state.userId, text, result: "pending" });
                await this.saveAndBroadcast(settings);
                return;
            }

            case "buzz": {
                if (
                    seesAnswers ||
                    settings.gameMode !== "buzz_in" ||
                    !buzz.activeQuestionId ||
                    buzz.buzzedUserId ||
                    buzz.answerRevealed ||
                    buzz.timerExpired ||
                    (buzz.timerEndsAt !== null && buzz.timerEndsAt <= Date.now()) ||
                    buzz.excludedUserIds.includes(state.userId)
                ) return;
                buzz.buzzedUserId = state.userId;
                if (buzz.timerEndsAt !== null) {
                    buzz.timerPausedMs = Math.max(0, buzz.timerEndsAt - Date.now());
                    buzz.timerEndsAt = null;
                }
                await this.saveAndBroadcast(settings);
                return;
            }

            case "judge_buzz": {
                if (!isHost || !buzz.buzzedUserId) return;
                const userId = buzz.buzzedUserId;
                const value = this.findBoardClue(settings, buzz.activeQuestionId)?.value ?? 0;
                settings.scores[userId] = (settings.scores[userId] ?? 0) + (message.correct ? value : -value);
                for (const attempt of buzz.attempts) {
                    if (attempt.userId === userId && attempt.result === "pending") {
                        attempt.result = message.correct ? "correct" : "incorrect";
                    }
                }
                if (message.correct) {
                    this.markActiveUsed(settings);
                    buzz.answerRevealed = true;
                    buzz.timerEndsAt = null;
                    buzz.timerPausedMs = null;
                    // In "player" pick mode, whoever answers correctly chooses the next clue.
                    settings.pickerUserId = userId;
                } else {
                    buzz.excludedUserIds.push(userId);
                    this.resumeAfterBuzz(settings);
                }
                await this.saveAndBroadcast(settings);
                return;
            }

            case "reveal_answer": {
                if (!isHost || !buzz.activeQuestionId) return;
                buzz.answerRevealed = true;
                // A revealed clue can no longer be judged, so `buzzedUserId` after a reveal always means "answered correctly".
                buzz.buzzedUserId = null;
                buzz.timerEndsAt = null;
                buzz.timerPausedMs = null;
                await this.saveAndBroadcast(settings);
                return;
            }

            case "end_question": {
                if (!isHost) return;
                this.markActiveUsed(settings);
                settings.buzz = createEmptyBuzz({ usedQuestionIds: buzz.usedQuestionIds });
                // Closing the last clue on the board moves the game on to the Final Buzz In or the winner screen.
                if (settings.phase === "playing" && this.remainingClueCount(settings) === 0) this.finishBoard(settings);
                await this.saveAndBroadcast(settings);
                return;
            }

            case "reset_scores": {
                if (!isHost) return;
                settings.scores = {};
                settings.pickerUserId = null;
                await this.saveAndBroadcast(settings);
                return;
            }

            case "reset_board": {
                if (!isHost) return;
                settings.buzz = createEmptyBuzz();
                settings.pickerUserId = null;
                await this.saveAndBroadcast(settings);
                return;
            }

            case "set_ready": {
                if (seesAnswers || settings.gameMode !== "buzz_in" || settings.phase !== "lobby") return;
                settings.readyUserIds = settings.readyUserIds.filter((userId) => userId !== state.userId);
                if (message.ready) settings.readyUserIds.push(state.userId);
                await this.saveAndBroadcast(settings);
                return;
            }

            case "start_game": {
                if (!isOwner && !isHost && !isAdmin) return deny("Only the room owner or host can start the game.");
                if (settings.gameMode !== "buzz_in" || settings.phase !== "lobby") return;
                if (!isBoardFull(settings.board)) return deny("Fill every clue on the board before starting.");
                const contestants = this.contestantIds(settings);
                if (contestants.length === 0) return deny("Wait for at least one player to join.");
                const notReady = contestants.filter((userId) => !settings.readyUserIds.includes(userId));
                if (notReady.length > 0 && !message.force) return deny("Not everyone is ready yet.");
                settings.phase = "playing";
                settings.readyUserIds = [];
                settings.buzz = createEmptyBuzz();
                settings.pickerUserId = null;
                settings.finalRound = null;
                await this.saveAndBroadcast(settings);
                return;
            }

            case "update_final": {
                if (!seesAnswers) return deny("Only the room owner or host can set up the Final Buzz In.");
                const final = settings.final;
                if (typeof message.enabled === "boolean") final.enabled = message.enabled;
                if (message.seconds !== undefined) {
                    final.seconds = clampSeconds(message.seconds, final.seconds, FINAL_MIN_SECONDS, FINAL_MAX_SECONDS);
                }
                if (message.source === "custom" || message.source === "random") final.source = message.source;
                if (message.category !== undefined) final.category = cleanContent(message.category, 40);
                if (message.prompt !== undefined) final.prompt = cleanContent(message.prompt, 240);
                if (message.answer !== undefined) final.answer = cleanContent(message.answer, 160);
                await this.saveAndBroadcast(settings);
                return;
            }

            case "finish_board": {
                if (!seesAnswers || settings.phase !== "playing") return;
                if (buzz.activeQuestionId) return deny("Close the clue on screen first.");
                this.finishBoard(settings);
                await this.saveAndBroadcast(settings);
                return;
            }

            case "submit_final": {
                const round = settings.finalRound;
                if (seesAnswers || settings.phase !== "final" || !round) return;
                if (round.stage !== "answering" || (round.endsAt !== null && round.endsAt <= Date.now())) return deny("Time's up.");
                if (round.entries.some((entry) => entry.userId === state.userId)) return deny("Your answer is already locked in.");
                const answer = cleanContent(message.answer, 160);
                if (!answer) return deny("Type an answer first.");
                const maxWager = Math.max(0, settings.scores[state.userId] ?? 0);
                const requested = Math.round(Number(message.wager));
                const wager = Number.isFinite(requested) ? Math.max(0, Math.min(maxWager, requested)) : 0;
                round.entries.push({ userId: state.userId, wager, answer, result: "pending" });
                // Once every player has locked in there's no need to wait for the clock.
                const contestants = this.contestantIds(settings);
                if (contestants.every((userId) => round.entries.some((entry) => entry.userId === userId))) {
                    round.stage = "judging";
                    round.endsAt = null;
                }
                await this.saveAndBroadcast(settings);
                return;
            }

            case "lock_final": {
                const round = settings.finalRound;
                if (!seesAnswers || settings.phase !== "final" || round?.stage !== "answering") return;
                round.stage = "judging";
                round.endsAt = null;
                await this.saveAndBroadcast(settings);
                return;
            }

            case "judge_final": {
                const round = settings.finalRound;
                if (!seesAnswers || settings.phase !== "final" || round?.stage !== "judging") return;
                const entry = round.entries.find((candidate) => candidate.userId === message.userId);
                if (!entry) return;
                entry.result = message.correct ? "correct" : "incorrect";
                await this.saveAndBroadcast(settings);
                return;
            }

            case "reveal_final": {
                const round = settings.finalRound;
                if (!seesAnswers || settings.phase !== "final" || round?.stage !== "judging") return;
                if (round.entries.some((entry) => entry.result === "pending")) return deny("Judge every answer first.");
                for (const entry of round.entries) {
                    const wager = entry.wager ?? 0;
                    settings.scores[entry.userId] = (settings.scores[entry.userId] ?? 0) + (entry.result === "correct" ? wager : -wager);
                }
                round.stage = "revealed";
                await this.saveAndBroadcast(settings);
                return;
            }

            case "end_game": {
                if (!seesAnswers || (settings.phase !== "final" && settings.phase !== "playing")) return;
                if (settings.phase === "final" && settings.finalRound?.stage !== "revealed") return deny("Reveal the results first.");
                if (buzz.activeQuestionId) return deny("Close the clue on screen first.");
                settings.phase = "finished";
                await this.saveAndBroadcast(settings);
                return;
            }

            case "new_game": {
                if (!isOwner && !isHost && !isAdmin) return deny("Only the room owner or host can start a new game.");
                settings.phase = "lobby";
                settings.readyUserIds = [];
                settings.scores = {};
                settings.buzz = createEmptyBuzz();
                settings.pickerUserId = null;
                settings.finalRound = null;
                await this.saveAndBroadcast(settings);
                return;
            }
        }
    }

    /** Connected players who compete (everyone but the owner and host). */
    private contestantIds(settings: StoredRoomSettings) {
        return this.collectPlayers(settings)
            .filter((player) => player.userId !== settings.ownerId && player.userId !== settings.hostId)
            .map((player) => player.userId);
    }

    private remainingClueCount(settings: StoredRoomSettings) {
        return settings.board
            .flatMap((category) => category.clues)
            .filter((clue) => isClueFilled(clue) && !settings.buzz.usedQuestionIds.includes(clue.id)).length;
    }

    /** The board is done: start the Final Buzz In if it's on, otherwise go straight to the winner screen. */
    private finishBoard(settings: StoredRoomSettings) {
        settings.buzz = createEmptyBuzz({ usedQuestionIds: settings.buzz.usedQuestionIds });
        if (!settings.final.enabled) {
            settings.phase = "finished";
            settings.finalRound = null;
            return;
        }
        const final = settings.final;
        const question =
            final.source === "custom" && isCustomFinalReady(final)
                ? { category: final.category || "Final Buzz In", prompt: final.prompt, answer: final.answer }
                : pickFinalQuestion(settings.board);
        settings.phase = "final";
        settings.finalRound = {
            stage: "answering",
            ...question,
            endsAt: Date.now() + final.seconds * 1000,
            entries: [],
        };
    }

    private startTimer(settings: StoredRoomSettings) {
        const buzz = settings.buzz;
        const durationMs = settings.timerSeconds * 1000;
        buzz.timerExpired = false;
        if (buzz.buzzedUserId) {
            buzz.timerEndsAt = null;
            buzz.timerPausedMs = durationMs;
        } else {
            buzz.timerEndsAt = Date.now() + durationMs;
            buzz.timerPausedMs = null;
        }
    }

    private resumeAfterBuzz(settings: StoredRoomSettings) {
        const buzz = settings.buzz;
        buzz.buzzedUserId = null;
        if (buzz.timerPausedMs !== null) {
            buzz.timerEndsAt = Date.now() + Math.max(buzz.timerPausedMs, MIN_RESUME_MS);
            buzz.timerPausedMs = null;
        }
    }

    private markActiveUsed(settings: StoredRoomSettings) {
        const activeId = settings.buzz.activeQuestionId;
        if (activeId && !settings.buzz.usedQuestionIds.includes(activeId)) {
            settings.buzz.usedQuestionIds.push(activeId);
        }
    }

    private defaultSettings(): StoredRoomSettings {
        const slug = this.safeRoomId();
        return {
            slug,
            title: titleFromSlug(slug),
            ownerId: "",
            hostId: "",
            teamNames: { ...DEFAULT_TEAM_NAMES },
            privacy: "open",
            maxPlayersPerTeam: 8,
            gameMode: "teams",
            timerEnabled: false,
            timerSeconds: 30,
            timerExpiryAction: "reveal",
            answerMode: "spoken",
            pickMode: "host",
            answerLeniency: DEFAULT_ANSWER_LENIENCY,
            pickerUserId: null,
            board: createBlankBoard(),
            buzz: createEmptyBuzz(),
            scores: {},
            removedUserIds: [],
            phase: "lobby",
            readyUserIds: [],
            final: createDefaultFinal(),
            finalRound: null,
        };
    }

    private async getStoredRooms() {
        return (await this.ctx.storage.get<StoredRoomSummary[]>("rooms")) ?? [];
    }

    /** Returns null when the room was never created (or has been deleted). */
    private async loadSettings(): Promise<StoredRoomSettings | null> {
        const stored = await this.ctx.storage.get<Partial<StoredRoomSettings>>("settings");
        if (!stored) return null;
        const defaults = this.defaultSettings();
        const { questions: _legacyQuestions, ...current } = stored as Partial<StoredRoomSettings> & { questions?: unknown };
        return {
            ...defaults,
            ...current,
            slug: stored.slug || defaults.slug,
            teamNames: { ...defaults.teamNames, ...stored.teamNames },
            timerSeconds: clampSeconds(stored.timerSeconds, defaults.timerSeconds),
            board: stored.board?.length ? stored.board : migrateLegacyQuestions(stored) ?? defaults.board,
            buzz: { ...defaults.buzz, ...stored.buzz },
            scores: stored.scores ?? {},
            removedUserIds: stored.removedUserIds ?? [],
            hostId: stored.hostId || stored.ownerId || "",
            // Rooms saved before the lobby existed keep playing if a game was already underway.
            phase: stored.phase ?? (stored.buzz?.activeQuestionId || stored.buzz?.usedQuestionIds?.length ? "playing" : "lobby"),
            readyUserIds: stored.readyUserIds ?? [],
            final: {
                ...defaults.final,
                ...stored.final,
                seconds: clampSeconds(stored.final?.seconds, defaults.final.seconds, FINAL_MIN_SECONDS, FINAL_MAX_SECONDS),
            },
            finalRound: stored.finalRound ?? null,
        };
    }

    private async saveSettings(settings: StoredRoomSettings) {
        await this.ctx.storage.put("settings", settings);
        await this.scheduleAlarm(settings);
    }

    /** One alarm covers both the clue timer and the Final Buzz In timer. */
    private async scheduleAlarm(settings: StoredRoomSettings) {
        const due: number[] = [];
        if (settings.buzz.timerEndsAt) due.push(settings.buzz.timerEndsAt);
        const round = settings.finalRound;
        if (settings.phase === "final" && round?.stage === "answering" && round.endsAt) due.push(round.endsAt);
        if (due.length > 0) {
            await this.ctx.storage.setAlarm(Math.min(...due));
        } else {
            await this.ctx.storage.deleteAlarm();
        }
    }

    private async saveAndBroadcast(settings: StoredRoomSettings) {
        await this.saveSettings(settings);
        await this.broadcastRoom(settings);
    }

    private async destroyRoom() {
        await this.ctx.storage.deleteAlarm();
        await this.ctx.storage.deleteAll();
        for (const connection of this.getConnections()) {
            this.send(connection, { type: "room_deleted" });
            connection.close(CLOSE_DELETED, "Room deleted");
        }
    }

    private gamePlayers(): GamePlayer[] {
        const players: GamePlayer[] = [];
        for (const connection of this.getConnections<ConnectionState>()) {
            const state = connection.state;
            if (state?.kind === "game") players.push({ connection, state });
        }
        return players;
    }

    private updateUserConnections(userId: string, update: (state: GameConnectionState) => GameConnectionState) {
        for (const player of this.gamePlayers()) {
            if (player.state.userId === userId) player.connection.setState(update(player.state));
        }
    }

    private teamMembers(team: TeamId) {
        const members = new Set<string>();
        for (const player of this.gamePlayers()) {
            if (player.state.team === team) members.add(player.state.userId);
        }
        return members;
    }

    private canJoinTeam(team: TeamId, settings: StoredRoomSettings, userId: string) {
        if (!isPrimaryTeam(team)) return true;
        const members = this.teamMembers(team);
        members.delete(userId);
        return members.size < settings.maxPlayersPerTeam;
    }

    private moveTeamOverflowToSpectators(maxPlayers: number) {
        for (const team of PRIMARY_TEAMS) {
            for (const userId of [...this.teamMembers(team)].slice(maxPlayers)) {
                this.updateUserConnections(userId, (current) => ({ ...current, team: "spectators" }));
            }
        }
    }

    private findBoardClue(settings: StoredRoomSettings, clueId: string | null) {
        if (!clueId) return null;
        for (const category of settings.board) {
            const clue = category.clues.find((candidate) => candidate.id === clueId);
            if (clue) return clue;
        }
        return null;
    }

    private categoryHasActiveClue(settings: StoredRoomSettings, category: BoardCategoryData) {
        return category.clues.some((clue) => clue.id === settings.buzz.activeQuestionId);
    }

    /** Drops "used" markers for clues that no longer exist on the board. */
    private pruneUsedClues(settings: StoredRoomSettings) {
        const ids = new Set(settings.board.flatMap((category) => category.clues.map((clue) => clue.id)));
        settings.buzz.usedQuestionIds = settings.buzz.usedQuestionIds.filter((id) => ids.has(id));
    }

    private async internalFetch(slug: string, body: InternalRequest) {
        if (!this.secret) return null;
        const token = await signToken({ from: this.name }, this.secret, "internal", 60);
        const stub = await getServerByName(this.env.Main, slug);
        return stub.fetch(INTERNAL_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    }

    private async notifyLobby() {
        await this.internalFetch("lobby", { action: "refresh_room", slug: this.name });
    }

    private async refreshLobbyRoom(slug: string) {
        if (!slug) return;
        const stub = await getServerByName(this.env.Main, slug);
        const response = await stub.fetch(INTERNAL_URL);
        if (!response.ok) return;
        const details = (await response.json()) as { title?: string; gameMode?: GameMode };
        const rooms = await this.getStoredRooms();
        const room = rooms.find((candidate) => candidate.slug === slug);
        if (!room) return;
        if (details.title) room.title = details.title;
        if (details.gameMode) room.gameMode = details.gameMode;
        room.updatedAt = Date.now();
        await this.ctx.storage.put("rooms", rooms);
        await this.broadcastLobby();
    }

    private async broadcastLobby() {
        const storedRooms = await this.getStoredRooms();
        const presence = new Map<string, Set<string>>();

        for (const connection of this.getConnections<ConnectionState>()) {
            const state = connection.state;
            if (state?.kind !== "lobby" || !state.roomSlug) continue;
            const users = presence.get(state.roomSlug) ?? new Set<string>();
            users.add(state.userId);
            presence.set(state.roomSlug, users);
        }

        const rooms: RoomSummary[] = storedRooms
            .map((room) => ({
                slug: room.slug,
                title: room.title,
                updatedAt: room.updatedAt,
                gameMode: room.gameMode ?? "teams",
                playerCount: presence.get(room.slug)?.size ?? 0,
            }))
            .sort((left, right) => right.playerCount - left.playerCount || right.updatedAt - left.updatedAt);
        this.broadcast(JSON.stringify({ type: "lobby_state", rooms } satisfies ServerMessage));
    }

    private collectPlayers(settings: StoredRoomSettings): RoomPlayer[] {
        const byUser = new Map<string, GameConnectionState>();
        for (const { state } of this.gamePlayers()) {
            const removed = settings.removedUserIds.includes(state.userId) && !state.isAdmin;
            if (!removed && !byUser.has(state.userId)) byUser.set(state.userId, state);
        }

        const users = [...byUser.values()];
        const nameTotals = new Map<string, number>();
        for (const user of users) {
            const key = user.name.toLocaleLowerCase();
            nameTotals.set(key, (nameTotals.get(key) ?? 0) + 1);
        }

        const nameIndexes = new Map<string, number>();
        return users.map((user) => {
            const key = user.name.toLocaleLowerCase();
            const index = (nameIndexes.get(key) ?? 0) + 1;
            nameIndexes.set(key, index);
            return {
                userId: user.userId,
                name: user.name,
                avatarUrl: user.avatarUrl,
                provider: user.provider,
                displayNumber: (nameTotals.get(key) ?? 0) > 1 ? index : undefined,
                team: user.team,
                isOwner: user.userId === settings.ownerId,
                isHost: user.userId === settings.hostId,
                isAdmin: user.isAdmin,
                score: settings.scores[user.userId] ?? 0,
            };
        });
    }

    private buildRoomState(settings: StoredRoomSettings): RoomState {
        return {
            slug: settings.slug,
            title: settings.title,
            ownerId: settings.ownerId,
            hostId: settings.hostId,
            teamNames: settings.teamNames,
            privacy: settings.privacy,
            maxPlayersPerTeam: settings.maxPlayersPerTeam,
            gameMode: settings.gameMode,
            timer: {
                enabled: settings.timerEnabled,
                seconds: settings.timerSeconds,
                expiryAction: settings.timerExpiryAction,
            },
            rules: { answerMode: settings.answerMode, pickMode: settings.pickMode, leniency: settings.answerLeniency },
            pickerUserId: settings.pickerUserId,
            players: this.collectPlayers(settings),
            board: settings.board.map((category) => ({
                ...category,
                clues: category.clues.map((clue) => ({ ...clue, filled: isClueFilled(clue) })),
            })),
            buzz: settings.buzz,
            removedCount: settings.removedUserIds.length,
            phase: settings.phase,
            readyUserIds: settings.readyUserIds,
            final: settings.final,
            finalRound: settings.finalRound,
        };
    }

    private async broadcastRoom(settings?: StoredRoomSettings) {
        const current = settings ?? (await this.loadSettings());
        if (!current) return;

        const room = this.buildRoomState(current);
        const redacted = this.redactAnswers(room);
        const serverTime = Date.now();
        // Players get their own Final Buzz In entry, so their copy is redacted per user while answers are hidden.
        const perUser = current.finalRound !== null && current.finalRound.stage !== "revealed";

        for (const connection of this.getConnections<ConnectionState>()) {
            const state = connection.state;
            if (state?.kind === "game") {
                // The owner and host build the board, so they see clues and answers; nobody else does early.
                const seesAnswers = state.userId === current.hostId || state.userId === current.ownerId;
                const view = seesAnswers ? room : perUser ? this.redactAnswers(room, state.userId) : redacted;
                this.send(connection, { type: "room_state", room: view, serverTime });
            } else if (state?.kind === "preview") {
                this.send(connection, { type: "preview_state", room: redacted, serverTime });
            }
        }
    }

    /**
     * Hides every prompt except the clue on screen, every answer until it's revealed, the custom final question,
     * and other players' Final Buzz In wagers and answers until the results are revealed.
     */
    private redactAnswers(room: RoomState, viewerId: string | null = null): RoomState {
        const { activeQuestionId, answerRevealed } = room.buzz;
        const round = room.finalRound;
        const revealed = round?.stage === "revealed";
        return {
            ...room,
            buzz: { ...room.buzz, attempts: [] },
            board: room.board.map((category): BoardCategory => ({
                ...category,
                clues: category.clues.map((clue) => ({
                    ...clue,
                    prompt: clue.id === activeQuestionId ? clue.prompt : "",
                    answer: clue.id === activeQuestionId && answerRevealed ? clue.answer : "",
                })),
            })),
            final: { ...room.final, category: "", prompt: "", answer: "" },
            finalRound: round && {
                ...round,
                answer: revealed ? round.answer : "",
                entries: round.entries.map((entry) =>
                    revealed
                        ? entry
                        : entry.userId === viewerId
                            ? { ...entry, result: "pending" }
                            : { ...entry, wager: null, answer: "", result: "pending" }
                ),
            },
        };
    }

    private send(connection: Connection, message: ServerMessage) {
        try {
            connection.send(JSON.stringify(message));
        } catch {
            // The socket closed mid-broadcast (e.g. a removed player); skip it.
        }
    }
}

export default {
    async fetch(request: Request, env: Env) {
        return (await routePartykitRequest(request, env)) ?? new Response("Not found", { status: 404 });
    },
} satisfies ExportedHandler<Env>;
