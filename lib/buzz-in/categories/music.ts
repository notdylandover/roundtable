import type { PrefilledCategory } from "../types";

export const music: PrefilledCategory = {
    id: "music",
    name: "Music",
    clues: [
        { value: 200, prompt: "This band recorded \"Bohemian Rhapsody\".", answer: "Queen" },
        { value: 400, prompt: "The number of strings on a standard guitar.", answer: "Six" },
        { value: 600, prompt: "This performer was crowned the King of Pop.", answer: "Michael Jackson" },
        { value: 800, prompt: "This Italian composer wrote \"The Four Seasons\".", answer: "Antonio Vivaldi" },
        { value: 1000, prompt: "The number of keys on a standard modern piano.", answer: "88" },
    ],
};
