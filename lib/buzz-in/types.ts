export type PrefilledClue = {
    value: number;
    prompt: string;
    answer: string;
};

export type PrefilledCategory = {
    /** Stable id; never change it once shipped. */
    id: string;
    name: string;
    /** Exactly CLUES_PER_CATEGORY clues, ordered from easiest to hardest. */
    clues: PrefilledClue[];
};
