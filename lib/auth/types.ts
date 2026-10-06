export type AuthProvider = "discord" | "guest";

export type SessionUser = {
    /** Namespaced user id: `discord:<snowflake>` or `guest:<uuid>`. */
    id: string;
    provider: AuthProvider;
    name: string;
    avatarUrl: string | null;
};

export type ClientSession = {
    user: SessionUser;
    isAdmin: boolean;
};
