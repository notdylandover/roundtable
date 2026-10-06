const BLOCKED_WORDS = ["fuck", "shit", "bitch", "asshole", "cunt", "nigger", "nigga"];

const LEET_REPLACEMENTS: Record<string, string> = {
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
};

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 24;

function normalizeForFilter(value: string) {
    return value
        .toLowerCase()
        .replace(/[013457]/g, (character) => LEET_REPLACEMENTS[character] ?? character)
        .replace(/[^a-z]/g, "");
}

export function collapseWhitespace(value: string) {
    return value
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function containsBlockedWord(value: string) {
    const normalized = normalizeForFilter(value);
    return BLOCKED_WORDS.some((word) => normalized.includes(word));
}

/** Returns an error message, or null when the name is acceptable. */
export function validateDisplayName(value: string) {
    const name = collapseWhitespace(value);

    if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
        return `Use between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.`;
    }
    if (!/[a-z]/i.test(name)) return "Include at least one letter.";
    if (/(.)\1{4,}/i.test(name)) return "That name repeats too many characters.";
    if (/https?:|www\.|\.(com|net|gg)\b/i.test(name)) return "Links are not allowed in names.";
    if (containsBlockedWord(name)) return "Choose a name without profanity.";
    return null;
}

export function createRoomSlug(title: string) {
    const stem = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 32);
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${stem || "room"}-${suffix}`;
}

export function initials(name: string) {
    return name.trim().slice(0, 1).toUpperCase() || "?";
}
