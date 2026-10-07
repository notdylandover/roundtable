"use client";

import { CircleHelp, Hand, Keyboard, Mic, Radio, SlidersHorizontal, ThumbsDown, ThumbsUp } from "lucide-react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { assessAnswer, type AnswerLeniency, type MatchVerdict } from "@/lib/answer-match";
import { playerLabel, type AnswerMode, type PickMode, type RoomState } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { SETTINGS_LABEL as LABEL, SETTINGS_PRESSED as PRESSED, SettingsSection } from "./settings-section";
import type { Send } from "./viewer";

const LENIENCY_OPTIONS: { value: AnswerLeniency; label: string; description: string }[] = [
    { value: "off", label: "Off", description: "No suggestions. You judge every answer on your own." },
    { value: "strict", label: "Strict", description: "Only exact answers and tiny typos look right. Partial answers are flagged for you to decide." },
    { value: "balanced", label: "Balanced", description: "Typos and extra words look right. Partial answers, like a last name only, are flagged as close." },
    { value: "lenient", label: "Lenient", description: "Partial answers that get the key word right look right." },
];

/** Shown under the leniency picker so owners can see what each level does. */
const EXAMPLES = [
    { guess: "Elephant", answer: "African elephant" },
    { guess: "Afrikan elefant", answer: "African elephant" },
    { guess: "Washington", answer: "George Washington" },
    { guess: "Indian elephant", answer: "African elephant" },
];

const VERDICT_CHIP: Record<MatchVerdict, { label: string; icon: typeof ThumbsUp; tone: string }> = {
    accept: { label: "Looks right", icon: ThumbsUp, tone: "border-pine/30 bg-green-100 text-pine" },
    review: { label: "Close", icon: CircleHelp, tone: "border-amber-500/40 bg-amber-100 text-amber-800" },
    reject: { label: "No match", icon: ThumbsDown, tone: "border-destructive/30 bg-destructive/10 text-destructive" },
};

function LeniencyPreview({ leniency }: { leniency: AnswerLeniency }) {
    if (leniency === "off") return null;
    return (
        <ul className="flex flex-col gap-1.5 rounded-lg bg-paper p-2.5">
            {EXAMPLES.map((example) => {
                const verdict = assessAnswer(example.guess, example.answer, leniency)?.verdict ?? "reject";
                const chip = VERDICT_CHIP[verdict];
                const Icon = chip.icon;
                return (
                    <li key={example.guess} className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate">
                            <strong>“{example.guess}”</strong> <span className="text-ink/50">for</span> “{example.answer}”
                        </span>
                        <span className={cn("flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-semibold", chip.tone)}>
                            <Icon className="size-3" /> {chip.label}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

export function GameRules({ room, send }: { room: RoomState; send: Send }) {
    const { answerMode, pickMode, leniency } = room.rules;
    const picker = room.players.find((player) => player.userId === room.pickerUserId);
    const leniencyCopy = LENIENCY_OPTIONS.find((option) => option.value === leniency) ?? LENIENCY_OPTIONS[0];

    return (
        <SettingsSection
            icon={<SlidersHorizontal />}
            title="Game rules"
            description="Choose how players answer, who picks the next clue, and how judging hints work."
        >
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

            <Field>
                <FieldLabel className={LABEL}>Judging hints</FieldLabel>
                <ToggleGroup
                    variant="outline"
                    spacing={0}
                    value={[leniency]}
                    onValueChange={(value) => {
                        const next = value[0] as AnswerLeniency | undefined;
                        if (next && next !== leniency) send({ type: "update_rules", leniency: next });
                    }}
                    className="w-full"
                >
                    {LENIENCY_OPTIONS.map((option) => (
                        <ToggleGroupItem key={option.value} value={option.value} className={`h-9 flex-1 ${PRESSED}`}>
                            {option.label}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
                <FieldDescription>
                    {leniencyCopy.description} Hints appear next to typed answers and Final Buzz In answers, only for you and
                    the host. You always make the final call.
                </FieldDescription>
                <LeniencyPreview leniency={leniency} />
            </Field>
        </SettingsSection>
    );
}
