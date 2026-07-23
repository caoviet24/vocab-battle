import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Layers, List, RotateCw, Volume2 } from 'lucide-react';
import { api } from '@/services/api';
import { decryptCardPayload } from '@/lib/card-payload';
import type { Card, PagedResult } from '@/types/type';
import { applyHint, getReviewHint, normalizeAnswer, shuffle } from './review';
import { AnswerState, WORDS_PER_UNIT } from './common';
import ReviewCard from './ReviewCard';
import CongratulatoryMascot from '@/components/CongratulatoryMascot';

export default function UnitStudy({
    categoryId,
    unit,
    savedLearned,
    savedLearnedIds,
    onComplete,
    onReset,
    onNextUnit,
    reduceMotion,
}: {
    categoryId: string;
    unit: number;
    savedLearned: number;
    savedLearnedIds: string[];
    onComplete: (categoryId: string, unit: number, learned: number, total: number, learnedIds?: string[]) => void;
    onReset: () => void;
    onNextUnit?: () => void;
    reduceMotion: boolean | null;
}) {
    const [cards, setCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [index, setIndex] = useState(0);
    const [learnedIds, setLearnedIds] = useState<Set<string>>(new Set());
    const learnedIdsRef = useRef<Set<string>>(new Set());
    const initialProgress = useRef({ learned: savedLearned, ids: savedLearnedIds });
    const [answer, setAnswer] = useState('');
    const [answerState, setAnswerState] = useState<AnswerState>('idle');
    const [hintLevel, setHintLevel] = useState(0);
    const [showWordList, setShowWordList] = useState(false);

    const persist = useCallback(
        (ids: Set<string>) => {
            onComplete(categoryId, unit, ids.size, cards.length, Array.from(ids));
        },
        [categoryId, unit, cards.length, onComplete],
    );

    useEffect(() => {
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot server fetch per unit
        setLoading(true);
        setError(null);
        setIndex(0);
        const initialSet = new Set<string>();
        setLearnedIds(initialSet);
        learnedIdsRef.current = initialSet;
        setAnswer('');
        setAnswerState('idle');
        setHintLevel(0);
        setShowWordList(false);
        api.get<{ iv: string; ciphertext: string }>('/cards', {
            params: { categoryId, page: unit, pageSize: WORDS_PER_UNIT },
        })
            .then(async (res) => {
                const sourceItems = (await decryptCardPayload<PagedResult<Card>>(res.data)).items;
                if (cancelled) return;
                const { learned, ids } = initialProgress.current;
                // Older saved progress has a count but no card IDs; migrate it using the stable unit order.
                const restored = new Set(ids);
                for (const item of sourceItems.slice(0, learned)) restored.add(item.card_id);
                // Keep restored cards before the random unseen cards so resuming never skips an unlearned word.
                const shuffled = shuffle(sourceItems);
                const items = [
                    ...shuffled.filter((item) => restored.has(item.card_id)),
                    ...shuffled.filter((item) => !restored.has(item.card_id)),
                ];
                setCards(items);
                setLoading(false);
                if (learned > 0 || ids.length > 0) {
                    setLearnedIds(restored);
                    learnedIdsRef.current = restored;
                    const firstUnlearned = items.findIndex((c) => !restored.has(c.card_id));
                    setIndex(firstUnlearned >= 0 ? firstUnlearned : items.length - 1);
                }
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

    const card = cards[index];

    const playCardAudio = (cardToPlay: Card) => {
        const audio = cardToPlay.phonetics?.find((p) => p.audio)?.audio;
        if (!audio) return;
        new Audio(audio).play().catch(() => {
            /* ponytail: autoplay / network failure — non-critical */
        });
    };

    const playAudio = () => {
        if (card) playCardAudio(card);
    };

    const playSystemSound = (name: 'correct' | 'wrong' | 'finish') => {
        try {
            new Audio(`/audios/system/${name}.mp3`).play().catch(() => {});
        } catch {
            /* ponytail: ignore */
        }
    };

    const markLearned = useCallback(
        (cardId: string) => {
            // Use the ref to avoid stale closure (learnedIds may be stale in event handlers)
            const next = new Set(learnedIdsRef.current);
            if (next.has(cardId)) return; // already marked
            next.add(cardId);
            learnedIdsRef.current = next;
            setLearnedIds(next);
            persist(next);
        },
        [persist],
    );

    const nextCard = () => {
        if (index >= cards.length - 1) return;
        setAnswer('');
        setAnswerState('idle');
        setHintLevel(0);
        setIndex((current) => current + 1);
    };

    const checkAnswer = (event: React.FormEvent) => {
        event.preventDefault();
        if (!card) return;
        if (answerState === 'correct' || answerState === 'revealed') {
            nextCard();
            return;
        }
        if (normalizeAnswer(answer) === normalizeAnswer(card.word)) {
            playSystemSound('correct');
            markLearned(card.card_id);
            setAnswer(card.word);
            setAnswerState('correct');
        } else {
            playSystemSound('wrong');
            setAnswerState('wrong');
        }
    };

    const showNextHint = () => {
        if (!card) return;
        if (getReviewHint(card.word, hintLevel).final) {
            playCardAudio(card);
            return;
        }
        const nextLevel = hintLevel + 1;
        setHintLevel(nextLevel);
        if (getReviewHint(card.word, nextLevel).final) {
            playCardAudio(card);
            return;
        }
        setAnswer((value) => applyHint(card.word, value, nextLevel));
    };
    const revealAnswer = () => {
        if (!card) return;
        setAnswer(card.word);
        setAnswerState('revealed');
        // Mark as learned when revealed
        markLearned(card.card_id);
    };

    const done = index === cards.length - 1 && learnedIds.size === cards.length;

    useEffect(() => {
        if (done) playSystemSound('finish');
    }, [done]);

    return (
        <>
            {loading ? (
                <div className="flex min-h-80 items-center justify-center rounded-[calc(var(--radius-card)+0.25rem)] border border-line bg-surface shadow-panel">
                    <div className="flex items-center gap-3 text-muted">
                        <Layers size={20} className="animate-pulse" /> Đang tải từ vựng…
                    </div>
                </div>
            ) : error ? (
                <div className="rounded-[calc(var(--radius-card)+0.25rem)] border border-line bg-surface p-8 text-center shadow-panel">
                    <p className="font-semibold text-danger-copy">{error}</p>
                    <p className="mt-2 text-sm text-muted">Chọn lại Unit để thử tải lại.</p>
                </div>
            ) : cards.length === 0 ? (
                <div className="rounded-[calc(var(--radius-card)+0.25rem)] border border-line bg-surface p-8 text-center shadow-panel">
                    <p className="font-semibold text-white">Unit này chưa có từ.</p>
                </div>
            ) : showWordList ? (
                <motion.section
                    initial={reduceMotion ? false : { opacity: 0, rotateY: 90 }}
                    animate={{ opacity: 1, rotateY: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ transformStyle: 'preserve-3d' }}
                    className="overflow-hidden rounded-[1.1rem] border border-line bg-surface shadow-panel"
                >
                    <header className="relative grid min-h-14 place-items-center border-b border-line px-14 py-3">
                        <h2 className="m-0 text-xl font-extrabold text-foreground">Các từ trong nhóm này</h2>
                        <button
                            type="button"
                            onClick={() => setShowWordList(false)}
                            aria-label="Quay lại bài học"
                            className="absolute right-3 grid size-9 place-items-center rounded-lg text-electric"
                        >
                            <ChevronRight size={18} aria-hidden="true" />
                        </button>
                    </header>
                    <div className="max-h-[min(74dvh,47rem)] overflow-auto">
                        <table className="w-full min-w-[62rem] border-collapse text-sm text-foreground">
                            <thead>
                                <tr>
                                    <th className="sticky top-0 z-10 w-[13%] border-b border-line bg-surface-raised p-3 text-left font-extrabold whitespace-nowrap">
                                        Từ vựng
                                    </th>
                                    <th className="sticky top-0 z-10 w-[13%] border-b border-line bg-surface-raised p-3 text-left font-extrabold whitespace-nowrap">
                                        IPA
                                    </th>
                                    <th
                                        aria-label="Phát âm"
                                        className="sticky top-0 z-10 w-[8%] border-b border-line bg-surface-raised p-3"
                                    />
                                    <th className="sticky top-0 z-10 w-[10%] border-b border-line bg-surface-raised p-3 text-left font-extrabold whitespace-nowrap">
                                        Loại từ
                                    </th>
                                    <th className="sticky top-0 z-10 w-[16%] border-b border-line bg-surface-raised p-3 text-left font-extrabold whitespace-nowrap">
                                        Bản dịch
                                    </th>
                                    <th className="sticky top-0 z-10 w-[22%] border-b border-line bg-surface-raised p-3 text-left font-extrabold whitespace-nowrap">
                                        Định nghĩa
                                    </th>
                                    <th className="sticky top-0 z-10 w-[18%] border-b border-line bg-surface-raised p-3 text-left font-extrabold whitespace-nowrap">
                                        Ví dụ
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {cards.map((item) => {
                                    const phonetic = item.phonetics?.find((item) => item.text)?.text;
                                    return (
                                        <tr
                                            key={item.card_id}
                                            className="[&>td]:border-b [&>td]:border-line [&>td]:p-3 [&>td]:text-left [&>td]:align-top"
                                        >
                                            <td className="font-extrabold text-electric">{item.word}</td>
                                            <td className="text-electric">{phonetic || '—'}</td>
                                            <td>
                                                <div className="flex gap-1.5">
                                                    {item.phonetics
                                                        ?.filter((phonetic) => phonetic.audio)
                                                        .map((phonetic, index) => (
                                                            <button
                                                                key={`${phonetic.locale}-${index}`}
                                                                type="button"
                                                                onClick={() =>
                                                                    new Audio(phonetic.audio).play().catch(() => {})
                                                                }
                                                                aria-label={`Nghe phát âm ${phonetic.locale || index + 1} của ${item.word}`}
                                                                className="flex items-center gap-1 rounded-full border border-line bg-background px-2 py-0.5 text-xs font-bold text-foreground"
                                                            >
                                                                <Volume2 size={14} aria-hidden="true" />{' '}
                                                                {phonetic.locale || `Âm ${index + 1}`}
                                                            </button>
                                                        ))}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="inline-block rounded border border-line px-1.5 py-0.5 text-[0.68rem] font-extrabold uppercase">
                                                    {item.type || 'Từ vựng'}
                                                </span>
                                            </td>
                                            <td>{item.translation}</td>
                                            <td className="text-electric">{item.explanation.en}</td>
                                            <td className="text-electric italic">{item.example.en}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </motion.section>
            ) : done ? (
                <motion.section
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    aria-labelledby="unit-complete-title"
                    className="relative overflow-hidden rounded-[1.25rem] border-2 border-line bg-surface px-6 py-10 shadow-panel sm:px-12 sm:py-16"
                >
                    <div className="grid mx-auto max-w-3xl place-items-center text-center" role="status">
                        <CongratulatoryMascot size={142} className="mb-2" withBackground speed={1.55} />
                        <h2
                            id="unit-complete-title"
                            className="m-0 text-2xl font-extrabold text-foreground sm:text-3xl"
                        >
                            🎉 Tuyệt vời!
                        </h2>
                        <p className="mt-3 text-sm text-electric">Bạn đã học xong các từ mới trong nhóm này.</p>
                        <p className="mt-1 text-sm italic text-electric">
                            Hãy nhớ ôn tập thường xuyên để ghi nhớ lâu dài nhé!
                        </p>
                        <p className="mt-3 text-xl font-extrabold text-electric">
                            Đã học {learnedIds.size} / {cards.length} từ
                        </p>
                  
                        <div className="mt-6 grid w-full grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setShowWordList(true)}
                                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-line bg-background text-sm font-extrabold uppercase text-foreground"
                            >
                                <List size={17} aria-hidden="true" /> Xem từ vựng
                            </button>
                            <button
                                type="button"
                                onClick={onNextUnit}
                                disabled={!onNextUnit}
                                className="min-h-12 rounded-2xl bg-electric text-sm font-extrabold uppercase text-white shadow-[inset_0_-4px_rgb(19_93_153_/_0.55)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Học nhóm tiếp theo
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={onReset}
                            className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-danger px-5 text-sm font-extrabold uppercase text-white shadow-[inset_0_-4px_rgb(116_20_17_/_0.5)]"
                        >
                            <RotateCw size={17} aria-hidden="true" /> Học lại từ đầu
                        </button>
                    </div>
                </motion.section>
            ) : (
                <div>
                    <div className="mb-4 border-l-2 border-electric bg-electric/10 px-6 py-4">
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
                            setAnswer(applyHint(card.word, value, hintLevel));
                            if (answerState !== 'idle') setAnswerState('idle');
                        }}
                        onSubmit={checkAnswer}
                        onHint={showNextHint}
                        onReveal={revealAnswer}
                        onNext={nextCard}
                        isLast={index === cards.length - 1}
                        onPlayAudio={playAudio}
                    />
                </div>
            )}
        </>
    );
}
