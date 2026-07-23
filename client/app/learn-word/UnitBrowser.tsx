import { ArrowLeft, Check, ChevronRight, ListTree } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import UnitStudy from './UnitStudy';
import { UnitProgress, WORDS_PER_UNIT } from './common';

export default function UnitBrowser({
    category,
    total,
    progress,
    onBack,
    onComplete,
    onReset,
    reduceMotion,
}: {
    category: { id: string; name: string; description: string };
    total: number;
    progress: Record<number, UnitProgress>;
    onBack: () => void;
    onComplete: (categoryId: string, unit: number, learned: number, total: number, learnedIds?: string[]) => void;
    onReset: (categoryId: string, unit: number) => void;
    reduceMotion: boolean | null;
}) {
    const unitCount = Math.max(1, Math.ceil(total / WORDS_PER_UNIT));
    const units = Array.from({ length: unitCount }, (_, index) => index + 1);
    const firstOpenUnit = units.find((unit) => !progress[unit]?.completed) ?? 1;
    const [selectedUnit, setSelectedUnit] = useState(firstOpenUnit);
    const [session, setSession] = useState(0);
    const learnedAll = Math.min(total, Object.values(progress).reduce((sum, unit) => sum + unit.learned, 0));
    const pct = total > 0 ? Math.round((learnedAll / total) * 100) : 0;
    const unitSize = (unit: number) => Math.max(0, Math.min(WORDS_PER_UNIT, total - (unit - 1) * WORDS_PER_UNIT));
    const openUnit = (unit: number) => {
        setSelectedUnit(unit);
        setSession((value) => value + 1);
    };

    return (
        <div className="learn-v2__workspace flex min-h-0 flex-1 flex-col overflow-hidden">
            <header className="learn-v2__workspace-head">
                <button type="button" onClick={onBack} className="learn-v2__back">
                    <ArrowLeft size={17} aria-hidden="true" /> Đổi bộ từ
                </button>
                <div className="min-w-0 flex-1">
                    <p className="learn-v2__category-name">{category.name}</p>
                    <h1 className="font-display text-2xl font-extrabold tracking-[-0.035em] text-foreground sm:text-3xl">
                        Unit {selectedUnit}
                    </h1>
                </div>
                <dl className="learn-v2__workspace-total" aria-label="Tiến độ của bộ từ">
                    <div>
                        <dt>Đã học</dt>
                        <dd>{learnedAll}/{total} từ</dd>
                    </div>
                    <div className="learn-v2__ring" style={{ '--progress': `${pct}%` } as React.CSSProperties}>
                        <span>{pct}%</span>
                    </div>
                </dl>
            </header>

            <label className="learn-v2__unit-select lg:hidden">
                Chọn Unit
                <select value={selectedUnit} onChange={(event) => openUnit(Number(event.target.value))} className="arena-field mt-2">
                    {units.map((unit) => (
                        <option key={unit} value={unit}>
                            Unit {unit} · {progress[unit]?.learned ?? 0}/{unitSize(unit)} từ
                        </option>
                    ))}
                </select>
            </label>

            <div className="learn-v2__workspace-body">
                <aside className="learn-v2__unit-queue hidden lg:flex">
                    <div className="learn-v2__queue-head">
                        <div>
                            <p>Hàng đợi học</p>
                            <strong>{unitCount} Unit</strong>
                        </div>
                        <ListTree size={19} aria-hidden="true" />
                    </div>
                    <div className="learn-v2__unit-scroll">
                        {units.map((unit, index) => {
                            const unitProgress = progress[unit];
                            const completed = unitProgress?.completed ?? false;
                            const size = unitSize(unit);
                            const learned = Math.min(unitProgress?.learned ?? 0, size);
                            const unitPct = size ? Math.round((learned / size) * 100) : 0;
                            const status = completed ? 'Đã xong' : learned > 0 ? 'Đang học' : 'Chưa học';
                            return (
                                <motion.button
                                    key={unit}
                                    type="button"
                                    onClick={() => openUnit(unit)}
                                    aria-pressed={selectedUnit === unit}
                                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.2) }}
                                    className="learn-v2__unit-row"
                                >
                                    <span className="learn-v2__unit-number">{unit}</span>
                                    <span className="min-w-0 flex-1 text-left">
                                        <span className="block font-semibold text-foreground">Unit {unit}</span>
                                        <span className="mt-0.5 block text-xs text-muted">{learned}/{size} từ · {status}</span>
                                    </span>
                                    {completed ? (
                                        <span className="learn-v2__unit-done"><Check size={14} strokeWidth={3} aria-hidden="true" /></span>
                                    ) : (
                                        <span className="text-xs font-bold tabular-nums text-electric">{unitPct}%</span>
                                    )}
                                    <ChevronRight size={15} aria-hidden="true" className="learn-v2__unit-arrow" />
                                </motion.button>
                            );
                        })}
                    </div>
                </aside>

                <section className="learn-v2__study-stage">
                    <UnitStudy
                        key={`${selectedUnit}-${session}`}
                        categoryId={category.id}
                        unit={selectedUnit}
                        savedLearned={progress[selectedUnit]?.learned ?? 0}
                        savedLearnedIds={progress[selectedUnit]?.learnedIds ?? []}
                        onComplete={onComplete}
                        onReset={() => {
                            onReset(category.id, selectedUnit);
                            setSession((value) => value + 1);
                        }}
                        onNextUnit={selectedUnit < unitCount ? () => openUnit(selectedUnit + 1) : undefined}
                        reduceMotion={reduceMotion}
                    />
                </section>
            </div>
        </div>
    );
}
