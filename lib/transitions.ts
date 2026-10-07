/**
 * Every timing for the lobby → room → game transitions lives here so they're easy to tune.
 * Durations are in seconds (framer-motion units).
 */

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const;

/** A room tile (or the create button) grows until it fills the screen. */
export const ROOM_EXPAND = { duration: 0.55, ease: EASE_OUT_EXPO };
/** The room's title and "Joining" label fade in on the expanding tile. */
export const ROOM_EXPAND_LABEL = { duration: 0.3, delay: 0.2 };
/** Once the room has loaded underneath, the full-screen tile fades away. */
export const ROOM_REVEAL = { duration: 0.4, ease: "easeOut" as const };
/** Never leave the tile covering the screen longer than this (ms), e.g. on a slow connection. */
export const ROOM_REVEAL_TIMEOUT_MS = 4000;

/** Game start: a panel swipes in from the right, holds, then fades to reveal the board. */
export const GAME_WIPE_IN = 0.5;
export const GAME_WIPE_HOLD = 0.6;
export const GAME_WIPE_FADE = { duration: 0.45, ease: "easeOut" as const };
export const GAME_WIPE_EASE = EASE_OUT_EXPO;
