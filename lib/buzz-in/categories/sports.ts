import type { PrefilledCategory } from "../types";

export const sports: PrefilledCategory = {
    id: "sports",
    name: "Sports",
    clues: [
        { value: 200, prompt: "The number of players each soccer team has on the field.", answer: "Eleven" },
        { value: 400, prompt: "This sport is played at Wimbledon.", answer: "Tennis" },
        { value: 600, prompt: "This country has won the most men's FIFA World Cups.", answer: "Brazil" },
        { value: 800, prompt: "In bowling, three strikes in a row is called this.", answer: "A turkey" },
        { value: 1000, prompt: "This swimmer has won the most Olympic gold medals of all time.", answer: "Michael Phelps" },
    ],
};
