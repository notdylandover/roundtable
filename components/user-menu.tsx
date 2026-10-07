"use client";

import { ChevronDown, LogOut, Pencil, ShieldCheck, Volume2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AudioSettingsDialog } from "@/components/audio-settings-dialog";
import { useSession } from "@/components/session-provider";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ClientSession } from "@/lib/auth/types";
import { NAME_MAX_LENGTH, validateDisplayName } from "@/lib/names";

function RenameDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { session, updateSession } = useSession();
    const [draft, setDraft] = useState(session?.user.name ?? "");
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        const validationError = validateDisplayName(draft);
        if (validationError) {
            setError(validationError);
            return;
        }

        setPending(true);
        const response = await fetch("/api/auth/session", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: draft }),
        }).catch(() => null);
        const payload = (await response?.json().catch(() => null)) as { session?: ClientSession; error?: string } | null;
        setPending(false);

        if (!response?.ok || !payload?.session) {
            setError(payload?.error ?? "Couldn't update your name. Try again.");
            return;
        }
        updateSession(payload.session);
        onOpenChange(false);
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    setDraft(session?.user.name ?? "");
                    setError(null);
                }
                onOpenChange(nextOpen);
            }}
        >
            <DialogContent>
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle>Change your name</DialogTitle>
                        <DialogDescription>Everyone in your rooms will see the new name right away.</DialogDescription>
                    </DialogHeader>
                    <Field data-invalid={Boolean(error)}>
                        <FieldLabel htmlFor="rename-input">Display name</FieldLabel>
                        <Input
                            id="rename-input"
                            value={draft}
                            maxLength={NAME_MAX_LENGTH}
                            autoFocus
                            aria-invalid={Boolean(error)}
                            onChange={(event) => {
                                setDraft(event.target.value);
                                setError(null);
                            }}
                        />
                        {error ? <FieldError>{error}</FieldError> : <FieldDescription>2–24 characters.</FieldDescription>}
                    </Field>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={pending}>
                            {pending && <Spinner />}
                            Save name
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** `compact` shows just the avatar, for the in-room top bar. */
export function UserMenu({ compact = false }: { compact?: boolean }) {
    const { session } = useSession();
    const [renameOpen, setRenameOpen] = useState(false);
    const [audioOpen, setAudioOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);

    if (!session) return null;
    const { user, isAdmin } = session;

    async function signOut() {
        setSigningOut(true);
        await fetch("/api/auth/session", { method: "DELETE" }).catch(() => null);
        window.location.assign("/");
    }

    return (
        <>
            <DropdownMenu>
                {compact ? (
                    <DropdownMenuTrigger
                        render={
                            <button
                                type="button"
                                aria-label={`Account: ${user.name}`}
                                className="flex size-9 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-aqua"
                            />
                        }
                    >
                        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} seed={user.id} className="size-9 ring-2 ring-white/20" />
                    </DropdownMenuTrigger>
                ) : (
                    <DropdownMenuTrigger
                        render={
                            <Button
                                variant="outline"
                                className="h-10 gap-2 rounded-full border-2 border-ink bg-white pr-3 pl-1 hover:bg-paper"
                            />
                        }
                    >
                        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} seed={user.id} />
                        <span className="max-w-28 truncate font-mono text-xs font-semibold sm:max-w-40">{user.name}</span>
                        {isAdmin && (
                            <Badge className="hidden bg-violet-600 text-white sm:inline-flex">
                                <ShieldCheck /> Admin
                            </Badge>
                        )}
                        <ChevronDown className="text-muted-foreground" />
                    </DropdownMenuTrigger>
                )}
                <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>
                            {compact && <span className="block truncate font-semibold text-foreground">{user.name}</span>}
                            Signed in {user.provider === "discord" ? "with Discord" : "as a guest"}
                            {isAdmin && " · Admin"}
                        </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setAudioOpen(true)}>
                        <Volume2 /> Audio settings
                    </DropdownMenuItem>
                    {user.provider === "guest" && (
                        <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                            <Pencil /> Change name
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem variant="destructive" disabled={signingOut} onClick={signOut}>
                        <LogOut /> Sign out
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            {user.provider === "guest" && <RenameDialog open={renameOpen} onOpenChange={setRenameOpen} />}
            <AudioSettingsDialog open={audioOpen} onOpenChange={setAudioOpen} />
        </>
    );
}
