import type { PrefilledCategory } from "../types";

export const animals: PrefilledCategory = {
    id: "animals",
    name: "Animals",
    clues: [
        { value: 200, prompt: "The largest land animal on Earth.", answer: "African elephant" },
        { value: 400, prompt: "A group of lions is called this.", answer: "A pride" },
        { value: 600, prompt: "The only mammal capable of true, sustained flight.", answer: "Bat" },
        { value: 800, prompt: "The fastest land animal.", answer: "Cheetah" },
        { value: 1000, prompt: "The number of hearts an octopus has.", answer: "Three" },
    ],
};
