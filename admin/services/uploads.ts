import type { UploadType } from "@/lib/image-upload";

type PresignedUpload = { url?: string; uploadUrl?: string; headers?: Record<string, string>; message?: string };

async function responseMessage(response: Response, fallback: string) {
  const result = (await response.json().catch(() => ({}))) as { message?: string };
  return result.message ?? fallback;
}

export async function uploadImage(file: File, type: UploadType, topic?: string) {
  const response = await fetch(`/api/uploads/${type}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, size: file.size, topic }),
  });
  const result = (await response.json().catch(() => ({}))) as PresignedUpload;
  if (!response.ok || !result.url || !result.uploadUrl || !result.headers) {
    throw new Error(result.message ?? "Không thể tạo URL tải ảnh.");
  }

  const upload = await fetch(result.uploadUrl, { method: "PUT", headers: result.headers, body: file });
  if (!upload.ok) throw new Error("Không thể tải ảnh lên R2.");
  return result.url;
}

export async function deleteUploadedImage(url: string, type: UploadType) {
  if (!url) return;
  const response = await fetch(`/api/uploads/${type}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (response.status === 400) return;
  if (!response.ok) throw new Error(await responseMessage(response, "Không thể xóa ảnh."));
}
