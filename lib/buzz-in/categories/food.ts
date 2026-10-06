import type { PrefilledCategory } from "../types";

export const food: PrefilledCategory = {
    id: "food",
    name: "Food & Drink",
    clues: [
        { value: 200, prompt: "The main ingredient in guacamole.", answer: "Avocado" },
        { value: 400, prompt: "This Italian dish layers flat pasta sheets with sauce and cheese.", answer: "Lasagna" },
        { value: 600, prompt: "This spicy Korean side dish is made from fermented vegetables like cabbage.", answer: "Kimchi" },
        { value: 800, prompt: "Harvested from crocus flowers, it's the most expensive spice by weight.", answer: "Saffron" },
        { value: 1000, prompt: "This French term describes meat, like duck, slowly cooked in its own fat.", answer: "Confit" },
    ],
};
