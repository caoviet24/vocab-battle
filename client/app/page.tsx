'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
    ArrowLeft,
    ArrowRight,
    Crown,
    Hash,
    LockKeyhole,
    Sparkles,
    Swords,
    UserRound,
    Users,
    X,
} from 'lucide-react';
import { useCategoryService } from '@/hooks/useCategoryService';
import { useRoomService } from '@/hooks/useRoomService';
import { api } from '@/services/api';
import { useGameStore } from '@/stores/gameStore';
import type { CategoryOption, Frame, HomeMode } from '@/types/type';
import WelcomeMascot from '@/components/WelcomeMascot';

const defaultCategories: CategoryOption[] = [
    { id: 'random', name: 'Random', description: 'Ngẫu nhiên · Toàn bộ kho từ' },
];

export default function Home() {
    const router = useRouter();
    const reduceMotion = useReducedMotion();
    const setMyInfo = useGameStore((state) => state.setMyInfo);
    const setMyProfile = useGameStore((state) => state.setMyProfile);
    const savedAvatarUrl = useGameStore((state) => state.myAvatarUrl);
    const savedFrameUrl = useGameStore((state) => state.myFrameUrl);

    const { categories: categoryData } = useCategoryService();
    const { rooms } = useRoomService(true);
    const categories = [
        ...defaultCategories,
        ...categoryData.map((item) => ({
            id: item.category_id,
            name: item.name,
            description: item.description,
        })),
    ];

    const [mode, setMode] = useState<HomeMode>('join');
    const [nameInput, setNameInput] = useState('');
    const [roomInput, setRoomInput] = useState('');
    const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
    const [passwordPromptInput, setPasswordPromptInput] = useState('');
    const [pendingRoomCode, setPendingRoomCode] = useState('');

    const [customRoomCode, setCustomRoomCode] = useState('');
    const [category, setCategory] = useState('random');
    const [totalQuestions, setTotalQuestions] = useState(10);
    const [password, setPassword] = useState('');
    const [homeError, setHomeError] = useState('');
    const [profileOpen, setProfileOpen] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(savedAvatarUrl);
    const [frames, setFrames] = useState<Frame[]>([]);
    const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
    const [framesLoading, setFramesLoading] = useState(true);
    const [profileError, setProfileError] = useState('');

    useEffect(() => {
        let active = true;
        api.get<Frame[]>('/frames')
            .then(({ data }) => {
                if (!active) return;
                setFrames(data);
                setSelectedFrame((current) => current ?? data.find((frame) => frame.url === savedFrameUrl) ?? data[0] ?? null);
            })
            .catch(() => {
                if (active) setProfileError('Không tải được danh sách frame.');
            })
            .finally(() => {
                if (active) setFramesLoading(false);
            });
        return () => {
            active = false;
        };
    }, [savedFrameUrl]);

    const selectAvatar = (file?: File) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setProfileError('Hãy chọn một tệp ảnh.');
            return;
        }
        setProfileError('');
        setAvatarUrl(URL.createObjectURL(file));
    };

    const preparePlayer = () => {
        const displayName = nameInput.trim();
        if (!displayName) {
            setHomeError('Hãy nhập tên hiển thị trước khi vào đấu trường.');
            return false;
        }

        const currentId = useGameStore.getState().myPlayerId;
        const playerId = currentId || Math.random().toString(36).slice(2, 10).padEnd(8, '0');
        setMyInfo(playerId, displayName);
        return true;
    };

    const enterRoom = (code: string, roomPassword: string) => {
        useGameStore.getState().resetRoom();
        sessionStorage.setItem(`pending_password_${code}`, roomPassword);
        sessionStorage.setItem(`pending_isHost_${code}`, '0');
        router.push(`/room/${code}`);
    };

    const handleJoinRoom = (event: FormEvent) => {
        event.preventDefault();
        setHomeError('');

        if (!preparePlayer()) return;

        const code = roomInput.trim().toUpperCase();
        if (!code) {
            setHomeError('Nhập mã phòng bạn muốn tham gia.');
            return;
        }

        const targetRoom = rooms.find((room) => room.code === code);
        if (!targetRoom) {
            setHomeError(`Không tìm thấy phòng ${code}.`);
            return;
        }

        if (targetRoom.status !== 'LOBBY') {
            setHomeError(`Phòng ${code} đang thi đấu. Hãy chờ trận tiếp theo.`);
            return;
        }

        if (targetRoom.has_password) {
            setPendingRoomCode(code);
            setPasswordPromptInput('');
            setPasswordPromptOpen(true);
            return;
        }

        enterRoom(code, '');
    };

    const submitJoinWithPassword = (event: FormEvent) => {
        event.preventDefault();
        enterRoom(pendingRoomCode, passwordPromptInput);
    };

    const handleCreateRoom = (event: FormEvent) => {
        event.preventDefault();
        setHomeError('');

        if (!preparePlayer()) return;

        const finalRoomCode = customRoomCode.trim().toUpperCase();
        if (!finalRoomCode) {
            setHomeError('Hãy đặt một mã phòng dễ nhớ.');
            return;
        }

        if (rooms.some((room) => room.code === finalRoomCode)) {
            setHomeError(`Mã phòng ${finalRoomCode} đã được sử dụng.`);
            return;
        }

        sessionStorage.setItem(`room_config_${finalRoomCode}`, JSON.stringify({ category, totalQuestions, password }));
        sessionStorage.setItem(`pending_password_${finalRoomCode}`, password);
        sessionStorage.setItem(`pending_isHost_${finalRoomCode}`, '1');
        useGameStore.getState().resetRoom();
        router.push(`/room/${finalRoomCode}`);
    };

    const selectMode = (nextMode: HomeMode) => {
        setMode(nextMode);
        setPasswordPromptOpen(false);
        setHomeError('');
    };

    return (
        <main id="main-content" className="relative min-h-screen overflow-hidden">
            <a
                href="#battle-control"
                className="sr-only z-50 rounded-lg bg-signal px-4 py-2 font-semibold text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
            >
                Đi tới bảng điều khiển
            </a>

            <div className="arena-grid pointer-events-none absolute inset-0" />
            <div className="pointer-events-none absolute -left-24 top-32 h-72 w-72 rounded-full bg-electric/10 blur-3xl" />
            <div className="pointer-events-none absolute -right-28 bottom-10 h-80 w-80 rounded-full bg-signal/10 blur-3xl" />

            <section className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16 lg:px-8 lg:pb-20 lg:pt-20">
                <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55 }}
                    className="max-w-2xl"
                >
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-electric/25 bg-electric/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-electric">
                        <Sparkles size={17} className="text-electric" />
                        <p>Vào trận tức thì</p>
                    </div>

                    <aside className="relative mt-8 min-h-48 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5 sm:min-h-52 sm:p-6">
                        <div className="pointer-events-none absolute -left-10 -top-12 size-40 rounded-full bg-electric/15 blur-3xl" />
                        <div className="relative max-w-[13rem]">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-electric">Chào tân binh</p>
                            <p className="mt-2 text-lg font-black leading-tight text-white sm:text-xl">
                                Chọn phòng, rồi để phản xạ dẫn đường.
                            </p>
                            <p className="mt-2 text-sm leading-6 text-muted">
                                Linh vật đã giữ sẵn một chỗ cho bạn trong đấu trường.
                            </p>
                        </div>
                        <WelcomeMascot
                            size={260}
                            className="pointer-events-none absolute -bottom-8 -right-8 w-[min(58%,16.25rem)] sm:-bottom-10 sm:-right-5"
                        />
                    </aside>

                    <div className="mt-9 grid max-w-xl grid-cols-3 gap-3">
                        {[
                            ['30s', 'mỗi vòng'],
                            ['50', 'câu tối đa'],
                            ['Live', 'bảng điểm'],
                        ].map(([value, label]) => (
                            <div
                                key={label}
                                className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-4 sm:px-5"
                            >
                                <p className="font-mono text-lg font-black text-white sm:text-2xl">{value}</p>
                                <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-muted sm:text-xs">
                                    {label}
                                </p>
                            </div>
                        ))}
                    </div>
                </motion.div>

                <motion.section
                    id="battle-control"
                    aria-labelledby="control-title"
                    initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, delay: 0.08 }}
                    className="arena-panel overflow-hidden rounded-[1.75rem]"
                >
                    <div className="border-b border-white/10 px-5 pt-5 sm:px-7 sm:pt-7">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-electric">
                                    Battle control
                                </p>
                                <h2 id="control-title" className="text-2xl font-black text-white">
                                    Sẵn sàng vào trận?
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setProfileOpen(true)}
                                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-2.5 text-sm font-bold text-white transition hover:border-electric/50 hover:bg-electric/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"
                                aria-haspopup="dialog"
                                aria-expanded={profileOpen}
                            >
                                <span className="relative grid size-7 place-items-center overflow-hidden rounded-full bg-black/20">
                                    {avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={avatarUrl} alt="" className="size-full object-cover" />
                                    ) : (
                                        <UserRound size={16} className="text-muted" aria-hidden="true" />
                                    )}
                                    {selectedFrame && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={selectedFrame.url} alt="" className="pointer-events-none absolute inset-0 size-full object-contain" />
                                    )}
                                </span>
                                <span className="hidden max-w-28 text-left leading-tight sm:block">
                                    <span className="block truncate text-xs font-black">{nameInput.trim() || 'Profile'}</span>
                                    <span className="block truncate text-[10px] font-medium text-muted">{selectedFrame?.name ?? 'Chọn frame'}</span>
                                </span>
                                <UserRound size={16} className="text-signal sm:hidden" aria-hidden="true" />
                            </button>
                        </div>

                        <div
                            className="grid grid-cols-2 rounded-xl bg-black/25 p-1"
                            role="tablist"
                            aria-label="Chọn cách bắt đầu"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mode === 'join'}
                                onClick={() => selectMode('join')}
                                className={`min-h-11 rounded-lg px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric ${
                                    mode === 'join' ? 'bg-white text-black shadow-sm' : 'text-muted hover:text-white'
                                }`}
                            >
                                Tham gia
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mode === 'create'}
                                onClick={() => selectMode('create')}
                                className={`min-h-11 rounded-lg px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric ${
                                    mode === 'create' ? 'bg-white text-black shadow-sm' : 'text-muted hover:text-white'
                                }`}
                            >
                                Tạo phòng
                            </button>
                        </div>
                    </div>

                    <div className="p-5 sm:p-7">


                        <AnimatePresence mode="wait" initial={false}>
                            {mode === 'join' ? (
                                <motion.div
                                    key={passwordPromptOpen ? 'password' : 'join'}
                                    initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={reduceMotion ? undefined : { opacity: 0, x: 8 }}
                                    transition={{ duration: 0.18 }}
                                >
                                    {passwordPromptOpen ? (
                                        <form onSubmit={submitJoinWithPassword}>
                                            <button
                                                type="button"
                                                onClick={() => setPasswordPromptOpen(false)}
                                                className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg pr-3 text-sm font-semibold text-muted hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"
                                            >
                                                <ArrowLeft size={17} /> Quay lại
                                            </button>
                                            <div className="mb-5 rounded-2xl border border-signal/20 bg-signal/[0.07] p-4">
                                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-signal">
                                                    Phòng được bảo vệ
                                                </p>
                                                <p className="mt-1 text-sm text-muted">
                                                    Nhập mật khẩu để tham gia phòng{' '}
                                                    <strong className="font-mono text-white">{pendingRoomCode}</strong>.
                                                </p>
                                            </div>
                                            <label
                                                htmlFor="join-password"
                                                className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-muted"
                                            >
                                                Mật khẩu
                                            </label>
                                            <div className="relative">
                                                <LockKeyhole
                                                    size={18}
                                                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                                                />
                                                <input
                                                    id="join-password"
                                                    type="password"
                                                    value={passwordPromptInput}
                                                    onChange={(event) => setPasswordPromptInput(event.target.value)}
                                                    className="arena-field pl-12"
                                                    placeholder="Nhập mật khẩu phòng"
                                                    autoFocus
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-signal px-5 py-3.5 font-black text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                            >
                                                Vào phòng <ArrowRight size={19} />
                                            </button>
                                        </form>
                                    ) : (
                                        <form onSubmit={handleJoinRoom}>
                                            <label
                                                htmlFor="join-code"
                                                className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-muted"
                                            >
                                                Mã phòng
                                            </label>
                                            <div className="relative">
                                                <Hash
                                                    size={18}
                                                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                                                />
                                                <input
                                                    id="join-code"
                                                    value={roomInput}
                                                    onChange={(event) => setRoomInput(event.target.value.toUpperCase())}
                                                    className="arena-field pl-12 font-mono font-bold uppercase tracking-[0.12em]"
                                                    placeholder="VD: BATTLE01"
                                                    maxLength={16}
                                                    required
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-signal px-5 py-3.5 font-black text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                            >
                                                Vào đấu trường <ArrowRight size={19} />
                                            </button>
                                        </form>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.form
                                    key="create"
                                    onSubmit={handleCreateRoom}
                                    initial={reduceMotion ? false : { opacity: 0, x: 8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={reduceMotion ? undefined : { opacity: 0, x: -8 }}
                                    transition={{ duration: 0.18 }}
                                    className="space-y-5"
                                >
                                    <div>
                                        <label
                                            htmlFor="create-code"
                                            className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-muted"
                                        >
                                            Mã phòng mới
                                        </label>
                                        <div className="relative">
                                            <Hash
                                                size={18}
                                                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                                            />
                                            <input
                                                id="create-code"
                                                value={customRoomCode}
                                                onChange={(event) =>
                                                    setCustomRoomCode(event.target.value.toUpperCase())
                                                }
                                                className="arena-field pl-12 font-mono font-bold uppercase tracking-[0.12em]"
                                                placeholder="Tạo mã dễ nhớ"
                                                maxLength={16}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="category"
                                            className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-muted"
                                        >
                                            Bộ từ vựng
                                        </label>
                                        <select
                                            id="category"
                                            value={category}
                                            onChange={(event) => setCategory(event.target.value)}
                                            className="arena-field appearance-none"
                                        >
                                            {categories.map((item) => (
                                                <option key={item.id} value={item.id} className="bg-surface">
                                                    {item.description}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="question-count"
                                            className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-muted"
                                        >
                                            Số câu hỏi
                                        </label>
                                        <input
                                            id="question-count"
                                            type="number"
                                            inputMode="numeric"
                                            min="1"
                                            max="50"
                                            value={totalQuestions}
                                            onChange={(event) => setTotalQuestions(Number(event.target.value))}
                                            className="arena-field font-mono font-black"
                                            required
                                        />
                                        <p className="mt-1.5 text-xs text-muted">Từ 1 đến 50 câu mỗi trận.</p>
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="create-password"
                                            className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-muted"
                                        >
                                            Mật khẩu{' '}
                                            <span className="font-normal normal-case text-muted">(tùy chọn)</span>
                                        </label>
                                        <div className="relative">
                                            <LockKeyhole
                                                size={18}
                                                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                                            />
                                            <input
                                                id="create-password"
                                                type="password"
                                                value={password}
                                                onChange={(event) => setPassword(event.target.value)}
                                                className="arena-field pl-12"
                                                placeholder="Để trống nếu là phòng công khai"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-electric px-5 py-3.5 font-black text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                    >
                                        Tạo phòng <Crown size={19} />
                                    </button>
                                </motion.form>
                            )}
                        </AnimatePresence>

                        <AnimatePresence>
                            {homeError && (
                                <motion.p
                                    role="alert"
                                    initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger-copy"
                                >
                                    {homeError}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.section>
            </section>

            <section
                aria-labelledby="active-rooms-title"
                className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8"
            >
                <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-electric">Live now</p>
                        <h2 id="active-rooms-title" className="text-2xl font-black text-white">
                            Phòng đang hoạt động
                        </h2>
                    </div>
                </div>

                {rooms.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {rooms.map((room) => {
                            const isLobby = room.status === 'LOBBY';
                            return (
                                <button
                                    key={room.code}
                                    type="button"
                                    disabled={!isLobby}
                                    onClick={() => {
                                        selectMode('join');
                                        setRoomInput(room.code);
                                        document.getElementById('battle-control')?.scrollIntoView({
                                            behavior: reduceMotion ? 'auto' : 'smooth',
                                            block: 'center',
                                        });
                                    }}
                                    className="group arena-panel flex min-h-28 items-center justify-between rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:border-signal/30 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"
                                >
                                    <span>
                                        <span className="mb-2 flex items-center gap-2">
                                            <span className="font-mono text-lg font-black tracking-[0.12em] text-white">
                                                {room.code}
                                            </span>
                                            {room.has_password && (
                                                <LockKeyhole
                                                    size={14}
                                                    className="text-muted"
                                                    aria-label="Có mật khẩu"
                                                />
                                            )}
                                        </span>
                                        <span className="flex items-center gap-2 text-sm text-muted">
                                            <Users size={15} /> {room.player_count} người chơi
                                        </span>
                                    </span>
                                    <span
                                        className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] ${
                                            isLobby ? 'bg-signal/10 text-signal' : 'bg-electric/10 text-electric'
                                        }`}
                                    >
                                        {isLobby ? 'Đang chờ' : 'Đang đấu'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="arena-panel flex min-h-36 flex-col items-center justify-center rounded-2xl px-5 text-center">
                        <Swords size={26} className="mb-3 text-muted" aria-hidden="true" />
                        <p className="font-semibold text-white">Chưa có phòng nào mở</p>
                        <p className="mt-1 text-sm text-muted">Hãy là người khởi động trận đầu tiên.</p>
                    </div>
                )}
            </section>

            <AnimatePresence>
                {profileOpen && (
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="profile-title"
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
                    >
                        <motion.section
                            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 12, scale: 0.98 }}
                            className="arena-panel w-full max-w-md rounded-2xl p-5 sm:p-6"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-electric">Profile</p>
                                    <h2 id="profile-title" className="mt-1 text-xl font-black text-white">Chọn diện mạo</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setProfileOpen(false)}
                                    className="grid size-11 place-items-center rounded-xl border border-white/10 text-muted hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric"
                                    aria-label="Đóng chọn profile"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="mt-6 flex items-center gap-4 rounded-2xl bg-black/25 p-4">
                                <div className="relative grid size-32 shrink-0 place-items-center">
                                    <div className="grid size-20 place-items-center overflow-hidden rounded-full bg-black/20">
                                    {avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={avatarUrl} alt="Avatar đã chọn" className="size-full object-cover" />
                                    ) : (
                                        <UserRound size={30} className="text-muted" aria-hidden="true" />
                                    )}
                                    </div>
                                    {selectedFrame && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={selectedFrame.url} alt="" className="pointer-events-none absolute inset-0 size-full max-w-none scale-125 object-contain" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-black text-white">{nameInput.trim() || 'Chưa đặt tên'}</p>
                                    <p className="mt-1 text-sm text-muted">{selectedFrame ? `Khung ${selectedFrame.name}` : 'Chưa chọn frame'}</p>
                                </div>
                            </div>

                            <div className="mt-6">
                                <label htmlFor="profile-name" className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Tên hiển thị</label>
                                <input
                                    id="profile-name"
                                    value={nameInput}
                                    onChange={(event) => setNameInput(event.target.value)}
                                    className="arena-field mt-2"
                                    placeholder="Ví dụ: FrogMaster"
                                    maxLength={24}
                                    autoComplete="nickname"
                                />
                            </div>

                            <fieldset className="mt-6">
                                <legend className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Avatar</legend>
                                <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-electric/40 bg-electric/5 px-4 text-sm font-bold text-electric hover:bg-electric/10">
                                    Chọn ảnh từ máy
                                    <input type="file" accept="image/*" className="sr-only" onChange={(event) => { selectAvatar(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                                </label>
                                <p className="mt-2 text-xs text-muted">Chỉ tạo URL tạm trong trình duyệt, không tải ảnh lên R2.</p>
                            </fieldset>

                            <fieldset className="mt-6">
                                <legend className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Frame</legend>
                                {framesLoading ? (
                                    <div className="mt-3 h-20 animate-pulse rounded-xl bg-white/[0.035]" />
                                ) : frames.length ? (
                                    <div className="mt-3 grid grid-cols-3 gap-3">
                                    {frames.map((option) => (
                                        <button
                                            key={option.frame_id}
                                            type="button"
                                            onClick={() => setSelectedFrame(option)}
                                            className={`overflow-hidden rounded-xl border p-1.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric ${
                                                selectedFrame?.frame_id === option.frame_id ? 'border-electric bg-electric/15' : 'border-white/10 hover:border-white/30'
                                            }`}
                                            aria-pressed={selectedFrame?.frame_id === option.frame_id}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={option.url} alt={option.name} className="aspect-square w-full object-contain" />
                                        </button>
                                    ))}
                                    </div>
                                ) : (
                                    <p className="mt-3 text-sm text-muted">Chưa có frame nào.</p>
                                )}
                            </fieldset>

                            {profileError && <p role="alert" className="mt-4 text-sm text-danger-copy">{profileError}</p>}

                            <button
                                type="button"
                                onClick={() => {
                                    setMyProfile(avatarUrl, selectedFrame?.url ?? '');
                                    setProfileOpen(false);
                                }}
                                className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl bg-signal px-5 font-black text-black transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                            >
                                Dùng profile này
                            </button>
                        </motion.section>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
