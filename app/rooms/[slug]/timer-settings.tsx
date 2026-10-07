"use client";

import { Eye, Lock, Pause, Timer } from "lucide-react";
import { useState } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
    TIMER_MAX_SECONDS,
    TIMER_MIN_SECONDS,
    TIMER_PRESETS,
    type TimerExpiryAction,
    type TimerSettings as TimerSettingsValue,
} from "@/lib/protocol";
import { cn } from "@/lib/utils";
import { SETTINGS_LABEL as LABEL, SETTINGS_PRESSED as PRESSED, SettingsSection } from "./settings-section";
import type { Send } from "./viewer";

export function TimerSettings({ timer, send }: { timer: TimerSettingsValue; send: Send }) {
    const [draftSeconds, setDraftSeconds] = useState<number | null>(null);
    const seconds = draftSeconds ?? timer.seconds;

    function update(next: Partial<TimerSettingsValue>) {
        const merged = { ...timer, ...next };
        send({ type: "update_timer", enabled: merged.enabled, seconds: merged.seconds, expiryAction: merged.expiryAction });
    }

    return (
        <SettingsSection
            icon={<Timer />}
            title="Clue timer"
            description="Give players a countdown on every clue."
            action={
                <>
                    <span className="font-mono text-[10px] font-semibold uppercase">{timer.enabled ? "On" : "Off"}</span>
                    <Switch
                        checked={timer.enabled}
                        onCheckedChange={(enabled) => update({ enabled })}
                        aria-label="Use a clue timer"
                    />
                </>
            }
        >
            <div className={cn("flex flex-col gap-6 transition-opacity", !timer.enabled && "opacity-50")}>
                <Field>
                    <div className="flex items-end justify-between">
                        <FieldLabel className={LABEL}>Time per clue</FieldLabel>
                        <span className="font-pixel-square text-3xl leading-none tabular-nums">{seconds}s</span>
                    </div>
                    <Slider
                        data-base-ui-swipe-ignore=""
                        value={[seconds]}
                        min={TIMER_MIN_SECONDS}
                        max={TIMER_MAX_SECONDS}
                        step={5}
                        disabled={!timer.enabled}
                        aria-label="Seconds per clue"
                        onValueChange={(value) => setDraftSeconds(Array.isArray(value) ? value[0] : value)}
                        onValueCommitted={(value) => {
                            setDraftSeconds(null);
                            update({ seconds: Array.isArray(value) ? value[0] : value });
                        }}
                        className="py-2"
                    />
                    <ToggleGroup
                        variant="outline"
                        size="sm"
                        value={[String(seconds)]}
                        disabled={!timer.enabled}
                        onValueChange={(value) => {
                            if (value[0]) update({ seconds: Number(value[0]) });
                        }}
                    >
                        {TIMER_PRESETS.map((preset) => (
                            <ToggleGroupItem key={preset} value={String(preset)} className={`px-3 font-mono ${PRESSED}`}>
                                {preset}s
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </Field>

                <Field>
                    <FieldLabel className={LABEL}>When time runs out</FieldLabel>
                    <ToggleGroup
                        variant="outline"
                        spacing={0}
                        value={[timer.expiryAction]}
                        disabled={!timer.enabled}
                        onValueChange={(value) => {
                            const expiryAction = value[0] as TimerExpiryAction | undefined;
                            if (expiryAction) update({ expiryAction });
                        }}
                        className="w-full"
                    >
                        <ToggleGroupItem value="reveal" className={`h-9 flex-1 ${PRESSED}`}>
                            <Eye /> Reveal answer
                        </ToggleGroupItem>
                        <ToggleGroupItem value="lock" className={`h-9 flex-1 ${PRESSED}`}>
                            <Lock /> Lock buzzers
                        </ToggleGroupItem>
                    </ToggleGroup>
                    <FieldDescription>
                        {timer.expiryAction === "reveal"
                            ? "The answer appears for everyone automatically."
                            : "Buzzers lock and you reveal the answer when you're ready."}
                    </FieldDescription>
                </Field>

                <p className="flex items-start gap-2 rounded-lg bg-paper px-3 py-2 text-xs text-ink/70">
                    <Pause className="mt-0.5 size-3.5 shrink-0" />
                    The clock pauses while a player answers and resumes if they&apos;re wrong. New durations apply from
                    the next clue, or use Restart timer.
                </p>
            </div>
        </SettingsSection>
    );
}
