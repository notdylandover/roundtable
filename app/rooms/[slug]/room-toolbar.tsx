"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ConnectionStatus } from "@/lib/party-client";
import { cn } from "@/lib/utils";

export type ToolbarTone = "dark" | "light";

/** Small round buttons used in the room's top bar. */
export function toolbarButtonClass(tone: ToolbarTone, { active = false, danger = false, wide = false } = {}) {
    return cn(
        "flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border-2 text-xs font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-aqua disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
        wide ? "w-9 @2xl:w-auto @2xl:px-3" : "w-9",
        tone === "dark" && !active && "border-white/15 bg-white/5 text-white hover:bg-white/15",
        tone === "dark" && active && "border-mustard bg-mustard text-ink hover:bg-mustard/90",
        tone === "light" && !active && "border-ink bg-white text-ink hover:bg-paper",
        tone === "light" && active && "border-ink bg-ink text-white hover:bg-ink/90",
        danger && "hover:border-coral hover:bg-coral/15 hover:text-coral"
    );
}

type ToolbarButtonProps = Omit<ComponentProps<"button">, "children"> & {
    label: string;
    icon: ReactNode;
    tone: ToolbarTone;
    active?: boolean;
    danger?: boolean;
    /** Show the label next to the icon on wider screens. */
    showLabel?: boolean;
    /** Renders a link instead of a button. External links open in a new tab. */
    href?: string;
    external?: boolean;
};

export function ToolbarButton({
    label,
    icon,
    tone,
    active,
    danger,
    showLabel,
    href,
    external,
    className,
    ...props
}: ToolbarButtonProps) {
    const classes = cn(toolbarButtonClass(tone, { active, danger, wide: showLabel }), className);
    const content = (
        <>
            {icon}
            {showLabel && <span className="hidden @2xl:inline">{label}</span>}
        </>
    );
    const trigger = href ? (
        external ? (
            <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={classes} />
        ) : (
            <Link href={href} aria-label={label} className={classes} />
        )
    ) : (
        <button type="button" aria-label={label} aria-pressed={active} className={classes} {...props} />
    );

    return (
        <Tooltip>
            <TooltipTrigger render={trigger}>{content}</TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
    connecting: "Connecting…",
    live: "Connected",
    offline: "Reconnecting…",
};

export function StatusDot({ status }: { status: ConnectionStatus }) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={<span role="status" aria-label={STATUS_LABEL[status]} className="relative flex size-3 shrink-0" />}
            >
                {status === "live" && <span className="absolute inset-0 rounded-full bg-green-400 opacity-60 motion-safe:animate-ping" />}
                <span
                    className={cn(
                        "relative size-3 rounded-full",
                        status === "live" && "bg-green-400",
                        status === "connecting" && "bg-mustard",
                        status === "offline" && "bg-coral"
                    )}
                />
            </TooltipTrigger>
            <TooltipContent>{STATUS_LABEL[status]}</TooltipContent>
        </Tooltip>
    );
}

type RoomTopBarProps = {
    tone: ToolbarTone;
    title: string;
    status: ConnectionStatus;
    /** Chips shown after the title (mode, phase, host). */
    details?: ReactNode;
    /** Buttons on the right. */
    children: ReactNode;
    className?: string;
};

/** Compact header: back to rooms, room title, connection, and small action buttons on the right. */
export function RoomTopBar({ tone, title, status, details, children, className }: RoomTopBarProps) {
    return (
        <header className={cn("relative z-20 flex items-center gap-2 px-3 py-3 @3xl:gap-3 @3xl:px-6", className)}>
            <ToolbarButton tone={tone} label="All rooms" icon={<ArrowLeft />} href="/rooms" />
            <div className="flex min-w-0 flex-1 items-center gap-2 @3xl:gap-3">
                <h1 className="min-w-0 truncate text-lg leading-tight font-bold @3xl:text-xl">{title}</h1>
                <StatusDot status={status} />
                {details}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 @3xl:gap-2">{children}</div>
        </header>
    );
}
