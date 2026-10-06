"use client";

import { Wifi, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { UserMenu } from "@/components/user-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ConnectionStatus } from "@/lib/party-client";
import { cn } from "@/lib/utils";

const STATUS_COPY: Record<ConnectionStatus, string> = {
    connecting: "Connecting…",
    live: "Connected",
    offline: "Reconnecting…",
};

export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
    return (
        <Tooltip>
            <TooltipTrigger
                aria-label={STATUS_COPY[status]}
                className={cn(
                    "flex size-10 items-center justify-center rounded-full border-2",
                    status === "live" && "border-pine/40 bg-green-100 text-pine",
                    status === "connecting" && "animate-pulse border-line bg-muted text-muted-foreground",
                    status === "offline" && "border-destructive/30 bg-destructive/10 text-destructive"
                )}
            >
                {status === "offline" ? <WifiOff size={16} /> : <Wifi size={16} />}
            </TooltipTrigger>
            <TooltipContent>{STATUS_COPY[status]}</TooltipContent>
        </Tooltip>
    );
}

export function AppHeader({ leading, status }: { leading?: ReactNode; status?: ConnectionStatus }) {
    return (
        <header className="sticky top-0 z-30 flex h-18 items-center justify-between gap-4 border-b-2 border-ink bg-white/90 px-4 backdrop-blur sm:px-8">
            <div className="flex min-w-0 items-center gap-3">{leading ?? <Brand />}</div>
            <div className="flex shrink-0 items-center gap-2">
                {status && <ConnectionIndicator status={status} />}
                <UserMenu />
            </div>
        </header>
    );
}
