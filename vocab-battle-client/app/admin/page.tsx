"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Users, Crown, Lock } from "lucide-react";

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
  WAITING: "bg-signal/15 text-signal",
  LOBBY: "bg-signal/15 text-signal",
  PLAYING: "bg-electric/15 text-electric",
  FINISHED: "bg-muted/15 text-muted",
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function AdminPage() {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = () => {
    fetch(`${API}/api/admin/rooms`)
      .then((res) => res.json())
      .then((data: RoomInfo[]) => setRooms(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Phòng hoạt động</h1>
          <p className="text-sm text-muted">{rooms.length} phòng</p>
        </div>
        <button
          onClick={fetchRooms}
          className="flex items-center gap-2 rounded-xl border border-line bg-surface-raised px-4 py-2 text-sm font-medium transition hover:bg-line/50"
        >
          <RefreshCw size={16} />
          Làm mới
        </button>
      </div>

      {loading ? (
        <p className="py-12 text-center text-muted">Đang tải...</p>
      ) : rooms.length === 0 ? (
        <div className="py-20 text-center text-muted">
          <Users size={64} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg">Chưa có phòng nào được tạo</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <div
              key={room.code}
              className="rounded-2xl border border-line bg-surface/60 p-5 transition hover:border-electric/30"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="font-mono text-xl font-bold">{room.code}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[room.status] || "bg-muted/15 text-muted"}`}
                    >
                      {room.status}
                    </span>
                    {room.has_password && (
                      <span className="text-muted">
                        <Lock size={12} />
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-electric/30 bg-electric/10 px-3 py-1 text-electric">
                  <Users size={14} />
                  <span className="text-sm font-bold">{room.player_count}</span>
                </div>
              </div>

              <ul className="space-y-1.5">
                {room.players.map((p) => (
                  <li
                    key={p.player_id}
                    className="flex items-center justify-between rounded-lg border border-line bg-background/60 p-2.5"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {p.player_id === room.host_id && <Crown size={14} className="text-signal" />}
                      {p.name}
                    </span>
                    <span className="font-mono text-xs text-electric">{p.score} pt</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}