"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  FolderTree,
  LayoutDashboard,
  LockKeyhole,
  Radio,
  UsersRound,
} from "lucide-react";
import { useCardService } from "@/hooks/useCardService";
import { useCategoryService } from "@/hooks/useCategoryService";
import { useRoomService } from "@/hooks/useRoomService";

const number = new Intl.NumberFormat("vi-VN");

export default function DashboardPage() {
  const {
    total: cardTotal,
    loading: cardsLoading,
    error: cardsError,
  } = useCardService({ page: 1, pageSize: 1 });
  const {
    categories,
    loading: categoriesLoading,
    error: categoriesError,
  } = useCategoryService();
  const { rooms, loading: roomsLoading, error: roomsError } = useRoomService();

  const loading = cardsLoading || categoriesLoading || roomsLoading;
  const unavailable = Boolean(cardsError || categoriesError || roomsError);
  const playingRooms = rooms.filter((room) => room.status === "PLAYING").length;

  return (
    <main id="main-content" className="admin-dashboard flex-1">
      <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <header className="border-b border-line pb-12 sm:pb-14">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric">
              Bảng điều hành
            </p>
            <h1 className="mt-3 min-w-0 max-w-[15ch] break-words font-display text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[0.94] tracking-[-0.06em] text-foreground">
              Điều hành kho từ.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
              Theo dõi nội dung đang có, kiểm tra các phòng trực tiếp và đi thẳng vào khu vực cần chỉnh sửa.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/cards"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-extrabold text-background whitespace-nowrap transition-[filter,transform] duration-200 hover:brightness-105 active:translate-y-px"
            >
              Quản lý từ <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/categories"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface-raised px-4 text-sm font-bold text-foreground whitespace-nowrap transition-[background-color,transform] duration-200 hover:bg-surface active:translate-y-px"
            >
              Danh mục <FolderTree size={16} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <section aria-label="Tóm tắt hệ thống" className="grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <article className="rounded-xl border border-line bg-surface p-5 shadow-panel sm:col-span-2">
            <FolderTree className="text-electric" size={20} aria-hidden="true" />
            <p className="mt-8 font-mono text-[clamp(2rem,5vw,3rem)] font-bold leading-none tabular-nums text-foreground" aria-live="polite">
              {categoriesLoading ? "—" : number.format(categories.length)}
            </p>
            <h2 className="mt-2 font-semibold text-foreground">Danh mục</h2>
            <p className="mt-1 text-sm text-muted">Bộ từ đang có thể quản lý.</p>
          </article>
          <article className="rounded-xl border border-line bg-surface p-5 shadow-panel">
            <BookOpen className="text-signal" size={20} aria-hidden="true" />
            <p className="mt-8 font-mono text-[clamp(2rem,5vw,3rem)] font-bold leading-none tabular-nums text-foreground" aria-live="polite">
              {cardsLoading ? "—" : number.format(cardTotal)}
            </p>
            <h2 className="mt-2 font-semibold text-foreground">Từ vựng</h2>
            <p className="mt-1 text-sm text-muted">Mục trong kho học hiện tại.</p>
          </article>
          <article className="rounded-xl border border-line bg-surface p-5 shadow-panel">
            <Radio className="text-electric" size={20} aria-hidden="true" />
            <p className="mt-8 font-mono text-[clamp(2rem,5vw,3rem)] font-bold leading-none tabular-nums text-foreground" aria-live="polite">
              {roomsLoading ? "—" : number.format(playingRooms)}
            </p>
            <h2 className="mt-2 font-semibold text-foreground">Phòng đang đấu</h2>
            <p className="mt-1 text-sm text-muted">Các trận có trạng thái PLAYING.</p>
          </article>
        </section>

        {unavailable && (
          <p role="status" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger-copy">
            Không thể tải toàn bộ số liệu từ backend. Hãy kiểm tra NEXT_PUBLIC_API_URL rồi thử lại.
          </p>
        )}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.55fr)]">
          <aside className="rounded-xl border border-line bg-surface p-5 shadow-panel sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-electric/15 text-electric">
                <LayoutDashboard size={21} aria-hidden="true" />
              </span>
              <div>
                <h2 className="min-w-0 break-words font-display text-2xl font-extrabold tracking-[-0.04em] text-foreground">
                  Lối tắt quản trị
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">Hai vùng thao tác chính của kho nội dung.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              <Link href="/cards" className="group flex min-h-11 items-center justify-between gap-4 rounded-lg border border-line bg-surface-raised px-4 py-3 transition-[background-color,transform] duration-200 hover:bg-surface active:translate-y-px">
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">Từ vựng</span>
                  <span className="mt-0.5 block text-sm text-muted">Tìm, sửa hoặc thêm từ.</span>
                </span>
                <ArrowUpRight className="shrink-0 text-electric transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={18} aria-hidden="true" />
              </Link>
              <Link href="/categories" className="group flex min-h-11 items-center justify-between gap-4 rounded-lg border border-line bg-surface-raised px-4 py-3 transition-[background-color,transform] duration-200 hover:bg-surface active:translate-y-px">
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">Danh mục</span>
                  <span className="mt-0.5 block text-sm text-muted">Sắp xếp các bộ từ học.</span>
                </span>
                <ArrowUpRight className="shrink-0 text-electric transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={18} aria-hidden="true" />
              </Link>
            </div>
          </aside>

          <section aria-labelledby="room-status-title" className="rounded-xl border border-line bg-surface shadow-panel">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-5 sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric">Realtime</p>
                <h2 id="room-status-title" className="mt-2 min-w-0 break-words font-display text-2xl font-extrabold tracking-[-0.04em] text-foreground">
                  Phòng đang mở
                </h2>
              </div>
              <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 text-sm font-semibold tabular-nums text-muted">
                <UsersRound size={16} className="text-electric" aria-hidden="true" />
                {roomsLoading ? "—" : number.format(rooms.length)} phòng
              </span>
            </div>

            {loading ? (
              <div className="grid gap-3 p-5 sm:p-6" aria-label="Đang tải phòng">
                {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-surface-raised" />)}
              </div>
            ) : rooms.length === 0 ? (
              <div className="grid min-h-56 place-items-center p-6 text-center">
                <div>
                  <Radio className="mx-auto text-electric" size={28} aria-hidden="true" />
                  <p className="mt-3 font-semibold text-foreground">Chưa có phòng nào đang mở.</p>
                  <p className="mt-1 text-sm text-muted">Danh sách sẽ tự cập nhật khi có phòng mới.</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-line" aria-live="polite">
                {rooms.slice(0, 6).map((room) => (
                  <li key={room.code} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-6">
                    <div className="min-w-0">
                      <p className="font-mono text-base font-bold tracking-[0.08em] text-foreground">{room.code}</p>
                      <p className="mt-1 truncate text-sm text-muted">{room.players.map((player) => player.name).join(", ") || "Chưa có người chơi"}</p>
                    </div>
                    <span className="inline-flex min-h-8 items-center self-start rounded-md border border-line bg-surface-raised px-2 text-xs font-semibold text-muted sm:self-auto">
                      {room.status}
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold tabular-nums text-foreground">
                      {room.has_password && <LockKeyhole size={15} className="text-muted" aria-label="Có mật khẩu" />}
                      {room.player_count} người
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}
