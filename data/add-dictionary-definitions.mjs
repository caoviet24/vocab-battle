#!/usr/bin/env node

"use strict";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ======================================================
// XÁC ĐỊNH THƯ MỤC CHỨA FILE JAVASCRIPT
// ======================================================

const ROOT_DIRECTORY = path.dirname(
  fileURLToPath(import.meta.url),
);

// ======================================================
// CẤU HÌNH FILE
// ======================================================

/**
 * File nguồn nằm trong thư mục output/.
 *
 * Thay thành:
 * A1.json
 * B2.json
 * C1.json
 * ...
 */
const INPUT_FILE_NAME = "C1.json";

const OUTPUT_DIRECTORY = path.join(
  ROOT_DIRECTORY,
  "output",
);

const INPUT_FILE_PATH = path.join(
  OUTPUT_DIRECTORY,
  INPUT_FILE_NAME,
);

const FILE_BASENAME =
  INPUT_FILE_NAME.replace(/\.json$/i, "");

/**
 * File kết quả.
 */
const OUTPUT_FILE_PATH = path.join(
  OUTPUT_DIRECTORY,
  `${FILE_BASENAME}.with-definitions.json`,
);

/**
 * Lưu danh sách các từ không xử lý được.
 */
const FAILURE_FILE_PATH = path.join(
  OUTPUT_DIRECTORY,
  `${FILE_BASENAME}.definition-failures.json`,
);

/**
 * Lưu vị trí đã xử lý cuối cùng.
 */
const PROGRESS_FILE_PATH = path.join(
  OUTPUT_DIRECTORY,
  `${FILE_BASENAME}.definition-progress.json`,
);

/**
 * File backup trước khi ghi đè file nguồn.
 */
const BACKUP_FILE_PATH = path.join(
  OUTPUT_DIRECTORY,
  `${FILE_BASENAME}.before-definitions.backup.json`,
);

/**
 * false:
 * Không ghi đè file nguồn.
 * Kết quả được lưu vào:
 *
 * B2.with-definitions.json
 *
 * true:
 * Khi chạy hoàn tất, chương trình backup file nguồn
 * rồi ghi kết quả ngược lại vào file nguồn.
 */
const OVERWRITE_SOURCE_WHEN_DONE = false;

// ======================================================
// CẤU HÌNH DICTIONARY API
// ======================================================

const API_BASE_URL =
  "https://api.dictionaryapi.dev/api/v2/entries/en";

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Số lần thử lại khi:
 *
 * - Timeout
 * - Lỗi mạng
 * - HTTP 408
 * - HTTP 429
 * - HTTP 5xx
 */
const RETRY_LIMIT = 4;

/**
 * Nghỉ giữa hai từ để tránh gửi request quá nhanh.
 */
const REQUEST_DELAY_MS = 150;

// ======================================================
// CẤU HÌNH CHECKPOINT
// ======================================================

/**
 * Sau mỗi bao nhiêu bản ghi thì lưu:
 *
 * - File kết quả
 * - File lỗi
 * - Vị trí checkpoint
 *
 * Đặt 1 để lưu sau từng bản ghi.
 * Đặt 10 để tăng tốc ghi file.
 *
 * Nếu chương trình bị tắt đột ngột khi đặt 10,
 * tối đa khoảng 9 bản ghi cuối có thể phải xử lý lại.
 */
const CHECKPOINT_EVERY = 10;

/**
 * Nếu record đã có value.definition thì bỏ qua,
 * không gọi API lại.
 */
const SKIP_EXISTING_DEFINITION = true;

// ======================================================
// HÀM TIỆN ÍCH
// ======================================================

const sleep = milliseconds =>
  new Promise(resolve =>
    setTimeout(resolve, milliseconds),
  );

async function fileExists(filePath) {
  return fs.access(filePath).then(
    () => true,
    () => false,
  );
}

/**
 * Đọc file JSON.
 *
 * Nếu file không tồn tại hoặc không hợp lệ,
 * trả về giá trị mặc định.
 */
async function readJsonOrDefault(
  filePath,
  defaultValue,
) {
  if (!(await fileExists(filePath))) {
    return defaultValue;
  }

  try {
    const content = await fs.readFile(
      filePath,
      "utf8",
    );

    if (!content.trim()) {
      return defaultValue;
    }

    return JSON.parse(content);
  } catch (error) {
    console.warn(
      `Không đọc được file: ${filePath}`,
    );

    console.warn(
      error?.message ?? error,
    );

    return defaultValue;
  }
}

/**
 * Ghi JSON vào file tạm trước, sau đó mới thay thế
 * file chính để hạn chế làm hỏng dữ liệu.
 */
async function writeJsonAtomically(
  filePath,
  data,
) {
  await fs.mkdir(
    path.dirname(filePath),
    {
      recursive: true,
    },
  );

  const temporaryPath =
    `${filePath}.tmp-${process.pid}`;

  await fs.writeFile(
    temporaryPath,
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8",
  );

  try {
    await fs.rename(
      temporaryPath,
      filePath,
    );
  } catch (error) {
    /**
     * Windows có thể không cho rename đè
     * lên file đang tồn tại.
     */
    const replaceableErrors = [
      "EEXIST",
      "EPERM",
      "ENOTEMPTY",
    ];

    if (
      !replaceableErrors.includes(
        error?.code,
      )
    ) {
      await fs
        .rm(temporaryPath, {
          force: true,
        })
        .catch(() => {});

      throw error;
    }

    await fs.rm(filePath, {
      force: true,
    });

    await fs.rename(
      temporaryPath,
      filePath,
    );
  }
}

/**
 * Lấy id của record.
 *
 * Hỗ trợ:
 *
 * record.id
 * record._id
 * record.value.id
 * record.value._id
 */
function getRecordId(record) {
  const id =
    record?.id ??
    record?._id ??
    record?.value?.id ??
    record?.value?._id;

  if (
    id === undefined ||
    id === null ||
    id === ""
  ) {
    return null;
  }

  return String(id);
}

// ======================================================
// CHUẨN HÓA LOẠI TỪ
// ======================================================

/**
 * Chuẩn hóa value.type và partOfSpeech từ API
 * về cùng một định dạng.
 *
 * Ví dụ:
 *
 * adv             -> adverb
 * adj             -> adjective
 * modal verb      -> verb
 * phrasal verb    -> verb
 * countable noun  -> noun
 * exclamation     -> interjection
 */
function normalizePartOfSpeech(value) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");

  const aliases = {
    n: "noun",
    noun: "noun",

    v: "verb",
    verb: "verb",

    adj: "adjective",
    adjective: "adjective",

    adv: "adverb",
    adverb: "adverb",

    pron: "pronoun",
    pronoun: "pronoun",

    prep: "preposition",
    preposition: "preposition",

    conj: "conjunction",
    conjunction: "conjunction",

    det: "determiner",
    determiner: "determiner",

    article: "article",

    numeral: "number",
    number: "number",

    interj: "interjection",
    interjection: "interjection",
    exclamation: "interjection",
  };

  if (aliases[text]) {
    return aliases[text];
  }

  /**
   * Xử lý type có thêm mô tả.
   */
  if (/\bnoun\b/.test(text)) {
    return "noun";
  }

  if (/\bverb\b/.test(text)) {
    return "verb";
  }

  if (/\badjective\b/.test(text)) {
    return "adjective";
  }

  if (/\badverb\b/.test(text)) {
    return "adverb";
  }

  if (/\bpronoun\b/.test(text)) {
    return "pronoun";
  }

  if (/\bpreposition\b/.test(text)) {
    return "preposition";
  }

  if (/\bconjunction\b/.test(text)) {
    return "conjunction";
  }

  if (/\bdeterminer\b/.test(text)) {
    return "determiner";
  }

  if (
    /\binterjection\b|\bexclamation\b/.test(
      text,
    )
  ) {
    return "interjection";
  }

  return text;
}

// ======================================================
// GỌI DICTIONARY API
// ======================================================

async function fetchDictionaryEntries(word) {
  const normalizedWord =
    String(word ?? "").trim();

  if (!normalizedWord) {
    return [];
  }

  const url =
    `${API_BASE_URL}/` +
    encodeURIComponent(normalizedWord);

  for (
    let attempt = 0;
    ;
    attempt += 1
  ) {
    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch(
        url,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",
          },

          signal:
            controller.signal,
        },
      );

      const responseText =
        await response.text();

      let data = null;

      try {
        data = responseText
          ? JSON.parse(responseText)
          : null;
      } catch {
        // Response không phải JSON.
      }

      /**
       * API thành công.
       */
      if (
        response.ok &&
        Array.isArray(data)
      ) {
        return data;
      }

      /**
       * Không tìm thấy từ.
       * Không cần thử lại.
       */
      if (response.status === 404) {
        return [];
      }

      const retryable =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500;

      if (
        !retryable ||
        attempt >= RETRY_LIMIT
      ) {
        const message =
          data?.message ??
          data?.title ??
          responseText ??
          "Không rõ lỗi";

        throw new Error(
          `Dictionary API ${response.status}: ${message}`,
        );
      }

      const retryAfterSeconds =
        Number(
          response.headers.get(
            "retry-after",
          ),
        );

      const delayMilliseconds =
        Number.isFinite(
          retryAfterSeconds,
        ) &&
        retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : 2 ** attempt * 1000;

      console.warn(
        `API trả về ${response.status} ` +
          `cho từ "${normalizedWord}". ` +
          `Thử lại sau ` +
          `${delayMilliseconds / 1000}s...`,
      );

      await sleep(
        delayMilliseconds,
      );
    } catch (error) {
      const retryable =
        error?.name === "AbortError" ||
        error instanceof TypeError;

      if (
        !retryable ||
        attempt >= RETRY_LIMIT
      ) {
        throw new Error(
          `Không thể tra từ "${normalizedWord}": ` +
            `${error?.message ?? error}`,
        );
      }

      const delayMilliseconds =
        2 ** attempt * 1000;

      console.warn(
        `Lỗi kết nối khi tra từ ` +
          `"${normalizedWord}". ` +
          `Thử lại sau ` +
          `${delayMilliseconds / 1000}s...`,
      );

      await sleep(
        delayMilliseconds,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ======================================================
// LỌC DEFINITION ĐÚNG LOẠI TỪ
// ======================================================

/**
 * Lấy toàn bộ definition có partOfSpeech
 * khớp với value.type.
 */
function getMatchingDefinitions(
  entries,
  expectedType,
) {
  const normalizedExpectedType =
    normalizePartOfSpeech(
      expectedType,
    );

  const results = [];
  const seenDefinitions =
    new Set();

  for (const entry of entries) {
    const meanings =
      Array.isArray(
        entry?.meanings,
      )
        ? entry.meanings
        : [];

    for (const meaning of meanings) {
      const normalizedApiType =
        normalizePartOfSpeech(
          meaning?.partOfSpeech,
        );

      /**
       * Không lấy sai loại từ.
       *
       * Ví dụ:
       *
       * value.type = noun
       * API type   = verb
       *
       * => bỏ qua.
       */
      if (
        normalizedApiType !==
        normalizedExpectedType
      ) {
        continue;
      }

      const definitions =
        Array.isArray(
          meaning?.definitions,
        )
          ? meaning.definitions
          : [];

      for (const item of definitions) {
        const definition =
          String(
            item?.definition ?? "",
          ).trim();

        if (!definition) {
          continue;
        }

        /**
         * Loại definition trùng nhau.
         */
        const duplicateKey =
          definition.toLowerCase();

        if (
          seenDefinitions.has(
            duplicateKey,
          )
        ) {
          continue;
        }

        seenDefinitions.add(
          duplicateKey,
        );

        results.push({
          definition,

          partOfSpeech:
            String(
              meaning?.partOfSpeech ??
                "",
            ).trim(),
        });
      }
    }
  }

  return results;
}

/**
 * Lấy danh sách loại từ API hiện có.
 *
 * Dùng để ghi thông tin lỗi khi không tìm thấy
 * loại từ phù hợp.
 */
function getAvailableTypes(entries) {
  const result = new Set();

  for (const entry of entries) {
    const meanings =
      Array.isArray(
        entry?.meanings,
      )
        ? entry.meanings
        : [];

    for (const meaning of meanings) {
      const partOfSpeech =
        String(
          meaning?.partOfSpeech ?? "",
        ).trim();

      if (partOfSpeech) {
        result.add(partOfSpeech);
      }
    }
  }

  return [...result];
}

/**
 * Chọn ngẫu nhiên một phần tử.
 */
function selectRandomItem(items) {
  if (!Array.isArray(items)) {
    return null;
  }

  if (items.length === 0) {
    return null;
  }

  if (items.length === 1) {
    return items[0];
  }

  return items[
    crypto.randomInt(items.length)
  ];
}

// ======================================================
// QUẢN LÝ DANH SÁCH LỖI
// ======================================================

/**
 * Thêm lỗi mới hoặc cập nhật lỗi theo id.
 *
 * Tránh bị trùng lỗi giữa các lần chạy.
 */
function upsertFailure(
  failures,
  failure,
) {
  const failureId =
    failure?.id === undefined ||
    failure?.id === null
      ? null
      : String(failure.id);

  if (failureId === null) {
    failures.push(failure);
    return;
  }

  const existingIndex =
    failures.findIndex(item => {
      if (
        item?.id === undefined ||
        item?.id === null
      ) {
        return false;
      }

      return (
        String(item.id) === failureId
      );
    });

  if (existingIndex >= 0) {
    failures[existingIndex] =
      failure;
  } else {
    failures.push(failure);
  }
}

/**
 * Xóa lỗi cũ khi record đã được xử lý thành công.
 */
function removeFailureById(
  failures,
  id,
) {
  if (
    id === undefined ||
    id === null
  ) {
    return;
  }

  const normalizedId =
    String(id);

  for (
    let index =
      failures.length - 1;
    index >= 0;
    index -= 1
  ) {
    const failureId =
      failures[index]?.id;

    if (
      failureId !== undefined &&
      failureId !== null &&
      String(failureId) ===
        normalizedId
    ) {
      failures.splice(index, 1);
    }
  }
}

// ======================================================
// XỬ LÝ MỘT RECORD
// ======================================================

async function updateRecord(record) {
  const id =
    getRecordId(record);

  if (id === null) {
    return {
      status: "failed",
      id: null,
      reason:
        "Record không có id.",
    };
  }

  const value = record?.value;

  if (
    !value ||
    typeof value !== "object"
  ) {
    return {
      status: "failed",
      id,
      reason:
        "Record không có value hợp lệ.",
    };
  }

  const word =
    String(
      value.word ?? "",
    ).trim();

  const type =
    String(
      value.type ?? "",
    ).trim();

  if (!word) {
    return {
      status: "failed",
      id,
      reason:
        "Record không có value.word.",
    };
  }

  if (!type) {
    return {
      status: "failed",
      id,
      word,
      reason:
        "Record không có value.type để kiểm tra loại từ.",
    };
  }

  /**
   * Bỏ qua record đã có definition.
   */
  if (
    SKIP_EXISTING_DEFINITION &&
    typeof value.definition ===
      "string" &&
    value.definition.trim()
  ) {
    return {
      status: "skipped",
      id,
      word,
      type,
      definition:
        value.definition,
    };
  }

  const entries =
    await fetchDictionaryEntries(
      word,
    );

  if (entries.length === 0) {
    return {
      status: "failed",
      id,
      word,
      type,
      reason:
        "Dictionary API không tìm thấy từ.",
    };
  }

  const matchingDefinitions =
    getMatchingDefinitions(
      entries,
      type,
    );

  if (
    matchingDefinitions.length === 0
  ) {
    const availableTypes =
      getAvailableTypes(entries);

    return {
      status: "failed",
      id,
      word,
      type,
      availableTypes,

      reason:
        `Không có definition khớp ` +
        `value.type="${type}". ` +
        `API hiện có loại từ: ` +
        `${
          availableTypes.join(", ") ||
          "không xác định"
        }.`,
    };
  }

  const selectedDefinition =
    selectRandomItem(
      matchingDefinitions,
    );

  /**
   * Ghi definition vào đúng record.
   */
  value.definition =
    selectedDefinition.definition;

  return {
    status: "updated",
    id,
    word,
    type,

    apiPartOfSpeech:
      selectedDefinition.partOfSpeech,

    definition:
      selectedDefinition.definition,
  };
}

// ======================================================
// CHECKPOINT VÀ RESUME
// ======================================================

async function readProgress() {
  const progress =
    await readJsonOrDefault(
      PROGRESS_FILE_PATH,
      null,
    );

  if (
    !progress ||
    typeof progress !== "object"
  ) {
    return {
      lastProcessedIndex: -1,
      lastProcessedId: null,
      completed: false,
    };
  }

  /**
   * Không sử dụng checkpoint của file khác.
   */
  if (
    progress.inputFile &&
    progress.inputFile !==
      INPUT_FILE_NAME
  ) {
    console.warn(
      "Checkpoint thuộc file khác. " +
        "Chương trình sẽ bắt đầu lại từ đầu.",
    );

    return {
      lastProcessedIndex: -1,
      lastProcessedId: null,
      completed: false,
    };
  }

  const lastProcessedIndex =
    Number.isInteger(
      progress.lastProcessedIndex,
    )
      ? progress.lastProcessedIndex
      : -1;

  const lastProcessedId =
    progress.lastProcessedId ===
      undefined ||
    progress.lastProcessedId === null
      ? null
      : String(
          progress.lastProcessedId,
        );

  return {
    lastProcessedIndex,
    lastProcessedId,
    completed:
      progress.completed === true,
  };
}

/**
 * Xác định index bắt đầu khi chạy lại.
 *
 * Kiểm tra cả index và id để tránh sai dữ liệu
 * nếu file đã bị thay đổi thứ tự.
 */
function resolveStartIndex(
  records,
  progress,
) {
  if (
    progress.lastProcessedIndex < 0 ||
    progress.lastProcessedId === null
  ) {
    return 0;
  }

  const expectedIndex =
    progress.lastProcessedIndex;

  /**
   * Kiểm tra id tại đúng index cũ.
   */
  if (
    expectedIndex >= 0 &&
    expectedIndex < records.length
  ) {
    const idAtExpectedIndex =
      getRecordId(
        records[expectedIndex],
      );

    if (
      idAtExpectedIndex ===
      progress.lastProcessedId
    ) {
      return expectedIndex + 1;
    }
  }

  /**
   * Nếu file đổi thứ tự, tìm lại record theo id.
   */
  const foundIndex =
    records.findIndex(
      record =>
        getRecordId(record) ===
        progress.lastProcessedId,
    );

  if (foundIndex >= 0) {
    console.warn(
      `Record id=${progress.lastProcessedId} ` +
        `đã đổi vị trí từ index ` +
        `${expectedIndex} sang ${foundIndex}.`,
    );

    return foundIndex + 1;
  }

  throw new Error(
    `Không tìm thấy id checkpoint ` +
      `"${progress.lastProcessedId}" ` +
      "trong dữ liệu hiện tại.\n" +
      "Có thể file nguồn đã bị thay đổi.\n" +
      `Kiểm tra hoặc xóa file checkpoint:\n` +
      PROGRESS_FILE_PATH,
  );
}

/**
 * Lưu dữ liệu trước, sau đó mới lưu checkpoint.
 *
 * Thứ tự này giúp tránh trường hợp checkpoint
 * đi trước dữ liệu và làm bỏ sót record.
 */
async function saveCheckpoint({
  records,
  failures,
  lastProcessedIndex,
}) {
  await writeJsonAtomically(
    OUTPUT_FILE_PATH,
    records,
  );

  await writeJsonAtomically(
    FAILURE_FILE_PATH,
    failures,
  );

  const lastProcessedId =
    lastProcessedIndex >= 0 &&
    lastProcessedIndex <
      records.length
      ? getRecordId(
          records[
            lastProcessedIndex
          ],
        )
      : null;

  const completed =
    records.length === 0 ||
    lastProcessedIndex >=
      records.length - 1;

  await writeJsonAtomically(
    PROGRESS_FILE_PATH,
    {
      inputFile:
        INPUT_FILE_NAME,

      outputFile:
        path.basename(
          OUTPUT_FILE_PATH,
        ),

      lastProcessedIndex,
      lastProcessedId,

      processedRecords:
        Math.max(
          lastProcessedIndex + 1,
          0,
        ),

      totalRecords:
        records.length,

      completed,

      updatedAt:
        new Date().toISOString(),
    },
  );

  console.log(
    `Đã lưu checkpoint: ` +
      `${Math.max(
        lastProcessedIndex + 1,
        0,
      )}/${records.length}` +
      `${
        lastProcessedId !== null
          ? ` | id=${lastProcessedId}`
          : ""
      }`,
  );
}

// ======================================================
// CHƯƠNG TRÌNH CHÍNH
// ======================================================

async function main() {
  if (
    !(await fileExists(
      INPUT_FILE_PATH,
    ))
  ) {
    throw new Error(
      `Không tìm thấy file nguồn:\n` +
        INPUT_FILE_PATH,
    );
  }

  await fs.mkdir(
    OUTPUT_DIRECTORY,
    {
      recursive: true,
    },
  );

  /**
   * Nếu đã có file kết quả thì đọc file kết quả
   * để tiếp tục.
   *
   * Nếu chưa có thì đọc file nguồn.
   */
  const outputExists =
    await fileExists(
      OUTPUT_FILE_PATH,
    );

  const workingFilePath =
    outputExists
      ? OUTPUT_FILE_PATH
      : INPUT_FILE_PATH;

  console.log(
    `Đọc dữ liệu từ:\n${workingFilePath}`,
  );

  const rawJson =
    await fs.readFile(
      workingFilePath,
      "utf8",
    );

  let records;

  try {
    records =
      JSON.parse(rawJson);
  } catch (error) {
    throw new Error(
      `File JSON không hợp lệ: ` +
        `${error?.message ?? error}`,
    );
  }

  if (!Array.isArray(records)) {
    throw new TypeError(
      "File JSON phải chứa một mảng record.",
    );
  }

  /**
   * Đọc danh sách lỗi cũ.
   */
  const loadedFailures =
    await readJsonOrDefault(
      FAILURE_FILE_PATH,
      [],
    );

  const failures =
    Array.isArray(loadedFailures)
      ? loadedFailures
      : [];

  /**
   * Chỉ sử dụng checkpoint khi file kết quả tồn tại.
   *
   * Nếu output bị xóa nhưng checkpoint vẫn còn,
   * chương trình bắt đầu lại từ đầu để tránh mất dữ liệu.
   */
  const progress = outputExists
    ? await readProgress()
    : {
        lastProcessedIndex: -1,
        lastProcessedId: null,
        completed: false,
      };

  const startIndex =
    resolveStartIndex(
      records,
      progress,
    );

  if (
    startIndex >= records.length
  ) {
    console.log("");
    console.log(
      "Toàn bộ dữ liệu đã được xử lý.",
    );

    console.log(
      `Tổng số record: ` +
        records.length.toLocaleString(
          "vi-VN",
        ),
    );

    console.log(
      `File kết quả:\n${OUTPUT_FILE_PATH}`,
    );

    console.log(
      `File lỗi:\n${FAILURE_FILE_PATH}`,
    );

    return;
  }

  if (startIndex > 0) {
    console.log(
      `Tiếp tục từ record ` +
        `${startIndex + 1}/` +
        `${records.length}.`,
    );

    console.log(
      `Record cuối đã xử lý: ` +
        `index=${startIndex - 1} | ` +
        `id=${progress.lastProcessedId}`,
    );
  } else {
    console.log(
      "Bắt đầu từ record đầu tiên.",
    );
  }

  // ====================================================
  // XỬ LÝ CTRL+C
  // ====================================================

  let stopRequested = false;
  let signalCount = 0;

  const requestStop = signal => {
    signalCount += 1;

    if (signalCount === 1) {
      stopRequested = true;

      console.log("");
      console.log(
        `Đã nhận ${signal}.`,
      );

      console.log(
        "Chương trình sẽ lưu checkpoint " +
          "sau khi xử lý xong record hiện tại.",
      );

      return;
    }

    /**
     * Nhấn Ctrl+C lần thứ hai:
     * thoát ngay lập tức.
     */
    process.exit(130);
  };

  process.on(
    "SIGINT",
    () =>
      requestStop("Ctrl+C"),
  );

  process.on(
    "SIGTERM",
    () =>
      requestStop("SIGTERM"),
  );

  // ====================================================
  // THỐNG KÊ
  // ====================================================

  const startedAt = Date.now();

  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  let processedSinceCheckpoint = 0;

  /**
   * Index cuối cùng đã xử lý.
   *
   * Kể cả record thất bại vẫn được đánh dấu,
   * để lần chạy sau không bị mắc tại record đó.
   */
  let lastProcessedIndex =
    startIndex - 1;

  try {
    for (
      let index = startIndex;
      index < records.length;
      index += 1
    ) {
      if (stopRequested) {
        break;
      }

      const record =
        records[index];

      let shouldDelay = false;

      try {
        const result =
          await updateRecord(record);

        if (
          result.status ===
          "updated"
        ) {
          updatedCount += 1;
          shouldDelay = true;

          removeFailureById(
            failures,
            result.id,
          );

          console.log(
            `[${index + 1}/${records.length}] ` +
              `id=${result.id} | ` +
              `${result.word} ` +
              `(${result.type})`,
          );

          console.log(
            `  API type: ` +
              `${result.apiPartOfSpeech}`,
          );

          console.log(
            `  → ${result.definition}`,
          );
        } else if (
          result.status ===
          "skipped"
        ) {
          skippedCount += 1;

          removeFailureById(
            failures,
            result.id,
          );

          console.log(
            `[${index + 1}/${records.length}] ` +
              `Bỏ qua id=${result.id}: ` +
              "đã có definition.",
          );
        } else {
          failedCount += 1;
          shouldDelay = true;

          upsertFailure(
            failures,
            {
              ...result,

              processedAt:
                new Date().toISOString(),
            },
          );

          console.warn(
            `[${index + 1}/${records.length}] ` +
              `Không xử lý được id=` +
              `${result.id ?? "?"}: ` +
              result.reason,
          );
        }
      } catch (error) {
        shouldDelay = true;

        const failure = {
          id:
            getRecordId(record),

          word:
            record?.value?.word ??
            "",

          type:
            record?.value?.type ??
            "",

          reason:
            error?.message ??
            String(error),

          processedAt:
            new Date().toISOString(),
        };

        failedCount += 1;

        upsertFailure(
          failures,
          failure,
        );

        console.error(
          `[${index + 1}/${records.length}] ` +
            `Lỗi id=` +
            `${failure.id ?? "?"}: ` +
            failure.reason,
        );
      }

      /**
       * Đánh dấu record hiện tại đã được xử lý,
       * kể cả khi không tìm thấy definition.
       */
      lastProcessedIndex =
        index;

      processedSinceCheckpoint += 1;

      /**
       * Lưu checkpoint định kỳ.
       */
      if (
        processedSinceCheckpoint >=
        CHECKPOINT_EVERY
      ) {
        await saveCheckpoint({
          records,
          failures,
          lastProcessedIndex,
        });

        processedSinceCheckpoint = 0;
      }

      if (
        shouldDelay &&
        REQUEST_DELAY_MS > 0
      ) {
        await sleep(
          REQUEST_DELAY_MS,
        );
      }
    }
  } finally {
    /**
     * Luôn lưu dữ liệu và checkpoint,
     * kể cả khi nhấn Ctrl+C.
     */
    await saveCheckpoint({
      records,
      failures,
      lastProcessedIndex,
    });
  }

  const completed =
    lastProcessedIndex >=
    records.length - 1;

  /**
   * Ghi đè file nguồn khi được bật
   * và chương trình đã xử lý hoàn tất.
   */
  if (
    completed &&
    OVERWRITE_SOURCE_WHEN_DONE
  ) {
    if (
      !(await fileExists(
        BACKUP_FILE_PATH,
      ))
    ) {
      await fs.copyFile(
        INPUT_FILE_PATH,
        BACKUP_FILE_PATH,
      );
    }

    await writeJsonAtomically(
      INPUT_FILE_PATH,
      records,
    );

    console.log(
      `Đã backup file nguồn:\n` +
        BACKUP_FILE_PATH,
    );

    console.log(
      `Đã ghi kết quả ngược vào:\n` +
        INPUT_FILE_PATH,
    );
  }

  const elapsedSeconds = (
    (Date.now() - startedAt) /
    1000
  ).toFixed(1);

  console.log("");

  console.log(
    stopRequested
      ? "Đã dừng an toàn."
      : "Hoàn tất.",
  );

  console.log(
    `Đã thêm definition lần này: ` +
      updatedCount.toLocaleString(
        "vi-VN",
      ),
  );

  console.log(
    `Đã có definition, bỏ qua: ` +
      skippedCount.toLocaleString(
        "vi-VN",
      ),
  );

  console.log(
    `Không xử lý được lần này: ` +
      failedCount.toLocaleString(
        "vi-VN",
      ),
  );

  console.log(
    `Vị trí hiện tại: ` +
      `${Math.max(
        lastProcessedIndex + 1,
        0,
      ).toLocaleString("vi-VN")}/` +
      `${records.length.toLocaleString(
        "vi-VN",
      )}`,
  );

  console.log(
    `Thời gian chạy: ` +
      `${elapsedSeconds}s`,
  );

  console.log(
    `File kết quả:\n` +
      OUTPUT_FILE_PATH,
  );

  console.log(
    `File checkpoint:\n` +
      PROGRESS_FILE_PATH,
  );

  console.log(
    `File lỗi:\n` +
      FAILURE_FILE_PATH,
  );
}

// ======================================================
// CHẠY CHƯƠNG TRÌNH
// ======================================================

main().catch(error => {
  console.error("");
  console.error(
    "Chương trình gặp lỗi:",
  );

  console.error(
    error?.stack ||
      error?.message ||
      error,
  );

  process.exitCode = 1;
});