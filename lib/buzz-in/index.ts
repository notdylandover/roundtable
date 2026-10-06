import { animals } from "./categories/animals";
import { food } from "./categories/food";
import { geography } from "./categories/geography";
import { history } from "./categories/history";
import { literature } from "./categories/literature";
import { movies } from "./categories/movies";
import { music } from "./categories/music";
import { science } from "./categories/science";
import { space } from "./categories/space";
import { sports } from "./categories/sports";
import { technology } from "./categories/technology";
import { tvAndGames } from "./categories/tv-and-games";
import type { PrefilledCategory } from "./types";

export type { PrefilledCategory, PrefilledClue } from "./types";

export const MIN_CATEGORIES = 1;
export const MAX_CATEGORIES = 10;
export const DEFAULT_CATEGORIES = 5;
export const CLUES_PER_CATEGORY = 5;
export const DEFAULT_CLUE_VALUES = [200, 400, 600, 800, 1000] as const;
export const MIN_CLUE_VALUE = 100;
export const MAX_CLUE_VALUE = 2000;

/** Add new prefilled categories to `./categories` and list them here. */
export const PREFILLED_CATEGORIES: readonly PrefilledCategory[] = [
    science,
    geography,
    movies,
    music,
    history,
    animals,
    food,
    sports,
    literature,
    space,
    technology,
    tvAndGames,
];

export function getPrefilledCategory(id: string) {
    return PREFILLED_CATEGORIES.find((category) => category.id === id) ?? null;
}

/** Board shapes shared by the PartyKit server and the client. */
export type BoardClueData = {
    id: string;
    value: number;
    prompt: string;
    answer: string;
};

export type BoardCategoryData = {
    id: string;
    name: string;
    /** The prefilled category this column was loaded from, if any. */
    prefilledId: string | null;
    clues: BoardClueData[];
};

function randomId(prefix: string) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createBlankCategory(index: number): BoardCategoryData {
    return {
        id: randomId("cat"),
        name: `Category ${index + 1}`,
        prefilledId: null,
        clues: DEFAULT_CLUE_VALUES.map((value) => ({ id: randomId("clue"), value, prompt: "", answer: "" })),
    };
}

export function createCategoryFromPrefilled(prefilled: PrefilledCategory): BoardCategoryData {
    return {
        id: randomId("cat"),
        name: prefilled.name,
        prefilledId: prefilled.id,
        clues: prefilled.clues.slice(0, CLUES_PER_CATEGORY).map((clue) => ({ id: randomId("clue"), ...clue })),
    };
}

export function createBlankBoard(count = DEFAULT_CATEGORIES) {
    return Array.from({ length: count }, (_, index) => createBlankCategory(index));
}

/** Picks `count` distinct prefilled categories in random order. */
export function pickRandomPrefilled(count: number, exclude: string[] = []) {
    const pool = PREFILLED_CATEGORIES.filter((category) => !exclude.includes(category.id));
    for (let index = pool.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[swap]] = [pool[swap], pool[index]];
    }
    return pool.slice(0, count);
}

export function isClueFilled(clue: Pick<BoardClueData, "prompt" | "answer">) {
    return clue.prompt.trim().length >= 2 && clue.answer.trim().length >= 1;
}

export function isBoardFull(board: BoardCategoryData[]) {
    return board.length > 0 && board.every((category) => category.clues.every(isClueFilled));
}

/** A random Final Buzz In question: the hardest clue of a prefilled category that isn't on the board. */
export function pickFinalQuestion(board: BoardCategoryData[]) {
    const onBoard = board.map((category) => category.prefilledId).filter((id): id is string => Boolean(id));
    const [category] = pickRandomPrefilled(1, onBoard);
    const fallback = PREFILLED_CATEGORIES[Math.floor(Math.random() * PREFILLED_CATEGORIES.length)];
    const source = category ?? fallback;
    const clue = [...source.clues].sort((left, right) => right.value - left.value)[0];
    return { category: source.name, prompt: clue.prompt, answer: clue.answer };
}
