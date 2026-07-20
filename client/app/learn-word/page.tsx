'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
    ArrowLeft,
    BookOpen,
    Check,
    ChevronLeft,
    ChevronRight,
    Eye,
    GraduationCap,
    Layers,
    RotateCw,
    Volume2,
    X,
} from 'lucide-react';
import { ThemeToggle } from '@/app/theme-toggle';
import { api } from '@/services/api';
import { useCategoryService } from '@/hooks/useCategoryService';
import type { Card, PagedResult } from '@/types/type';
import { getAnswerReveal, getReviewHint, maskAnswer, mergeUnitProgress, normalizeAnswer } from './review';

const WORDS_PER_UNIT = 20;

type View = 'categories' | 'units';
type AnswerState = 'idle' | 'wrong' | 'correct' | 'revealed';

type UnitProgress = { learned: number; total: number; completed: boolean };
type ProgressMap = Record<string, Record<number, UnitProgress>>;

const PROGRESS_KEY = 'learn-progress';

function loadProgress(): ProgressMap {
    if (typeof window === 'undefined') return {};
    try {
        return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}');
    } catch {
        return {};
    }
}

function saveProgress(progress: ProgressMap) {
    try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch {
        /* ponytail: ignore quota / private-mode failures */
    }
}

// CEFR levels get a tinted badge; anything else falls back to neutral.
const LEVEL_TONE: Record<string, string> = {
    A1: 'bg-signal/15 text-signal border-signal/30',
    A2: 'bg-signal/15 text-signal border-signal/30',
    B1: 'bg-electric/15 text-electric border-electric/30',
    B2: 'bg-electric/15 text-electric border-electric/30',
    C1: 'bg-white/10 text-white border-white/20',
    C2: 'bg-white/10 text-white border-white/20',
};

function toneFor(name: string) {
    const upper = name.trim().toUpperCase();
    return LEVEL_TONE[upper] ?? 'bg-white/10 text-white border-white/20';
}

export default function LearnWordPage() {
    const reduceMotion = useReducedMotion();
    const { categories, loading: categoriesLoading } = useCategoryService();

    const [view, setView] = useState<View>('categories');
    const [activeCategory, setActiveCategory] = useState<{
        id: string;
        name: string;
        description: string;
    } | null>(null);
    // wordTotal per categoryId — fetched once categories load, via pageSize=1
    // so the server does the counting, we never pull all words client-side.
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [countsLoading, setCountsLoading] = useState(false);

    const [progress, setProgress] = useState<ProgressMap>(() => loadProgress());

    useEffect(() => {
        if (categories.length === 0) return;
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot server fetch, like useQuery internals
        setCountsLoading(true);
        Promise.all(
            categories.map((c) =>
                api
                    .get<PagedResult<Card>>('/cards', {
                        params: { categoryId: c.category_id, page: 1, pageSize: 1 },
                    })
                    .then((res) => [c.category_id, res.data.total] as const)
                    .catch(() => [c.category_id, 0] as const),
            ),
        ).then((entries) => {
            if (cancelled) return;
            setCounts(Object.fromEntries(entries));
            setCountsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [categories]);

    const openCategory = (cat: { id: string; name: string; description: string }) => {
        setActiveCategory(cat);
        setView('units');
    };

    const recordUnitResult = useCallback((categoryId: string, unit: number, learned: number, total: number) => {
        setProgress((prev) => {
            const next: ProgressMap = {
                ...prev,
                [categoryId]: {
                    ...(prev[categoryId] ?? {}),
                    [unit]: mergeUnitProgress(prev[categoryId]?.[unit], learned, total),
                },
            };
            saveProgress(next);
            return next;
        });
    }, []);

    const categoryProgress = (categoryId: string) => {
        const units = progress[categoryId];
        if (!units) return { learned: 0, total: counts[categoryId] ?? 0 };
        let learned = 0;
        for (const u of Object.values(units)) learned += u.learned;
        return { learned, total: counts[categoryId] ?? 0 };
    };

    return (
        <main id="main-content" className="learn-page relative flex flex-col h-dvh">
            <nav
                aria-label="Điều hướng chính"
                className="learn-nav mx-auto flex w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
            >
                <Link
                    href="/"
                    className="learn-back inline-flex min-h-11 items-center gap-2 px-3 text-sm font-bold sm:px-4"
                >
                    <ArrowLeft size={17} aria-hidden="true" /> Trang chủ
                </Link>
                <div className="flex items-center gap-3">
                    <div className="learn-wordmark hidden items-center gap-3 sm:flex">
                        <span className="grid size-9 place-items-center text-signal">
                            <GraduationCap size={21} aria-hidden="true" />
                        </span>
                        <div className="leading-tight">
                            <p className="font-display text-sm font-extrabold tracking-[-0.02em] text-white">
                                Vocab Lab
                            </p>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                                học theo nhịp riêng
                            </p>
                        </div>
                    </div>
                    <ThemeToggle />
                </div>
            </nav>

            <section
                className={`learn-stage relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${
                    view === 'units' ? 'flex flex-1 flex-col overflow-hidden pb-0' : 'pb-20'
                }`}
            >
                <AnimatePresence mode="wait" initial={false}>
                    {view === 'categories' && (
                        <motion.div
                            key="categories"
                            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
                            transition={{ duration: 0.25 }}
                        >
                            <header className="learn-catalogue-head mb-8">
                                <div className="min-w-0">
                                    <h1 className="font-display text-balance text-[clamp(2.25rem,5vw,3.75rem)] font-extrabold leading-[0.98] tracking-[-0.04em] text-white">
                                        Chọn bộ từ vựng
                                    </h1>
                                    <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
                                        Học theo từng unit tối đa {WORDS_PER_UNIT} từ, rồi quay lại ôn bất cứ khi nào
                                        bạn cần.
                                    </p>
                                </div>
                            </header>

                            {categoriesLoading || categories.length === 0 ? (
                                <CategoryGridSkeleton />
                            ) : (
                                <div className="learn-category-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                    {categories.map((cat, idx) => {
                                        const total = counts[cat.category_id] ?? 0;
                                        const { learned } = categoryProgress(cat.category_id);
                                        const units = Math.max(1, Math.ceil(total / WORDS_PER_UNIT));
                                        const title = cat.description || cat.name.replaceAll('_', ' ');
                                        const action = learned > 0 ? 'Học tiếp' : 'Bắt đầu học';
                                        return (
                                            <motion.article
                                                key={cat.category_id}
                                                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.3, delay: idx * 0.04 }}
                                                className="learn-category min-w-0"
                                            >
                                                <div className="learn-category-media">
                                                    {cat.image_url ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={cat.image_url}
                                                            alt={`Minh họa cho ${title}`}
                                                            width={960}
                                                            height={540}
                                                            loading={idx < 2 ? 'eager' : 'lazy'}
                                                        />
                                                    ) : (
                                                        <div className="grid h-full place-items-center text-electric">
                                                            <BookOpen size={38} aria-hidden="true" />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="learn-category-body">
                                                    <div className="min-w-0">
                                                        <h2 className="font-display line-clamp-2 min-h-12 text-[var(--text-md)] font-extrabold leading-tight tracking-[-0.025em] text-white">
                                                            {title}
                                                        </h2>
                                                    </div>

                                                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <BookOpen
                                                                size={16}
                                                                className="text-electric"
                                                                aria-hidden="true"
                                                            />
                                                            <strong className="font-bold tabular-nums text-white">
                                                                {countsLoading ? '—' : total.toLocaleString('vi-VN')}
                                                            </strong>
                                                            thẻ
                                                        </span>
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <Layers
                                                                size={16}
                                                                className="text-electric"
                                                                aria-hidden="true"
                                                            />
                                                            <strong className="font-bold tabular-nums text-white">
                                                                {countsLoading ? '—' : units}
                                                            </strong>
                                                            unit
                                                        </span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openCategory({
                                                                id: cat.category_id,
                                                                name: title,
                                                                description: cat.description,
                                                            })
                                                        }
                                                        aria-label={`${action}: ${title}`}
                                                        className="learn-primary mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 text-sm font-bold uppercase tracking-[0.06em]"
                                                    >
                                                        {action}
                                                        <ChevronRight size={17} aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </motion.article>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {view === 'units' && activeCategory && (
                        <motion.div
                            key="units"
                            initial={reduceMotion ? false : { opacity: 0, x: 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, x: -24 }}
                            transition={{ duration: 0.25 }}
                            className="flex flex-1 flex-col overflow-hidden"
                        >
                            <UnitBrowser
                                category={activeCategory}
                                total={counts[activeCategory.id] ?? 0}
                                progress={progress[activeCategory.id] ?? {}}
                                onBack={() => setView('categories')}
                                onComplete={recordUnitResult}
                                reduceMotion={reduceMotion}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>
        </main>
    );
}

function CategoryGridSkeleton() {
    return (
        <div className="learn-category-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="learn-category min-h-96 animate-pulse">
                    <div className="aspect-video rounded-[var(--radius-input)] bg-white/10" />
                    <div className="learn-category-body">
                        <div className="h-6 w-2/3 rounded bg-white/10" />
                        <div className="mt-5 h-4 w-1/2 rounded bg-white/10" />
                        <div className="mt-5 h-12 w-full rounded-[var(--radius-input)] bg-white/10" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function UnitBrowser({
    category,
    total,
    progress,
    onBack,
    onComplete,
    reduceMotion,
}: {
    category: { id: string; name: string; description: string };
    total: number;
    progress: Record<number, UnitProgress>;
    onBack: () => void;
    onComplete: (categoryId: string, unit: number, learned: number, total: number) => void;
    reduceMotion: boolean | null;
}) {
    const unitCount = Math.max(1, Math.ceil(total / WORDS_PER_UNIT));
    const units = Array.from({ length: unitCount }, (_, i) => i + 1);
    const firstOpenUnit = units.find((unit) => !progress[unit]?.completed) ?? 1;
    const [selectedUnit, setSelectedUnit] = useState(firstOpenUnit);
    const [session, setSession] = useState(0);
    const learnedAll = Math.min(
        total,
        Object.values(progress).reduce((sum, u) => sum + u.learned, 0),
    );
    const pct = total > 0 ? Math.round((learnedAll / total) * 100) : 0;
    const unitSize = (unit: number) => Math.max(0, Math.min(WORDS_PER_UNIT, total - (unit - 1) * WORDS_PER_UNIT));
    const openUnit = (unit: number) => {
        setSelectedUnit(unit);
        setSession((value) => value + 1);
    };

    return (
        <div className="flex flex-col overflow-hidden" style={{ height: '100%' }}>
            <button
                type="button"
                onClick={onBack}
                className="learn-back mb-4 inline-flex shrink-0 min-h-11 items-center gap-2 px-3 text-sm font-bold sm:px-4"
            >
                <ArrowLeft size={17} aria-hidden="true" /> Tất cả cấp độ
            </button>

            <header className="mb-4 shrink-0 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
                <div className="min-w-0">
                    <h1 className="font-display flex flex-wrap items-center gap-3 text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.035em] text-white">
                        <span
                            className={`inline-flex items-center rounded-md border px-3 py-1 text-sm font-bold ${toneFor(
                                category.name,
                            )}`}
                        >
                            {category.name}
                        </span>
                        <span>Unit {selectedUnit}</span>
                    </h1>
                    <p className="mt-3 text-sm text-muted">
                        {total.toLocaleString('vi-VN')} từ · {unitCount} Unit · tiến độ được lưu tự động
                    </p>
                </div>
                <div className="min-w-48 text-left sm:text-right">
                    <p className="text-xs font-semibold text-muted">Toàn bộ</p>
                    <p className="mt-1 font-bold tabular-nums text-white">
                        {learnedAll}/{total} từ · <span className="text-signal">{pct}%</span>
                    </p>
                </div>
            </header>

            <label className="mb-4 shrink-0 block text-sm font-bold text-white lg:hidden">
                Chọn Unit
                <select
                    value={selectedUnit}
                    onChange={(event) => openUnit(Number(event.target.value))}
                    className="arena-field mt-2"
                >
                    {units.map((unit) => (
                        <option key={unit} value={unit}>
                            Unit {unit} · {progress[unit]?.learned ?? 0}/{unitSize(unit)} từ
                        </option>
                    ))}
                </select>
            </label>

            <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.8fr)] overflow-hidden">
                <aside className="learn-unit-list hidden p-3 lg:flex lg:flex-col lg:overflow-hidden">
                    <div className="flex shrink-0 items-center justify-between px-2 pb-3 pt-1">
                        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Chọn Unit</h2>
                        <span className="rounded-full border border-line bg-black/20 px-2 py-0.5 text-xs font-bold tabular-nums text-muted">
                            {unitCount} Unit
                        </span>
                    </div>
                    <div className="grid flex-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-1">
                        {units.map((unit, idx) => {
                            const p = progress[unit];
                            const completed = p?.completed ?? false;
                            const size = unitSize(unit);
                            const learned = Math.min(p?.learned ?? 0, size);
                            const unitPct = size ? Math.round((learned / size) * 100) : 0;
                            const status = completed ? 'Đã hoàn thành' : learned > 0 ? 'Đang học' : 'Chưa bắt đầu';
                            return (
                                <motion.button
                                    key={unit}
                                    type="button"
                                    onClick={() => openUnit(unit)}
                                    aria-pressed={selectedUnit === unit}
                                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.22, delay: Math.min(idx * 0.025, 0.25) }}
                                    className="learn-unit-option flex min-h-20 w-full items-center gap-3 p-3 text-left"
                                >
                                    <span className="grid size-11 shrink-0 place-items-center rounded-md border border-line bg-black/20 text-base font-extrabold tabular-nums text-white">
                                        {unit}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-display font-extrabold text-white">
                                            Unit {unit}
                                        </span>
                                        <span className="mt-0.5 block text-xs text-muted">
                                            {learned}/{size} từ · {status}
                                        </span>
                                    </span>
                                    {completed ? (
                                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-signal text-black">
                                            <Check size={15} strokeWidth={3} aria-hidden="true" />
                                            <span className="sr-only">Đã hoàn thành</span>
                                        </span>
                                    ) : (
                                        <span className="shrink-0 text-xs font-bold tabular-nums text-electric">
                                            {unitPct}%
                                        </span>
                                    )}
                                </motion.button>
                            );
                        })}
                    </div>
                </aside>

                    <section className="min-w-0 overflow-y-auto">
                        <UnitStudy
                            key={`${selectedUnit}-${session}`}
                            categoryId={category.id}
                            unit={selectedUnit}
                            onComplete={onComplete}
                            onReplay={() => {
                                setSession((value) => value + 1);
                            }}
                            reduceMotion={reduceMotion}
                        />
                    </section>
            </div>
        </div>
    );
}

function UnitStudy({
    categoryId,
    unit,
    onComplete,
    onReplay,
    reduceMotion,
}: {
    categoryId: string;
    unit: number;
    onComplete: (categoryId: string, unit: number, learned: number, total: number) => void;
    onReplay: () => void;
    reduceMotion: boolean | null;
}) {
    // Server-side paging: only this unit's words are fetched, never the whole set.
    const [cards, setCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [index, setIndex] = useState(0);
    const [learnedIds, setLearnedIds] = useState<Set<string>>(new Set());
    const [answer, setAnswer] = useState('');
    const [answerState, setAnswerState] = useState<AnswerState>('idle');
    const [hintLevel, setHintLevel] = useState(0);

    useEffect(() => {
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot server fetch per unit
        setLoading(true);
        setError(null);
        setIndex(0);
        setLearnedIds(new Set());
        setAnswer('');
        setAnswerState('idle');
        setHintLevel(0);
        api.get<PagedResult<Card>>('/cards', {
            params: { categoryId, page: unit, pageSize: WORDS_PER_UNIT },
        })
            .then((res) => {
                if (cancelled) return;
                setCards(res.data.items);
                setLoading(false);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Không tải được từ.');
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [categoryId, unit]);

    // Persist result whenever learned set changes.
    useEffect(() => {
        if (cards.length === 0) return;
        onComplete(categoryId, unit, learnedIds.size, cards.length);
    }, [learnedIds, cards, categoryId, unit, onComplete]);

    const card = cards[index];

    const playAudio = () => {
        const audio = card?.phonetics?.find((p) => p.audio)?.audio;
        if (!audio) return;
        new Audio(audio).play().catch(() => {
            /* ponytail: autoplay / network failure — non-critical */
        });
    };

    const playSystemSound = (name: 'correct' | 'wrong' | 'finish') => {
        try {
            new Audio(`/audios/system/${name}.mp3`).play().catch(() => {});
        } catch {
            /* ponytail: ignore */
        }
    };

    const checkAnswer = (event: React.FormEvent) => {
        event.preventDefault();
        if (!card) return;
        if (answerState === 'correct' || answerState === 'revealed') return;
        if (normalizeAnswer(answer) === normalizeAnswer(card.word)) {
            playSystemSound('correct');
            setLearnedIds((prev) => new Set(prev).add(card.card_id));
            if (index < cards.length - 1) {
                setAnswer('');
                setAnswerState('idle');
                setHintLevel(0);
                setIndex((i) => i + 1);
            } else {
                // Last card — stay on it so "Hoàn thành" section renders
                setAnswer(card.word);
                setAnswerState('correct');
            }
        } else {
            playSystemSound('wrong');
            setAnswerState('wrong');
        }
    };

    const showNextHint = () => setHintLevel((level) => level + 1);
    const revealAnswer = () => {
        if (!card) return;
        setAnswer(card.word);
        setAnswerState('revealed');
    };

    const done = index === cards.length - 1 && learnedIds.size === cards.length;

    useEffect(() => {
        if (done) playSystemSound('finish');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only trigger on done transition
    }, [done]);

    return (
        <>
            {loading ? (
                <div className="learn-study-card flex min-h-80 items-center justify-center">
                    <div className="flex items-center gap-3 text-muted">
                        <Layers size={20} className="animate-pulse" /> Đang tải từ vựng…
                    </div>
                </div>
            ) : error ? (
                <div className="learn-study-card p-8 text-center">
                    <p className="font-semibold text-danger-copy">{error}</p>
                    <p className="mt-2 text-sm text-muted">Chọn lại Unit để thử tải lại.</p>
                </div>
            ) : cards.length === 0 ? (
                <div className="learn-study-card p-8 text-center">
                    <p className="font-semibold text-white">Unit này chưa có từ.</p>
                </div>
            ) : (
                <div>
                    <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-electric">
                                Tiến độ · Unit {unit}
                            </p>
                            <span className="text-xs font-bold tabular-nums text-muted">
                                {index + 1}/{cards.length} thẻ
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div
                                role="progressbar"
                                aria-label={`Tiến độ Unit ${unit}`}
                                aria-valuemin={0}
                                aria-valuemax={cards.length}
                                aria-valuenow={index + 1}
                                className="learn-progress flex-1"
                            >
                                <div
                                    className="learn-progress-fill"
                                    style={{
                                        width: `${Math.round(((index + 1) / cards.length) * 100)}%`,
                                    }}
                                />
                            </div>
                            <span className="text-xs font-bold tabular-nums text-muted">
                                {Math.round(((index + 1) / cards.length) * 100)}%
                            </span>
                        </div>
                    </div>

                        <ReviewCard
                            card={card}
                            answer={answer}
                            answerState={answerState}
                            hintLevel={hintLevel}
                            reduceMotion={reduceMotion}
                            onAnswerChange={(value) => {
                                setAnswer(value);
                                if (answerState !== 'idle') setAnswerState('idle');
                            }}
                            onSubmit={checkAnswer}
                            onHint={showNextHint}
                            onReveal={revealAnswer}
                            onPlayAudio={playAudio}
                        />

                    <AnimatePresence>
                        {done && (
                            <motion.section
                                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                aria-labelledby="unit-complete-title"
                                className="mt-5 rounded-[var(--radius-card)] border border-signal/30 bg-signal/10 p-5 text-left"
                            >
                                <div role="status" className="flex items-center gap-3">
                                    <Check className="shrink-0 text-signal" aria-hidden="true" />
                                    <div>
                                        <p id="unit-complete-title" className="font-bold text-signal">
                                            Hoàn thành Unit {unit}
                                        </p>
                                        <p className="mt-1 text-sm text-muted">
                                            Bạn đã thuộc tất cả {cards.length} từ trong unit này.
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        onClick={onReplay}
                                        className="learn-primary inline-flex min-h-12 items-center justify-center gap-2 px-4 text-sm font-bold"
                                    >
                                        <RotateCw size={17} aria-hidden="true" /> Học lại
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onReplay}
                                        className="learn-secondary inline-flex min-h-12 items-center justify-center gap-2 px-4 text-sm font-bold"
                                    >
                                        <RotateCw size={17} aria-hidden="true" /> Luyện lại
                                    </button>
                                </div>
                            </motion.section>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </>
    );
}

function ReviewCard({
    card,
    answer,
    answerState,
    hintLevel,
    reduceMotion,
    onAnswerChange,
    onSubmit,
    onHint,
    onReveal,
    onPlayAudio,
}: {
    card: Card;
    answer: string;
    answerState: AnswerState;
    hintLevel: number;
    reduceMotion: boolean | null;
    onAnswerChange: (value: string) => void;
    onSubmit: (event: React.FormEvent) => void;
    onHint: () => void;
    onReveal: () => void;
    onPlayAudio: () => void;
}) {
    const hint = getReviewHint(card.word, hintLevel);
    const resolved = answerState === 'correct' || answerState === 'revealed';
    const revealedAnswer = getAnswerReveal(card.word, hintLevel);

    // Auto-play IPA audio when final hint is triggered
    useEffect(() => {
        if (hint.final && card.phonetics?.[0]?.audio) {
            new Audio(card.phonetics[0].audio).play().catch(() => {});
        }
    }, [hint.final, card.phonetics]);

    return (
        <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="learn-study-card overflow-hidden"
        >
            <div className="relative p-6 text-center sm:p-8">
                {card.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={card.image_url}
                        alt={`Minh họa cho nghĩa của từ ${card.word}`}
                        width={240}
                        height={240}
                        className="mx-auto size-28 rounded-[var(--radius-card)] border-4 border-white object-cover shadow-panel"
                    />
                )}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-white">
                        {card.translation || 'Đoán từ tiếng Anh'}
                    </h2>
                    <span className="rounded-md border border-line bg-black/20 px-2.5 py-1 text-xs font-bold text-muted">
                        {card.type || 'từ vựng'}
                    </span>
                </div>

                {card.explanation?.en && (
                    <div className="mx-auto mt-5 max-w-2xl">
                        <p className="text-xs font-bold text-electric">Định nghĩa tiếng Anh</p>
                        <p className="mt-1 text-sm leading-6 text-muted">{card.explanation.en}</p>
                    </div>
                )}
                {card.explanation?.vi && (
                    <div className="mx-auto mt-3 max-w-2xl">
                        <p className="text-xs font-bold text-electric">Định nghĩa</p>
                        <p className="mt-1 text-sm leading-6 text-muted">{card.explanation.vi}</p>
                    </div>
                )}
                {card.example?.en && (
                    <div className="mx-auto mt-4 max-w-2xl">
                        <p className="text-xs font-bold text-electric">Ví dụ</p>
                        <p className="mt-1 text-sm italic leading-relaxed text-white">
                            {resolved
                                ? (() => {
                                    const escaped = card.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                    const parts = card.example.en.split(new RegExp(`(${escaped})`, 'gi'));
                                    return (
                                        <>
                                            “{parts.map((part, i) =>
                                                part.toLowerCase() === card.word.toLowerCase()
                                                    ? <span key={i} className="font-bold text-signal">{part}</span>
                                                    : part
                                            )}”
                                        </>
                                    );
                                })()
                                : `“${maskAnswer(card.example.en, card.word)}”`
                            }
                        </p>
                        {card.example.vi && <p className="mt-1 text-sm text-muted">{card.example.vi}</p>}
                    </div>
                )}
            </div>

            <form onSubmit={onSubmit} className="border-t border-line p-5 sm:p-8">
                <div
                    id="review-hint"
                    aria-live="polite"
                    className={`mb-4 rounded-[var(--radius-input)] border px-4 py-3 text-center ${
                        resolved ? 'border-signal/50 bg-signal/8' : 'border-line bg-black/20'
                    }`}
                >
                    {resolved ? (
                        <p
                            aria-label={`Đáp án: ${card.word}`}
                            className="flex min-h-8 flex-wrap items-center justify-center gap-1 font-mono text-xl font-black"
                        >
                            {revealedAnswer.map(({ char, highlight }, index) => (
                                <motion.span
                                    key={`${char}-${index}`}
                                    initial={reduceMotion || !highlight ? false : { opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2, delay: index * 0.025 }}
                                    className={highlight ? 'rounded bg-signal/20 px-1 text-signal' : 'px-1 text-white'}
                                >
                                    {char === ' ' ? '\u00a0' : char}
                                </motion.span>
                            ))}
                        </p>
                    ) : hint.final && card.phonetics?.[0]?.text ? (
                        <div className="flex flex-wrap items-center justify-center gap-2 text-base font-semibold text-electric">
                            <span>{card.phonetics[0].text}</span>
                            {card.phonetics.some((p) => p.audio) && (
                                <button
                                    type="button"
                                    onClick={onPlayAudio}
                                    aria-label={`Nghe phát âm của ${card.word}`}
                                    className="learn-secondary grid size-9 place-items-center"
                                >
                                    <Volume2 size={15} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    ) : (
                        <p className="font-mono text-xl font-black tracking-[0.16em] text-white">{hint.pattern}</p>
                    )}
                </div>

                <label htmlFor="review-answer" className="text-sm font-bold text-white">
                    Nhập từ tiếng Anh
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                        id="review-answer"
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                        value={answer}
                        readOnly={resolved}
                        onChange={(event) => onAnswerChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (!resolved && (event.code === 'Backquote' || event.key === '`')) {
                                event.preventDefault();
                                onHint();
                            }
                            if (!resolved && event.altKey && event.key.toLowerCase() === 'a') {
                                event.preventDefault();
                                onReveal();
                            }
                        }}
                        aria-invalid={answerState === 'wrong'}
                        aria-describedby="review-feedback review-hint"
                        placeholder="Gõ đáp án rồi nhấn Enter…"
                        className={`arena-field min-w-0 flex-1 text-lg font-bold ${
                            answerState === 'wrong' ? 'border-danger' : resolved ? 'border-signal' : ''
                        }`}
                    />
                    {!resolved && (
                        <button type="submit" className="learn-primary min-h-13 px-5 text-sm font-bold sm:w-auto">
                            Kiểm tra
                        </button>
                    )}
                </div>

                {!resolved && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={onHint}
                            disabled={hint.final}
                            className="learn-secondary inline-flex min-h-11 items-center justify-center gap-2 px-3 text-xs font-bold text-muted disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {hint.final ? 'Đã hết gợi ý' : 'Gợi ý'}
                        </button>
                        <button
                            type="button"
                            onClick={onReveal}
                            className="learn-secondary inline-flex min-h-11 items-center justify-center gap-2 px-3 text-xs font-bold text-electric"
                        >
                            <Eye size={15} aria-hidden="true" /> Xem đáp án
                        </button>
                    </div>
                )}

                <div id="review-feedback" aria-live="polite" className="min-h-7 pt-2 text-sm font-bold">
                    {answerState === 'wrong' && (
                        <p className="flex items-center gap-2 text-danger-copy">
                            <X size={16} strokeWidth={3} /> Chưa đúng, thử lại nhé.
                        </p>
                    )}
                    {answerState === 'correct' && (
                        <p className="flex items-center gap-2 text-signal">
                            <Check size={16} strokeWidth={3} /> Chính xác!
                        </p>
                    )}
                    {answerState === 'revealed' && (
                        <p className="flex items-center gap-2 text-electric">
                            <Eye size={16} /> Đáp án đã mở. Chữ được tô là phần còn thiếu.
                        </p>
                    )}
                </div>
            </form>
        </motion.div>
    );
}
