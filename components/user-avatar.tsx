import { cn } from "@/lib/utils";
import { initials } from "@/lib/names";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const FALLBACK_COLORS = [
    "bg-coral text-ink",
    "bg-mustard text-ink",
    "bg-aqua text-ink",
    "bg-pine text-white",
    "bg-violet-300 text-ink",
    "bg-ink text-white",
];

function colorFor(seed: string) {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) | 0;
    return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

type UserAvatarProps = {
    name: string;
    avatarUrl: string | null;
    seed: string;
    size?: "sm" | "default" | "lg";
    className?: string;
};

export function UserAvatar({ name, avatarUrl, seed, size = "default", className }: UserAvatarProps) {
    return (
        <Avatar size={size} className={className}>
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />}
            <AvatarFallback className={cn("font-mono font-bold", colorFor(seed))}>
                {initials(name)}
            </AvatarFallback>
        </Avatar>
    );
}
