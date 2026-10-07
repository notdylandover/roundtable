"use client";

import { useSyncExternalStore } from "react";

export type AudioChannel = "global" | "lobby" | "effects";

export type ChannelSettings = {
    enabled: boolean;
    /** 0–100 */
    volume: number;
};

export type AudioSettings = Record<AudioChannel, ChannelSettings>;

export const AUDIO_CHANNELS: AudioChannel[] = ["global", "lobby", "effects"];

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
    global: { enabled: true, volume: 80 },
    lobby: { enabled: true, volume: 50 },
    effects: { enabled: true, volume: 80 },
};

const STORAGE_KEY = "roundtable:audio-settings";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedSettings: AudioSettings = DEFAULT_AUDIO_SETTINGS;
/** Used instead of localStorage once it fails (private mode, quota), so changes still apply for this page load. */
let memoryRaw: string | null | undefined;

function clampVolume(value: unknown, fallback: number) {
    return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : fallback;
}

function parseSettings(raw: string | null): AudioSettings {
    if (!raw) return DEFAULT_AUDIO_SETTINGS;
    try {
        const parsed = JSON.parse(raw) as Partial<Record<AudioChannel, Partial<ChannelSettings>>>;
        const settings = {} as AudioSettings;
        for (const channel of AUDIO_CHANNELS) {
            const fallback = DEFAULT_AUDIO_SETTINGS[channel];
            const stored = parsed?.[channel];
            settings[channel] = {
                enabled: typeof stored?.enabled === "boolean" ? stored.enabled : fallback.enabled,
                volume: clampVolume(stored?.volume, fallback.volume),
            };
        }
        return settings;
    } catch {
        return DEFAULT_AUDIO_SETTINGS;
    }
}

function readStorage(): string | null {
    if (memoryRaw !== undefined) return memoryRaw;
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function writeStorage(raw: string | null) {
    try {
        if (raw === null) window.localStorage.removeItem(STORAGE_KEY);
        else window.localStorage.setItem(STORAGE_KEY, raw);
        memoryRaw = undefined;
    } catch {
        memoryRaw = raw;
    }
}

export function getAudioSettings(): AudioSettings {
    if (typeof window === "undefined") return DEFAULT_AUDIO_SETTINGS;
    const raw = readStorage();
    // Re-parse only when the stored value changes so useSyncExternalStore gets a stable snapshot.
    if (raw !== cachedRaw) {
        cachedRaw = raw;
        cachedSettings = parseSettings(raw);
    }
    return cachedSettings;
}

function emit() {
    for (const listener of listeners) listener();
}

export function updateAudioSettings(channel: AudioChannel, patch: Partial<ChannelSettings>) {
    const current = getAudioSettings();
    const next: AudioSettings = { ...current, [channel]: { ...current[channel], ...patch } };
    writeStorage(JSON.stringify(next));
    emit();
}

export function resetAudioSettings() {
    writeStorage(null);
    emit();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    // Keep other open tabs in sync.
    const onStorage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY || event.key === null) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
    };
}

export function useAudioSettings(): AudioSettings {
    return useSyncExternalStore(subscribe, getAudioSettings, () => DEFAULT_AUDIO_SETTINGS);
}

/** Final 0–1 volume for a channel after applying the global setting. */
export function effectiveVolume(settings: AudioSettings, channel: Exclude<AudioChannel, "global">) {
    if (!settings.global.enabled || !settings[channel].enabled) return 0;
    return (settings.global.volume / 100) * (settings[channel].volume / 100);
}
