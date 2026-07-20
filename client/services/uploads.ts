import type { UploadType } from "@/lib/image-upload";

async function responseMessage(response: Response, fallback: string) {
  const result = (await response.json().catch(() => ({}))) as { message?: string };
  return result.message ?? fallback;
}

export async function uploadImage(file: File, type: UploadType, topic?: string) {
  const body = new FormData();
  body.append("file", file);
  if (topic) body.append("topic", topic);

  const response = await fetch(`/api/uploads/${type}`, { method: "POST", body });
  const result = (await response.json().catch(() => ({}))) as { url?: string; message?: string };
  if (!response.ok || !result.url) throw new Error(result.message ?? "Không thể tải ảnh.");
  return result.url;
}

export async function deleteUploadedImage(url: string) {
  if (!url.startsWith("/uploads/")) return;
  const type = url.split("/")[2];
  const response = await fetch(`/api/uploads/${type}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(await responseMessage(response, "Không thể xóa ảnh."));
}
