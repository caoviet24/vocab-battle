import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { normalizeUploadType, type UploadType, uploadDirectory } from "@/lib/image-upload";

const MAX_PRESIGNED_URL_TTL = 3600;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Thiếu biến môi trường ${name}.`);
  return value;
}

function config() {
  const ttl = Number(process.env.R2_PRESIGNED_URL_TTL_SECONDS ?? 300);
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > MAX_PRESIGNED_URL_TTL) {
    throw new Error("R2_PRESIGNED_URL_TTL_SECONDS phải từ 1 đến 3600.");
  }

  return {
    endpoint: required("R2_ENDPOINT").replace(/\/$/, ""),
    bucket: required("R2_BUCKET"),
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    publicUrl: required("R2_PUBLIC_URL").replace(/\/$/, ""),
    prefix: (process.env.R2_UPLOAD_PREFIX ?? "uploads").replace(/^\/+|\/+$/g, ""),
    ttl,
  };
}

function client(r2: ReturnType<typeof config>) {
  return new S3Client({
    endpoint: r2.endpoint,
    region: "auto",
    credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
  });
}

function keyFor(type: UploadType, filename: string, topic?: string) {
  const directory = uploadDirectory(type, topic);
  if (!directory) throw new Error("Ảnh từ vựng phải có chủ đề.");
  const prefix = config().prefix;
  return [...(prefix ? [prefix] : []), ...directory, filename].join("/");
}

function publicUrlFor(key: string) {
  return `${config().publicUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function presignedImageUpload(
  type: UploadType,
  filename: string,
  contentType: "image/jpeg" | "image/png" | "image/webp",
  topic?: string,
) {
  const r2 = config();
  const key = keyFor(type, filename, topic);
  const command = new PutObjectCommand({
    Bucket: r2.bucket,
    Key: key,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  });
  const uploadUrl = await getSignedUrl(client(r2), command, { expiresIn: r2.ttl });
  return {
    url: publicUrlFor(key),
    uploadUrl,
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  };
}

export async function deleteR2Image(url: string, type: UploadType) {
  const r2 = config();
  const publicBase = new URL(`${r2.publicUrl}/`);
  const imageUrl = new URL(url);
  if (imageUrl.origin !== publicBase.origin || !imageUrl.pathname.startsWith(publicBase.pathname)) {
    return false;
  }

  const key = decodeURIComponent(imageUrl.pathname.slice(publicBase.pathname.length));
  const parts = key.split("/");
  const prefix = r2.prefix ? r2.prefix.split("/") : [];
  if (
    parts.length <= prefix.length ||
    prefix.some((part, index) => parts[index] !== part) ||
    normalizeUploadType(parts[prefix.length]) !== type
  ) {
    return false;
  }

  await client(r2).send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
  return true;
}
