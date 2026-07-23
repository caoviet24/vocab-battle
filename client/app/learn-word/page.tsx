'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BookOpen, ChevronRight, CircleCheckBig, Layers } from 'lucide-react';
import { api } from '@/services/api';
import { decryptCardPayload } from '@/lib/card-payload';
import { useCategoryService } from '@/hooks/useCategoryService';
import type { Card, PagedResult } from '@/types/type';
import { mergeUnitProgress } from './review';
import { loadProgress, ProgressMap, saveProgress, View, WORDS_PER_UNIT } from './common';
import UnitBrowser from './UnitBrowser';
import StudyMascot from '@/components/StudyMascot';

export default function LearnWordPage() {
    const reduceMotion = useReducedMotion();
    const { categories, loading: categoriesLoading } = useCategoryService();

    const [view, setView] = useState<View>('categories');
    const [activeCategory, setActiveCategory] = useState<{
        id: string;
        name: string;
        description: string;
    } | null>(null);
    const [counts, setCounts] = useState<Record<string, number>>({});

    const [progress, setProgress] = useState<ProgressMap>(() => loadProgress());

    useEffect(() => {
        if (categories.length === 0) return;
        let cancelled = false;
        Promise.all(
            categories.map((c) =>
                api
                    .get<{ iv: string; ciphertext: string }>('/cards', {
                        params: { categoryId: c.category_id, page: 1, pageSize: 1 },
                    })
                    .then(async (res) => [c.category_id, (await decryptCardPayload<PagedResult<Card>>(res.data)).total] as const)
                    .catch(() => [c.category_id, 0] as const),
            ),
        ).then((entries) => {
            if (cancelled) return;
            setCounts(Object.fromEntries(entries));
        });
        return () => {
            cancelled = true;
        };
    }, [categories]);

    const openCategory = (cat: { id: string; name: string; description: string }) => {
        setActiveCategory(cat);
        setView('units');
    };

    const recordUnitResult = useCallback(
        (categoryId: string, unit: number, learned: number, total: number, learnedIds?: string[]) => {
            setProgress((prev) => {
                const next: ProgressMap = {
                    ...prev,
                    [categoryId]: {
                        ...(prev[categoryId] ?? {}),
                        [unit]: mergeUnitProgress(prev[categoryId]?.[unit], learned, total, learnedIds),
                    },
                };
                saveProgress(next);
                return next;
            });
        },
        [],
    );

    const resetUnit = useCallback((categoryId: string, unit: number) => {
        setProgress((previous) => {
            const categoryProgress = { ...(previous[categoryId] ?? {}) };
            delete categoryProgress[unit];
            const next = { ...previous, [categoryId]: categoryProgress };
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

    const totalWords = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const learnedWords = categories.reduce((sum, category) => sum + categoryProgress(category.category_id).learned, 0);

    return (
        <main
            id="main-content"
            className={`learn-page learn-v2 relative flex min-h-0 flex-1 flex-col ${
                view === 'units' ? 'lg:h-[calc(100dvh-4rem)] lg:flex-none lg:overflow-hidden' : ''
            }`}
        >
            <section
                className={`learn-stage relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${
                    view === 'units' ? 'flex min-h-0 flex-1 flex-col overflow-hidden pb-0' : 'pb-20'
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
                            <header className="learn-v2__catalogue-head">
                                <div className="learn-v2__catalogue-intro">
                                    <h1 className="font-display text-balance text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold leading-[0.94] tracking-[-0.045em] text-foreground">
                                        Học theo nhịp của bạn.
                                    </h1>
                                    <p className="mt-4 max-w-xl text-base leading-7 text-muted">
                                        Mỗi Unit có tối đa {WORDS_PER_UNIT} từ — chọn một bộ, học tiếp đúng nơi bạn đã dừng.
                                    </p>
                                </div>
                                <aside className="learn-v2__study-companion" aria-label="Trợ lý học tập">
                                    <StudyMascot className="learn-v2__study-mascot" />
                                    <div className="learn-v2__study-companion-copy">
                                        <p className="learn-v2__study-companion-kicker">Trợ lý học tập</p>
                                        <p className="learn-v2__study-companion-note">Chọn một Unit để bắt đầu phiên học của bạn.</p>
                                    </div>
                                    <dl className="learn-v2__overview" aria-label="Tổng quan tiến độ học">
                                        <div>
                                            <dt>Bộ từ</dt>
                                            <dd>{categories.length || '—'}</dd>
                                        </div>
                                        <div>
                                            <dt>Đã học</dt>
                                            <dd>{learnedWords.toLocaleString('vi-VN')} từ</dd>
                                        </div>
                                        <div>
                                            <dt>Toàn bộ</dt>
                                            <dd>{totalWords.toLocaleString('vi-VN')} từ</dd>
                                        </div>
                                    </dl>
                                </aside>
                            </header>

                            {categoriesLoading || categories.length === 0 ? (
                                <CategoryGridSkeleton />
                            ) : (
                                <section aria-label="Danh sách bộ từ" className="learn-v2__category-grid">
                                    {categories.map((cat, idx) => {
                                        const total = counts[cat.category_id] ?? 0;
                                        const { learned } = categoryProgress(cat.category_id);
                                        const units = Math.max(1, Math.ceil(total / WORDS_PER_UNIT));
                                        const title = cat.description || cat.name.replaceAll('_', ' ');
                                        const action = learned > 0 ? 'Học tiếp' : 'Bắt đầu học';
                                        const progressPct = total ? Math.round((learned / total) * 100) : 0;
                                        return (
                                            <motion.article
                                                key={cat.category_id}
                                                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.3, delay: idx * 0.04 }}
                                                className="learn-v2__deck min-w-0"
                                            >
                                                <div className="learn-v2__deck-media">
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

                                                <div className="learn-v2__deck-body">
                                                    <div className="min-w-0">
                                                        <h2 className="font-display line-clamp-2 text-[var(--text-md)] font-extrabold leading-tight tracking-[-0.025em] text-foreground">
                                                            {title}
                                                        </h2>
                                                    </div>

                                                    <div className="learn-v2__deck-meta">
                                                        <span><BookOpen size={16} aria-hidden="true" /> {total.toLocaleString('vi-VN')} từ</span>
                                                        <span><Layers size={16} aria-hidden="true" /> {units} Unit</span>
                                                    </div>

                                                    <div className="learn-v2__deck-progress">
                                                        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted">
                                                            <span>{learned > 0 ? 'Đang học' : 'Sẵn sàng bắt đầu'}</span>
                                                            <span className="tabular-nums">{progressPct}%</span>
                                                        </div>
                                                        <div role="progressbar" aria-label={`Tiến độ ${title}`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={learned}>
                                                            <span style={{ width: `${progressPct}%` }} />
                                                        </div>
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
                                                        className="learn-v2__deck-action"
                                                    >
                                                        <CircleCheckBig size={17} aria-hidden="true" />
                                                        {action}
                                                        <ChevronRight size={17} aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </motion.article>
                                        );
                                    })}
                                </section>
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
                            className="flex min-h-0 flex-1 flex-col overflow-hidden"
                        >
                            <UnitBrowser
                                category={activeCategory}
                                total={counts[activeCategory.id] ?? 0}
                                progress={progress[activeCategory.id] ?? {}}
                                onBack={() => setView('categories')}
                                onComplete={recordUnitResult}
                                onReset={resetUnit}
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
        <div className="learn-v2__category-grid" aria-label="Đang tải bộ từ">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="learn-v2__deck min-h-96 animate-pulse">
                    <div className="aspect-video rounded-[var(--radius-input)] bg-white/10" />
                    <div className="learn-v2__deck-body">
                        <div className="h-6 w-2/3 rounded bg-white/10" />
                        <div className="mt-5 h-4 w-1/2 rounded bg-white/10" />
                        <div className="mt-5 h-12 w-full rounded-[var(--radius-input)] bg-white/10" />
                    </div>
                </div>
            ))}
        </div>
    );
}
