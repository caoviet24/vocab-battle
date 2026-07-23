"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon, LoaderCircle, Pencil, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { useFrameService } from "@/hooks/useFrameService";
import { deleteUploadedImage, uploadImage } from "@/services/uploads";
import type { Frame } from "@/types/type";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function FramesPage() {
  const { frames, loading, saving, refreshFrames, createFrame, updateFrame, deleteFrame } = useFrameService();
  const [editing, setEditing] = useState<Frame | null>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const preview = useMemo(() => file ? URL.createObjectURL(file) : editing?.url ?? "", [file, editing]);
  const busy = saving || uploading;

  useEffect(() => () => { if (file) URL.revokeObjectURL(preview); }, [file, preview]);

  const openForm = (frame?: Frame) => {
    setEditing(frame ?? null);
    setName(frame?.name ?? "");
    setFile(null);
    setError("");
    setShowForm(true);
  };

  const chooseFile = (next?: File) => {
    setError("");
    if (!next) return;
    if (next.type !== "image/webp") return setError("Frame phải là ảnh WebP.");
    if (next.size > MAX_IMAGE_SIZE) return setError("Ảnh không được lớn hơn 5 MB.");
    setFile(next);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file && !editing) return setError("Hãy chọn một frame WebP.");
    let url = "";
    let saved = false;
    try {
      setUploading(Boolean(file));
      url = file ? await uploadImage(file, "frame") : editing!.url;
      if (editing) await updateFrame({ id: editing.frame_id, name: name.trim(), url });
      else await createFrame({ name: name.trim(), url });
      saved = true;
      if (editing && file && editing.url !== url) await deleteUploadedImage(editing.url, "frame");
      setShowForm(false);
    } catch (cause) {
      if (!saved && url) await deleteUploadedImage(url, "frame").catch(() => undefined);
      setError(cause instanceof Error ? cause.message : "Không thể lưu frame.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (frame: Frame) => {
    if (!confirm(`Xóa frame "${frame.name}"?`)) return;
    try {
      await deleteFrame(frame.frame_id);
      await deleteUploadedImage(frame.url, "frame");
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Không thể xóa frame.");
    }
  };

  return <main id="main-content" className="admin-dashboard flex-1"><section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
    <header className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between sm:pb-10"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric">Tài nguyên giao diện</p><h1 className="mt-3 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[0.94] tracking-[-0.06em] text-foreground">Frame WebP</h1><p className="mt-4 max-w-2xl text-base leading-7 text-muted">Lưu các khung ảnh dùng trong ứng dụng.</p></div><div className="flex gap-3"><button type="button" onClick={() => void refreshFrames()} className="grid size-11 place-items-center rounded-lg border border-line bg-surface-raised text-muted hover:text-electric" aria-label="Tải lại"><RefreshCw size={17} /></button><button type="button" onClick={() => openForm()} className="flex min-h-11 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-bold text-background"><Plus size={17} /> Thêm frame</button></div></header>
    {loading ? <div className="mt-8 h-56 animate-pulse rounded-xl border border-line bg-surface" /> : frames.length === 0 ? <section className="mt-8 grid min-h-72 place-items-center rounded-xl border border-dashed border-line bg-surface/60 p-8 text-center"><div><ImageIcon className="mx-auto text-electric" size={30} /><h2 className="mt-4 font-display text-xl font-bold">Chưa có frame</h2><button type="button" onClick={() => openForm()} className="mt-5 min-h-11 rounded-lg bg-signal px-4 text-sm font-bold text-background">Tải frame WebP</button></div></section> : <section className="mt-8 overflow-hidden rounded-xl border border-line bg-surface shadow-panel"><div className="divide-y divide-line">{frames.map((frame) => <article key={frame.frame_id} className="grid grid-cols-[5rem_minmax(0,1fr)_auto] gap-4 p-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto]"><div role="img" aria-label={frame.name} className="aspect-square w-full rounded-lg border border-line bg-surface-raised bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${frame.url})` }} /><div className="min-w-0 self-center"><h2 className="truncate font-display text-xl font-extrabold text-foreground">{frame.name}</h2><p className="mt-1 truncate font-mono text-xs text-muted">{frame.url}</p><p className="mt-2 text-xs text-muted">Tạo ngày {new Date(frame.created_at).toLocaleDateString("vi-VN")}</p></div><div className="flex self-center"><button type="button" onClick={() => openForm(frame)} className="grid size-11 place-items-center rounded-lg border border-line text-muted hover:text-electric" aria-label={`Sửa ${frame.name}`}><Pencil size={15} /></button><button type="button" onClick={() => void remove(frame)} className="ml-1 grid size-11 place-items-center rounded-lg border border-danger/30 text-danger hover:bg-danger/10" aria-label={`Xóa ${frame.name}`}><Trash2 size={15} /></button></div></article>)}</div></section>}
  </section>{showForm && <div className="fixed inset-0 z-[var(--z-modal)] grid place-items-center bg-background/80 p-4 backdrop-blur-sm"><form onSubmit={save} className="arena-panel w-full max-w-xl overflow-hidden rounded-xl" aria-labelledby="frame-form-title"><div className="flex items-center justify-between border-b border-line px-5 py-4"><div><p className="font-mono text-xs font-bold uppercase text-electric">{editing ? "Chỉnh sửa" : "Frame mới"}</p><h2 id="frame-form-title" className="mt-1 font-display text-xl font-bold">{editing ? editing.name : "Tải frame WebP"}</h2></div><button type="button" disabled={busy} onClick={() => setShowForm(false)} className="grid size-11 place-items-center rounded-lg border border-line text-muted" aria-label="Đóng"><X size={18} /></button></div><div className="p-5 sm:p-6"><div className="relative grid aspect-square place-items-center overflow-hidden rounded-lg border border-line bg-surface-raised">{preview ? <div role="img" aria-label="Xem trước frame" className="size-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${preview})` }} /> : <ImageIcon className="text-muted" size={32} />}</div><label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface-raised text-sm font-semibold hover:text-electric"><Upload size={16} /> Chọn file WebP<input type="file" accept="image/webp" className="sr-only" onChange={(event) => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label><p className="mt-2 text-xs text-muted">Chỉ WebP · tối đa 5 MB</p><label htmlFor="frame-name" className="mb-1.5 mt-5 block text-sm font-semibold">Tên frame <span className="text-danger">*</span></label><input id="frame-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} className="arena-field" placeholder="Ví dụ: Khung vàng" />{error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-copy" role="alert">{error}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setShowForm(false)} className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold">Hủy</button><button type="submit" disabled={busy || !name.trim()} className="flex min-h-11 items-center gap-2 rounded-lg bg-signal px-5 text-sm font-bold text-background disabled:opacity-50">{busy && <LoaderCircle className="animate-spin" size={16} />}{uploading ? "Đang tải..." : editing ? "Lưu thay đổi" : "Tạo frame"}</button></div></div></form></div>}</main>;
}
