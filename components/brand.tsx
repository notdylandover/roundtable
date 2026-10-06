import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ href = "/rooms", className }: { href?: string; className?: string }) {
    return (
        <Link
            href={href}
            className={cn("flex items-center gap-2.5 font-mono text-sm font-bold tracking-tight", className)}
            aria-label="Roundtable home"
        >
            <span className="flex size-10 items-center justify-center rounded-full border-2 border-ink bg-blue-400 font-pixel-square text-lg text-ink shadow-[3px_3px_0_var(--ink)]">
                R
            </span>
            <span className="hidden sm:inline">ROUNDTABLE</span>
        </Link>
    );
}
