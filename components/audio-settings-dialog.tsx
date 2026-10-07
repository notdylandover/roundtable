"use client";

import { Music, Sparkles, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { playSoundEffect } from "@/hooks/use-game-audio";
import {
    AUDIO_CHANNELS,
    resetAudioSettings,
    updateAudioSettings,
    useAudioSettings,
    type AudioChannel,
} from "@/lib/audio-settings";
import { cn } from "@/lib/utils";

const CHANNEL_COPY: Record<AudioChannel, { title: string; description: string; icon: typeof Volume2 }> = {
    global: { title: "Global", description: "Master volume for every sound in Roundtable.", icon: Volume2 },
    lobby: { title: "Lobby music", description: "Loops while players gather in a Buzz In lobby.", icon: Music },
    effects: { title: "Sound effects", description: "Plays when a clue opens and when answers are judged.", icon: Sparkles },
};

function sliderValue(value: number | readonly number[]) {
    return Array.isArray(value) ? value[0] : (value as number);
}

export function AudioSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const settings = useAudioSettings();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Audio settings</DialogTitle>
                    <DialogDescription>Saved in this browser and applied automatically next time.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3">
                    {AUDIO_CHANNELS.map((channel) => {
                        const copy = CHANNEL_COPY[channel];
                        const value = settings[channel];
                        const mutedByGlobal = channel !== "global" && !settings.global.enabled;
                        const active = value.enabled && !mutedByGlobal;
                        const Icon = active ? copy.icon : VolumeX;
                        const previewEffect = () => {
                            if (channel !== "lobby") playSoundEffect("correct");
                        };

                        return (
                            <section
                                key={channel}
                                className="flex flex-col gap-3 rounded-xl border-2 border-ink bg-white p-3 shadow-[3px_3px_0_var(--ink)]"
                            >
                                <header className="flex items-start gap-3">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-paper [&_svg]:size-4">
                                        <Icon />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-sm leading-8 font-bold">{copy.title}</h3>
                                        <p className="text-xs text-ink/60">
                                            {mutedByGlobal ? "Muted because Global sound is off." : copy.description}
                                        </p>
                                    </div>
                                    <div className="flex h-8 shrink-0 items-center gap-2">
                                        <span className="font-mono text-[10px] font-semibold uppercase">{value.enabled ? "On" : "Off"}</span>
                                        <Switch
                                            checked={value.enabled}
                                            aria-label={`Turn ${copy.title.toLowerCase()} on or off`}
                                            onCheckedChange={(enabled) => {
                                                updateAudioSettings(channel, { enabled });
                                                if (enabled) previewEffect();
                                            }}
                                        />
                                    </div>
                                </header>
                                <div className={cn("flex items-center gap-3 transition-opacity", !active && "opacity-50")}>
                                    <Slider
                                        data-base-ui-swipe-ignore=""
                                        value={[value.volume]}
                                        min={0}
                                        max={100}
                                        step={1}
                                        disabled={!active}
                                        aria-label={`${copy.title} volume`}
                                        onValueChange={(next) => updateAudioSettings(channel, { volume: sliderValue(next) })}
                                        onValueCommitted={previewEffect}
                                        className="py-2"
                                    />
                                    <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold tabular-nums">
                                        {value.volume}%
                                    </span>
                                </div>
                            </section>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={resetAudioSettings}>
                        Reset to defaults
                    </Button>
                    <Button type="button" onClick={() => onOpenChange(false)}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
