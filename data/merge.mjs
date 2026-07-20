#!/usr/bin/env node

"use strict";

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { ObjectId } from "mongodb";
import { parser } from "stream-json";
import { streamArray } from "stream-json/streamers/stream-array.js";
import chain from "stream-chain";

// ======================================================
// XÁC ĐỊNH THƯ MỤC CHỨA FILE JS
// ======================================================

const ROOT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: path.join(ROOT_DIRECTORY, ".env.local"),
});

// ======================================================
// CẤU HÌNH ĐƯỜNG DẪN
// ======================================================

const INPUT_FILE_NAME = "C1.json";

const INPUT_FILE_PATH = path.join(
  ROOT_DIRECTORY,
  "output",
  INPUT_FILE_NAME,
);

const OUTPUT_FILE_PATH = path.join(
  ROOT_DIRECTORY,
  "merge",
  INPUT_FILE_NAME.replace(/\.json$/i, "") + ".merge.json",
);

// Hiển thị tiến độ sau mỗi số lượng bản ghi này.
const PROGRESS_INTERVAL = 1_000;

// ======================================================
// CÁC HÀM HỖ TRỢ
// ======================================================

/**
 * Chuyển dữ liệu thành chuỗi.
 * Trường không tồn tại sẽ trả về chuỗi rỗng.
 *
 * @param {unknown} value
 * @returns {string}
 */
function toStringOrEmpty(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

/**
 * Lấy phần tử tại vị trí chỉ định trong mảng.
 * Nếu không có sẽ trả về chuỗi rỗng.
 *
 * @param {unknown} value
 * @param {number} index
 * @returns {string}
 */
function getArrayItem(value, index = 0) {
  if (!Array.isArray(value)) {
    return "";
  }

  return toStringOrEmpty(value[index]);
}

/**
 * Lấy đường dẫn audio.
 * Ưu tiên MP3, nếu không có thì lấy OGG.
 *
 * @param {unknown} pronunciation
 * @returns {string}
 */
function getAudioUrl(pronunciation) {
  if (
    !pronunciation ||
    typeof pronunciation !== "object" ||
    Array.isArray(pronunciation)
  ) {
    return "";
  }

  return toStringOrEmpty(
    pronunciation.mp3 || pronunciation.ogg,
  );
}

/**
 * Tạo ObjectId mới của MongoDB.
 *
 * @returns {string}
 */
function createMongoObjectId() {
  return new ObjectId().toHexString();
}

/**
 * Chuẩn hóa dữ liệu nguồn.
 *
 * Hỗ trợ cả hai dạng:
 *
 * {
 *   "id": 5940,
 *   "value": {
 *     "word": "young"
 *   }
 * }
 *
 * Hoặc:
 *
 * {
 *   "word": "young"
 * }
 *
 * @param {unknown} item
 * @returns {Record<string, any>}
 */
function getSourceValue(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return {};
  }

  if (
    item.value &&
    typeof item.value === "object" &&
    !Array.isArray(item.value)
  ) {
    return item.value;
  }

  return item;
}

// ======================================================
// TẠO CÁC TRƯỜNG DỮ LIỆU ĐÍCH
// ======================================================

/**
 * Tạo phần giải thích đa ngôn ngữ.
 *
 * @param {Record<string, any>} source
 */
function createExplanation(source) {
  return {
    en: toStringOrEmpty(source.definition),
    vi: toStringOrEmpty(source.definition_vi),
    th: "",
    id: "",
    ar: "",
    ja: "",
  };
}

/**
 * Tạo phần bản dịch đa ngôn ngữ.
 *
 * @param {Record<string, any>} source
 */
function createTranslation(source) {
  let vietnameseTranslation = "";

  // Dạng nguồn:
  // "translation": "trẻ"
  if (typeof source.translation === "string") {
    vietnameseTranslation = source.translation;
  }

  // Hỗ trợ trường hợp:
  // "translation": {
  //   "vi": "trẻ"
  // }
  if (
    source.translation &&
    typeof source.translation === "object" &&
    !Array.isArray(source.translation)
  ) {
    vietnameseTranslation =
      source.translation.vi ??
      source.translation.en ??
      "";
  }

  return {
    vi: toStringOrEmpty(vietnameseTranslation),
    th: "",
    id: "",
    ar: "",
    ja: "",
  };
}

/**
 * Tạo danh sách phiên âm.
 *
 * @param {Record<string, any>} source
 */
function createPhonetics(source) {
  const phonetics =
    source.phonetics &&
    typeof source.phonetics === "object" &&
    !Array.isArray(source.phonetics)
      ? source.phonetics
      : {};

  return [
    {
      text: toStringOrEmpty(phonetics.uk),
      audio: getAudioUrl(source.uk),
      locale: "en-UK",
    },
    {
      text: toStringOrEmpty(phonetics.us),
      audio: getAudioUrl(source.us),
      locale: "en-US",
    },
  ];
}

/**
 * Tạo câu ví dụ đa ngôn ngữ.
 *
 * Do cấu trúc đích chỉ có một câu ví dụ,
 * chương trình lấy câu đầu tiên trong examples và example_vi.
 *
 * @param {Record<string, any>} source
 */
function createExample(source) {
  return {
    en: getArrayItem(source.examples, 0),
    vi: getArrayItem(source.example_vi, 0),
    th: "",
    id: "",
    ar: "",
    ja: "",
  };
}

/**
 * Tạo quiz option đúng.
 *
 * Dữ liệu nguồn không có các đáp án sai nên quiz_options
 * chỉ tạo một đáp án đúng.
 *
 * @param {Record<string, any>} source
 */
function createCorrectQuizOption(source) {
  return {
    word: toStringOrEmpty(source.word),
    explanation: createExplanation(source),
    translation: createTranslation(source),
    phonetics: createPhonetics(source),
    is_correct: true,
  };
}

/**
 * Chuyển một phần tử từ cấu trúc cũ sang cấu trúc mới.
 *
 * @param {unknown} item
 */
function transformItem(item) {
  const source = getSourceValue(item);

  return {
    card_id: createMongoObjectId(),

    word: toStringOrEmpty(source.word),

    explanation: createExplanation(source),

    translation: createTranslation(source),

    type: toStringOrEmpty(source.type),

    phonetics: createPhonetics(source),

    example: createExample(source),

    image_url: "",

    group_id: "",

    group_name: "",

    deck_id: "",

    deck_name: "",

    quiz_options: [
      createCorrectQuizOption(source),
    ],
  };
}

// ======================================================
// GHI STREAM VÀ XỬ LÝ BACKPRESSURE
// ======================================================

/**
 * Ghi dữ liệu ra stream.
 * Khi bộ đệm đầy, chờ sự kiện drain trước khi ghi tiếp.
 *
 * @param {fs.WriteStream} outputStream
 * @param {string} content
 */
async function writeToStream(outputStream, content) {
  const canContinue = outputStream.write(content);

  if (!canContinue) {
    await once(outputStream, "drain");
  }
}

// ======================================================
// CHUYỂN ĐỔI FILE JSON
// ======================================================

async function convertJsonFile() {
  console.log("==============================================");
  console.log("BẮT ĐẦU CHUYỂN ĐỔI DỮ LIỆU");
  console.log("==============================================");
  console.log(`File đầu vào : ${INPUT_FILE_PATH}`);
  console.log(`File đầu ra  : ${OUTPUT_FILE_PATH}`);
  console.log("");

  await fsp.access(INPUT_FILE_PATH, fs.constants.R_OK);

  await fsp.mkdir(path.dirname(OUTPUT_FILE_PATH), {
    recursive: true,
  });

  const inputStream = fs.createReadStream(INPUT_FILE_PATH, {
    encoding: "utf8",
    highWaterMark: 1024 * 1024,
  });

  const outputStream = fs.createWriteStream(OUTPUT_FILE_PATH, {
    encoding: "utf8",
    highWaterMark: 1024 * 1024,
  });

  // stream-json phiên bản mới phải ghép pipeline bằng stream-chain.
  const jsonStream = chain([
    inputStream,
    parser(),
    streamArray(),
  ]);

  let processedCount = 0;
  let isFirstItem = true;

  try {
    await writeToStream(outputStream, "[\n");

    for await (const chunk of jsonStream) {
      const transformedItem = transformItem(chunk.value);

      const jsonContent = JSON.stringify(
        transformedItem,
        null,
        2,
      );

      if (!isFirstItem) {
        await writeToStream(outputStream, ",\n");
      }

      await writeToStream(outputStream, jsonContent);

      isFirstItem = false;
      processedCount += 1;

      if (processedCount % PROGRESS_INTERVAL === 0) {
        console.log(
          `Đã xử lý ${processedCount.toLocaleString("vi-VN")} bản ghi...`,
        );
      }
    }

    await writeToStream(outputStream, "\n]\n");

    outputStream.end();

    await once(outputStream, "finish");

    console.log("");
    console.log("==============================================");
    console.log("CHUYỂN ĐỔI HOÀN TẤT");
    console.log("==============================================");
    console.log(
      `Tổng số bản ghi: ${processedCount.toLocaleString("vi-VN")}`,
    );
    console.log(`File kết quả: ${OUTPUT_FILE_PATH}`);
  } catch (error) {
    jsonStream.destroy?.();
    inputStream.destroy();
    outputStream.destroy();

    await fsp.rm(OUTPUT_FILE_PATH, {
      force: true,
    });

    throw error;
  }
}

// ======================================================
// CHẠY CHƯƠNG TRÌNH
// ======================================================

convertJsonFile().catch((error) => {
  console.error("");
  console.error("Không thể chuyển đổi dữ liệu.");

  if (error.code === "ENOENT") {
    console.error(`Không tìm thấy file: ${INPUT_FILE_PATH}`);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
