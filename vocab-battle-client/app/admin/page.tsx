"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Users, Crown, Lock, DoorOpen } from "lucide-react";

type Player = {
  player_id: string;
  name: string;
  score: number;
};

type RoomInfo = {
  code: string;
  status: string;
  host_id: string;
  has_password: boolean;
  player_count: number;
  players: Player[];
};

const statusColor: Record<string, string> = {
  WAITING: "bg-yellow-500/20 text-yellow-300",
  LOBBY: "bg-yellow-500/20 text-yellow-300",
  PLAYING: "bg-green-500/20 text-green-300",
  FINISHED: "bg-gray-500/20 text-gray-300",
};

export default function AdminPage() {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    fetch(`${apiUrl}/api/admin/rooms`)
      .then((res) => res.json())
      .then((data: RoomInfo[]) => setRooms(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRooms();
    // ponytail: poll mỗi 2s, đủ realtime cho admin dashboard
    const interval = setInterval(fetchRooms, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8 bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-pink-500/20 p-2 rounded-lg">
              <DoorOpen className="text-pink-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-gray-400">
                {rooms.length} phòng hoạt động
              </p>
            </div>
          </div>
          <button
            onClick={fetchRooms}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all"
          >
            <RefreshCw size={18} />
            Làm mới
          </button>
        </header>

        {loading ? (
          <p className="text-gray-400 text-center py-12">Đang tải...</p>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Users size={64} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">Chưa có phòng nào được tạo</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <div
                key={room.code}
                className="bg-white/5 border border-white/10 rounded-2xl p-5"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold font-mono">
                      {room.code}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[room.status] || "bg-gray-500/20 text-gray-300"}`}
                      >
                        {room.status}
                      </span>
                      {room.has_password && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Lock size={12} />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-blue-500/20 px-3 py-1 rounded-lg border border-blue-500/30">
                    <Users size={14} className="text-blue-400" />
                    <span className="font-bold text-blue-400 text-sm">
                      {room.player_count}
                    </span>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {room.players.map((p) => (
                    <li
                      key={p.player_id}
                      className="flex justify-between items-center bg-black/40 p-2.5 rounded-lg border border-white/5"
                    >
                      <span className="text-sm font-medium flex items-center gap-1.5">
                        {p.player_id === room.host_id && (
                          <Crown size={14} className="text-yellow-400" />
                        )}
                        {p.name}
                      </span>
                      <span className="text-xs font-mono text-blue-400">
                        {p.score} pt
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
