import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { LoginPanel } from "@/components/login-panel";
import { safeNextPath } from "@/lib/auth/paths";
import { getSessionUser, isDiscordEnabled } from "@/lib/auth/server";

const ERROR_MESSAGES: Record<string, string> = {
    discord_unavailable: "Discord sign-in isn't set up on this server yet. You can still play as a guest.",
    discord_denied: "Discord sign-in was cancelled.",
    discord_state: "That sign-in link expired. Please try again.",
    discord_failed: "We couldn't reach Discord. Please try again.",
};

const TABLE_SEATS = [
    { label: "Teams", color: "bg-coral" },
    { label: "Buzz In", color: "bg-mustard" },
    { label: "Live scores", color: "bg-aqua" },
];

export default async function HomePage({ searchParams }: PageProps<"/">) {
    const params = await searchParams;
    const next = safeNextPath(typeof params.next === "string" ? params.next : undefined);
    if (await getSessionUser()) redirect(next);

    const errorCode = typeof params.error === "string" ? params.error : "";

    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col border-x-2 border-ink/10">
            <header className="flex h-18 items-center justify-between border-b-2 border-ink px-4 sm:px-8">
                <Brand href="/" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink/60">
                    Realtime game night
                </span>
            </header>

            <section className="grid flex-1 items-center gap-12 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-16 lg:py-20">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-wrap gap-2">
                        {TABLE_SEATS.map((seat) => (
                            <span
                                key={seat.label}
                                className="flex items-center gap-2 rounded-full border-2 border-ink bg-white px-3 py-1 font-mono text-[11px] font-semibold uppercase"
                            >
                                <span className={`size-2.5 rounded-full border border-ink ${seat.color}`} />
                                {seat.label}
                            </span>
                        ))}
                    </div>
                    <h1 className="text-6xl leading-[0.9] font-bold tracking-tight text-balance sm:text-7xl xl:text-8xl">
                        Pick a table.
                        <br />
                        Bring your{" "}
                        <span className="relative inline-block">
                            friends.
                            <span aria-hidden="true" className="absolute inset-x-0 -bottom-1 -z-10 h-4 -rotate-1 bg-coral/70" />
                        </span>
                    </h1>
                    <p className="max-w-md text-base leading-relaxed text-ink/70">
                        Spin up a room, split into teams, and race to the buzzer. Everyone plays from their own
                        device while the board runs on the big screen.
                    </p>
                </div>

                <div className="w-full max-w-md justify-self-center lg:justify-self-end">
                    <LoginPanel next={next} discordEnabled={isDiscordEnabled()} error={ERROR_MESSAGES[errorCode] ?? null} />
                </div>
            </section>
        </main>
    );
}
