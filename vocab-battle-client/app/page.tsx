"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Crown,
  Gamepad2,
  Hash,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";
import { useGameStore } from "@/lib/store";
import { ThemeToggle } from "@/app/theme-toggle";

type Mode = "join" | "create";

interface CategoryResponse {
  category_id: string;
  name: string;
  description: string;
}

interface CategoryOption {
  id: string;
  name: string;
  description: string;
}

interface ActiveRoom {
  code: string;
  player_count: number;
  status: string;
  has_password: boolean;
}

const defaultCategories: CategoryOption[] = [
  { id: "random", name: "Ramdom", description: "Ngẫu nhiên · Toàn bộ kho từ" },
];

export default function Home() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const setMyInfo = useGameStore((state) => state.setMyInfo);

  const [mode, setMode] = useState<Mode>("join");
  const [nameInput, setNameInput] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [passwordPromptInput, setPasswordPromptInput] = useState("");
  const [pendingRoomCode, setPendingRoomCode] = useState("");

  const [customRoomCode, setCustomRoomCode] = useState("");
  const [category, setCategory] = useState("random");
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [password, setPassword] = useState("");
  const [categories, setCategories] =
    useState<CategoryOption[]>(defaultCategories);
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);
  const [homeError, setHomeError] = useState("");

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
    fetch(`${apiUrl}/api/categories`)
      .then((response) => response.json())
      .then((data: CategoryResponse[]) => {
        setCategories([
          ...defaultCategories,
          ...data.map((item) => ({
            id: item.category_id,
            name: item.name,
            description: item.description,
          })),
        ]);
      })
      .catch(() => {
        // Giữ lựa chọn ngẫu nhiên nếu API chưa sẵn sàng.
      });
  }, []);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL!;
    let socket: WebSocket | null = null;
    let closed = false;
    let reconnect = 0;

    const connect = () => {
      socket = new WebSocket(`${wsUrl}/ws/lobby`);
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data) as {
          type: string;
          payload: ActiveRoom[];
        };
        if (message.type === "ROOMS_UPDATE") {
          setRooms(message.payload || []);
        }
      };
      socket.onclose = () => {
        // Tự kết nối lại sau 3s nếu chưa unmount — tránh kẹt danh sách phòng khi WS ngắt
        if (!closed) reconnect = window.setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      closed = true;
      window.clearTimeout(reconnect);
      socket?.close();
    };
  }, []);

  const preparePlayer = () => {
    const displayName = nameInput.trim();
    if (!displayName) {
      setHomeError("Hãy nhập tên hiển thị trước khi vào đấu trường.");
      return false;
    }

    const currentId = useGameStore.getState().myPlayerId;
    const playerId =
      currentId || Math.random().toString(36).slice(2, 10).padEnd(8, "0");
    setMyInfo(playerId, displayName);
    return true;
  };

  const enterRoom = (code: string, roomPassword: string) => {
    useGameStore.getState().resetRoom();
    sessionStorage.setItem(`pending_password_${code}`, roomPassword);
    sessionStorage.setItem(`pending_isHost_${code}`, "0");
    router.push(`/room/${code}`);
  };

  const handleJoinRoom = (event: FormEvent) => {
    event.preventDefault();
    setHomeError("");

    if (!preparePlayer()) return;

    const code = roomInput.trim().toUpperCase();
    if (!code) {
      setHomeError("Nhập mã phòng bạn muốn tham gia.");
      return;
    }

    const targetRoom = rooms.find((room) => room.code === code);
    if (!targetRoom) {
      setHomeError(`Không tìm thấy phòng ${code}.`);
      return;
    }

    if (targetRoom.status !== "LOBBY") {
      setHomeError(`Phòng ${code} đang thi đấu. Hãy chờ trận tiếp theo.`);
      return;
    }

    if (targetRoom.has_password) {
      setPendingRoomCode(code);
      setPasswordPromptInput("");
      setPasswordPromptOpen(true);
      return;
    }

    enterRoom(code, "");
  };

  const submitJoinWithPassword = (event: FormEvent) => {
    event.preventDefault();
    enterRoom(pendingRoomCode, passwordPromptInput);
  };

  const handleCreateRoom = (event: FormEvent) => {
    event.preventDefault();
    setHomeError("");

    if (!preparePlayer()) return;

    const finalRoomCode = customRoomCode.trim().toUpperCase();
    if (!finalRoomCode) {
      setHomeError("Hãy đặt một mã phòng dễ nhớ.");
      return;
    }

    if (rooms.some((room) => room.code === finalRoomCode)) {
      setHomeError(`Mã phòng ${finalRoomCode} đã được sử dụng.`);
      return;
    }

    sessionStorage.setItem(
      `room_config_${finalRoomCode}`,
      JSON.stringify({ category, totalQuestions, password }),
    );
    sessionStorage.setItem(`pending_password_${finalRoomCode}`, password);
    sessionStorage.setItem(`pending_isHost_${finalRoomCode}`, "1");
    useGameStore.getState().resetRoom();
    router.push(`/room/${finalRoomCode}`);
  };

  const selectMode = (nextMode: Mode) => {
    setMode(nextMode);
    setPasswordPromptOpen(false);
    setHomeError("");
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

      <nav
        aria-label="Điều hướng chính"
        className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl border border-signal/30 bg-signal text-black shadow-[0_0_28px_rgba(223,255,98,0.18)]">
            <Swords size={21} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-black tracking-[0.17em] text-white">
              VOCAB BATTLE
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted">
              live word arena
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-xs text-muted backdrop-blur-md sm:px-4">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-signal" />
            </span>
            <span className="hidden sm:inline">Máy chủ hoạt động</span>
            <span className="font-mono font-bold text-white">
              {rooms.length}
            </span>
            <span>phòng</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pb-12 pt-8 sm:px-6 md:pt-14 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16 lg:px-8 lg:pb-20 lg:pt-20">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="max-w-2xl"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-electric/25 bg-electric/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-electric">
            <Radio size={14} aria-hidden="true" />
            Thi đấu realtime
          </div>

          <h1 className="text-balance text-[clamp(3.2rem,10vw,7.6rem)] font-black leading-[0.83] tracking-[-0.07em] text-white">
            ĐOÁN TỪ.
            <span className="block text-signal">HẠ ĐỐI THỦ.</span>
          </h1>

          <p className="mt-7 max-w-xl text-balance text-base leading-7 text-muted sm:text-lg">
            Một đấu trường từ vựng tốc độ cao. Tạo phòng, gọi bạn bè và giành
            điểm bằng từng đáp án chính xác.
          </p>

          <div className="mt-9 grid max-w-xl grid-cols-3 gap-3">
            {[
              ["30s", "mỗi vòng"],
              ["50", "câu tối đa"],
              ["Live", "bảng điểm"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-4 sm:px-5"
              >
                <p className="font-mono text-lg font-black text-white sm:text-2xl">
                  {value}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-muted sm:text-xs">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
            <span className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-signal" /> Không cần tài
              khoản
            </span>
            <span className="flex items-center gap-2">
              <Sparkles size={17} className="text-electric" /> Vào trận tức thì
            </span>
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
                <h2
                  id="control-title"
                  className="text-2xl font-black text-white"
                >
                  Sẵn sàng vào trận?
                </h2>
              </div>
              <Gamepad2
                className="mt-1 text-signal"
                size={27}
                aria-hidden="true"
              />
            </div>

            <div
              className="grid grid-cols-2 rounded-xl bg-black/25 p-1"
              role="tablist"
              aria-label="Chọn cách bắt đầu"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "join"}
                onClick={() => selectMode("join")}
                className={`min-h-11 rounded-lg px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric ${
                  mode === "join"
                    ? "bg-white text-black shadow-sm"
                    : "text-muted hover:text-white"
                }`}
              >
                Tham gia
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "create"}
                onClick={() => selectMode("create")}
                className={`min-h-11 rounded-lg px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric ${
                  mode === "create"
                    ? "bg-white text-black shadow-sm"
                    : "text-muted hover:text-white"
                }`}
              >
                Tạo phòng
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <div className="mb-5">
              <label
                htmlFor="player-name"
                className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-muted"
              >
                Tên hiển thị
              </label>
              <input
                id="player-name"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                className="arena-field"
                placeholder="Ví dụ: FrogMaster"
                maxLength={24}
                autoComplete="nickname"
                required
              />
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {mode === "join" ? (
                <motion.div
                  key={passwordPromptOpen ? "password" : "join"}
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
                          Nhập mật khẩu để tham gia phòng{" "}
                          <strong className="font-mono text-white">
                            {pendingRoomCode}
                          </strong>
                          .
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
                          onChange={(event) =>
                            setPasswordPromptInput(event.target.value)
                          }
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
                          onChange={(event) =>
                            setRoomInput(event.target.value.toUpperCase())
                          }
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
                        <option
                          key={item.id}
                          value={item.id}
                          className="bg-surface"
                        >
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
                      onChange={(event) =>
                        setTotalQuestions(Number(event.target.value))
                      }
                      className="arena-field font-mono font-black"
                      required
                    />
                    <p className="mt-1.5 text-xs text-muted">
                      Từ 1 đến 50 câu mỗi trận.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="create-password"
                      className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-muted"
                    >
                      Mật khẩu{" "}
                      <span className="font-normal normal-case text-muted">
                        (tùy chọn)
                      </span>
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
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-electric">
              Live now
            </p>
            <h2
              id="active-rooms-title"
              className="text-2xl font-black text-white"
            >
              Phòng đang hoạt động
            </h2>
          </div>
          <p className="hidden text-sm text-muted sm:block">
            Cập nhật realtime
          </p>
        </div>

        {rooms.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => {
              const isLobby = room.status === "LOBBY";
              return (
                <button
                  key={room.code}
                  type="button"
                  disabled={!isLobby}
                  onClick={() => {
                    selectMode("join");
                    setRoomInput(room.code);
                    document.getElementById("battle-control")?.scrollIntoView({
                      behavior: reduceMotion ? "auto" : "smooth",
                      block: "center",
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
                      isLobby
                        ? "bg-signal/10 text-signal"
                        : "bg-electric/10 text-electric"
                    }`}
                  >
                    {isLobby ? "Đang chờ" : "Đang đấu"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="arena-panel flex min-h-36 flex-col items-center justify-center rounded-2xl px-5 text-center">
            <Swords size={26} className="mb-3 text-muted" aria-hidden="true" />
            <p className="font-semibold text-white">Chưa có phòng nào mở</p>
            <p className="mt-1 text-sm text-muted">
              Hãy là người khởi động trận đầu tiên.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
