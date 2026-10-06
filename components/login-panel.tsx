"use client";

import { ArrowRight, ShieldCheck, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSession } from "@/components/session-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ClientSession } from "@/lib/auth/types";
import { NAME_MAX_LENGTH, validateDisplayName } from "@/lib/names";
import { cn } from "@/lib/utils";

function DiscordIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
            <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.076.076 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
    );
}

type LoginPanelProps = {
    next: string;
    discordEnabled: boolean;
    error: string | null;
};

export function LoginPanel({ next, discordEnabled, error }: LoginPanelProps) {
    const router = useRouter();
    const { updateSession } = useSession();
    const [name, setName] = useState("");
    const [nameError, setNameError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const discordHref = `/api/auth/discord?next=${encodeURIComponent(next)}`;
    const discordClasses = cn(
        buttonVariants({ size: "lg" }),
        "h-12 w-full gap-2.5 border-2 border-ink bg-[#5865F2] text-sm font-semibold text-white shadow-[4px_4px_0_var(--ink)] hover:bg-[#4752c4] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--ink)]"
    );

    async function continueAsGuest(event: FormEvent) {
        event.preventDefault();
        const validationError = validateDisplayName(name);
        if (validationError) {
            setNameError(validationError);
            return;
        }

        setPending(true);
        const response = await fetch("/api/auth/guest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        }).catch(() => null);
        const payload = (await response?.json().catch(() => null)) as { session?: ClientSession; error?: string } | null;

        if (!response?.ok || !payload?.session) {
            setNameError(payload?.error ?? "Couldn't sign you in. Try again.");
            setPending(false);
            return;
        }
        updateSession(payload.session);
        router.replace(next);
    }

    return (
        <Card className="gap-0 rounded-2xl border-2 border-ink bg-white py-0 shadow-[8px_8px_0_var(--ink)] ring-0">
            <CardHeader className="gap-1.5 border-b-2 border-ink bg-mustard py-5">
                <CardTitle className="text-2xl font-bold">Take a seat</CardTitle>
                <CardDescription className="text-sm text-ink/70">Sign in to see the open tables.</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-6 py-6">
                {error && (
                    <Alert variant="destructive">
                        <TriangleAlert />
                        <AlertTitle>Sign-in didn&apos;t finish</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {discordEnabled ? (
                    <a className={discordClasses} href={discordHref}>
                        <DiscordIcon className="size-5" />
                        Continue with Discord
                    </a>
                ) : (
                    <Tooltip>
                        <TooltipTrigger render={<span className="w-full" />}>
                            <Button className={discordClasses} disabled>
                                <DiscordIcon className="size-5" />
                                Continue with Discord
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Discord sign-in isn&apos;t configured on this server.</TooltipContent>
                    </Tooltip>
                )}

                <FieldSeparator className="*:data-[slot=field-separator-content]:bg-white">or play as a guest</FieldSeparator>

                <form className="flex flex-col gap-4" onSubmit={continueAsGuest}>
                    <Field data-invalid={Boolean(nameError)}>
                        <FieldLabel htmlFor="guest-name" className="font-mono text-[11px] uppercase tracking-wider">
                            Display name
                        </FieldLabel>
                        <Input
                            id="guest-name"
                            className="h-11 border-2 border-ink bg-cream px-3 text-sm md:text-sm"
                            value={name}
                            onChange={(event) => {
                                setName(event.target.value);
                                setNameError(null);
                            }}
                            placeholder="What should we call you?"
                            maxLength={NAME_MAX_LENGTH}
                            autoComplete="nickname"
                            aria-invalid={Boolean(nameError)}
                        />
                        {nameError ? (
                            <FieldError>{nameError}</FieldError>
                        ) : (
                            <FieldDescription>2–24 characters. You can change it later.</FieldDescription>
                        )}
                    </Field>
                    <Button
                        type="submit"
                        size="lg"
                        disabled={pending}
                        className="h-11 border-2 border-ink text-sm font-semibold shadow-[4px_4px_0_var(--coral)]"
                    >
                        {pending ? <Spinner /> : <ArrowRight />}
                        Continue as guest
                    </Button>
                </form>
            </CardContent>

            <CardFooter className="gap-2 border-t-2 border-ink bg-paper py-4 text-xs text-ink/70">
                <ShieldCheck className="size-4 shrink-0" />
                Discord only shares your username and avatar with us.
            </CardFooter>
        </Card>
    );
}
