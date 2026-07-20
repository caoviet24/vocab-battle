import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  detectImage,
  MAX_IMAGE_SIZE,
  normalizeUploadType,
  storedImagePath,
  UPLOAD_ROOT,
  uploadDirectory,
} from "@/lib/image-upload";

export const runtime = "nodejs";

type Context = { params: Promise<{ type: string }> };

export async function POST(request: Request, { params }: Context) {
  const type = normalizeUploadType((await params).type);
  if (!type) return Response.json({ message: "Loại ảnh không hợp lệ." }, { status: 404 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_SIZE) {
      return Response.json({ message: "Ảnh phải có dung lượng từ 1 byte đến 5 MB." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const image = detectImage(bytes);
    if (!image) {
      return Response.json({ message: "Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP hợp lệ." }, { status: 415 });
    }

    const segments = uploadDirectory(type, String(form.get("topic") ?? ""));
    if (!segments) {
      return Response.json({ message: "Ảnh từ vựng phải có chủ đề." }, { status: 400 });
    }

    const filename = `${randomUUID()}.${image.extension}`;
    await mkdir(path.join(/* turbopackIgnore: true */ UPLOAD_ROOT, ...segments), { recursive: true });
    await writeFile(path.join(/* turbopackIgnore: true */ UPLOAD_ROOT, ...segments, filename), bytes, { flag: "wx" });

    const url = `/uploads/${[...segments, filename].map(encodeURIComponent).join("/")}`;
    return Response.json({ url }, { status: 201 });
  } catch {
    return Response.json({ message: "Không thể tải ảnh lúc này." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const type = normalizeUploadType((await params).type);
  if (!type) return Response.json({ message: "Loại ảnh không hợp lệ." }, { status: 404 });

  let url: unknown;
  try {
    ({ url } = (await request.json()) as { url?: unknown });
  } catch {
    return Response.json({ message: "Dữ liệu xóa ảnh không hợp lệ." }, { status: 400 });
  }

  const segments = typeof url === "string" ? storedImagePath(url) : null;
  if (!segments || normalizeUploadType(segments[0]) !== type) {
    return Response.json({ message: "Đường dẫn ảnh không hợp lệ." }, { status: 400 });
  }

  try {
    await unlink(path.join(/* turbopackIgnore: true */ UPLOAD_ROOT, ...segments));
    return new Response(null, { status: 204 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 204 });
    return Response.json({ message: "Không thể xóa ảnh lúc này." }, { status: 500 });
  }
}
