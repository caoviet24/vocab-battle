#!/usr/bin/env node

"use strict";

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

import { parser } from "stream-json";
import { streamArray } from "stream-json/streamers/stream-array.js";

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
  "PHRASE_VER",
  INPUT_FILE_NAME,
);

const OUTPUT_FILE_PATH = path.join(
  ROOT_DIRECTORY,
  "PHRASE_VER",
  INPUT_FILE_NAME.replace(/\.json$/i, "") + ".translated.json",
);

// ======================================================
// CẤU HÌNH DLX
// ======================================================

/**
 * File .env.local:
 *
 * DLX_BASE_URL=https://dlx.domain.com
 * DLX_TOKEN=your-token
 *
 * Không thêm /translate vào DLX_BASE_URL.
 *
 * Nếu DLX không cấu hình TOKEN thì để trống:
 *
 * DLX_TOKEN=
 */
const DLX_BASE_URL = (process.env.DLX_BASE_URL ?? "http://127.0.0.1:1188")
  .trim()
  .replace(/\/+$/, "");

const DLX_TOKEN = (process.env.DLX_TOKEN ?? "").trim();

const DLX_TRANSLATE_URL = `${DLX_BASE_URL}/translate`;

const SOURCE_LANG = "EN";
const TARGET_LANG = "VI";

/**
 * Giới hạn ký tự cho mỗi lần gọi DLX.
 */
const DLX_MAX_TEXT_LENGTH = 1500;

/**
 * Timeout mỗi request: 30 giây.
 */
const REQUEST_TIMEOUT_MS = 30_000;

// ======================================================
// CẤU HÌNH XỬ LÝ
// ======================================================

/**
 * Để bằng 1 nhằm:
 *
 * - Giữ đúng thứ tự dữ liệu.
 * - Resume chính xác.
 * - Tránh gọi DLX quá nhanh.
 */
const CONCURRENCY = 2;

const RETRY_LIMIT = 4;

const READ_BUFFER_SIZE = 64 * 1024;

const PROGRESS_INTERVAL = 100;

/**
 * Đồng bộ xuống ổ đĩa sau mỗi bản ghi.
 */
const SYNC_INTERVAL = 2;

// ======================================================
// HÀM TIỆN ÍCH
// ======================================================

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fileExists(filePath) {
  return fsp.access(filePath).then(
    () => true,
    () => false,
  );
}

/**
 * Hỗ trợ lấy id ở các vị trí:
 *
 * record.id
 * record._id
 * record.value.id
 * record.value._id
 */
function getRecordId(record) {
  const id =
    record?.id ?? record?._id ?? record?.value?.id ?? record?.value?._id;

  if (id === undefined || id === null || id === "") {
    return null;
  }

  return String(id);
}

/**
 * Phân tích từng dòng trong file output.
 *
 * File output được ghi theo dạng:
 *
 * [
 * {"id":1,...},
 * {"id":2,...}
 * ]
 *
 * Mỗi record nằm trên một dòng để dễ khôi phục.
 */
function parseOutputLine(line) {
  let text = line.replace(/^\uFEFF/, "").trim();

  if (!text) {
    return {
      type: "empty",
    };
  }

  if (text === "[") {
    return {
      type: "array-start",
    };
  }

  if (text === "]") {
    return {
      type: "array-end",
    };
  }

  if (text.startsWith(",")) {
    text = text.slice(1).trimStart();
  }

  if (text.endsWith(",")) {
    text = text.slice(0, -1).trimEnd();
  }

  if (!text) {
    return {
      type: "empty",
    };
  }

  try {
    return {
      type: "record",
      record: JSON.parse(text),
    };
  } catch {
    return {
      type: "invalid",
      raw: line,
    };
  }
}

/**
 * Thay thế file an toàn.
 */
async function replaceFileSafely(sourcePath, destinationPath) {
  const backupPath = `${destinationPath}.resume-backup`;

  const destinationExists = await fileExists(destinationPath);

  await fsp.rm(backupPath, {
    force: true,
  });

  if (destinationExists) {
    await fsp.rename(destinationPath, backupPath);
  }

  try {
    await fsp.rename(sourcePath, destinationPath);

    await fsp.rm(backupPath, {
      force: true,
    });
  } catch (error) {
    if (await fileExists(backupPath)) {
      await fsp
        .rm(destinationPath, {
          force: true,
        })
        .catch(() => {});

      await fsp.rename(backupPath, destinationPath).catch(() => {});
    }

    throw error;
  }
}

// ======================================================
// CHUẨN BỊ FILE OUTPUT ĐỂ RESUME
// ======================================================

/**
 * Khi chạy lại chương trình:
 *
 * 1. Đọc file translated hiện có.
 * 2. Loại bỏ record cuối nếu bị ghi dở.
 * 3. Tìm id cuối cùng đã ghi hoàn chỉnh.
 * 4. Tạo lại file output ở trạng thái có thể append.
 */
async function prepareOutputForResume() {
  const temporaryPath = `${OUTPUT_FILE_PATH}.resume-` + `${process.pid}.tmp`;

  const temporaryHandle = await fsp.open(temporaryPath, "w");

  let existingCount = 0;
  let lastCompletedId = null;

  let sawArrayStart = false;
  let sawInvalidLine = false;
  let preparationError = null;

  try {
    await temporaryHandle.writeFile("[\n", "utf8");

    if (await fileExists(OUTPUT_FILE_PATH)) {
      const stat = await fsp.stat(OUTPUT_FILE_PATH);

      if (stat.size > 0) {
        const inputStream = fs.createReadStream(OUTPUT_FILE_PATH, {
          encoding: "utf8",
          highWaterMark: READ_BUFFER_SIZE,
        });

        const lines = createInterface({
          input: inputStream,
          crlfDelay: Infinity,
        });

        for await (const line of lines) {
          const parsed = parseOutputLine(line);

          if (parsed.type === "array-start") {
            sawArrayStart = true;
            continue;
          }

          if (parsed.type === "empty" || parsed.type === "array-end") {
            continue;
          }

          if (parsed.type === "invalid") {
            /**
             * Có thể chương trình bị tắt
             * khi đang ghi record cuối.
             */
            sawInvalidLine = true;
            continue;
          }

          /**
           * Nếu có record hợp lệ sau dòng lỗi,
           * file có thể bị hỏng ở giữa.
           */
          if (sawInvalidLine) {
            throw new Error(
              "File kết quả bị hỏng ở giữa: " +
                "có record hợp lệ xuất hiện " +
                "sau một dòng JSON lỗi.",
            );
          }

          const recordId = getRecordId(parsed.record);

          if (recordId === null) {
            throw new Error(
              `Bản ghi thứ ${
                existingCount + 1
              } trong file kết quả không có id.`,
            );
          }

          const prefix = existingCount === 0 ? "" : ",\n";

          await temporaryHandle.appendFile(
            prefix + JSON.stringify(parsed.record),
            "utf8",
          );

          existingCount += 1;
          lastCompletedId = recordId;
        }

        if (!sawArrayStart) {
          throw new Error(
            "File kết quả không đúng " +
              "định dạng mảng JSON: " +
              OUTPUT_FILE_PATH,
          );
        }
      }
    }

    await temporaryHandle.sync();
  } catch (error) {
    preparationError = error;
  } finally {
    await temporaryHandle.close();
  }

  if (preparationError) {
    await fsp
      .rm(temporaryPath, {
        force: true,
      })
      .catch(() => {});

    throw preparationError;
  }

  await replaceFileSafely(temporaryPath, OUTPUT_FILE_PATH);

  return {
    existingCount,
    lastCompletedId,
  };
}

// ======================================================
// GỌI DLX
// ======================================================

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Dịch một chuỗi bằng DLX.
 *
 * Request:
 *
 * {
 *   "text": "Hello",
 *   "source_lang": "EN",
 *   "target_lang": "VI"
 * }
 *
 * Response:
 *
 * {
 *   "code": 200,
 *   "data": "Xin chào"
 * }
 */
async function dlxTranslateOne(text) {
  const inputText = String(text ?? "");

  if (!inputText) {
    return "";
  }

  if (inputText.length > DLX_MAX_TEXT_LENGTH) {
    throw new Error(
      `Đoạn văn dài ${inputText.length} ký tự, ` +
        `vượt giới hạn ${DLX_MAX_TEXT_LENGTH} ` +
        "ký tự/request của DLX.",
    );
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (DLX_TOKEN) {
    headers.Authorization = `Bearer ${DLX_TOKEN}`;
  }

  const body = {
    text: inputText,
    source_lang: SOURCE_LANG,
    target_lang: TARGET_LANG,
  };

  for (let attempt = 0; ; attempt += 1) {
    let response;

    try {
      response = await fetchWithTimeout(DLX_TRANSLATE_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (error) {
      const retryable =
        error?.name === "AbortError" || error instanceof TypeError;

      if (!retryable || attempt >= RETRY_LIMIT) {
        throw new Error(
          `Không thể kết nối DLX tại ` +
            `${DLX_TRANSLATE_URL}: ` +
            `${error?.message ?? error}`,
        );
      }

      const delayMs = 2 ** attempt * 1000;

      console.warn(
        `Không kết nối được DLX. ` + `Thử lại sau ${delayMs / 1000}s...`,
      );

      await sleep(delayMs);

      continue;
    }

    const responseText = await response.text();

    let data = null;

    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      // Nếu response không phải JSON,
      // dùng responseText để báo lỗi.
    }

    if (
      response.ok &&
      Number(data?.code ?? 200) === 200 &&
      typeof data?.data === "string"
    ) {
      return data.data;
    }

    const effectiveStatus = Number(data?.code ?? response.status);

    const retryable =
      effectiveStatus === 408 ||
      effectiveStatus === 429 ||
      effectiveStatus >= 500;

    if (!retryable || attempt >= RETRY_LIMIT) {
      const message = data?.message ?? responseText ?? "Không rõ lỗi";

      throw new Error(`DLX ${effectiveStatus}: ` + message);
    }

    const retryAfterSeconds = Number(response.headers.get("retry-after"));

    const delayMs =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : 2 ** attempt * 1000;

    console.warn(
      `DLX trả về ${effectiveStatus}. ` + `Thử lại sau ${delayMs / 1000}s...`,
    );

    await sleep(delayMs);
  }
}

/**
 * DLX nhận một chuỗi mỗi request.
 *
 * Do đó dịch lần lượt:
 *
 * word
 * example 1
 * example 2
 * ...
 */
async function dlxTranslate(texts) {
  const translations = [];

  for (const text of texts) {
    translations.push(await dlxTranslateOne(text));
  }

  return translations;
}

/**
 * Dịch một bản ghi.
 */
/**
 * Dịch một bản ghi.
 *
 * value.word
 *   -> value.translation
 *
 * value.examples[]
 *   -> value.example_vi[]
 *
 * value.definition
 *   -> value.definition_vi
 */
async function translateRecord(record) {
  const value = record.value ?? {};

  const word = String(value.word ?? "").trim();

  const examples = Array.isArray(value.examples)
    ? value.examples.map((example) => String(example ?? "").trim())
    : [];

  /**
   * definition là một chuỗi.
   */
  const definition = String(value.definition ?? "").trim();

  /**
   * Thứ tự gửi lên DLX:
   *
   * 0                    = word
   * 1 -> examples.length = examples
   * cuối cùng            = definition
   */
  const texts = [word, ...examples];

  const definitionIndex = definition ? texts.length : -1;

  if (definition) {
    texts.push(definition);
  }

  const translations = await dlxTranslate(texts);

  /**
   * Bản dịch của word.
   */
  value.translation = translations[0] ?? "";

  /**
   * Bản dịch của examples.
   */
  value.example_vi = translations.slice(1, 1 + examples.length);

  /**
   * Bản dịch của definition.
   */
  if (definitionIndex >= 0) {
    value.definition_vi = translations[definitionIndex] ?? "";
  } else {
    value.definition_vi = "";
  }

  return record;
}

// ======================================================
// CHƯƠNG TRÌNH CHÍNH
// ======================================================

async function main() {
  let parsedDlxUrl;

  try {
    parsedDlxUrl = new URL(DLX_BASE_URL);
  } catch {
    throw new Error(
      `DLX_BASE_URL không hợp lệ: ` +
        `${DLX_BASE_URL}\n` +
        "Ví dụ: " +
        "DLX_BASE_URL=https://dlx.example.com",
    );
  }

  if (!["http:", "https:"].includes(parsedDlxUrl.protocol)) {
    throw new Error(
      "DLX_BASE_URL phải sử dụng " + "giao thức http hoặc https.",
    );
  }

  console.log(`DLX endpoint: ` + `${DLX_TRANSLATE_URL}`);

  console.log(`Xác thực token: ` + `${DLX_TOKEN ? "Có" : "Không"}`);

  if (!(await fileExists(INPUT_FILE_PATH))) {
    throw new Error("Không tìm thấy file nguồn: " + INPUT_FILE_PATH);
  }

  await fsp.mkdir(path.dirname(OUTPUT_FILE_PATH), {
    recursive: true,
  });

  /**
   * Đọc file đã dịch và lấy id cuối.
   */
  const { existingCount, lastCompletedId } = await prepareOutputForResume();

  if (lastCompletedId !== null) {
    console.log(`Tiếp tục từ id cuối: ` + `${lastCompletedId}`);

    console.log(
      `File kết quả đã có: ` +
        `${existingCount.toLocaleString("vi-VN")} bản ghi`,
    );
  } else {
    console.log("Chưa có dữ liệu dịch, " + "bắt đầu từ bản ghi đầu tiên.");
  }

  // ====================================================
  // XỬ LÝ CTRL+C
  // ====================================================

  let stopRequested = false;
  let signalCount = 0;

  const requestStop = (signal) => {
    signalCount += 1;

    if (signalCount === 1) {
      stopRequested = true;

      console.log("");
      console.log(`Đã nhận ${signal}.`);

      console.log(
        "Chương trình sẽ dừng sau khi " + "ghi xong bản ghi đang xử lý.",
      );

      return;
    }

    /**
     * Nhấn Ctrl+C lần thứ hai:
     * thoát ngay.
     */
    process.exit(130);
  };

  process.on("SIGINT", () => requestStop("Ctrl+C"));

  process.on("SIGTERM", () => requestStop("SIGTERM"));

  // ====================================================
  // MỞ FILE OUTPUT
  // ====================================================

  const outputHandle = await fsp.open(OUTPUT_FILE_PATH, "a");

  const startedAt = Date.now();

  let totalWrittenCount = existingCount;

  let newlyWrittenCount = 0;

  /**
   * Nếu chưa có id cuối thì dịch ngay.
   *
   * Nếu đã có id cuối thì quét file nguồn
   * đến đúng id đó rồi mới dịch tiếp.
   */
  let resumeMarkerFound = lastCompletedId === null;

  async function writeRecord(record) {
    const prefix = totalWrittenCount === 0 ? "" : ",\n";

    await outputHandle.appendFile(prefix + JSON.stringify(record), "utf8");

    totalWrittenCount += 1;
    newlyWrittenCount += 1;

    if (newlyWrittenCount % SYNC_INTERVAL === 0) {
      await outputHandle.sync();
    }

    if (totalWrittenCount % PROGRESS_INTERVAL === 0) {
      const memoryUsageMB = Math.round(process.memoryUsage().rss / 1024 / 1024);

      console.log(
        `Đã dịch: ` +
          `${totalWrittenCount.toLocaleString("vi-VN")} bản ghi | ` +
          `RAM ~${memoryUsageMB} MB`,
      );
    }
  }

  try {
    const readStream = fs
      .createReadStream(INPUT_FILE_PATH, {
        highWaterMark: READ_BUFFER_SIZE,
      })
      .pipe(parser.asStream())
      .pipe(streamArray.asStream());

    const inFlight = [];

    for await (const chunk of readStream) {
      const record = chunk.value;

      const recordId = getRecordId(record);

      if (recordId === null) {
        throw new Error(
          `Bản ghi nguồn tại vị trí ` + `${chunk.key} không có id.`,
        );
      }

      /**
       * Bỏ qua các record cũ đến id cuối
       * đã hoàn thành.
       */
      if (!resumeMarkerFound) {
        if (recordId === lastCompletedId) {
          resumeMarkerFound = true;

          console.log(`Đã tìm thấy mốc id ` + `${lastCompletedId}.`);

          console.log("Bắt đầu dịch từ " + "bản ghi kế tiếp.");
        }

        continue;
      }

      if (stopRequested) {
        break;
      }

      inFlight.push(translateRecord(record));

      if (inFlight.length >= CONCURRENCY) {
        const translatedRecord = await inFlight.shift();

        await writeRecord(translatedRecord);
      }
    }

    if (!resumeMarkerFound) {
      throw new Error(
        `Không tìm thấy id cuối ` +
          `"${lastCompletedId}" ` +
          "trong file nguồn.\n" +
          "Có thể file nguồn đã bị " +
          "thay đổi, sắp xếp lại hoặc " +
          "id đã bị xóa.",
      );
    }

    /**
     * Ghi nốt các request còn lại.
     */
    for (const promise of inFlight) {
      const translatedRecord = await promise;

      await writeRecord(translatedRecord);
    }
  } finally {
    /**
     * Đóng mảng JSON.
     *
     * Khi chạy lại,
     * prepareOutputForResume()
     * sẽ tự bỏ dấu ] để append tiếp.
     */
    try {
      await outputHandle.appendFile("\n]\n", "utf8");

      await outputHandle.sync();
    } finally {
      await outputHandle.close();
    }
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log("");

  if (stopRequested) {
    console.log("Đã dừng an toàn.");
  } else {
    console.log("Hoàn tất.");
  }

  console.log(
    `Đã dịch thêm: ` + `${newlyWrittenCount.toLocaleString("vi-VN")} bản ghi`,
  );

  console.log(
    `Tổng dữ liệu: ` + `${totalWrittenCount.toLocaleString("vi-VN")} bản ghi`,
  );

  console.log(`Thời gian chạy lần này: ` + `${elapsedSeconds}s`);

  console.log(`→ ${OUTPUT_FILE_PATH}`);
}

main().catch((error) => {
  console.error("");
  console.error("Chương trình gặp lỗi:");

  console.error(error?.stack || error?.message || error);

  process.exitCode = 1;
});
