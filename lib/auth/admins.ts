import type { SessionUser } from "./types";

/**
 * Discord user IDs that get admin access. Admins can delete rooms, remove players,
 * and manage any room's settings. Verified server-side from the signed session.
 */
export const ADMIN_DISCORD_IDS: readonly string[] = [
    "458854676557856790",
];

export function discordIdFromUserId(userId: string) {
    return userId.startsWith("discord:") ? userId.slice("discord:".length) : null;
}

export function isAdminUser(user: Pick<SessionUser, "id" | "provider"> | null | undefined) {
    if (!user || user.provider !== "discord") return false;
    const discordId = discordIdFromUserId(user.id);
    return discordId !== null && ADMIN_DISCORD_IDS.includes(discordId);
}
