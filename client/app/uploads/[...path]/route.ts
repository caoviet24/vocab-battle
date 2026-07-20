import { readFile } from "node:fs/promises";
import path from "node:path";
import { isStoredImagePath, UPLOAD_ROOT } from "@/lib/image-upload";

export const runtime = "nodejs";

const MIME = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const filename = segments.at(-1);
  const extension = filename?.split(".").pop() as keyof typeof MIME | undefined;

  if (!isStoredImagePath(segments) || !extension) {
    return new Response(null, { status: 404 });
  }

  try {
    const bytes = await readFile(path.join(/* turbopackIgnore: true */ UPLOAD_ROOT, ...segments));
    return new Response(bytes, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": MIME[extension],
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
