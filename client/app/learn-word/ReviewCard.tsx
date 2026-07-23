import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Eye, Volume2, X } from 'lucide-react';

import type { Card } from '@/types/type';
import { getAnswerReveal, getReviewHint, maskAnswer } from './review';
import { AnswerState } from './common';

export default function ReviewCard({
    card,
    answer,
    answerState,
    hintLevel,
    reduceMotion,
    onAnswerChange,
    onSubmit,
    onHint,
    onReveal,
    onNext,
    isLast,
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
    onNext: () => void;
    isLast: boolean;
    onPlayAudio: () => void;
}) {
    const answerRef = useRef<HTMLInputElement>(null);
    const resolved = answerState === 'correct' || answerState === 'revealed';
    const revealedAnswer = getAnswerReveal(card.word, hintLevel);
    const hintsExhausted = getReviewHint(card.word, hintLevel).final;
    const hintCharacters = revealedAnswer.map(({ char, highlight }, index) => ({
        char: highlight ? Array.from(answer)[index] || '_' : char,
        hinted: !highlight,
    }));
    const phonetic = card.phonetics?.find((item) => item.text);

    useEffect(() => {
        const focusAnswer = () => answerRef.current?.focus({ preventScroll: true });
        focusAnswer();
        const frame = requestAnimationFrame(focusAnswer);
        return () => cancelAnimationFrame(frame);
    }, [card.card_id]);

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
                {phonetic && hintsExhausted && (
                    <div className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-electric">
                        <span>{phonetic.text}</span>
                        {card.phonetics?.some((item) => item.audio) && (
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
                )}

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
                                              “
                                              {parts.map((part, i) =>
                                                  part.toLowerCase() === card.word.toLowerCase() ? (
                                                      <span key={i} className="font-bold text-signal">
                                                          {part}
                                                      </span>
                                                  ) : (
                                                      part
                                                  ),
                                              )}
                                              ”
                                          </>
                                      );
                                  })()
                                : `“${maskAnswer(card.example.en, card.word)}”`}
                        </p>
                        {card.example.vi && <p className="mt-1 text-sm text-muted">{card.example.vi}</p>}
                    </div>
                )}
            </div>

            <form onSubmit={onSubmit} className="border-t border-line p-5 sm:p-8">
                <motion.div
                    id="review-hint"
                    aria-live="polite"
                    animate={
                        reduceMotion
                            ? { x: 0, scale: 1 }
                            : answerState === 'wrong'
                              ? { x: [0, -8, 8, -5, 5, 0], scale: 1 }
                              : answerState === 'correct'
                                ? { x: 0, scale: [1, 1.025, 1] }
                                : { x: 0, scale: 1 }
                    }
                    transition={{ duration: answerState === 'wrong' ? 0.3 : 0.22 }}
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
                    ) : (
                        <p
                            aria-label="Gợi ý đáp án"
                            className="flex min-h-8 flex-wrap items-center justify-center gap-1 font-mono text-xl font-black"
                        >
                            {hintCharacters.map(({ char, hinted }, index) => (
                                <span
                                    key={`${char}-${index}`}
                                    className={
                                        hinted
                                            ? 'rounded bg-electric/20 px-1 text-electric'
                                            : char === '_'
                                              ? 'px-1 text-muted'
                                              : 'px-1 text-white'
                                    }
                                >
                                    {char === ' ' ? '\u00a0' : char}
                                </span>
                            ))}
                        </p>
                    )}
                </motion.div>

                <label htmlFor="review-answer" className="sr-only">
                    Nhập từ tiếng Anh
                </label>
                <input
                    ref={answerRef}
                    id="review-answer"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={Array.from(card.word).length}
                    value={answer}
                    readOnly={resolved}
                    onChange={(event) => onAnswerChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (!resolved && event.key === 'Tab') {
                            event.preventDefault();
                            onReveal();
                        }
                        if (!resolved && (event.code === 'Backquote' || event.key === '`')) {
                            event.preventDefault();
                            onHint();
                        }
                        if (!resolved && event.altKey && event.key.toLowerCase() === 'a') {
                            event.preventDefault();
                            onReveal();
                        }
                        if (resolved && event.key === 'Tab') event.preventDefault();
                        if (resolved && !isLast && event.key === 'Enter') {
                            event.preventDefault();
                            onNext();
                        }
                    }}
                    aria-invalid={answerState === 'wrong'}
                    aria-describedby="review-feedback review-hint"
                    className="sr-only"
                />

                {resolved && !isLast && (
                    <button
                        type="submit"
                        className="learn-primary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-bold lg:hidden"
                    >
                        Tiếp theo <ArrowRight size={16} aria-hidden="true" />
                    </button>
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
