import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const SETTINGS_LABEL = "font-mono text-[11px] tracking-wider text-ink/70 uppercase";
export const SETTINGS_PRESSED = "aria-pressed:bg-ink aria-pressed:text-white data-pressed:bg-ink data-pressed:text-white";

type SettingsSectionProps = {
    icon: ReactNode;
    title: string;
    description: ReactNode;
    /** Usually an on/off switch shown on the right of the heading. */
    action?: ReactNode;
    children: ReactNode;
    className?: string;
};

/** A titled group of settings inside the room settings drawer. */
export function SettingsSection({ icon, title, description, action, children, className }: SettingsSectionProps) {
    return (
        <section className={cn("flex flex-col gap-5 rounded-xl border-2 border-ink bg-white p-4 shadow-[3px_3px_0_var(--ink)]", className)}>
            <header className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-paper [&_svg]:size-4">
                    {icon}
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm leading-8 font-bold">{title}</h3>
                    <p className="text-xs text-ink/60">{description}</p>
                </div>
                {action && <div className="flex h-8 shrink-0 items-center gap-2">{action}</div>}
            </header>
            {children}
        </section>
    );
}
