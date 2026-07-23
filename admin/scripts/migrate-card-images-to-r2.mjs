import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const concurrency = 2;

async function forEachConcurrent(items, callback) {
  for (let index = 0; index < items.length; index += concurrency) {
    await Promise.all(items.slice(index, index + concurrency).map(callback));
  }
}

function extensionFor(contentType, context = "") {
  switch (contentType.split(";", 1)[0].trim().toLowerCase()) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    default: throw new Error(`${context}: unsupported image type ${contentType || "unknown"}; expected JPEG, PNG, or WebP`);
  }
}

function folderFor(name) {
  const folder = name.trim().replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 100);
  if (!folder) throw new Error("Category name cannot be used as an R2 folder.");
  return folder;
}

function isR2Image(imageUrl, publicUrl) {
  return imageUrl.startsWith(`${publicUrl}/`);
}

function errorRecord(card, error) {
  return {
    card_id: card.card_id,
    word: card.word,
    category_id: card.category_id,
    image_url: card.image_url,
    error: error.message,
  };
}

if (args.includes("--self-test")) {
  assert.equal(extensionFor("image/jpeg"), "jpg");
  assert.equal(extensionFor("image/webp; charset=binary"), "webp");
  assert.throws(() => extensionFor("image/gif", "card 1"), /card 1: unsupported image type image\/gif/);
  assert.equal(folderFor("1000 Word common"), "1000_Word_common");
  assert.equal(isR2Image("https://assets.example.com/uploads/word/card.jpg", "https://assets.example.com"), true);
  assert.equal(isR2Image("https://images.example.com/card.jpg", "https://assets.example.com"), false);
  assert.deepEqual(errorRecord({ card_id: 1, word: "audio", category_id: 2, image_url: "https://example.com/a.mp3" }, new Error("not an image")), {
    card_id: 1, word: "audio", category_id: 2, image_url: "https://example.com/a.mp3", error: "not an image",
  });
  let running = 0;
  let maxRunning = 0;
  await forEachConcurrent([1, 2, 3], async () => {
    maxRunning = Math.max(maxRunning, ++running);
    await Promise.resolve();
    running -= 1;
  });
  assert.equal(maxRunning, concurrency);
  console.log("self-test passed");
  process.exit();
}

process.loadEnvFile(new URL("../../.env.product", import.meta.url));

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const sourceApiUrl = (process.env.SOURCE_API_URL ?? "https://api.urms.io.vn").replace(/\/$/, "");
const targetApiUrl = (process.env.TARGET_API_URL ?? required("NEXT_PUBLIC_API_URL")).replace(/\/$/, "");
const endpoint = required("R2_ENDPOINT").replace(/\/$/, "");
const bucket = required("R2_BUCKET");
const publicUrl = required("R2_PUBLIC_URL").replace(/\/$/, "");
const prefix = (process.env.R2_UPLOAD_PREFIX ?? "uploads").replace(/^\/+|\/+$/g, "");

if (new URL(endpoint).pathname !== "/") {
  throw new Error("R2_ENDPOINT must not include the bucket name.");
}

const r2 = new S3Client({
  endpoint,
  region: "auto",
  credentials: {
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  },
});

async function cards(categoryId, page) {
  const url = new URL(`${sourceApiUrl}/api/cards`);
  url.search = new URLSearchParams({ categoryId, page: String(page), pageSize: "20" });
  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`skipped page: ${categoryId}/${page} (API ${response.status})`);
    return null;
  }
  return response.json();
}

async function categories() {
  const response = await fetch(`${sourceApiUrl}/api/categories`);
  if (!response.ok) throw new Error(`GET /api/categories failed: ${response.status}`);
  return response.json();
}

function cardInput(card, imageUrl) {
  return {
    word: card.word,
    type: card.type,
    explanation: card.explanation,
    translation: card.translation,
    example: card.example,
    phonetics: card.phonetics,
    image_url: imageUrl,
    difficulty: card.difficulty,
    category_id: card.category_id,
  };
}

async function migrate(card, folder) {
  if (!card.image_url || isR2Image(card.image_url, publicUrl)) return "skipped";
  if (dryRun) return "planned";
  const label = `card ${card.card_id} (${card.word}) in category ${card.category_id}`;
  const sourceUrl = new URL(card.image_url, `${sourceApiUrl}/`);
  const source = await fetch(sourceUrl);
  if (!source.ok) throw new Error(`${label}: GET ${sourceUrl} failed (${source.status} ${source.statusText})`);
  const contentType = source.headers.get("content-type") ?? "";
  const extension = extensionFor(contentType, `${label}: ${sourceUrl}`);
  const key = [prefix, "word", folder, `${randomUUID()}.${extension}`].filter(Boolean).join("/");
  const bytes = new Uint8Array(await source.arrayBuffer());
  const imageUrl = `${publicUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;

  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: bytes,
    ContentType: contentType.split(";", 1)[0],
    CacheControl: "public, max-age=31536000, immutable",
  }));

  const response = await fetch(`${targetApiUrl}/api/cards/${card.card_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cardInput(card, imageUrl)),
  });
  if (!response.ok) throw new Error(`${label}: PUT /api/cards/${card.card_id} failed (${response.status} ${response.statusText})`);
  return "migrated";
}

let migrated = 0;
let skipped = 0;
let skippedPages = 0;
const errors = [];
console.log(`Source: ${sourceApiUrl}; target: ${targetApiUrl}`);
for (const category of await categories()) {
  const folder = folderFor(category.name);
  console.log(`R2 folder: word/${folder}`);
  const firstPage = await cards(category.category_id, 1);
  if (!firstPage) {
    skippedPages += 1;
    continue;
  }
  for (let page = 1; page <= firstPage.total_pages; page += 1) {
    const result = page === 1 ? firstPage : await cards(category.category_id, page);
    if (!result) {
      skippedPages += 1;
      continue;
    }
    await forEachConcurrent(result.items, async (card) => {
      try {
        const status = await migrate(card, folder);
        if (status === "skipped") skipped += 1;
        else migrated += 1;
        console.log(`${status}: ${card.word}`);
      } catch (error) {
        errors.push(errorRecord(card, error));
        console.error(`error (skipped): ${error.message}`);
      }
    });
  }
}

const errorsFile = new URL("../migrate-card-images-errors.json", import.meta.url);
await writeFile(errorsFile, `${JSON.stringify(errors, null, 2)}\n`);
console.log(`${dryRun ? "Planned" : "Migrated"}: ${migrated}; skipped cards: ${skipped}; errors: ${errors.length}; skipped pages: ${skippedPages}`);
console.log(`Errors written: ${errorsFile.pathname}`);
