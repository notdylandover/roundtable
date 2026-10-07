"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Zap } from "lucide-react";
import { useState } from "react";
import type { GamePhase } from "@/lib/protocol";
import { GAME_WIPE_EASE, GAME_WIPE_FADE, GAME_WIPE_HOLD, GAME_WIPE_IN } from "@/lib/transitions";

const TOTAL = GAME_WIPE_IN + GAME_WIPE_HOLD;

/** When the game starts, a panel swipes in from the right over the stage, then fades to reveal the board. */
export function GameStartWipe({ phase }: { phase: GamePhase }) {
    const [previous, setPrevious] = useState(phase);
    const [run, setRun] = useState(0);
    const [active, setActive] = useState(false);

    if (phase !== previous) {
        setPrevious(phase);
        if (previous === "lobby" && phase === "playing") {
            setRun((count) => count + 1);
            setActive(true);
        }
    }

    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    key={run}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden rounded-2xl bg-board"
                    initial={{ x: "100%" }}
                    animate={{ x: ["100%", "0%", "0%"] }}
                    exit={{ opacity: 0, transition: GAME_WIPE_FADE }}
                    transition={{ duration: TOTAL, times: [0, GAME_WIPE_IN / TOTAL, 1], ease: GAME_WIPE_EASE }}
                    onAnimationComplete={() => setActive(false)}
                >
                    {/* Leading edge stripes trail the panel as it moves left. */}
                    <span className="absolute inset-y-0 left-0 w-6 bg-coral" />
                    <span className="absolute inset-y-0 left-6 w-2 bg-mustard" />
                    <motion.div
                        className="flex items-center gap-4 text-white"
                        initial={{ opacity: 0, x: 80 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: GAME_WIPE_IN * 0.5, type: "spring", stiffness: 260, damping: 22 }}
                    >
                        <Zap className="size-12 fill-mustard text-mustard @3xl:size-16" />
                        <span className="font-pixel-square text-5xl @3xl:text-7xl @6xl:text-8xl">Game on!</span>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
