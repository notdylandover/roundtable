import type { PrefilledCategory } from "../types";

export const movies: PrefilledCategory = {
    id: "movies",
    name: "Movies",
    clues: [
        { value: 200, prompt: "This 1997 film follows Jack and Rose aboard a doomed ocean liner.", answer: "Titanic" },
        { value: 400, prompt: "The school of witchcraft and wizardry Harry Potter attends.", answer: "Hogwarts" },
        { value: 600, prompt: "He directed both Jaws and Jurassic Park.", answer: "Steven Spielberg" },
        { value: 800, prompt: "In this animated film, Simba grows up to become king of the Pride Lands.", answer: "The Lion King" },
        { value: 1000, prompt: "This silent war film won the top picture award at the very first Academy Awards.", answer: "Wings" },
    ],
};
