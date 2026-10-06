import type { PrefilledCategory } from "../types";

export const technology: PrefilledCategory = {
    id: "technology",
    name: "Technology",
    clues: [
        { value: 200, prompt: "This company makes the iPhone.", answer: "Apple" },
        { value: 400, prompt: "In computing, CPU stands for this.", answer: "Central Processing Unit" },
        { value: 600, prompt: "He co-founded Microsoft with Paul Allen.", answer: "Bill Gates" },
        { value: 800, prompt: "This programming language is named after a British comedy troupe.", answer: "Python" },
        { value: 1000, prompt: "The binary number 1010 equals this number in decimal.", answer: "10" },
    ],
};
