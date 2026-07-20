import path from "node:path";

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const UPLOAD_ROOT =
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), "storage", "uploads");

export type StoredImage = { extension: "jpg" | "png" | "webp"; mime: string };
export type UploadType = "category" | "user" | "word";

const IMAGE_FILENAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function normalizeUploadType(value: string): UploadType | null {
  if (value === "category" || value === "categories") return "category";
  return value === "user" || value === "word" ? value : null;
}

export function uploadDirectory(type: UploadType, topic?: string, now = new Date()): string[] | null {
  if (type === "category") return [type];
  if (type === "user") {
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return [type, `${day}-${month}-${now.getFullYear()}`];
  }

  const safeTopic = topic
    ?.trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
  return safeTopic ? [type, safeTopic] : null;
}

export function isStoredImagePath(segments: string[]): boolean {
  const [type, folder, filename] = segments;
  if (!type || !folder) return false;
  if (type === "category") return segments.length === 2 && IMAGE_FILENAME.test(folder);
  if (type === "user") {
    return segments.length === 3 && /^\d{2}-\d{2}-\d{4}$/.test(folder) && IMAGE_FILENAME.test(filename ?? "");
  }
  if (type === "word") {
    return segments.length === 3 && /^[\p{L}\p{N}_-]{1,100}$/u.test(folder) && IMAGE_FILENAME.test(filename ?? "");
  }

  // Keep previously uploaded category images readable/removable.
  return type === "categories" && /^\d{4}$/.test(folder) &&
    /^(0[1-9]|1[0-2])$/.test(filename ?? "") &&
    segments.length === 4 && IMAGE_FILENAME.test(segments[3]);
}

export function storedImagePath(url: string): string[] | null {
  if (!url.startsWith("/uploads/")) return null;
  try {
    const segments = new URL(url, "http://local").pathname
      .slice("/uploads/".length)
      .split("/")
      .map(decodeURIComponent);
    return isStoredImagePath(segments) ? segments : null;
  } catch {
    return null;
  }
}

export function detectImage(bytes: Uint8Array): StoredImage | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", mime: "image/jpeg" };
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { extension: "png", mime: "image/png" };
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { extension: "webp", mime: "image/webp" };
  }
  return null;
}
