/** Only allow same-site relative paths as post-login destinations (prevents open redirects). */
export function safeNextPath(value: unknown, fallback = "/rooms") {
    if (typeof value !== "string" || !value) return fallback;
    if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
    if (value.startsWith("/api/") || value === "/") return fallback;
    return value;
}
