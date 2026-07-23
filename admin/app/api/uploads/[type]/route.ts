import { randomUUID } from "node:crypto";
import { MAX_IMAGE_SIZE, normalizeUploadType } from "@/lib/image-upload";
import { deleteR2Image, presignedImageUpload } from "@/lib/r2-upload";

export const runtime = "nodejs";

type Context = { params: Promise<{ type: string }> };
type UploadInput = { contentType?: unknown; size?: unknown; topic?: unknown };

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"] as const);

export async function POST(request: Request, { params }: Context) {
  const type = normalizeUploadType((await params).type);
  if (!type) return Response.json({ message: "Loại ảnh không hợp lệ." }, { status: 404 });

  try {
    const { contentType, size, topic } = (await request.json()) as UploadInput;
    if (
      typeof contentType !== "string" ||
      !imageTypes.has(contentType as "image/jpeg" | "image/png" | "image/webp") ||
      (type === "frame" && contentType !== "image/webp") ||
      typeof size !== "number" ||
      !Number.isInteger(size) || size < 1 || size > MAX_IMAGE_SIZE
    ) {
      return Response.json({ message: type === "frame" ? "Frame phải là ảnh WebP, dung lượng tối đa 5 MB." : "Ảnh phải là JPEG, PNG hoặc WebP, dung lượng tối đa 5 MB." }, { status: 400 });
    }
    const imageType = contentType as "image/jpeg" | "image/png" | "image/webp";
    const extension = imageType === "image/jpeg" ? "jpg" : imageType.slice("image/".length);
    const result = await presignedImageUpload(type, `${randomUUID()}.${extension}`, imageType, typeof topic === "string" ? topic : undefined);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Không thể tạo URL tải ảnh." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const type = normalizeUploadType((await params).type);
  if (!type) return Response.json({ message: "Loại ảnh không hợp lệ." }, { status: 404 });

  try {
    const { url } = (await request.json()) as { url?: unknown };
    if (typeof url !== "string" || !(await deleteR2Image(url, type))) {
      return Response.json({ message: "Đường dẫn ảnh không hợp lệ." }, { status: 400 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Không thể xóa ảnh." }, { status: 500 });
  }
}
