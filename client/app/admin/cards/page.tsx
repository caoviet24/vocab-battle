"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useCardService } from "@/hooks/useCardService";
import { useCategoryService } from "@/hooks/useCategoryService";
import { deleteUploadedImage } from "@/services/uploads";
import type { Card, CardForm, Phonetic } from "@/types/type";

const DEFAULT_PAGE_SIZE = 20;

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
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setOriginalImageUrl("");
    setForm({ ...EMPTY_FORM, category_id: categoryId });
    setShowForm(true);
  };

  const openEdit = (c: Card) => {
    const { card_id, ...rest } = c;
    setEditingId(card_id);
    setOriginalImageUrl(c.image_url);
    setForm(rest);
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await updateCard({ id: editingId, card: form });
        if (originalImageUrl !== form.image_url) await deleteUploadedImage(originalImageUrl);
      } else await createCard(form);
      setShowForm(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không thể lưu từ vựng");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Card) => {
    if (
      !confirm(`Xóa từ "${c.word}"?
      `)
    )
      return;
    try {
      await deleteCard(c.card_id);
      await deleteUploadedImage(c.image_url);
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

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Từ vựng</h1>
          <p className="text-sm text-muted">{total} từ</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void refreshCards()}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface-raised px-3 py-2 transition hover:bg-line/50"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/80"
          >
            <Plus size={16} /> Thêm từ
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="arena-field w-auto min-h-0 py-2 text-sm"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>
              {c.name}
            </option>
          ))}
        </select>
        <form onSubmit={submitSearch} className="flex gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm từ..."
            className="arena-field w-auto min-h-0 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm transition hover:bg-line/50"
          >
            Tìm
          </button>
        </form>
      </div>

      {/* Table */}
      {loading ? (
        <p className="py-12 text-center text-muted">Đang tải...</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface/60">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-surface-raised text-left text-muted text-xs uppercase tracking-wider">
              <tr>
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
                  className="border-b border-line/50 transition hover:bg-surface/60"
                >
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
                        className="rounded-lg border border-line bg-surface-raised p-2 transition hover:bg-electric/10 hover:text-electric"
                        title="Sửa"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => remove(c)}
                        className="rounded-lg border border-danger/30 bg-danger/10 p-2 text-danger transition hover:bg-danger/20"
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
                  <td colSpan={6} className="p-8 text-center text-muted">
                    Không có từ vựng nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
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
              className="rounded-lg border border-line bg-surface-raised px-2 py-1.5"
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
              className="flex items-center gap-1 rounded-lg border border-line bg-surface-raised px-3 py-1.5 disabled:opacity-30"
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
                className="w-14 rounded-lg border border-line bg-surface-raised px-2 py-1.5 text-center tabular-nums"
              />
              <span>/ {totalPages}</span>
            </form>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="flex items-center gap-1 rounded-lg border border-line bg-surface-raised px-3 py-1.5 disabled:opacity-30"
            >
              Sau <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-background/70 backdrop-blur-sm p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={save}
            className="arena-panel my-8 w-full max-w-2xl p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingId ? "Sửa từ vựng" : "Thêm từ vựng"}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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

            <label className="mb-1 mt-3 block text-sm text-muted">
              Ảnh (URL)
            </label>
            <input
              value={form.image_url}
              onChange={(e) => setField("image_url", e.target.value)}
              className="arena-field"
            />

            {/* Phonetics */}
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
                      className="shrink-0 rounded-lg border border-danger/30 bg-danger/10 p-2 text-danger transition hover:bg-danger/20"
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

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-line bg-surface-raised px-4 py-2 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
