"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, RefreshCw, X } from "lucide-react";

type Category = {
  category_id: string;
  name: string;
  description: string;
  created_at: string;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCategories = () => {
    fetch(`${API}/api/categories`)
      .then((r) => r.json())
      .then((data: Category[]) => setCategories(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setShowForm(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setName(c.name);
    setDescription(c.description);
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const url = editing ? `${API}/api/categories/${editing.category_id}` : `${API}/api/categories`;
    await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    setSaving(false);
    setShowForm(false);
    fetchCategories();
  };

  const remove = async (c: Category) => {
    if (!confirm(`Xóa danh mục "${c.name}"? Các từ vựng thuộc danh mục sẽ không bị xóa.`)) return;
    await fetch(`${API}/api/categories/${c.category_id}`, { method: "DELETE" });
    fetchCategories();
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Danh mục</h1>
          <p className="text-sm text-muted">{categories.length} danh mục</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchCategories}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface-raised px-3 py-2 transition hover:bg-line/50"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-electric px-4 py-2 text-sm font-medium text-white transition hover:bg-electric/80"
          >
            <Plus size={16} /> Thêm danh mục
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-muted">Đang tải...</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface/60">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-surface-raised text-left text-muted text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3 font-medium">Tên</th>
                <th className="hidden p-3 font-medium sm:table-cell">Mô tả</th>
                <th className="hidden p-3 font-medium md:table-cell">Ngày tạo</th>
                <th className="p-3 text-right font-medium">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.category_id} className="border-b border-line/50 transition hover:bg-surface/60">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="hidden p-3 text-muted sm:table-cell">{c.description || "—"}</td>
                  <td className="hidden p-3 text-muted md:table-cell">
                    {new Date(c.created_at).toLocaleDateString("vi-VN")}
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
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted">
                    Chưa có danh mục nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={save}
            className="arena-panel w-full max-w-md p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing ? "Sửa danh mục" : "Thêm danh mục"}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <label className="mb-1 block text-sm text-muted">Tên</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="arena-field mb-3"
            />
            <label className="mb-1 block text-sm text-muted">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="arena-field"
            />
            <div className="mt-4 flex justify-end gap-2">
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