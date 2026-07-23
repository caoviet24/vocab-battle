'use client';

import Image from 'next/image';
import { FormEvent, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
    AlertCircle,
    ArrowRight,
    AudioLines,
    Check,
    CheckCircle2,
    Clock3,
    Copy,
    Crown,
    Gamepad2,
    Lightbulb,
    LogOut,
    Medal,
    Radio,
    RotateCcw,
    Trophy,
    UserRound,
    Users,
    Zap,
} from 'lucide-react';
import { useGameService } from '@/hooks/useGameService';
import { useGameStore } from '@/stores/gameStore';
import type { Player } from '@/types/type';

const statusCopy = {
    LOBBY: 'Sảnh chờ',
    PLAYING: 'Đang thi đấu',
    FINISHED: 'Kết quả',
} as const;

function PlayerPortrait({
    player,
    avatarUrl,
    frameUrl,
    className,
}: {
    player: Player;
    avatarUrl?: string;
    frameUrl?: string;
    className: string;
}) {
    return (
        <span className={`relative grid shrink-0 place-items-center ${className}`}>
            <span className="grid size-[72%] place-items-center overflow-hidden rounded-full bg-white/[0.08]">
                {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt={`Avatar ${player.name}`} className="size-full object-cover" />
                ) : (
                    <UserRound size={16} className="text-muted" aria-hidden="true" />
                )}
            </span>
            {frameUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={frameUrl}
                    alt=""
                    className="pointer-events-none absolute inset-0 size-full max-w-none scale-125 object-contain"
                />
            )}
        </span>
    );
}

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const roomCode = code.toUpperCase();
    const reduceMotion = useReducedMotion();

    const answerInputRef = useRef<HTMLInputElement>(null);
    const phoneticsAudioRef = useRef<HTMLAudioElement | null>(null);
    const {
        myPlayerId,
        myAvatarUrl,
        myFrameUrl,
        players,
        currentQuestion,
        gameStatus,
        winnerInfo,
        isHost,
        error,
        setError,
        readyIds,
        iAmReady,
        answerInput,
        setAnswerInput,
        timeRemaining,
        setTimeRemaining,
        wrongAnswers,
        phoneticsData,
        lastTotalRounds,
    } = useGameStore();
    const [copied, setCopied] = useState(false);
    const {
        startGame,
        submitAnswer: sendAnswer,
        requestPhonetics,
        timeout,
        setReady,
        leaveRoom,
    } = useGameService(roomCode);

    const sortedPlayers = useMemo(() => [...players].sort((first, second) => second.score - first.score), [players]);
    const champion = sortedPlayers[0];
    const allReady = players.length >= 2 && readyIds.length === players.length;
    const playPhonetics = useCallback(() => {
        const audio = phoneticsAudioRef.current;
        if (!audio) return;
        audio.currentTime = 0;
        void audio.play().catch(() => undefined);
    }, []);

    useEffect(() => {
        if (gameStatus !== 'PLAYING' || !currentQuestion || winnerInfo) return;

        const interval = window.setInterval(() => {
            const remaining = useGameStore.getState().timeRemaining;
            if (remaining <= 1) {
                window.clearInterval(interval);
                if (isHost) timeout();
                setTimeRemaining(0);
                return;
            }
            setTimeRemaining(remaining - 1);
        }, 1000);

        return () => window.clearInterval(interval);
    }, [currentQuestion, gameStatus, winnerInfo, isHost, setTimeRemaining, timeout]);

    useEffect(() => {
        if (timeRemaining === 7 && gameStatus === 'PLAYING' && currentQuestion && !winnerInfo) {
            requestPhonetics();
        }
    }, [timeRemaining, gameStatus, currentQuestion, winnerInfo, requestPhonetics]);

    useEffect(() => {
        const audioUrl = phoneticsData?.[0]?.audio;
        if (!audioUrl) return;

        const audio = new Audio(audioUrl);
        phoneticsAudioRef.current = audio;
        playPhonetics();
        const replayPhonetics = (event: KeyboardEvent) => {
            if (event.key !== '`' || event.repeat) return;
            event.preventDefault();
            playPhonetics();
        };
        window.addEventListener('keydown', replayPhonetics);
        return () => {
            window.removeEventListener('keydown', replayPhonetics);
            audio.pause();
            phoneticsAudioRef.current = null;
        };
    }, [phoneticsData, playPhonetics]);

    useEffect(() => {
        if (currentQuestion && gameStatus === 'PLAYING' && !winnerInfo) {
            answerInputRef.current?.focus();
        }
    }, [currentQuestion, gameStatus, winnerInfo]);

    const submitAnswer = (event: FormEvent) => {
        event.preventDefault();
        if (!answerInput.trim() || winnerInfo) return;
        sendAnswer(answerInput);
        answerInputRef.current?.focus();
    };

    const copyRoomCode = async () => {
        try {
            await navigator.clipboard.writeText(roomCode);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            setError('Không thể sao chép mã phòng. Hãy sao chép thủ công.');
        }
    };

    const getLetterBoxes = () => {
        if (!currentQuestion?.word_length) return [];
        const pattern = Array.from(currentQuestion.hint_pattern || '_'.repeat(currentQuestion.word_length));
        const hintCount = pattern.filter((letter) => letter !== '_' && letter.trim()).length;
        const stage = timeRemaining > 15 ? 0 : Math.min(3, Math.floor((15 - timeRemaining) / 5) + 1);
        let visibleHints = Math.ceil((hintCount * stage) / 3);

        return pattern.map((letter) => {
            if (!letter.trim()) return letter;
            if (letter === '_' || visibleHints === 0) return '_';
            visibleHints--;
            return letter;
        });
    };

    return (
        <main id="main-content" className="room-v3 relative min-h-screen overflow-hidden pb-10 text-white">
            <div className="arena-grid pointer-events-none absolute inset-0" />
            <div className="pointer-events-none absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-electric/[0.07] blur-3xl" />
            <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-signal/[0.06] blur-3xl" />

            <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
                <section
                    aria-label="Trạng thái phòng"
                    className="room-v3__rail arena-panel mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 sm:px-5"
                >
                    <p className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-muted">
                        <Radio size={15} className="text-signal" aria-hidden="true" />
                        {statusCopy[gameStatus]}
                    </p>

                    <button
                        type="button"
                        onClick={copyRoomCode}
                        className="order-3 flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 font-mono text-sm font-black tracking-[0.14em] transition hover:border-electric/40 hover:bg-white/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric sm:order-none sm:flex-none"
                        aria-label={`Sao chép mã phòng ${roomCode}`}
                    >
                        <span className="text-muted">#</span> {roomCode}
                        {copied ? (
                            <Check size={15} className="text-signal" />
                        ) : (
                            <Copy size={15} className="text-muted" />
                        )}
                    </button>

                    <div className="flex items-center gap-2">
                        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-sm">
                            <Users size={17} className="text-electric" />
                            <span className="font-mono font-black">{players.length}</span>
                            <span className="hidden text-muted sm:inline">người</span>
                        </div>
                        <button
                            type="button"
                            onClick={leaveRoom}
                            className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-muted transition hover:border-danger/40 hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                            aria-label="Thoát khỏi phòng"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </section>

                <AnimatePresence>
                    {error && (
                        <motion.div
                            role="alert"
                            aria-live="assertive"
                            initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mb-5 flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-copy"
                        >
                            <AlertCircle size={19} className="mt-0.5 shrink-0" />
                            <span className="font-medium">{error}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    {gameStatus === 'LOBBY' && (
                        <motion.div
                            key="lobby"
                            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
                            className="room-v3__lobby grid gap-5 lg:grid-cols-[1.12fr_0.88fr]"
                        >
                            <section className="room-v3__lobby-stage arena-panel relative min-h-[470px] overflow-hidden rounded-[1.75rem] p-6 sm:p-9 lg:min-h-[600px]">
                                <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full border-[55px] border-signal/[0.055]" />
                                <div className="pointer-events-none absolute bottom-8 right-8 hidden grid-cols-4 gap-2 opacity-25 sm:grid">
                                    {Array.from({ length: 12 }).map((_, index) => (
                                        <span key={index} className="size-2 rounded-full bg-electric" />
                                    ))}
                                </div>

                                <div className="relative flex h-full flex-col">
                                    <span className="mb-9 inline-flex w-fit items-center gap-2 rounded-full border border-signal/25 bg-signal/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-signal">
                                        <span className="size-1.5 animate-pulse rounded-full bg-signal motion-reduce:animate-none" />
                                        Phòng đã sẵn sàng
                                    </span>

                                    <div className="max-w-xl">
                                        <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-electric">
                                            {isHost ? 'Bạn là chủ phòng' : 'Bạn đã vào phòng'}
                                        </p>
                                        <h1 className="text-balance text-4xl font-black leading-[0.94] tracking-[-0.045em] sm:text-6xl">
                                            TẬP HỢP ĐỦ ĐỘI.
                                            <span className="block text-signal">BẮT ĐẦU CUỘC ĐẤU.</span>
                                        </h1>
                                        <p className="mt-6 max-w-lg text-base leading-7 text-muted">
                                            Chia sẻ mã phòng cho bạn bè. Trận đấu có thể bắt đầu ngay khi có ít nhất hai
                                            chiến binh.
                                        </p>
                                    </div>

                                    <div className="mt-9 flex flex-wrap items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={copyRoomCode}
                                            className="flex min-h-14 items-center gap-3 rounded-xl border border-white/12 bg-white/[0.055] px-5 font-mono text-lg font-black tracking-[0.16em] transition hover:border-electric/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"
                                        >
                                            {roomCode}
                                            {copied ? (
                                                <Check size={18} className="text-signal" />
                                            ) : (
                                                <Copy size={18} className="text-muted" />
                                            )}
                                        </button>
                                        <p className="text-sm text-muted">Chạm để sao chép mã</p>
                                    </div>

                                    <div className="mt-auto pt-10">
                                        {isHost ? (
                                            <button
                                                type="button"
                                                onClick={startGame}
                                                disabled={players.length < 2}
                                                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-signal px-6 py-4 text-base font-black text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto sm:min-w-72"
                                            >
                                                {players.length < 2 ? (
                                                    <>
                                                        <Users size={19} /> Cần thêm một người chơi
                                                    </>
                                                ) : (
                                                    <>
                                                        <Zap size={19} /> Bắt đầu trận đấu
                                                    </>
                                                )}
                                            </button>
                                        ) : (
                                            <div className="flex max-w-md items-center gap-3 rounded-xl border border-electric/20 bg-electric/[0.07] px-4 py-4 text-sm text-muted">
                                                <span className="relative flex size-3 shrink-0">
                                                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-electric opacity-60 motion-reduce:animate-none" />
                                                    <span className="relative inline-flex size-3 rounded-full bg-electric" />
                                                </span>
                                                Đang chờ chủ phòng bắt đầu trận đấu…
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <aside
                                className="room-v3__roster arena-panel rounded-[1.75rem] p-5 sm:p-7"
                                aria-labelledby="player-list-title"
                            >
                                <div className="mb-6 flex items-center justify-between">
                                    <div>
                                        <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-electric">
                                            Roster
                                        </p>
                                        <h2 id="player-list-title" className="text-2xl font-black">
                                            Đội hình
                                        </h2>
                                    </div>
                                    <span className="grid size-11 place-items-center rounded-xl bg-electric/10 text-electric">
                                        <Users size={21} />
                                    </span>
                                </div>

                                <ul className="space-y-3" aria-live="polite">
                                    {players.map((player, index) => {
                                        const isMe = player.player_id === myPlayerId;
                                        return (
                                            <li
                                                key={player.player_id}
                                                className={`flex min-h-17 items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                                                    isMe
                                                        ? 'border-signal/30 bg-signal/[0.07]'
                                                        : 'border-white/8 bg-black/20'
                                                }`}
                                            >
                                                <span className="flex min-w-0 items-center gap-3">
                                                    <span
                                                        className={`grid size-10 shrink-0 place-items-center rounded-xl font-mono text-sm font-black ${isMe ? 'bg-signal text-black' : 'bg-white/8 text-muted'}`}
                                                    >
                                                        {String(index + 1).padStart(2, '0')}
                                                    </span>
                                                    <PlayerPortrait
                                                        player={player}
                                                        avatarUrl={isMe ? myAvatarUrl : undefined}
                                                        frameUrl={isMe ? myFrameUrl : player.frame_url}
                                                        className="size-16"
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="truncate font-bold text-white">
                                                                {player.name}
                                                            </span>
                                                            {isMe && isHost && (
                                                                <Crown
                                                                    size={15}
                                                                    className="shrink-0 text-signal"
                                                                    aria-label="Chủ phòng"
                                                                />
                                                            )}
                                                        </span>
                                                        <span className="text-xs text-muted">
                                                            {isMe ? 'Bạn' : 'Đã kết nối'}
                                                        </span>
                                                    </span>
                                                </span>
                                                <span className="flex items-center gap-2 text-xs font-bold text-signal">
                                                    <span className="size-2 rounded-full bg-signal" /> ONLINE
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>

                                {players.length === 0 && (
                                    <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-muted">
                                        Đang đồng bộ danh sách người chơi…
                                    </p>
                                )}
                            </aside>
                        </motion.div>
                    )}

                    {gameStatus === 'PLAYING' && currentQuestion && (
                        <motion.div
                            key="playing"
                            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
                            className="room-v3__play grid gap-5"
                        >
                            <section
                                className="room-v3__question arena-panel relative overflow-hidden rounded-[1.75rem]"
                                aria-labelledby="question-title"
                            >
                                <div className="h-1.5 bg-white/[0.06]">
                                    <div
                                        className={`h-full transition-[width] duration-1000 ease-linear ${
                                            timeRemaining <= 5
                                                ? 'bg-danger'
                                                : timeRemaining <= 15
                                                  ? 'bg-[#ffd166]'
                                                  : 'bg-signal'
                                        }`}
                                        style={{ width: `${(timeRemaining / 30) * 100}%` }}
                                    />
                                </div>

                                <div className="p-5 sm:p-8 lg:p-10">
                                    <div className="mb-7 flex items-center justify-between gap-3">
                                        <span className="rounded-full border border-electric/20 bg-electric/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-electric">
                                            Vòng {currentQuestion.round || 1}/
                                            {currentQuestion.total_rounds || lastTotalRounds || '—'}
                                        </span>
                                        <div
                                            className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 font-mono text-xl font-black sm:px-4 sm:text-2xl ${
                                                timeRemaining <= 5
                                                    ? 'border-danger/30 bg-danger/10 text-danger'
                                                    : 'border-white/10 bg-black/20 text-white'
                                            }`}
                                            aria-label={`Còn ${timeRemaining} giây`}
                                        >
                                            <Clock3 size={19} /> {timeRemaining}
                                            <span className="text-xs text-muted">s</span>
                                        </div>
                                    </div>

                                    <div className="mx-auto max-w-3xl text-center">
                                        <div className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                                            <Gamepad2 size={15} /> Giải mã từ vựng
                                        </div>
                                        <h1 id="question-title" className="sr-only">
                                            Câu hỏi vòng {currentQuestion.round || 1}
                                        </h1>

                                        {currentQuestion.image_url && (
                                            <div className="relative mx-auto mb-6 aspect-video max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                                                <Image
                                                    src={currentQuestion.image_url}
                                                    alt="Hình ảnh gợi ý cho từ vựng"
                                                    fill
                                                    unoptimized
                                                    sizes="(max-width: 768px) 90vw, 512px"
                                                    className="object-cover"
                                                />
                                            </div>
                                        )}

                                        <div className="mb-7 flex flex-wrap justify-center gap-1.5 sm:gap-2">
                                            {getLetterBoxes().map((letter, index) =>
                                                letter.trim() ? (
                                                    <motion.span
                                                        key={`${currentQuestion.card_id}-${index}`}
                                                        initial={
                                                            reduceMotion ? false : { opacity: 0, scale: 0.8, y: 6 }
                                                        }
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        transition={{
                                                            delay: reduceMotion ? 0 : Math.min(index * 0.035, 0.3),
                                                        }}
                                                        className={`grid size-10 place-items-center rounded-lg border font-mono text-lg font-black uppercase sm:size-13 sm:rounded-xl sm:text-2xl ${
                                                            letter === '_'
                                                                ? 'border-white/14 bg-white/[0.045] text-transparent'
                                                                : 'border-signal/50 bg-signal/10 text-signal'
                                                        }`}
                                                    >
                                                        {letter === '_' ? '•' : letter}
                                                    </motion.span>
                                                ) : (
                                                    <span
                                                        key={`${currentQuestion.card_id}-${index}`}
                                                        className="w-3 sm:w-5"
                                                        aria-hidden="true"
                                                    />
                                                ),
                                            )}
                                        </div>

                                        {timeRemaining <= 7 && phoneticsData?.[0] && (
                                            <motion.button
                                                type="button"
                                                initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                onClick={playPhonetics}
                                                aria-keyshortcuts="`"
                                                className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-electric/25 bg-electric/10 px-4 text-sm font-bold text-electric transition hover:bg-electric/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"
                                            >
                                                <AudioLines size={18} />
                                                Nghe lại{' '}
                                                <kbd className="rounded border border-current/30 px-1.5 font-mono">
                                                    `
                                                </kbd>
                                                {phoneticsData[0].text && (
                                                    <span className="font-mono text-white">
                                                        {phoneticsData[0].text}
                                                    </span>
                                                )}
                                            </motion.button>
                                        )}

                                        <div className="mb-5 grid gap-3 text-left sm:grid-cols-2">
                                            {currentQuestion.translation && (
                                                <div className="rounded-2xl border border-signal/15 bg-signal/[0.055] p-4 sm:col-span-2">
                                                    <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-signal">
                                                        Bản dịch
                                                    </p>
                                                    <div className="flex items-end justify-between gap-3">
                                                        <p className="text-lg font-bold text-white sm:text-xl">
                                                            {currentQuestion.translation}
                                                        </p>
                                                        <span className="rounded-md bg-black/25 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                                                            {currentQuestion.type || 'word'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {(currentQuestion.explanation?.vi || currentQuestion.explanation?.en) && (
                                                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                                                    <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-electric">
                                                        <Lightbulb size={14} /> Giải thích
                                                    </p>
                                                    {currentQuestion.explanation.vi && (
                                                        <p className="text-sm leading-6 text-white">
                                                            {currentQuestion.explanation.vi}
                                                        </p>
                                                    )}
                                                    {currentQuestion.explanation.en && (
                                                        <p className="mt-2 text-xs leading-5 text-muted">
                                                            {currentQuestion.explanation.en}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {(currentQuestion.example?.en || currentQuestion.example?.vi) && (
                                                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                                                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-electric">
                                                        Ví dụ
                                                    </p>
                                                    {currentQuestion.example.en && (
                                                        <p className="text-sm font-semibold leading-6 text-white">
                                                            “{currentQuestion.example.en}”
                                                        </p>
                                                    )}
                                                    {currentQuestion.example.vi && (
                                                        <p className="mt-2 text-xs leading-5 text-muted">
                                                            {currentQuestion.example.vi}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <form onSubmit={submitAnswer} className="flex flex-col gap-2 sm:flex-row">
                                            <label htmlFor="answer" className="sr-only">
                                                Đáp án của bạn
                                            </label>
                                            <input
                                                ref={answerInputRef}
                                                id="answer"
                                                type="text"
                                                value={answerInput}
                                                onChange={(event) => setAnswerInput(event.target.value)}
                                                disabled={Boolean(winnerInfo) || timeRemaining === 0}
                                                placeholder={timeRemaining === 0 ? 'Hết giờ!' : 'Nhập đáp án của bạn…'}
                                                className="arena-field min-h-14 flex-1 text-center text-lg font-bold sm:text-left"
                                                autoComplete="off"
                                            />
                                            <button
                                                type="submit"
                                                disabled={
                                                    !answerInput.trim() || Boolean(winnerInfo) || timeRemaining === 0
                                                }
                                                className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-signal px-6 font-black text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                                            >
                                                Chốt đáp án <ArrowRight size={18} />
                                            </button>
                                        </form>

                                        {wrongAnswers.length > 0 && (
                                            <div className="mt-4 rounded-2xl border border-danger/20 bg-danger/[0.06] p-3 text-left">
                                                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-danger-copy">
                                                    Đã thử
                                                </p>
                                                <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
                                                    {wrongAnswers.map((item, index) => (
                                                        <span
                                                            key={`${item.player_name}-${item.answer}-${index}`}
                                                            className="rounded-lg bg-black/25 px-2.5 py-1 text-xs text-danger-copy"
                                                        >
                                                            {item.player_name}: <strong>{item.answer}</strong>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {winnerInfo && (
                                        <motion.div
                                            role="status"
                                            aria-live="assertive"
                                            initial={reduceMotion ? false : { opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="absolute inset-0 z-20 grid place-items-center bg-background/95 p-5 text-center backdrop-blur-md"
                                        >
                                            <motion.div
                                                initial={reduceMotion ? false : { scale: 0.9, y: 12 }}
                                                animate={{ scale: 1, y: 0 }}
                                                className="max-w-lg"
                                            >
                                                <span
                                                    className={`mx-auto mb-5 grid size-20 place-items-center rounded-3xl ${winnerInfo.timeout ? 'bg-danger/10 text-danger' : 'bg-signal/10 text-signal'}`}
                                                >
                                                    {winnerInfo.timeout ? (
                                                        <Clock3 size={38} />
                                                    ) : (
                                                        <CheckCircle2 size={38} />
                                                    )}
                                                </span>
                                                <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-electric">
                                                    Kết thúc vòng
                                                </p>
                                                <h2 className="text-balance text-3xl font-black sm:text-5xl">
                                                    {winnerInfo.timeout
                                                        ? 'HẾT GIỜ!'
                                                        : winnerInfo.last_man
                                                          ? `${winnerInfo.winner_name} CHIẾN THẮNG!`
                                                          : `${winnerInfo.winner_name} ĐOÁN ĐÚNG!`}
                                                </h2>
                                                {winnerInfo.card?.word && (
                                                    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-4">
                                                        <p className="text-xs uppercase tracking-[0.14em] text-muted">
                                                            Đáp án
                                                        </p>
                                                        <p className="mt-1 font-mono text-2xl font-black uppercase tracking-[0.12em] text-signal">
                                                            {winnerInfo.card.word}
                                                        </p>
                                                    </div>
                                                )}
                                            </motion.div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </section>

                            <aside
                                className="room-v3__scoreboard arena-panel h-fit rounded-[1.75rem] p-5 lg:sticky lg:top-6"
                                aria-labelledby="scoreboard-title"
                            >
                                <div className="mb-5 flex items-center justify-between">
                                    <div>
                                        <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-electric">
                                            Live score
                                        </p>
                                        <h2 id="scoreboard-title" className="text-xl font-black">
                                            Bảng xếp hạng
                                        </h2>
                                    </div>
                                    <Trophy size={23} className="text-signal" />
                                </div>
                                <ol className="space-y-2" aria-live="polite">
                                    {sortedPlayers.map((player, index) => {
                                        const isMe = player.player_id === myPlayerId;
                                        return (
                                            <li
                                                key={player.player_id}
                                                className={`room-v3__score-row grid grid-cols-[2rem_4rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-3 py-2.5 ${
                                                    index === 0
                                                        ? 'border-signal/25 bg-signal/[0.07]'
                                                        : isMe
                                                          ? 'border-electric/25 bg-electric/[0.06]'
                                                          : 'border-white/8 bg-black/20'
                                                }`}
                                            >
                                                <span
                                                    className={`grid size-8 place-items-center rounded-lg font-mono text-xs font-black ${index === 0 ? 'bg-signal text-black' : 'bg-white/8 text-muted'}`}
                                                >
                                                    {index + 1}
                                                </span>
                                                <PlayerPortrait
                                                    player={player}
                                                    avatarUrl={isMe ? myAvatarUrl : undefined}
                                                    frameUrl={isMe ? myFrameUrl : player.frame_url}
                                                    className="size-18"
                                                />
                                                <span className="min-w-0 truncate text-sm font-bold">
                                                    {player.name}
                                                    {isMe && <span className="text-electric"> · Bạn</span>}
                                                </span>
                                                <span className="room-v3__score-points font-mono text-lg font-black text-white">
                                                    <strong>{player.score}</strong>
                                                    <span className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                                                        điểm
                                                    </span>
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </aside>
                        </motion.div>
                    )}

                    {gameStatus === 'FINISHED' && (
                        <motion.div
                            key="finished"
                            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
                            className="room-v3__finish grid gap-5 lg:grid-cols-[0.85fr_1.15fr]"
                        >
                            <section className="room-v3__finish-champion arena-panel relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
                                <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full border-[48px] border-signal/[0.055]" />
                                <div className="relative">
                                    <span className="mb-8 grid size-16 place-items-center rounded-2xl bg-signal text-black shadow-[0_0_35px_rgba(223,255,98,0.16)]">
                                        <Trophy size={31} />
                                    </span>
                                    <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-signal">
                                        Trận đấu hoàn tất
                                    </p>
                                    <h1 className="text-balance text-4xl font-black leading-[0.95] tracking-[-0.04em] sm:text-5xl">
                                        NHÀ VÔ ĐỊCH
                                        <br />
                                        <span className="text-signal">{champion?.name || '—'}</span>
                                    </h1>
                                    <p className="mt-5 max-w-md text-sm leading-6 text-muted">
                                        Một trận đấu đã khép lại. Cả đội có thể sẵn sàng để tái đấu ngay trong phòng
                                        này.
                                    </p>

                                    <div className="mt-8 grid grid-cols-3 gap-2">
                                        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                                            <p className="font-mono text-2xl font-black">{champion?.score || 0}</p>
                                            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted">
                                                Điểm cao
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                                            <p className="font-mono text-2xl font-black">{lastTotalRounds}</p>
                                            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted">
                                                Câu hỏi
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                                            <p className="font-mono text-2xl font-black">{players.length}</p>
                                            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted">
                                                Người chơi
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-8 space-y-3">
                                        <button
                                            type="button"
                                            onClick={setReady}
                                            disabled={iAmReady}
                                            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-signal px-5 font-black text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-signal/20 disabled:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                                        >
                                            <CheckCircle2 size={19} />
                                            {iAmReady ? 'Bạn đã sẵn sàng' : 'Sẵn sàng tái đấu'}
                                        </button>

                                        {isHost && allReady && (
                                            <button
                                                type="button"
                                                onClick={startGame}
                                                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-electric px-5 font-black text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"
                                            >
                                                <RotateCcw size={19} /> Bắt đầu tái đấu
                                            </button>
                                        )}

                                        {isHost && !allReady && (
                                            <p className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-center text-sm text-muted">
                                                Đang chờ mọi người sẵn sàng ({readyIds.length}/{players.length})
                                            </p>
                                        )}

                                        {!isHost && allReady && (
                                            <p className="rounded-xl border border-electric/20 bg-electric/[0.06] px-4 py-3 text-center text-sm text-muted">
                                                Tất cả đã sẵn sàng · Chờ chủ phòng bắt đầu
                                            </p>
                                        )}

                                        <button
                                            type="button"
                                            onClick={leaveRoom}
                                            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] font-bold text-muted transition hover:border-danger/30 hover:bg-danger/[0.07] hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                                        >
                                            <LogOut size={18} /> Rời phòng
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <section
                                className="room-v3__finish-ranking arena-panel rounded-[1.75rem] p-5 sm:p-7"
                                aria-labelledby="final-ranking-title"
                            >
                                <div className="mb-6 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="mb-1 text-xs font-black uppercase tracking-[0.16em] text-electric">
                                            Final standing
                                        </p>
                                        <h2 id="final-ranking-title" className="text-2xl font-black">
                                            Bảng thành tích
                                        </h2>
                                    </div>
                                    <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-muted">
                                        Ready {readyIds.length}/{players.length}
                                    </span>
                                </div>

                                <ol className="space-y-3">
                                    {sortedPlayers.map((player, index) => {
                                        const ready = readyIds.includes(player.player_id);
                                        const isMe = player.player_id === myPlayerId;
                                        return (
                                            <li
                                                key={player.player_id}
                                                className={`flex min-h-20 items-center justify-between gap-4 rounded-2xl border px-4 py-3 ${
                                                    index === 0
                                                        ? 'border-signal/30 bg-signal/[0.07]'
                                                        : 'border-white/8 bg-black/20'
                                                }`}
                                            >
                                                <span className="flex min-w-0 items-center gap-3">
                                                    <span
                                                        className={`grid size-11 shrink-0 place-items-center rounded-xl ${index === 0 ? 'bg-signal text-black' : 'bg-white/8 text-muted'}`}
                                                    >
                                                        {index === 0 ? (
                                                            <Medal size={21} />
                                                        ) : (
                                                            <span className="font-mono font-black">{index + 1}</span>
                                                        )}
                                                    </span>
                                                    <PlayerPortrait
                                                        player={player}
                                                        avatarUrl={isMe ? myAvatarUrl : undefined}
                                                        frameUrl={isMe ? myFrameUrl : player.frame_url}
                                                        className="size-16"
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="block truncate font-bold text-white">
                                                            {player.name}
                                                            {isMe && <span className="text-electric"> · Bạn</span>}
                                                        </span>
                                                        <span
                                                            className={`mt-1 flex items-center gap-1.5 text-xs ${ready ? 'text-signal' : 'text-muted'}`}
                                                        >
                                                            {ready ? (
                                                                <CheckCircle2 size={13} />
                                                            ) : (
                                                                <span className="size-2 rounded-full border border-muted" />
                                                            )}
                                                            {ready ? 'Sẵn sàng tái đấu' : 'Đang nghỉ'}
                                                        </span>
                                                    </span>
                                                </span>
                                                <span className="text-right">
                                                    <span className="block font-mono text-2xl font-black">
                                                        {player.score}
                                                    </span>
                                                    <span className="text-[10px] uppercase tracking-[0.12em] text-muted">
                                                        điểm
                                                    </span>
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </section>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}
