#!/usr/bin/env node

"use strict";

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIRECTORY = path.dirname(
  fileURLToPath(import.meta.url),
);

dotenv.config({
  path: path.join(ROOT_DIRECTORY, ".env.local"),
});

const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

console.log(PIXABAY_API_KEY);


if (!PIXABAY_API_KEY) {
  throw new Error(
    "Thiếu PIXABAY_API_KEY trong file .env.local",
  );
}

/**
 * Tìm ảnh minh họa trên Pixabay theo từ tiếng Anh.
 *
 * @param {string} word
 * @returns {Promise<object | null>}
 */
async function searchPixabayImage(word) {
  const normalizedWord = String(word || "").trim();

  if (!normalizedWord) {
    return null;
  }

  const query =
    `${normalizedWord} cartoon illustration`;

  const url = new URL("https://pixabay.com/api/");

  url.searchParams.set("key", PIXABAY_API_KEY);
  url.searchParams.set("q", query);
  url.searchParams.set("lang", "en");
  url.searchParams.set("image_type", "illustration");
  url.searchParams.set("orientation", "all");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("order", "popular");
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "20");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorContent = await response.text();

    throw new Error(
      `Pixabay API error ${response.status}: ${errorContent}`,
    );
  }

  const result = await response.json();

  if (!Array.isArray(result.hits) || result.hits.length === 0) {
    return null;
  }

  const image = result.hits[0];

  return {
    id: image.id,

    imageUrl:
      image.largeImageURL ||
      image.webformatURL ||
      image.previewURL ||
      "",

    previewUrl: image.previewURL || "",

    pageUrl: image.pageURL || "",

    tags: image.tags || "",

    width: image.imageWidth || 0,

    height: image.imageHeight || 0,

    author: image.user || "",
  };
}

async function main() {
  const word = process.argv[2] || "academic";

  console.log(`Đang tìm ảnh cho từ: ${word}`);

  const image = await searchPixabayImage(word);

  if (!image) {
    console.log("Không tìm thấy ảnh phù hợp.");
    return;
  }

  console.log("Kết quả:");
  console.log(JSON.stringify(image, null, 2));
}

main().catch((error) => {
  console.error("");
  console.error("Không thể tìm ảnh:");
  console.error(error);
  process.exitCode = 1;
});
