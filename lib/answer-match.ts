/** How forgiving judging suggestions are. "off" hides them. */
export type AnswerLeniency = "off" | "strict" | "balanced" | "lenient";
export type MatchVerdict = "accept" | "review" | "reject";

export type AnswerAssessment = {
    verdict: MatchVerdict;
    /** 0 (nothing in common) to 1 (exact match). */
    score: number;
    reason: string;
};

export const ANSWER_LENIENCIES: AnswerLeniency[] = ["off", "strict", "balanced", "lenient"];
export const DEFAULT_ANSWER_LENIENCY: AnswerLeniency = "balanced";

const THRESHOLDS: Record<Exclude<AnswerLeniency, "off">, { accept: number; review: number }> = {
    strict: { accept: 0.95, review: 0.7 },
    balanced: { accept: 0.85, review: 0.55 },
    lenient: { accept: 0.7, review: 0.4 },
};

/** Two words count as the same word at or above this similarity. */
const WORD_MATCH = 0.8;

const STOPWORDS = new Set(["a", "an", "the", "of", "and"]);

const NUMBER_WORDS: Record<string, string> = {
    zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
    eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17",
    eighteen: "18", nineteen: "19", twenty: "20", hundred: "100", thousand: "1000", million: "1000000",
};

/** Folds common spelling variants so "elefant" and "elephant" or "cheeta" and "cheetah" compare as equal. */
function fold(word: string) {
    if (/^\d+$/.test(word)) return word;
    let folded = word.replace(/ph/g, "f").replace(/ck/g, "k").replace(/(.)\1+/g, "$1");
    if (folded.length > 3 && folded.endsWith("ies")) folded = `${folded.slice(0, -3)}y`;
    else if (folded.length > 3 && folded.endsWith("s") && !folded.endsWith("ss")) folded = folded.slice(0, -1);
    if (folded.length > 4 && folded.endsWith("h")) folded = folded.slice(0, -1);
    return folded;
}

function words(text: string) {
    const cleaned = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/['’`]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        // Quiz-show phrasing: "What is Saturn?"
        .replace(/^(?:what|who|where|when|which)\s+(?:is|are|was|were)\s+/, "");
    const all = cleaned ? cleaned.split(" ").map((word) => NUMBER_WORDS[word] ?? word) : [];
    const significant = all.filter((word) => !STOPWORDS.has(word));
    return (significant.length > 0 ? significant : all).map((word) => ({ raw: word, key: fold(word) }));
}

function levenshtein(left: string, right: string) {
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row++) {
        const current = [row];
        for (let column = 1; column <= right.length; column++) {
            const cost = left[row - 1] === right[column - 1] ? 0 : 1;
            current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost);
        }
        previous = current;
    }
    return previous[right.length];
}

function similarity(left: string, right: string) {
    const longest = Math.max(left.length, right.length);
    return longest === 0 ? 1 : 1 - levenshtein(left, right) / longest;
}

/** Short words and numbers must match exactly; longer words may have a typo. */
function wordSimilarity(left: string, right: string) {
    if (left === right) return 1;
    if (left.length <= 3 || right.length <= 3 || /^\d+$/.test(left) || /^\d+$/.test(right)) return 0;
    const score = similarity(left, right);
    return score >= WORD_MATCH ? score : 0;
}

const quote = (list: string[]) => list.map((word) => `“${word}”`).join(", ");

function scoreAgainst(guess: string, answer: string): { score: number; reason: string } {
    const guessWords = words(guess);
    const answerWords = words(answer);
    if (guessWords.length === 0 || answerWords.length === 0) return { score: 0, reason: "Nothing to compare" };

    const guessJoined = guessWords.map((word) => word.raw).join("");
    const answerJoined = answerWords.map((word) => word.raw).join("");
    if (guessJoined === answerJoined) return { score: 1, reason: "Exact match" };
    const guessKey = guessWords.map((word) => word.key).join("");
    const answerKey = answerWords.map((word) => word.key).join("");
    if (guessKey === answerKey) return { score: 0.97, reason: "Same answer, slightly different spelling" };

    // Pair each answer word with its closest unused guess word.
    const usedGuess = new Set<number>();
    const matched: { word: string; score: number }[] = [];
    const missing: string[] = [];
    for (const answerWord of answerWords) {
        let best = { index: -1, score: 0 };
        guessWords.forEach((guessWord, index) => {
            if (usedGuess.has(index)) return;
            const score = wordSimilarity(guessWord.key, answerWord.key);
            if (score > best.score) best = { index, score };
        });
        if (best.index >= 0) {
            usedGuess.add(best.index);
            matched.push({ word: answerWord.raw, score: best.score });
        } else {
            missing.push(answerWord.raw);
        }
    }

    const totalLength = answerWords.reduce((sum, word) => sum + word.raw.length, 0);
    const coverage = matched.reduce((sum, item) => sum + item.word.length * item.score, 0) / totalLength;
    const precision = usedGuess.size / guessWords.length;
    const extra = guessWords.filter((_, index) => !usedGuess.has(index)).map((word) => word.raw);
    // The last word is usually the noun that matters most: "elephant" in "African elephant".
    const headMatched = missing.length === 0 || !missing.includes(answerWords[answerWords.length - 1].raw);

    // Whole-string typo check catches merged or split words ("spider man" vs "spiderman").
    const whole = similarity(guessKey, answerKey);
    const wholeScore = whole >= 0.85 ? whole * 0.95 : 0;

    let tokenScore: number;
    let reason: string;
    if (missing.length === 0) {
        const quality = coverage;
        tokenScore = quality * (0.8 + 0.2 * precision);
        reason =
            extra.length > 0
                ? `Includes the answer plus ${quote(extra)}`
                : quality < 1
                    ? "Close spelling"
                    : "Same words, different order";
    } else if (matched.length > 0) {
        const base = headMatched ? 0.5 + 0.4 * coverage : coverage * 0.9;
        tokenScore = base * precision;
        reason = `Has ${quote(matched.map((item) => item.word))} but not ${quote(missing)}`;
        if (extra.length > 0) reason += `; adds ${quote(extra)}`;
    } else {
        tokenScore = 0;
        reason = "No words in common";
    }

    if (wholeScore > tokenScore) return { score: wholeScore, reason: "Close spelling" };
    return { score: tokenScore, reason };
}

/** "Saturn (accept: the ringed planet)" and "Paris / Paree" list alternates that also count. */
function answerVariants(answer: string) {
    const variants = new Set<string>([answer]);
    const withoutNotes = answer.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").trim();
    if (withoutNotes) variants.add(withoutNotes);
    for (const note of answer.match(/\(([^)]*)\)|\[([^\]]*)\]/g) ?? []) {
        const inner = note.slice(1, -1).replace(/^\s*(?:also|accept|or|aka|a\.k\.a\.)\s*:?\s*/i, "");
        if (inner) variants.add(inner);
    }
    for (const variant of [...variants]) {
        for (const part of variant.split(/\s*[/;]\s*/)) {
            if (part.trim()) variants.add(part.trim());
        }
    }
    return [...variants];
}

/** Suggests whether a typed guess should be accepted. Returns null when suggestions are off or there's nothing to compare. */
export function assessAnswer(guess: string, answer: string, leniency: AnswerLeniency): AnswerAssessment | null {
    if (leniency === "off" || !guess.trim() || !answer.trim()) return null;
    const best = answerVariants(answer)
        .map((variant) => scoreAgainst(guess, variant))
        .reduce((left, right) => (right.score > left.score ? right : left));
    const { accept, review } = THRESHOLDS[leniency];
    const verdict: MatchVerdict = best.score >= accept ? "accept" : best.score >= review ? "review" : "reject";
    return { verdict, score: Math.round(best.score * 100) / 100, reason: best.reason };
}

export function isAnswerLeniency(value: unknown): value is AnswerLeniency {
    return typeof value === "string" && (ANSWER_LENIENCIES as string[]).includes(value);
}
