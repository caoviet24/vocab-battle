"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ImageIcon,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCategoryService } from "@/hooks/useCategoryService";
import { deleteUploadedImage, uploadImage } from "@/services/uploads";
import type { Category } from "@/types/type";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];

export default function CategoriesPage() {
  const {
    categories,
    loading,
    saving,
    refreshCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategoryService();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");

  const localPreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : ""),
    [imageFile],
  );
  const previewUrl = localPreview || imageUrl;
  const busy = saving || uploading;

  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [localPreview],
  );

  const resetForm = (category?: Category) => {
    setEditing(category ?? null);
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setImageUrl(category?.image_url ?? "");
    setImageFile(null);
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (!busy) setShowForm(false);
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

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    let uploadedUrl = "";
    let saved = false;
    try {
      setUploading(Boolean(imageFile));
      uploadedUrl = imageFile ? await uploadImage(imageFile, "category") : "";
      const finalImageUrl = uploadedUrl || imageUrl;
      const category = {
        name: name.trim(),
        description: description.trim(),
        image_url: finalImageUrl,
      };
      if (editing) {
        await updateCategory({ id: editing.category_id, ...category });
      } else {
        await createCategory(category);
      }
      saved = true;
      if (editing?.image_url && editing.image_url !== finalImageUrl) {
        await deleteUploadedImage(editing.image_url, "category");
      }
      setShowForm(false);
    } catch (error) {
      if (!saved && uploadedUrl) await deleteUploadedImage(uploadedUrl, "category").catch(() => undefined);
      setFormError(error instanceof Error ? error.message : "Không thể lưu danh mục.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (category: Category) => {
    if (!confirm(`Xóa danh mục "${category.name}"? Các từ vựng thuộc danh mục sẽ không bị xóa.`)) return;
    try {
      await deleteCategory(category.category_id);
      await deleteUploadedImage(category.image_url, "category");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không thể xóa danh mục");
    }
  };

  return (
    <main id="main-content" className="admin-dashboard flex-1">
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <header className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between sm:pb-10">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric">
            Nội dung học
          </p>
          <h1 className="mt-3 min-w-0 max-w-[16ch] break-words font-display text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[0.94] tracking-[-0.06em] text-foreground">
            Danh mục từ vựng
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">Tạo và chỉnh sửa các bộ từ để giữ nội dung học dễ tìm, dễ vận hành.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void refreshCategories()}
            className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-line bg-surface-raised text-muted transition hover:border-electric/50 hover:text-electric"
            aria-label="Tải lại danh mục"
            title="Tải lại"
          >
            <RefreshCw size={17} />
          </button>
          <button
            type="button"
            onClick={() => resetForm()}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-bold text-background transition hover:brightness-105"
          >
            <Plus size={17} /> Thêm danh mục
          </button>
        </div>
      </header>

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" aria-label="Đang tải danh mục">
          {[0, 1, 2].map((item) => (
            <div key={item} className={`h-72 animate-pulse rounded-xl border border-line bg-surface ${item === 0 ? "sm:col-span-2" : ""}`} />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <section className="mt-8 grid min-h-72 place-items-center rounded-xl border border-dashed border-line bg-surface/60 p-8 text-center">
          <div>
            <ImagePlus className="mx-auto text-electric" size={30} aria-hidden="true" />
            <h2 className="font-display mt-4 text-xl font-bold">Chưa có danh mục</h2>
            <p className="mt-1 text-sm text-muted">Tạo bộ từ đầu tiên và thêm ảnh nhận diện.</p>
            <button type="button" onClick={() => resetForm()} className="mt-5 min-h-11 rounded-lg bg-signal px-4 text-sm font-bold text-background transition hover:brightness-105">Tạo danh mục</button>
          </div>
        </section>
      ) : (
        <section className="mt-8 overflow-hidden rounded-xl border border-line bg-surface shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-raised px-4 py-3 sm:px-5">
            <p className="font-display text-lg font-extrabold tracking-[-0.03em]">Danh mục hiện có <span className="font-mono text-sm font-semibold text-electric">{categories.length}</span></p>
            <p className="text-sm text-muted">Chọn một mục để chỉnh sửa</p>
          </div>
          <div className="divide-y divide-line">
          {categories.map((category) => (
            <article
              key={category.category_id}
              className="group grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-3 p-3 transition hover:bg-surface-raised sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:gap-5 sm:p-4"
            >
              <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-surface-raised">
                {category.image_url ? (
                  <div
                    role="img"
                    aria-label={`Ảnh danh mục ${category.name}`}
                    className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-[1.02]"
                    style={{ backgroundImage: `url(${category.image_url})` }}
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-muted">
                    <ImageIcon size={30} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="min-w-0 self-center">
                <h2 className="truncate font-display text-lg font-extrabold tracking-[-0.03em] text-foreground sm:text-xl">{category.name}</h2>
                <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-6 text-muted">{category.description || "Chưa có mô tả"}</p>
                <p className="mt-2 font-mono text-xs text-muted">Tạo ngày {new Date(category.created_at).toLocaleDateString("vi-VN")}</p>
              </div>
              <div className="flex shrink-0 self-center gap-1">
                <button
                  type="button"
                  onClick={() => resetForm(category)}
                  className="grid size-11 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:border-electric/50 hover:text-electric"
                  aria-label={`Sửa ${category.name}`}
                  title="Sửa"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(category)}
                  className="grid size-11 place-items-center rounded-lg border border-danger/30 bg-danger/10 text-danger transition hover:bg-danger/20"
                  aria-label={`Xóa ${category.name}`}
                  title="Xóa"
                >
                  <Trash2 size={15} />
                </button>
                </div>
            </article>
          ))}
          </div>
        </section>
      )}
      </section>

      {showForm && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] grid place-items-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeForm();
          }}
        >
          <form
            onSubmit={save}
            className="arena-panel my-auto w-full max-w-3xl overflow-hidden rounded-xl"
            aria-labelledby="category-form-title"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
              <div>
                <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-electric">
                  {editing ? "Chỉnh sửa" : "Danh mục mới"}
                </p>
                <h2 id="category-form-title" className="font-display mt-1 text-xl font-bold">
                  {editing ? editing.name : "Tạo bộ từ vựng"}
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

            <div className="grid md:grid-cols-[0.9fr_1.1fr]">
              <section className="border-b border-line bg-surface-raised p-5 md:border-b-0 md:border-r sm:p-6">
                <p className="mb-3 text-sm font-semibold">Ảnh đại diện</p>
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-background">
                  {previewUrl ? (
                    <div
                      role="img"
                      aria-label="Xem trước ảnh danh mục"
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${previewUrl})` }}
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center p-6 text-center text-muted">
                      <div>
                        <ImageIcon className="mx-auto" size={32} strokeWidth={1.5} />
                        <p className="mt-3 text-sm">Ảnh xem trước sẽ xuất hiện ở đây</p>
                      </div>
                    </div>
                  )}
                </div>
                <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-background px-4 text-sm font-semibold transition hover:border-electric/50 hover:text-electric">
                  <Upload size={16} /> {previewUrl ? "Chọn ảnh khác" : "Chọn ảnh"}
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
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImageUrl("");
                    }}
                    className="mt-2 min-h-11 w-full rounded-lg text-sm font-semibold text-muted transition hover:bg-danger/10 hover:text-danger"
                  >
                    Xóa ảnh
                  </button>
                )}
                <p className="mt-3 text-xs leading-5 text-muted">JPEG, PNG hoặc WebP · tối đa 5 MB</p>
              </section>

              <section className="p-5 sm:p-6">
                <label htmlFor="category-name" className="mb-1.5 block text-sm font-semibold">
                  Tên danh mục <span className="text-danger">*</span>
                </label>
                <input
                  id="category-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={100}
                  placeholder="Ví dụ: Tiếng Anh công sở"
                  className="arena-field"
                />

                <label htmlFor="category-description" className="mb-1.5 mt-5 block text-sm font-semibold">
                  Mô tả
                </label>
                <textarea
                  id="category-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="Nội dung và trình độ phù hợp với bộ từ này"
                  className="arena-field resize-y"
                />

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
                    className="min-h-11 rounded-lg border border-line bg-surface-raised px-4 text-sm font-semibold transition hover:bg-line/40 disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !name.trim()}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-signal px-5 text-sm font-bold text-background transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy && <LoaderCircle className="animate-spin" size={16} />}
                    {uploading ? "Đang tải ảnh..." : saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo danh mục"}
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
