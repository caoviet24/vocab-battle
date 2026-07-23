export const WORDS_PER_UNIT = 20;

export type View = 'categories' | 'units';
export type AnswerState = 'idle' | 'wrong' | 'correct' | 'revealed';

export type UnitProgress = { learned: number; total: number; completed: boolean; learnedIds?: string[] };
export type ProgressMap = Record<string, Record<number, UnitProgress>>;

export const PROGRESS_KEY = 'learn-progress';

export const LEVEL_TONE: Record<string, string> = {
    A1: 'bg-signal/15 text-signal border-signal/30',
    A2: 'bg-signal/15 text-signal border-signal/30',
    B1: 'bg-electric/15 text-electric border-electric/30',
    B2: 'bg-electric/15 text-electric border-electric/30',
    C1: 'bg-white/10 text-white border-white/20',
    C2: 'bg-white/10 text-white border-white/20',
};

export function loadProgress(): ProgressMap {
    if (typeof window === 'undefined') return {};
    try {
        return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}');
    } catch {
        return {};
    }
}

export function saveProgress(progress: ProgressMap) {
    try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch {
        /* ponytail: ignore quota / private-mode failures */
    }
}


export function toneFor(name: string) {
    const upper = name.trim().toUpperCase();
    return LEVEL_TONE[upper] ?? 'bg-white/10 text-white border-white/20';
}
