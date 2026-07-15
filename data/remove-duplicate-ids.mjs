#!/usr/bin/env node

'use strict';

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import chain from 'stream-chain';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/stream-array.js';

// ======================================================
// XÁC ĐỊNH THƯ MỤC CHỨA SCRIPT
// ======================================================

const CURRENT_FILE_PATH = fileURLToPath(import.meta.url);

const ROOT_DIRECTORY = path.dirname(
  CURRENT_FILE_PATH
);

// ======================================================
// CẤU HÌNH
// ======================================================

/**
 * Thư mục chứa các file JSON cần lọc:
 *
 * output/
 * ├── A1.json
 * ├── A2.json
 * ├── B1.json
 * ├── B2.json
 * └── C1.json
 */
const JSON_DIRECTORY = path.join(
  ROOT_DIRECTORY,
  'output'
);

/**
 * Thứ tự xử lý cũng là thứ tự ưu tiên giữ bản ghi.
 *
 * Ví dụ:
 * - ID 5916 xuất hiện trong A1 và B2.
 * - A1 được đọc trước nên bản ghi trong A1 được giữ.
 * - Bản ghi ID 5916 trong B2 bị loại.
 *
 * Các ID lặp ngay trong cùng một file cũng bị loại.
 */
const JSON_FILE_NAMES = [
  'C1.json',
  'B1.json',
  'B2.json'
];

/**
 * true:
 * Kiểm tra ID trùng trên toàn bộ các file.
 *
 * false:
 * Chỉ kiểm tra ID trùng bên trong từng file riêng.
 */
const DEDUPLICATE_ACROSS_FILES = true;

/**
 * true:
 * Sao lưu file gốc trước khi thay bằng file đã lọc.
 *
 * false:
 * Không tạo backup để tiết kiệm dung lượng ổ đĩa.
 */
const CREATE_BACKUP = false;

/**
 * Thư mục backup.
 *
 * Chỉ được sử dụng khi CREATE_BACKUP = true.
 */
const BACKUP_ROOT_DIRECTORY = path.join(
  ROOT_DIRECTORY,
  'backup-before-deduplicate'
);

/**
 * Kích thước mỗi khối đọc từ file.
 *
 * File JSON không được nạp toàn bộ vào RAM.
 */
const READ_BUFFER_SIZE = 64 * 1024;

/**
 * Hiển thị tiến độ sau mỗi 10.000 bản ghi.
 */
const PROGRESS_INTERVAL = 10_000;

// ======================================================
// HÀM TIỆN ÍCH
// ======================================================

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatNumber(value) {
  return Number(value).toLocaleString('vi-VN');
}

/**
 * Tạo tên thư mục theo thời gian.
 */
function createTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, '-');
}

/**
 * Chuẩn hóa ID để kiểm tra trùng.
 *
 * Các giá trị dưới đây được xem là cùng một ID:
 *
 * 5916
 * "5916"
 * "005916"
 *
 * @param {unknown} id
 * @returns {string|number|null}
 */
function normalizeId(id) {
  if (
    id === undefined ||
    id === null
  ) {
    return null;
  }

  const normalizedValue = String(id).trim();

  if (!normalizedValue) {
    return null;
  }

  /**
   * Nếu ID là số nguyên và nằm trong giới hạn an toàn,
   * lưu dưới dạng number để giảm bộ nhớ cho Set.
   */
  if (/^-?\d+$/.test(normalizedValue)) {
    const numericId = Number(normalizedValue);

    if (Number.isSafeInteger(numericId)) {
      return numericId;
    }

    /**
     * ID số quá lớn sẽ được chuẩn hóa bằng BigInt.
     */
    try {
      return `number:${BigInt(normalizedValue).toString()}`;
    } catch {
      return `string:${normalizedValue}`;
    }
  }

  return `string:${normalizedValue}`;
}

/**
 * Tính dung lượng RAM hiện tại của tiến trình.
 */
function getMemoryUsageMB() {
  return Math.round(
    process.memoryUsage().rss / 1024 / 1024
  );
}

// ======================================================
// GHI MẢNG JSON THEO STREAM
// ======================================================

class JsonArrayWriter {
  /**
   * @param {string} temporaryFilePath
   */
  constructor(temporaryFilePath) {
    this.temporaryFilePath =
      temporaryFilePath;

    this.writeStream = null;
    this.hasWrittenItems = false;
    this.initialized = false;
    this.closed = false;
  }

  /**
   * Khởi tạo file JSON tạm bằng dấu mở mảng.
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    await fsp.mkdir(
      path.dirname(this.temporaryFilePath),
      {
        recursive: true,
      }
    );

    await fsp.writeFile(
      this.temporaryFilePath,
      '[\n',
      'utf8'
    );

    this.writeStream = fs.createWriteStream(
      this.temporaryFilePath,
      {
        flags: 'a',
        encoding: 'utf8',
      }
    );

    this.initialized = true;
  }

  /**
   * Ghi một bản ghi vào mảng JSON.
   *
   * @param {unknown} item
   */
  async write(item) {
    await this.initialize();

    const separator = this.hasWrittenItems
      ? ',\n'
      : '';

    const serializedItem = JSON.stringify(item);

    this.hasWrittenItems = true;

    /**
     * Kiểm soát backpressure:
     * nếu bộ đệm ghi đầy thì chờ stream ghi bớt
     * trước khi đọc bản ghi tiếp theo.
     */
    const canContinue = this.writeStream.write(
      separator + serializedItem
    );

    if (!canContinue) {
      await once(
        this.writeStream,
        'drain'
      );
    }
  }

  /**
   * Đóng mảng JSON bằng dấu ].
   */
  async close() {
    if (this.closed) {
      return;
    }

    await this.initialize();

    this.writeStream.end('\n]\n');

    await finished(this.writeStream);

    this.closed = true;
  }

  /**
   * Dừng stream và xóa file tạm khi có lỗi.
   */
  async abort() {
    if (
      this.writeStream &&
      !this.writeStream.destroyed
    ) {
      this.writeStream.destroy();
    }

    await fsp.rm(
      this.temporaryFilePath,
      {
        force: true,
      }
    ).catch(() => {});
  }
}

// ======================================================
// SAO LƯU FILE GỐC
// ======================================================

async function backupOriginalFile(
  originalFilePath,
  fileName,
  backupDirectory
) {
  if (!CREATE_BACKUP) {
    return;
  }

  await fsp.mkdir(
    backupDirectory,
    {
      recursive: true,
    }
  );

  const backupFilePath = path.join(
    backupDirectory,
    fileName
  );

  await fsp.copyFile(
    originalFilePath,
    backupFilePath
  );
}

// ======================================================
// THAY FILE GỐC BẰNG FILE ĐÃ LỌC
// ======================================================

/**
 * Thay file gốc bằng file tạm.
 *
 * Trên Linux, rename có thể thay thế file đích trực tiếp.
 * Có thêm cơ chế dự phòng cho hệ điều hành không cho
 * rename đè lên file tồn tại.
 */
async function replaceOriginalFile(
  temporaryFilePath,
  originalFilePath
) {
  try {
    await fsp.rename(
      temporaryFilePath,
      originalFilePath
    );

    return;
  } catch (error) {
    if (
      error.code !== 'EEXIST' &&
      error.code !== 'EPERM'
    ) {
      throw error;
    }
  }

  const oldFilePath =
    `${originalFilePath}.old-${process.pid}`;

  /**
   * Chuyển file gốc sang tên tạm trước.
   */
  await fsp.rename(
    originalFilePath,
    oldFilePath
  );

  try {
    /**
     * Đưa file đã lọc vào vị trí file gốc.
     */
    await fsp.rename(
      temporaryFilePath,
      originalFilePath
    );

    /**
     * Xóa file cũ sau khi thay thành công.
     */
    await fsp.rm(
      oldFilePath,
      {
        force: true,
      }
    );
  } catch (error) {
    /**
     * Nếu thay file mới thất bại,
     * phục hồi lại file gốc.
     */
    await fsp.rename(
      oldFilePath,
      originalFilePath
    ).catch(() => {});

    throw error;
  }
}

// ======================================================
// TẠO PIPELINE ĐỌC MẢNG JSON
// ======================================================

/**
 * File nguồn phải có cấu trúc mảng JSON:
 *
 * [
 *   {
 *     "id": 5916,
 *     "value": {}
 *   }
 * ]
 *
 * stream-chain kết nối:
 *
 * file stream
 * → parser()
 * → streamArray()
 *
 * @param {string} filePath
 */
function createJsonArrayPipeline(filePath) {
  return chain([
    fs.createReadStream(
      filePath,
      {
        highWaterMark: READ_BUFFER_SIZE,
      }
    ),

    parser(),

    streamArray(),
  ]);
}

// ======================================================
// XỬ LÝ MỘT FILE JSON
// ======================================================

async function processJsonFile({
  fileName,
  globalSeenIds,
  backupDirectory,
}) {
  const originalFilePath = path.join(
    JSON_DIRECTORY,
    fileName
  );

  const temporaryFilePath = path.join(
    JSON_DIRECTORY,
    `.${fileName}.deduplicate-${process.pid}.tmp`
  );

  if (!(await fileExists(originalFilePath))) {
    throw new Error(
      `Không tìm thấy file:\n${originalFilePath}`
    );
  }

  /**
   * Nếu lọc trên toàn bộ file thì dùng chung Set.
   * Nếu chỉ lọc từng file thì tạo Set riêng.
   */
  const seenIds = DEDUPLICATE_ACROSS_FILES
    ? globalSeenIds
    : new Set();

  const writer = new JsonArrayWriter(
    temporaryFilePath
  );

  let totalRecords = 0;
  let keptRecords = 0;
  let duplicateRecords = 0;
  let missingIdRecords = 0;

  console.log('');
  console.log(
    '----------------------------------------'
  );

  console.log(
    `Đang xử lý: ${fileName}`
  );

  console.log(
    '----------------------------------------'
  );

  try {
    const jsonPipeline =
      createJsonArrayPipeline(
        originalFilePath
      );

    /**
     * Mỗi lần lặp chỉ nhận một phần tử trong mảng.
     *
     * chunk có dạng:
     *
     * {
     *   key: 0,
     *   value: {
     *     id: 5916,
     *     value: {...}
     *   }
     * }
     */
    for await (const chunk of jsonPipeline) {
      const item = chunk.value;

      totalRecords += 1;

      const normalizedId = normalizeId(
        item?.id
      );

      /**
       * Bản ghi không có ID:
       * giữ lại để tránh xóa nhầm dữ liệu.
       */
      if (normalizedId === null) {
        missingIdRecords += 1;
        keptRecords += 1;

        await writer.write(item);

        continue;
      }

      /**
       * ID đã xuất hiện:
       * không ghi bản ghi này vào file mới.
       */
      if (seenIds.has(normalizedId)) {
        duplicateRecords += 1;
      } else {
        /**
         * ID xuất hiện lần đầu:
         * lưu ID và giữ lại bản ghi.
         */
        seenIds.add(normalizedId);

        keptRecords += 1;

        await writer.write(item);
      }

      if (
        totalRecords % PROGRESS_INTERVAL === 0
      ) {
        console.log(
          [
            `Đã đọc ${formatNumber(totalRecords)}`,
            `Giữ ${formatNumber(keptRecords)}`,
            `Xóa trùng ${formatNumber(duplicateRecords)}`,
            `ID duy nhất ${formatNumber(seenIds.size)}`,
            `RAM khoảng ${getMemoryUsageMB()} MB`,
          ].join(' | ')
        );
      }
    }

    /**
     * Hoàn tất file JSON tạm.
     */
    await writer.close();

    /**
     * Sao lưu file gốc nếu được bật.
     */
    await backupOriginalFile(
      originalFilePath,
      fileName,
      backupDirectory
    );

    /**
     * Thay file gốc bằng file đã lọc.
     */
    await replaceOriginalFile(
      temporaryFilePath,
      originalFilePath
    );

    console.log('');
    console.log(`${fileName}:`);

    console.log(
      `  Tổng bản ghi : ${formatNumber(totalRecords)}`
    );

    console.log(
      `  Giữ lại      : ${formatNumber(keptRecords)}`
    );

    console.log(
      `  Đã xóa trùng : ${formatNumber(duplicateRecords)}`
    );

    console.log(
      `  Không có ID  : ${formatNumber(missingIdRecords)}`
    );

    return {
      fileName,
      totalRecords,
      keptRecords,
      duplicateRecords,
      missingIdRecords,
    };
  } catch (error) {
    await writer.abort();

    throw new Error(
      [
        `Lỗi khi xử lý ${fileName}:`,
        error?.stack ||
          error?.message ||
          String(error),
      ].join('\n')
    );
  }
}

// ======================================================
// KIỂM TRA CÁC FILE NGUỒN
// ======================================================

async function validateInputFiles() {
  for (const fileName of JSON_FILE_NAMES) {
    const filePath = path.join(
      JSON_DIRECTORY,
      fileName
    );

    const exists = await fileExists(filePath);

    if (!exists) {
      throw new Error(
        `Không tìm thấy file:\n${filePath}`
      );
    }

    const stat = await fsp.stat(filePath);

    if (!stat.isFile()) {
      throw new Error(
        `Đường dẫn không phải file:\n${filePath}`
      );
    }
  }
}

// ======================================================
// CHƯƠNG TRÌNH CHÍNH
// ======================================================

async function main() {
  console.log(
    '========================================'
  );

  console.log(
    'LỌC TRÙNG JSON THEO ID'
  );

  console.log(
    '========================================'
  );

  console.log(
    `Thư mục JSON:\n${JSON_DIRECTORY}`
  );

  console.log('');

  console.log(
    `Thứ tự xử lý:\n${JSON_FILE_NAMES.join(' → ')}`
  );

  console.log('');

  console.log(
    'Phạm vi lọc:',
    DEDUPLICATE_ACROSS_FILES
      ? 'Toàn bộ các file'
      : 'Riêng từng file'
  );

  console.log('');

  console.log(
    'Backup:',
    CREATE_BACKUP
      ? 'Có'
      : 'Không'
  );

  /**
   * Kiểm tra toàn bộ file trước khi xử lý.
   */
  await validateInputFiles();

  const backupDirectory = path.join(
    BACKUP_ROOT_DIRECTORY,
    createTimestamp()
  );

  /**
   * Chỉ lưu các ID đã gặp, không lưu toàn bộ bản ghi.
   */
  const globalSeenIds = new Set();

  const results = [];

  /**
   * Xử lý tuần tự theo thứ tự ưu tiên:
   *
   * A1 → A2 → B1 → B2 → C1
   */
  for (const fileName of JSON_FILE_NAMES) {
    const result = await processJsonFile({
      fileName,
      globalSeenIds,
      backupDirectory,
    });

    results.push(result);
  }

  const totalRecords = results.reduce(
    (total, result) => {
      return total + result.totalRecords;
    },
    0
  );

  const totalKeptRecords = results.reduce(
    (total, result) => {
      return total + result.keptRecords;
    },
    0
  );

  const totalDuplicateRecords =
    results.reduce(
      (total, result) => {
        return (
          total +
          result.duplicateRecords
        );
      },
      0
    );

  const totalMissingIdRecords =
    results.reduce(
      (total, result) => {
        return (
          total +
          result.missingIdRecords
        );
      },
      0
    );

  console.log('');
  console.log(
    '========================================'
  );

  console.log('HOÀN TẤT');

  console.log(
    '========================================'
  );

  console.log(
    `Tổng bản ghi : ${formatNumber(totalRecords)}`
  );

  console.log(
    `Giữ lại      : ${formatNumber(totalKeptRecords)}`
  );

  console.log(
    `Đã xóa trùng : ${formatNumber(totalDuplicateRecords)}`
  );

  console.log(
    `Không có ID  : ${formatNumber(totalMissingIdRecords)}`
  );

  console.log(
    `ID duy nhất  : ${formatNumber(globalSeenIds.size)}`
  );

  console.log(
    `RAM cuối     : khoảng ${getMemoryUsageMB()} MB`
  );

  if (CREATE_BACKUP) {
    console.log('');

    console.log(
      `File gốc đã được sao lưu tại:\n${backupDirectory}`
    );
  }
}

main().catch(error => {
  console.error('');
  console.error(
    'Chương trình gặp lỗi:'
  );

  console.error(
    error?.stack ||
    error?.message ||
    error
  );

  process.exitCode = 1;
});