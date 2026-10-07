"use client";

import { useEffect, useRef } from "react";
import { effectiveVolume, getAudioSettings, useAudioSettings } from "@/lib/audio-settings";
import type { RoomState } from "@/lib/protocol";

export const LOBBY_MUSIC_SRC = "/audio/lobby.wav";

export const SOUND_EFFECTS = {
    clue: "/audio/buzz-in-clue.wav",
    correct: "/audio/buzz-in-clue-correct.wav",
    incorrect: "/audio/buzz-in-clue-incorrect.wav",
} as const;

export type SoundEffect = keyof typeof SOUND_EFFECTS;

const effectElements = new Map<SoundEffect, HTMLAudioElement>();

function getEffectElement(effect: SoundEffect) {
    let audio = effectElements.get(effect);
    if (!audio) {
        audio = new Audio(SOUND_EFFECTS[effect]);
        audio.preload = "auto";
        effectElements.set(effect, audio);
    }
    return audio;
}

export function preloadSoundEffects() {
    for (const effect of Object.keys(SOUND_EFFECTS) as SoundEffect[]) getEffectElement(effect);
}

/** Plays a sound effect at the volume from the user's audio settings. */
export function playSoundEffect(effect: SoundEffect) {
    const volume = effectiveVolume(getAudioSettings(), "effects");
    if (volume <= 0) return;
    const audio = getEffectElement(effect);
    audio.volume = volume;
    audio.currentTime = 0;
    // Browsers reject playback until the user has interacted with the page; a missed effect is fine.
    audio.play().catch(() => undefined);
}

type BuzzSnapshot = {
    clueId: string | null;
    buzzedUserId: string | null;
    revealed: boolean;
    misses: number;
};

/** Loops the lobby music during the Buzz In lobby and plays clue / correct / incorrect sound effects. */
export function useGameAudio(room: RoomState) {
    const settings = useAudioSettings();
    const lobbyVolume = effectiveVolume(settings, "lobby");
    const lobbyAudible = lobbyVolume > 0;
    const inLobby = room.gameMode === "buzz_in" && room.phase === "lobby";
    const musicRef = useRef<HTMLAudioElement | null>(null);
    const lobbyVolumeRef = useRef(lobbyVolume);

    useEffect(() => {
        preloadSoundEffects();
    }, []);

    useEffect(() => {
        lobbyVolumeRef.current = lobbyVolume;
        if (musicRef.current) musicRef.current.volume = lobbyVolume;
    }, [lobbyVolume]);

    useEffect(() => {
        // Start the track from the top the next time players are back in the lobby.
        if (!inLobby && musicRef.current) musicRef.current.currentTime = 0;
        if (!inLobby || !lobbyAudible) return;

        const audio = musicRef.current ?? new Audio(LOBBY_MUSIC_SRC);
        audio.loop = true;
        audio.volume = lobbyVolumeRef.current;
        musicRef.current = audio;

        // Autoplay is blocked until the user interacts with the page, so retry on the first interaction.
        const events = ["pointerdown", "keydown"] as const;
        const retry = () => {
            removeRetry();
            audio.play().catch(() => undefined);
        };
        const removeRetry = () => {
            for (const event of events) window.removeEventListener(event, retry);
        };
        audio.play().catch(() => {
            for (const event of events) window.addEventListener(event, retry);
        });

        return () => {
            removeRetry();
            audio.pause();
        };
    }, [inLobby, lobbyAudible]);

    const { activeQuestionId, buzzedUserId, answerRevealed, excludedUserIds } = room.buzz;
    const misses = excludedUserIds.length;
    const previousRef = useRef<BuzzSnapshot | null>(null);

    useEffect(() => {
        const previous = previousRef.current;
        const next: BuzzSnapshot = { clueId: activeQuestionId, buzzedUserId, revealed: answerRevealed, misses };
        previousRef.current = next;
        // Don't replay whatever is already on screen when joining mid-game.
        if (!previous || room.gameMode !== "buzz_in" || room.phase !== "playing" || !next.clueId) return;

        if (next.clueId !== previous.clueId) {
            playSoundEffect("clue");
            return;
        }
        if (next.misses > previous.misses) {
            playSoundEffect("incorrect");
            return;
        }
        // A revealed clue that still has a buzzed player was answered correctly (see `reveal_answer` on the server).
        if (next.revealed && !previous.revealed && next.buzzedUserId && next.buzzedUserId === previous.buzzedUserId) {
            playSoundEffect("correct");
        }
    }, [activeQuestionId, buzzedUserId, answerRevealed, misses, room.gameMode, room.phase]);
}
