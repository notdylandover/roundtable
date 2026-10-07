"use client";

import { motion } from "framer-motion";
import { CircleHelp, ThumbsDown, ThumbsUp } from "lucide-react";
import type { AnswerAssessment, MatchVerdict } from "@/lib/answer-match";
import { cn } from "@/lib/utils";

const VERDICT_COPY: Record<MatchVerdict, { label: string; icon: typeof ThumbsUp; tone: string }> = {
    accept: { label: "Looks right", icon: ThumbsUp, tone: "border-green-400/60 bg-green-400/15 text-green-300" },
    review: { label: "Close — your call", icon: CircleHelp, tone: "border-mustard/60 bg-mustard/15 text-mustard" },
    reject: { label: "Doesn't match", icon: ThumbsDown, tone: "border-coral/60 bg-coral/15 text-coral" },
};

/** Judging suggestion shown to the owner/host next to a typed answer. */
export function MatchHint({ assessment, compact = false, className }: { assessment: AnswerAssessment | null; compact?: boolean; className?: string }) {
    if (!assessment) return null;
    const copy = VERDICT_COPY[assessment.verdict];
    const Icon = copy.icon;

    return (
        <motion.span
            key={assessment.verdict}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            title={compact ? `${copy.label}: ${assessment.reason}` : undefined}
            className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                copy.tone,
                className
            )}
        >
            <Icon className="size-3.5 shrink-0" />
            <span className="shrink-0">{copy.label}</span>
            {!compact && <span className="min-w-0 truncate font-normal text-white/70">· {assessment.reason}</span>}
        </motion.span>
    );
}

/** Ring for the judge button that matches the suggestion. */
export function suggestedRing(assessment: AnswerAssessment | null, button: "correct" | "incorrect") {
    if (!assessment) return undefined;
    if (button === "correct" && assessment.verdict === "accept") return "ring-4 ring-green-300/50 ring-offset-2 ring-offset-[#070b1f]";
    if (button === "incorrect" && assessment.verdict === "reject") return "ring-4 ring-coral/50 ring-offset-2 ring-offset-[#070b1f]";
    return undefined;
}
