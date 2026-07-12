"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/lib/store";
import {
  Swords,
  X,
  Settings2,
  Lock,
  ListOrdered,
  Hash,
  Users,
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [nameInput, setNameInput] = useState("");
  const [roomInput, setRoomInput] = useState(""); // Dùng cho phần VÀO PHÒNG
  const [isModalOpen, setIsModalOpen] = useState(false);
  const setMyInfo = useGameStore((state) => state.setMyInfo);

  // Popup password khi user click "VÀO NGAY" mà phòng có pass
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [passwordPromptInput, setPasswordPromptInput] = useState("");
  const [pendingRoomCode, setPendingRoomCode] = useState("");

  // Form TẠO PHÒNG
  const [customRoomCode, setCustomRoomCode] = useState(""); // Mã phòng do user tự nhập
  const [category, setCategory] = useState("random");
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [password, setPassword] = useState("");

  // Fetch categories từ backend
  const [categories, setCategories] = useState([
    { id: "random", name: "Ngẫu nhiên (Toàn bộ kho)" },
  ]);

  // Danh sách phòng active (auto-fetch để check phòng tồn tại trước khi join)
  const [rooms, setRooms] = useState<
    {
      code: string;
      player_count: number;
      status: string;
      has_password: boolean;
    }[]
  >([]);
  const [homeError, setHomeError] = useState("");

  useEffect(() => {
    // ponytail: dùng hostname hiện tại thay vì localhost → hoạt động cả qua LAN IP
    const apiUrl = `${window.location.protocol}//${window.location.hostname}:8080`;
    fetch(`${apiUrl}/api/categories`)
      .then((res) => res.json())
      .then((data) => {
        // data là array của Category từ backend: [{category_id, name, description, created_at}]
        const mapped = data.map((c: any) => ({
          id: c.category_id,
          name: c.name,
        }));
        setCategories([
          { id: "random", name: "Ngẫu nhiên (Toàn bộ kho)" },
          ...mapped,
        ]);
      })
      .catch(() => {
        // ponytail: silent fallback, keep default "random" option
      });
  }, []);

  // Auto-fetch phòng mỗi 2s — dừng tự động khi user navigate sang /room (component unmount)
  useEffect(() => {
    const apiUrl = `${window.location.protocol}//${window.location.hostname}:8080`;
    const fetchRooms = () => {
      fetch(`${apiUrl}/api/admin/rooms`)
        .then((res) => res.json())
        .then((data) => setRooms(data || []))
        .catch(() => {});
    };
    fetchRooms();
    const interval = setInterval(fetchRooms, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const randomId = Math.random().toString(36).substring(2, 10);
    const randomName = `Player_${Math.floor(Math.random() * 1000)}`;
    setNameInput(randomName);
    setMyInfo(randomId, randomName);
  }, [setMyInfo]);

  // Bước 1: bấm "VÀO NGAY" -> check phòng tồn tại từ danh sách fetched, nếu OK mở popup pass
  const handleJoinRoom = () => {
    if (!roomInput.trim()) return;
    setHomeError("");

    const code = roomInput.trim().toUpperCase();

    // Check phòng tồn tại từ danh sách fetched — không join rồi mới báo
    const exists = rooms.some((r) => r.code === code);
    if (!exists) {
      setHomeError(`Phòng ${code} không tồn tại`);
      setTimeout(() => setHomeError(""), 3000);
      return;
    }

    useGameStore
      .getState()
      .setMyInfo(useGameStore.getState().myPlayerId, nameInput);
    // Mở popup yêu cầu pass LUÔN — client 2 không biết phòng có pass hay không,
    // nên hiển thị popup để user nhập. Server sẽ trả ERROR nếu sai.
    setPendingRoomCode(code);
    setPasswordPromptInput("");
    setPasswordPromptOpen(true);
  };

  // Sau khi user nhập password (hoặc để trống) và bấm "Vào phòng"
  const submitJoinWithPassword = () => {
    setPasswordPromptOpen(false);
    router.push(`/room/${pendingRoomCode}`);
    // Lưu password vào store để trang /room/[code] đọc khi kết nối WS
    sessionStorage.setItem(
      `pending_password_${pendingRoomCode}`,
      passwordPromptInput,
    );
    sessionStorage.setItem(`pending_isHost_${pendingRoomCode}`, "0");
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customRoomCode.trim()) {
      alert("Vui lòng nhập mã phòng bạn muốn tạo!");
      return;
    }

    useGameStore
      .getState()
      .setMyInfo(useGameStore.getState().myPlayerId, nameInput);

    const finalRoomCode = customRoomCode.trim().toUpperCase();

    // Lưu cấu hình vào sessionStorage (chỉ tab này, không phải localStorage)
    sessionStorage.setItem(
      `room_config_${finalRoomCode}`,
      JSON.stringify({ category, totalQuestions, password }),
    );
    sessionStorage.setItem(`pending_password_${finalRoomCode}`, password);
    sessionStorage.setItem(`pending_isHost_${finalRoomCode}`, "1");

    router.push(`/room/${finalRoomCode}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md text-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="inline-block mb-6 text-pink-500"
        >
          <Swords size={64} />
        </motion.div>

        <h1 className="text-4xl font-extrabold text-white mb-8 tracking-tight">
          VOCAB BATTLE
        </h1>

        <div className="space-y-4">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Tên hiển thị của bạn"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all text-center text-lg font-medium"
          />

          <div className="flex gap-2">
            <input
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="Nhập mã phòng..."
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all uppercase font-medium"
            />
            <button
              onClick={handleJoinRoom}
              className="px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl transition-colors shadow-lg"
            >
              VÀO NGAY
            </button>
          </div>

          {/* Toast lỗi phòng không tồn tại */}
          <AnimatePresence>
            {homeError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm font-medium"
              >
                {homeError}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-transparent text-gray-400 text-sm">
                hoặc
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Settings2 size={20} /> TẠO PHÒNG MỚI
          </button>
        </div>
      </motion.div>

      {/* Danh sách phòng đang hoạt động — auto-refresh */}
      {rooms.length > 0 && (
        <div className="mt-6 w-full max-w-md">
          <p className="text-gray-400 text-sm mb-3 flex items-center gap-2">
            <Users size={16} /> Phòng đang hoạt động ({rooms.length})
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {rooms.map((r) => (
              <button
                key={r.code}
                onClick={() => setRoomInput(r.code)}
                className="w-full flex justify-between items-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 transition-all"
              >
                <span className="font-mono font-bold text-white">{r.code}</span>
                <span className="flex items-center gap-2">
                  {r.has_password && (
                    <Lock size={12} className="text-gray-400" />
                  )}
                  <span className="text-xs text-blue-300 font-medium">
                    {r.player_count} người
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === "PLAYING"
                        ? "bg-green-500/20 text-green-300"
                        : "bg-yellow-500/20 text-yellow-300"
                    }`}
                  >
                    {r.status}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* POPUP TẠO PHÒNG */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-900 border border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>

              <h2 className="text-2xl font-bold text-white mb-6">
                Tùy chỉnh phòng
              </h2>

              <form onSubmit={handleCreateRoom} className="space-y-5 text-left">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <Hash size={16} /> Mã phòng
                  </label>
                  <input
                    type="text"
                    value={customRoomCode}
                    onChange={(e) => setCustomRoomCode(e.target.value)}
                    placeholder="Nhập mã phòng bạn muốn tạo (VD: VIP123)"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <ListOrdered size={16} /> Bộ từ vựng
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id} className="bg-gray-800">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Số lượng câu hỏi:{" "}
                    <span className="text-blue-400 font-bold">
                      {totalQuestions}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <Lock size={16} /> Mật khẩu phòng (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Bỏ trống nếu tạo phòng công khai"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30"
                >
                  Xác Nhận Tạo Phòng
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POPUP NHẬP PASSWORD KHI JOIN PHÒNG */}
      <AnimatePresence>
        {passwordPromptOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-900 border border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setPasswordPromptOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>

              <h2 className="text-2xl font-bold text-white mb-2">
                Nhập mật khẩu phòng
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                Phòng{" "}
                <strong className="text-pink-400">{pendingRoomCode}</strong> có
                thể được bảo vệ bằng mật khẩu. Hãy nhập để tiếp tục (bỏ trống
                nếu phòng công khai).
              </p>

              <div className="space-y-4">
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute top-1/2 left-4 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={passwordPromptInput}
                    onChange={(e) => setPasswordPromptInput(e.target.value)}
                    placeholder="Mật khẩu..."
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitJoinWithPassword();
                    }}
                  />
                </div>

                <button
                  onClick={submitJoinWithPassword}
                  className="w-full py-4 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl transition-all shadow-lg"
                >
                  Vào phòng
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
