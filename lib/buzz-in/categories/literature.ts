import type { PrefilledCategory } from "../types";

export const literature: PrefilledCategory = {
    id: "literature",
    name: "Literature",
    clues: [
        { value: 200, prompt: "He wrote \"Romeo and Juliet\".", answer: "William Shakespeare" },
        { value: 400, prompt: "The boy wizard created by J.K. Rowling.", answer: "Harry Potter" },
        { value: 600, prompt: "The white whale hunted by Captain Ahab.", answer: "Moby Dick" },
        { value: 800, prompt: "He wrote the dystopian novel \"1984\".", answer: "George Orwell" },
        { value: 1000, prompt: "This novel opens: \"It was the best of times, it was the worst of times.\"", answer: "A Tale of Two Cities" },
    ],
};
