import type { PrefilledCategory } from "../types";

export const space: PrefilledCategory = {
    id: "space",
    name: "Space",
    clues: [
        { value: 200, prompt: "The star at the center of our solar system.", answer: "The Sun" },
        { value: 400, prompt: "The first person to walk on the Moon.", answer: "Neil Armstrong" },
        { value: 600, prompt: "The largest planet in our solar system.", answer: "Jupiter" },
        { value: 800, prompt: "The galaxy that contains our solar system.", answer: "The Milky Way" },
        { value: 1000, prompt: "Saturn's largest moon, the only moon known to have a thick atmosphere.", answer: "Titan" },
    ],
};
