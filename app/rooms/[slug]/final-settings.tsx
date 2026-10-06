"use client";

import { Check, PencilLine, Shuffle, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    FINAL_MAX_SECONDS,
    FINAL_MIN_SECONDS,
    FINAL_PRESETS,
    isCustomFinalReady,
    type FinalSettings as FinalSettingsValue,
    type FinalSource,
} from "@/lib/protocol";
import { cn } from "@/lib/utils";
import type { Send } from "./viewer";

const PRESSED = "aria-pressed:bg-ink aria-pressed:text-white data-pressed:bg-ink data-pressed:text-white";
const LABEL = "font-mono text-[11px] tracking-wider text-ink/70 uppercase";

function CustomQuestionForm({ final, send }: { final: FinalSettingsValue; send: Send }) {
    const [category, setCategory] = useState(final.category);
    const [prompt, setPrompt] = useState(final.prompt);
    const [answer, setAnswer] = useState(final.answer);
    const dirty = category !== final.category || prompt !== final.prompt || answer !== final.answer;
    const ready = isCustomFinalReady({ prompt, answer });

    function save(event: FormEvent) {
        event.preventDefault();
        send({ type: "update_final", category, prompt, answer });
    }

    return (
        <form onSubmit={save} className="flex flex-col gap-3 rounded-lg border-2 border-ink/10 bg-paper p-3">
            <Field>
                <FieldLabel className={LABEL} htmlFor="final-category">Category</FieldLabel>
                <Input
                    id="final-category"
                    value={category}
                    maxLength={40}
                    placeholder="Final Buzz In"
                    onChange={(event) => setCategory(event.target.value)}
                    className="bg-white"
                />
            </Field>
            <Field>
                <FieldLabel className={LABEL} htmlFor="final-prompt">Question</FieldLabel>
                <Textarea
                    id="final-prompt"
                    value={prompt}
                    maxLength={240}
                    placeholder="This planet has the most known moons."
                    onChange={(event) => setPrompt(event.target.value)}
                    className="min-h-20 bg-white"
                />
            </Field>
            <Field>
                <FieldLabel className={LABEL} htmlFor="final-answer">Answer</FieldLabel>
                <Input
                    id="final-answer"
                    value={answer}
                    maxLength={160}
                    placeholder="Saturn"
                    onChange={(event) => setAnswer(event.target.value)}
                    className="bg-white"
                />
            </Field>
            <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-ink/60">
                    {!ready
                        ? "Add a question and answer, or a random question is used."
                        : dirty
                            ? "Unsaved changes."
                            : "Saved. Only you and the host can see this."}
                </span>
                <Button type="submit" size="lg" disabled={!dirty} className="h-9 border-2 border-ink px-4">
                    <Check /> Save
                </Button>
            </div>
        </form>
    );
}

export function FinalSettings({ final, send }: { final: FinalSettingsValue; send: Send }) {
    const [draftSeconds, setDraftSeconds] = useState<number | null>(null);
    const seconds = draftSeconds ?? final.seconds;
    const customReady = isCustomFinalReady(final);

    return (
        <Card className="gap-0 rounded-xl border-2 border-ink py-0 text-ink shadow-[4px_4px_0_var(--ink)] ring-0">
            <CardHeader className="border-b-2 border-ink bg-paper py-4">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <Sparkles className="size-4" /> Final Buzz In
                </CardTitle>
                <CardDescription>
                    After the last clue, everyone wagers up to their score and types an answer to one final question.
                </CardDescription>
                <CardAction className="flex items-center gap-2 self-center">
                    <span className="font-mono text-[10px] font-semibold uppercase">{final.enabled ? "On" : "Off"}</span>
                    <Switch
                        checked={final.enabled}
                        onCheckedChange={(enabled) => send({ type: "update_final", enabled })}
                        aria-label="Play a Final Buzz In"
                    />
                </CardAction>
            </CardHeader>

            <CardContent className={cn("flex flex-col gap-6 py-5 transition-opacity", !final.enabled && "opacity-50")}>
                <Field>
                    <div className="flex items-end justify-between">
                        <FieldLabel className={LABEL}>Time to answer</FieldLabel>
                        <span className="font-pixel-square text-3xl leading-none tabular-nums">{seconds}s</span>
                    </div>
                    <Slider
                        value={[seconds]}
                        min={FINAL_MIN_SECONDS}
                        max={FINAL_MAX_SECONDS}
                        step={5}
                        disabled={!final.enabled}
                        aria-label="Seconds to answer the Final Buzz In"
                        onValueChange={(value) => setDraftSeconds(Array.isArray(value) ? value[0] : value)}
                        onValueCommitted={(value) => {
                            setDraftSeconds(null);
                            send({ type: "update_final", seconds: Array.isArray(value) ? value[0] : value });
                        }}
                        className="py-2"
                    />
                    <ToggleGroup
                        variant="outline"
                        size="sm"
                        value={[String(seconds)]}
                        disabled={!final.enabled}
                        onValueChange={(value) => {
                            if (value[0]) send({ type: "update_final", seconds: Number(value[0]) });
                        }}
                    >
                        {FINAL_PRESETS.map((preset) => (
                            <ToggleGroupItem key={preset} value={String(preset)} className={`px-3 font-mono ${PRESSED}`}>
                                {preset}s
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </Field>

                <Field>
                    <div className="flex items-center justify-between">
                        <FieldLabel className={LABEL}>Question</FieldLabel>
                        {final.source === "custom" && (
                            <Badge
                                variant="outline"
                                className={cn("border-2 font-mono", customReady ? "border-pine/40 bg-green-100 text-pine" : "border-ink/15")}
                            >
                                {customReady ? "Ready" : "Not set"}
                            </Badge>
                        )}
                    </div>
                    <ToggleGroup
                        variant="outline"
                        spacing={0}
                        value={[final.source]}
                        disabled={!final.enabled}
                        onValueChange={(value) => {
                            const source = value[0] as FinalSource | undefined;
                            if (source && source !== final.source) send({ type: "update_final", source });
                        }}
                        className="w-full"
                    >
                        <ToggleGroupItem value="random" className={`h-9 flex-1 ${PRESSED}`}>
                            <Shuffle /> Random
                        </ToggleGroupItem>
                        <ToggleGroupItem value="custom" className={`h-9 flex-1 ${PRESSED}`}>
                            <PencilLine /> Write my own
                        </ToggleGroupItem>
                    </ToggleGroup>
                    <FieldDescription>
                        {final.source === "random"
                            ? "A hard question from a prefilled category that isn't on the board."
                            : "Players see the category and question when the Final Buzz In starts."}
                    </FieldDescription>
                </Field>

                {final.source === "custom" && (
                    <CustomQuestionForm key={`${final.category}|${final.prompt}|${final.answer}`} final={final} send={send} />
                )}
            </CardContent>
        </Card>
    );
}
