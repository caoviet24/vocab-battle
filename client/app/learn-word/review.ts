export function normalizeAnswer(value: string) {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

export function getReviewHint(word: string, level: number) {
    const chars = Array.from(word);
    const letterIndexes = chars.flatMap((char, index) => (/[\p{L}\p{N}]/u.test(char) ? [index] : []));
    const maxRevealed = Math.max(0, Math.min(letterIndexes.length - 1, Math.ceil(letterIndexes.length / 2)));
    const revealed = new Set(letterIndexes.slice(0, Math.min(level, maxRevealed)));

    return {
        pattern: chars
            .map((char, index) => (/[\p{L}\p{N}]/u.test(char) && !revealed.has(index) ? '_' : char))
            .join(' '),
        final: level > maxRevealed,
    };
}

export function getAnswerReveal(word: string, level: number) {
    const chars = Array.from(word);
    const letterIndexes = chars.flatMap((char, index) => (/[\p{L}\p{N}]/u.test(char) ? [index] : []));
    const maxRevealed = Math.max(0, Math.min(letterIndexes.length - 1, Math.ceil(letterIndexes.length / 2)));
    const visibleBeforeAnswer = new Set(letterIndexes.slice(0, Math.min(level, maxRevealed)));

    return chars.map((char, index) => ({
        char,
        highlight: /[\p{L}\p{N}]/u.test(char) && !visibleBeforeAnswer.has(index),
    }));
}

export function maskAnswer(text: string, answer: string) {
    if (!text || !answer) return text;
    const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(escaped, 'gi'), '_'.repeat(answer.length));
}

export function mergeUnitProgress(
    previous: { learned: number; total: number; completed: boolean } | undefined,
    learned: number,
    total: number,
) {
    const bestLearned = Math.min(total, Math.max(previous?.learned ?? 0, learned));
    return {
        learned: bestLearned,
        total,
        completed: total > 0 && bestLearned >= total,
    };
}
