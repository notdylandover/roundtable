"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Hand } from "lucide-react";
import type { ReactNode } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { findClue, playerLabel, type RoomPlayer, type RoomState } from "@/lib/protocol";
import type { Send, Viewer } from "../viewer";
import { Board, ClueOverlay } from "./board";
import { ClueControls } from "./clue-controls";
import { FinalStage } from "./final";
import { GameStartWipe } from "./game-start-wipe";
import { LobbyStage } from "./lobby";
import { StandBy } from "./primitives";
import { WinnerStage } from "./winner";

type StageBodyProps = {
    room: RoomState;
    clockOffset: number;
    /** Omitted on the read-only big-screen preview. */
    viewer?: Viewer;
    send?: Send;
    joinUrl?: string;
    renderActions?: (player: RoomPlayer) => ReactNode;
    onEditBoard?: () => void;
};

/** Score rail is shown while clues are being played and during the Final Buzz In. */
export function stageShowsScores(room: RoomState) {
    return room.gameMode === "buzz_in" && (room.phase === "playing" || room.phase === "final");
}

/** Score changes animate while a clue is open or Final Buzz In results are revealed. */
export function stageShowsDeltas(room: RoomState) {
    return Boolean(room.buzz.activeQuestionId) || room.phase === "final";
}

function PlayingStage({ room, clockOffset, viewer, send }: StageBodyProps) {
    const activeQuestion = findClue(room.board, room.buzz.activeQuestionId);
    const hasClues = room.board.some((category) => category.clues.some((clue) => clue.filled));
    const isPicker = room.rules.pickMode === "player" && Boolean(viewer?.userId) && room.pickerUserId === viewer?.userId;
    const canPick = Boolean(send && viewer && (viewer.isHost || isPicker));

    if (!hasClues) return <StandBy title="Waiting for clues" description="The host is still writing the board." />;

    return (
        <LayoutGroup id="board">
            <Board room={room} onPick={canPick ? (questionId) => send?.({ type: "select_question", questionId }) : undefined} />
            <AnimatePresence>
                {activeQuestion && (
                    <ClueOverlay
                        key={activeQuestion.id}
                        room={room}
                        question={activeQuestion}
                        clockOffset={clockOffset}
                        answerKey={viewer?.isGameMaster ? activeQuestion.answer : undefined}
                    >
                        {viewer && send && <ClueControls room={room} viewer={viewer} send={send} question={activeQuestion} />}
                    </ClueOverlay>
                )}
            </AnimatePresence>
        </LayoutGroup>
    );
}

export function StageBody(props: StageBodyProps) {
    const { room } = props;
    if (room.gameMode !== "buzz_in") {
        return <StandBy title="Stand by" description="The board appears as soon as the room switches to Buzz In." />;
    }

    return (
        <>
            <AnimatePresence mode="wait">
                <motion.div
                    key={room.phase}
                    className="relative h-full"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.03 }}
                    transition={{ duration: 0.35 }}
                >
                    {room.phase === "lobby" && (
                        <LobbyStage
                            room={room}
                            viewer={props.viewer}
                            send={props.send}
                            joinUrl={props.joinUrl}
                            renderActions={props.renderActions}
                            onEditBoard={props.onEditBoard}
                        />
                    )}
                    {room.phase === "playing" && <PlayingStage {...props} />}
                    {room.phase === "final" && <FinalStage room={room} clockOffset={props.clockOffset} viewer={props.viewer} send={props.send} />}
                    {room.phase === "finished" && <WinnerStage room={room} viewer={props.viewer} send={props.send} />}
                </motion.div>
            </AnimatePresence>
            <GameStartWipe phase={room.phase} />
        </>
    );
}

/** "Your pick!" / "Sam picks next" while players choose clues. */
export function PickerChip({ room, viewerId = null }: { room: RoomState; viewerId?: string | null }) {
    const picker =
        room.gameMode === "buzz_in" && room.phase === "playing" && room.rules.pickMode === "player" && !room.buzz.activeQuestionId
            ? room.players.find((player) => player.userId === room.pickerUserId)
            : undefined;
    const mine = picker?.userId === viewerId;

    return (
        <AnimatePresence>
            {picker && (
                <motion.span
                    key={picker.userId}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={mine ? { opacity: 1, scale: [1, 1.08, 1] } : { opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={mine ? { scale: { duration: 1.2, repeat: Infinity } } : undefined}
                    className="flex items-center gap-2 rounded-full bg-mustard py-1 pr-4 pl-1 text-sm font-bold text-ink"
                >
                    <UserAvatar name={picker.name} avatarUrl={picker.avatarUrl} seed={picker.userId} size="sm" />
                    {mine ? (
                        <>
                            <Hand className="size-4" /> Your pick!
                        </>
                    ) : (
                        `${playerLabel(picker)} picks next`
                    )}
                </motion.span>
            )}
        </AnimatePresence>
    );
}
