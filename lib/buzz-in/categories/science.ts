import type { PrefilledCategory } from "../types";

export const science: PrefilledCategory = {
    id: "science",
    name: "Science",
    clues: [
        { value: 200, prompt: "This planet is known as the Red Planet.", answer: "Mars" },
        { value: 400, prompt: "H2O is the chemical formula for this substance.", answer: "Water" },
        { value: 600, prompt: "This organelle is nicknamed the powerhouse of the cell.", answer: "Mitochondria" },
        { value: 800, prompt: "The chemical symbol Au stands for this element.", answer: "Gold" },
        { value: 1000, prompt: "He laid out the three laws of motion in his book Principia.", answer: "Isaac Newton" },
    ],
};
