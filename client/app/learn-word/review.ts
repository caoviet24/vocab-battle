export function normalizeAnswer(value: string) {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

export function shuffle<T>(items: readonly T[]) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
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

export function applyHint(word: string, value: string, level: number) {
    const typed = Array.from(value).filter((char) => /[\p{L}\p{N}]/u.test(char));
    let typedIndex = 0;
    const answer = getAnswerReveal(word, level).map(({ char, highlight }) => {
        if (!/[\p{L}\p{N}]/u.test(char)) return { char, fixed: true, active: false };
        const typedChar = typed[typedIndex++];
        return { char: highlight ? (typedChar ?? '') : char, fixed: false, active: !highlight || !!typedChar };
    });
    const lastActive = answer.reduce((last, item, index) => (item.active ? index : last), -1);
    return answer
        .map((item, index) => (item.fixed && index > lastActive ? '' : item.char))
        .join('');
}

export function maskAnswer(text: string, answer: string) {
    if (!text || !answer) return text;
    const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(escaped, 'gi'), '_'.repeat(answer.length));
}

export function mergeUnitProgress(
    previous: { learned: number; total: number; completed: boolean; learnedIds?: string[] } | undefined,
    learned: number,
    total: number,
    learnedIds?: string[],
) {
    const bestLearned = Math.min(total, Math.max(previous?.learned ?? 0, learned));
    // Merge id sets so reopening a unit resumes from the last learned card.
    const idSet = new Set<string>([...(previous?.learnedIds ?? []), ...(learnedIds ?? [])]);
    return {
        learned: bestLearned,
        total,
        completed: total > 0 && bestLearned >= total,
        ...(previous?.learnedIds || learnedIds ? { learnedIds: Array.from(idSet) } : {}),
    };
}
