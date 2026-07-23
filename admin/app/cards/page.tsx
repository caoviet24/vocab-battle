"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  LoaderCircle,
  Upload,
} from "lucide-react";
import { useCardService } from "@/hooks/useCardService";
import { useCategoryService } from "@/hooks/useCategoryService";
import { deleteUploadedImage, uploadImage } from "@/services/uploads";
import type { Card, CardForm, Phonetic } from "@/types/type";

const DEFAULT_PAGE_SIZE = 20;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];

const EMPTY_FORM: CardForm = {
  word: "",
  type: "",
  explanation: { en: "", vi: "" },
  translation: "",
  example: { en: "", vi: "" },
  phonetics: [],
  image_url: "",
  difficulty: "",
  category_id: "",
};

export default function CardsPage() {
  const [categoryId, setCategoryId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const {
    cards,
    total,
    totalPages,
    loading,
    refreshCards,
    createCard,
    updateCard,
    deleteCard,
  } = useCardService({ categoryId, search: search.trim(), page, pageSize });
  const { categories } = useCategoryService();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState("");
  const [form, setForm] = useState<CardForm>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const localPreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : ""),
    [imageFile],
  );
  const previewUrl = localPreview || form.image_url;
  const busy = saving || uploading;

  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [localPreview],
  );

  const openCreate = () => {
    setEditingId(null);
    setOriginalImageUrl("");
    setForm({ ...EMPTY_FORM, category_id: categoryId });
    setImageFile(null);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (c: Card) => {
    const { card_id, ...rest } = c;
    setEditingId(card_id);
    setOriginalImageUrl(c.image_url);
    setForm(rest);
    setImageFile(null);
    setFormError("");
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    let uploadedUrl = "";
    let saved = false;
    try {
      setUploading(Boolean(imageFile));
      uploadedUrl = imageFile ? await uploadImage(imageFile, "word") : "";
      const card = { ...form, image_url: uploadedUrl || form.image_url };
      if (editingId) {
        await updateCard({ id: editingId, card });
        if (originalImageUrl !== card.image_url) {
          await deleteUploadedImage(originalImageUrl, "word");
        }
      } else await createCard(card);
      saved = true;
      setShowForm(false);
    } catch (error) {
      if (!saved && uploadedUrl) {
        await deleteUploadedImage(uploadedUrl, "word").catch(() => undefined);
      }
      setFormError(error instanceof Error ? error.message : "Không thể lưu từ vựng.");
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  const chooseImage = (file?: File) => {
    setFormError("");
    if (!file) return;
    if (!ACCEPTED_IMAGES.includes(file.type)) {
      setFormError("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setFormError("Ảnh không được lớn hơn 5 MB.");
      return;
    }
    setImageFile(file);
  };

  const closeForm = () => {
    if (!busy) setShowForm(false);
  };

  const remove = async (c: Card) => {
    if (
      !confirm(`Xóa từ "${c.word}"?
      `)
    )
      return;
    try {
      await deleteCard(c.card_id);
      await deleteUploadedImage(c.image_url, "word");
      if (cards.length === 1 && page > 1) setPage(page - 1);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không thể xóa từ vựng");
    }
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const goToPage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestedPage = Number(new FormData(event.currentTarget).get("page"));
    setPage(Math.min(Math.max(requestedPage, 1), totalPages));
  };

  const setField = <K extends keyof CardForm>(key: K, value: CardForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setBilingual = (
    key: "explanation" | "example",
    lang: "en" | "vi",
    value: string,
  ) => setForm((f) => ({ ...f, [key]: { ...f[key], [lang]: value } }));

  const setPhonetic = (i: number, field: keyof Phonetic, value: string) =>
    setForm((f) => ({
      ...f,
      phonetics: f.phonetics.map((p, idx) =>
        idx === i ? { ...p, [field]: value } : p,
      ),
    }));

  const addPhonetic = () =>
    setForm((f) => ({
      ...f,
      phonetics: [...f.phonetics, { text: "", audio: "", locale: "us" }],
    }));

  const removePhonetic = (i: number) =>
    setForm((f) => ({
      ...f,
      phonetics: f.phonetics.filter((_, idx) => idx !== i),
    }));

  const categoryName = (id: string) =>
    categories.find((c) => c.category_id === id)?.name ?? "—";
  const from = cards.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = cards.length === 0 ? 0 : Math.min(from + cards.length - 1, total);
  const activeFilters = Number(Boolean(categoryId)) + Number(Boolean(search));
  const clearFilters = () => {
    setCategoryId("");
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  return (
    <main id="main-content" className="admin-dashboard flex-1">
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <header className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between sm:pb-10">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric">Kho nội dung</p>
          <h1 className="mt-3 min-w-0 break-words font-display text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[0.94] tracking-[-0.06em] text-foreground">Từ vựng</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">Tìm, lọc và cập nhật từng mục trong kho học.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => void refreshCards()}
            className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-line bg-surface-raised text-muted transition hover:border-electric/50 hover:text-electric"
            aria-label="Tải lại từ vựng"
            title="Tải lại"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={openCreate}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-bold text-background transition hover:brightness-105"
          >
            <Plus size={16} /> Thêm từ
          </button>
        </div>
      </header>

      <section aria-label="Bộ lọc từ vựng" className="mt-8 rounded-xl border border-line bg-surface p-4 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <p className="font-display text-lg font-extrabold tracking-[-0.03em]">Danh sách từ <span className="font-mono text-sm font-semibold text-electric">{total}</span></p>
          {activeFilters > 0 && <button type="button" onClick={clearFilters} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-muted transition hover:bg-surface-raised hover:text-foreground whitespace-nowrap">Xóa {activeFilters} bộ lọc</button>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            aria-label="Lọc theo danh mục"
            className="arena-field w-full py-2 text-sm sm:w-auto"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.category_id} value={c.category_id}>
                {c.name}
              </option>
            ))}
          </select>
          <form onSubmit={submitSearch} className="flex min-w-0 flex-1 flex-wrap gap-2">
            <label htmlFor="card-search" className="sr-only">Tìm từ vựng</label>
            <input
              id="card-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm từ hoặc bản dịch"
              className="arena-field min-w-0 flex-1 py-2 text-sm"
            />
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-line bg-surface-raised px-4 text-sm font-semibold whitespace-nowrap transition hover:bg-line/50"
            >
              Tìm
            </button>
          </form>
        </div>
      </section>

      {loading ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-line bg-surface p-5" aria-label="Đang tải từ vựng">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-surface-raised" />)}
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface shadow-panel">
          <div className="divide-y divide-line md:hidden">
            {cards.map((c) => (
              <article key={c.card_id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-3 p-4">
                <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-surface-raised">
                  {c.image_url ? (
                    <div
                      role="img"
                      aria-label={`Ảnh của từ ${c.word}`}
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${c.image_url})` }}
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-muted"><ImageIcon size={18} aria-hidden="true" /></div>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg font-extrabold tracking-[-0.03em]">{c.word}</h2>
                  <p className="mt-1 truncate text-sm text-muted">{c.translation || "Chưa có bản dịch"}</p>
                  <p className="mt-2 font-mono text-xs text-muted">{categoryName(c.category_id)} · {c.difficulty || "—"}</p>
                </div>
                <button onClick={() => openEdit(c)} className="grid size-11 shrink-0 place-items-center rounded-lg border border-line bg-surface-raised text-muted transition hover:border-electric/50 hover:text-electric" aria-label={`Sửa ${c.word}`}><Pencil size={15} /></button>
              </article>
            ))}
            {cards.length === 0 && <p className="p-8 text-center text-muted">Không có từ vựng nào theo bộ lọc này.</p>}
          </div>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-surface-raised text-left text-muted text-xs uppercase tracking-wider">
              <tr>
                <th className="w-16 p-3 font-medium">Ảnh</th>
                <th className="p-3 font-medium">Từ</th>
                <th className="hidden p-3 font-medium sm:table-cell">Loại</th>
                <th className="hidden p-3 font-medium md:table-cell">
                  Trình độ
                </th>
                <th className="hidden p-3 font-medium lg:table-cell">
                  Danh mục
                </th>
                <th className="hidden p-3 font-medium lg:table-cell">
                  Bản dịch
                </th>
                <th className="p-3 text-right font-medium">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr
                  key={c.card_id}
                  className="border-b border-line/50 transition hover:bg-surface-raised"
                >
                  <td className="p-3">
                    <div className="relative size-10 overflow-hidden rounded-lg border border-line bg-surface-raised">
                      {c.image_url ? (
                        <div
                          role="img"
                          aria-label={`Ảnh của từ ${c.word}`}
                          className="absolute inset-0 bg-cover bg-center"
                          style={{ backgroundImage: `url(${c.image_url})` }}
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-muted"><ImageIcon size={16} aria-hidden="true" /></div>
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-medium">{c.word}</td>
                  <td className="hidden p-3 text-muted sm:table-cell">
                    {c.type || "—"}
                  </td>
                  <td className="hidden p-3 text-muted md:table-cell">
                    {c.difficulty || "—"}
                  </td>
                  <td className="hidden p-3 text-muted lg:table-cell">
                    {categoryName(c.category_id)}
                  </td>
                  <td className="hidden p-3 text-muted lg:table-cell">
                    {c.translation || "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="grid size-11 place-items-center rounded-lg border border-line bg-surface-raised text-muted transition hover:border-electric/50 hover:text-electric"
                        title="Sửa"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => remove(c)}
                        className="grid size-11 place-items-center rounded-lg border border-danger/30 bg-danger/10 text-danger transition hover:bg-danger/20"
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {cards.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">
                    Không có từ vựng nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-muted">
          <span>
            {from}–{to} / {total}
          </span>
          <div className="flex items-center gap-2">
            <label htmlFor="page-size">Số dòng</label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="min-h-11 rounded-lg border border-line bg-surface-raised px-2"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="flex min-h-11 items-center gap-1 rounded-lg border border-line bg-surface-raised px-3 disabled:opacity-30"
            >
              <ChevronLeft size={14} /> Trước
            </button>
            <form onSubmit={goToPage} className="flex items-center gap-1">
              <label htmlFor="page-number">Trang</label>
              <input
                key={page}
                id="page-number"
                name="page"
                type="number"
                min={1}
                max={totalPages}
                defaultValue={page}
                className="min-h-11 w-14 rounded-lg border border-line bg-surface-raised px-2 text-center tabular-nums"
              />
              <span>/ {totalPages}</span>
            </form>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="flex min-h-11 items-center gap-1 rounded-lg border border-line bg-surface-raised px-3 disabled:opacity-30"
            >
              Sau <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
      </section>

      {showForm && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] grid place-items-center bg-background/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeForm();
          }}
        >
          <form
            onSubmit={save}
            className="arena-panel grid h-[min(42rem,calc(100dvh-2rem))] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl"
            aria-labelledby="card-form-title"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
              <div>
                <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-electric">{editingId ? "Chỉnh sửa" : "Mục mới"}</p>
                <h2 id="card-form-title" className="mt-1 font-display text-xl font-extrabold tracking-[-0.03em]">
                  {editingId ? "Sửa từ vựng" : "Thêm từ vựng"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={busy}
                className="grid size-11 place-items-center rounded-lg border border-line text-muted transition hover:text-foreground disabled:opacity-50"
                aria-label="Đóng biểu mẫu"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(15rem,0.65fr)_minmax(0,1.35fr)] lg:grid-rows-1">
            <section className="border-b border-line bg-surface-raised p-5 lg:border-b-0 lg:border-r sm:p-6">
              <p className="mb-3 text-sm font-semibold">Ảnh minh họa</p>
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-background">
                {previewUrl ? (
                  <div
                    role="img"
                    aria-label="Xem trước ảnh từ vựng"
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${previewUrl})` }}
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center p-6 text-center text-muted">
                    <div><ImageIcon className="mx-auto" size={32} strokeWidth={1.5} /><p className="mt-3 text-sm">Chưa có ảnh minh họa</p></div>
                  </div>
                )}
              </div>
              <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-background px-4 text-sm font-semibold transition hover:border-electric/50 hover:text-electric">
                <Upload size={16} /> {previewUrl ? "Chọn ảnh khác" : "Tải ảnh lên"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    chooseImage(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {previewUrl && (
                <button type="button" onClick={() => { setImageFile(null); setField("image_url", ""); }} disabled={busy} className="mt-2 min-h-11 w-full rounded-lg text-sm font-semibold text-muted transition hover:bg-danger/10 hover:text-danger disabled:opacity-50">Xóa ảnh</button>
              )}
              <p className="mt-3 text-xs leading-5 text-muted">JPEG, PNG hoặc WebP · tối đa 5 MB</p>
            </section>
            <section className="min-h-0 overflow-y-auto p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted">Từ *</label>
                <input
                  value={form.word}
                  onChange={(e) => setField("word", e.target.value)}
                  required
                  className="arena-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Loại</label>
                <input
                  value={form.type}
                  onChange={(e) => setField("type", e.target.value)}
                  placeholder="noun, verb, adj..."
                  className="arena-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">
                  Trình độ
                </label>
                <input
                  value={form.difficulty}
                  onChange={(e) => setField("difficulty", e.target.value)}
                  placeholder="A1, A2, B1, B2, C1..."
                  className="arena-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">
                  Danh mục *
                </label>
                <select
                  value={form.category_id}
                  onChange={(e) => setField("category_id", e.target.value)}
                  required
                  className="arena-field"
                >
                  <option value="">— Chọn —</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="mb-1 mt-3 block text-sm text-muted">
              Bản dịch (vi)
            </label>
            <input
              value={form.translation}
              onChange={(e) => setField("translation", e.target.value)}
              className="arena-field"
            />

            <label className="mb-1 mt-3 block text-sm text-muted">
              Giải thích (EN)
            </label>
            <textarea
              value={form.explanation.en}
              onChange={(e) =>
                setBilingual("explanation", "en", e.target.value)
              }
              rows={2}
              className="arena-field"
            />
            <label className="mb-1 mt-2 block text-sm text-muted">
              Giải thích (VI)
            </label>
            <textarea
              value={form.explanation.vi}
              onChange={(e) =>
                setBilingual("explanation", "vi", e.target.value)
              }
              rows={2}
              className="arena-field"
            />

            <label className="mb-1 mt-3 block text-sm text-muted">
              Ví dụ (EN)
            </label>
            <textarea
              value={form.example.en}
              onChange={(e) => setBilingual("example", "en", e.target.value)}
              rows={2}
              className="arena-field"
            />
            <label className="mb-1 mt-2 block text-sm text-muted">
              Ví dụ (VI)
            </label>
            <textarea
              value={form.example.vi}
              onChange={(e) => setBilingual("example", "vi", e.target.value)}
              rows={2}
              className="arena-field"
            />

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm text-muted">Phiên âm</label>
                <button
                  type="button"
                  onClick={addPhonetic}
                  className="flex items-center gap-1 rounded-lg border border-line bg-surface-raised px-2 py-1 text-xs transition hover:bg-line/50"
                >
                  <Plus size={12} /> Thêm
                </button>
              </div>
              <div className="space-y-2">
                {form.phonetics.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={p.text}
                      onChange={(e) => setPhonetic(i, "text", e.target.value)}
                      placeholder="/phiên âm/"
                      className="arena-field flex-1"
                    />
                    <input
                      value={p.audio}
                      onChange={(e) => setPhonetic(i, "audio", e.target.value)}
                      placeholder="URL audio"
                      className="arena-field flex-1"
                    />
                    <input
                      value={p.locale}
                      onChange={(e) => setPhonetic(i, "locale", e.target.value)}
                      placeholder="us/uk"
                      className="arena-field w-20"
                    />
                    <button
                      type="button"
                      onClick={() => removePhonetic(i)}
                      className="grid size-11 shrink-0 place-items-center rounded-lg border border-danger/30 bg-danger/10 text-danger transition hover:bg-danger/20"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {form.phonetics.length === 0 && (
                  <p className="text-xs text-muted">Chưa có phiên âm nào.</p>
                )}
              </div>
            </div>

            {formError && (
              <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-copy" role="alert">
                {formError}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeForm}
                disabled={busy}
                className="min-h-11 rounded-lg border border-line bg-surface-raised px-4 text-sm font-semibold disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={busy}
                className="min-h-11 rounded-lg bg-signal px-5 text-sm font-bold text-background transition hover:brightness-105 disabled:opacity-50"
              >
                {busy && <LoaderCircle className="mr-2 inline animate-spin" size={16} />}
                {uploading ? "Đang tải ảnh..." : saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
            </section>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
