"use client";

import { Hand, Keyboard, Mic, Radio, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { playerLabel, type AnswerMode, type PickMode, type RoomState } from "@/lib/protocol";
import type { Send } from "./viewer";

const PRESSED = "aria-pressed:bg-ink aria-pressed:text-white data-pressed:bg-ink data-pressed:text-white";
const LABEL = "font-mono text-[11px] tracking-wider text-ink/70 uppercase";

export function GameRules({ room, send }: { room: RoomState; send: Send }) {
    const { answerMode, pickMode } = room.rules;
    const picker = room.players.find((player) => player.userId === room.pickerUserId);

    return (
        <Card className="gap-0 rounded-xl border-2 border-ink py-0 text-ink shadow-[4px_4px_0_var(--ink)] ring-0">
            <CardHeader className="border-b-2 border-ink bg-paper py-4">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <SlidersHorizontal className="size-4" /> Game rules
                </CardTitle>
                <CardDescription>Choose how players answer and who picks the next clue.</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-6 py-5">
                <Field>
                    <FieldLabel className={LABEL}>Answers</FieldLabel>
                    <ToggleGroup
                        variant="outline"
                        spacing={0}
                        value={[answerMode]}
                        onValueChange={(value) => {
                            const next = value[0] as AnswerMode | undefined;
                            if (next && next !== answerMode) send({ type: "update_rules", answerMode: next });
                        }}
                        className="w-full"
                    >
                        <ToggleGroupItem value="spoken" className={`h-9 flex-1 ${PRESSED}`}>
                            <Mic /> Say it out loud
                        </ToggleGroupItem>
                        <ToggleGroupItem value="typed" className={`h-9 flex-1 ${PRESSED}`}>
                            <Keyboard /> Type it in
                        </ToggleGroupItem>
                    </ToggleGroup>
                    <FieldDescription>
                        {answerMode === "typed"
                            ? "After buzzing, players type their answer. You and the host see what each player typed; other players don't."
                            : "After buzzing, players answer out loud and the host judges it."}
                    </FieldDescription>
                </Field>

                <Field>
                    <FieldLabel className={LABEL}>Picking clues</FieldLabel>
                    <ToggleGroup
                        variant="outline"
                        spacing={0}
                        value={[pickMode]}
                        onValueChange={(value) => {
                            const next = value[0] as PickMode | undefined;
                            if (next && next !== pickMode) send({ type: "update_rules", pickMode: next });
                        }}
                        className="w-full"
                    >
                        <ToggleGroupItem value="host" className={`h-9 flex-1 ${PRESSED}`}>
                            <Radio /> Host picks
                        </ToggleGroupItem>
                        <ToggleGroupItem value="player" className={`h-9 flex-1 ${PRESSED}`}>
                            <Hand /> Players pick
                        </ToggleGroupItem>
                    </ToggleGroup>
                    <FieldDescription>
                        {pickMode === "player"
                            ? `The last player to answer correctly chooses the next clue. ${picker ? `Up next: ${playerLabel(picker)}.` : "The host picks until someone gets one right."} The host can always pick instead.`
                            : "The host chooses every clue."}
                    </FieldDescription>
                </Field>
            </CardContent>
        </Card>
    );
}
