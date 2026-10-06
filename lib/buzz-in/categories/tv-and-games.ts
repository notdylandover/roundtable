import type { PrefilledCategory } from "../types";

export const tvAndGames: PrefilledCategory = {
    id: "tv-and-games",
    name: "TV & Games",
    clues: [
        { value: 200, prompt: "The coffee shop where the gang hangs out in \"Friends\".", answer: "Central Perk" },
        { value: 400, prompt: "This animated yellow family lives in Springfield.", answer: "The Simpsons" },
        { value: 600, prompt: "This plumber is always rescuing Princess Peach.", answer: "Mario" },
        { value: 800, prompt: "Most of \"Game of Thrones\" takes place on this fictional continent.", answer: "Westeros" },
        { value: 1000, prompt: "The chemistry teacher turned drug manufacturer in \"Breaking Bad\".", answer: "Walter White" },
    ],
};
