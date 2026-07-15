#!/usr/bin/env node

'use strict';

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/stream-array.js';

// ======================================================
// XÁC ĐỊNH THƯ MỤC CHỨA FILE JS
// ======================================================

const CURRENT_FILE_PATH = fileURLToPath(import.meta.url);
const ROOT_DIRECTORY = path.dirname(CURRENT_FILE_PATH);

// ======================================================
// CẤU HÌNH ĐƯỜNG DẪN
// ======================================================

/**
 * Tên file JSON nguồn.
 *
 * Ví dụ cấu trúc:
 *
 * data/
 * ├── processing-data.js
 * ├── package.json
 * ├── vocabulary.json
 * └── output/
 */
const INPUT_FILE_NAME = '/OXFORD/data.json';

/**
 * File nguồn nằm cùng thư mục với processing-data.js.
 */
const INPUT_FILE_PATH = path.join(
  ROOT_DIRECTORY,
  INPUT_FILE_NAME
);

/**
 * Thư mục chứa:
 *
 * A1.json
 * A2.json
 * B1.json
 * B2.json
 * C1.json
 * C2.json
 * UNKNOWN.json
 */
const OUTPUT_DIRECTORY = path.join(
  ROOT_DIRECTORY,
  'output'
);

/**
 * false:
 * - Nếu A1.json đã có thì nối thêm dữ liệu.
 * - Nếu chưa có thì tạo mới.
 *
 * true:
 * - Xóa các file JSON cũ trong output.
 * - Tạo lại hoàn toàn từ file nguồn.
 */
const OVERWRITE_OUTPUT_FILES = false;

/**
 * Kích thước mỗi khối dữ liệu đọc từ file.
 *
 * 64 KB giúp chương trình không đưa toàn bộ file vào RAM.
 */
const READ_BUFFER_SIZE = 64 * 1024;

/**
 * Hiển thị tiến độ sau mỗi 10.000 phần tử.
 */
const PROGRESS_INTERVAL = 10_000;

// ======================================================
// HÀM XỬ LÝ ĐƯỜNG DẪN VÀ LEVEL
// ======================================================

function getOutputFilePath(level) {
  return path.join(
    OUTPUT_DIRECTORY,
    `${level}.json`
  );
}

/**
 * Chuẩn hóa level để sử dụng làm tên file.
 *
 * "a1"   -> "A1"
 * " A2 " -> "A2"
 * null   -> "UNKNOWN"
 */
function normalizeLevel(level) {
  if (
    level === undefined ||
    level === null ||
    String(level).trim() === ''
  ) {
    return 'UNKNOWN';
  }

  const normalizedLevel = String(level)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalizedLevel || 'UNKNOWN';
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ======================================================
// HÀM KIỂM TRA MẢNG JSON ĐÃ TỒN TẠI
// ======================================================

function isWhitespace(byte) {
  return (
    byte === 0x20 ||
    byte === 0x09 ||
    byte === 0x0a ||
    byte === 0x0d
  );
}

/**
 * Tìm ký tự đầu tiên không phải khoảng trắng.
 */
async function findFirstNonWhitespace(
  fileHandle,
  fileSize
) {
  let position = 0;

  while (position < fileSize) {
    const length = Math.min(
      READ_BUFFER_SIZE,
      fileSize - position
    );

    const buffer = Buffer.allocUnsafe(length);

    const { bytesRead } = await fileHandle.read(
      buffer,
      0,
      length,
      position
    );

    for (
      let index = 0;
      index < bytesRead;
      index += 1
    ) {
      if (!isWhitespace(buffer[index])) {
        return {
          position: position + index,
          byte: buffer[index],
        };
      }
    }

    position += bytesRead;
  }

  return null;
}

/**
 * Tìm ký tự cuối cùng không phải khoảng trắng.
 */
async function findLastNonWhitespace(
  fileHandle,
  beforePosition
) {
  let position = beforePosition;

  while (position > 0) {
    const startPosition = Math.max(
      0,
      position - READ_BUFFER_SIZE
    );

    const length = position - startPosition;
    const buffer = Buffer.allocUnsafe(length);

    const { bytesRead } = await fileHandle.read(
      buffer,
      0,
      length,
      startPosition
    );

    for (
      let index = bytesRead - 1;
      index >= 0;
      index -= 1
    ) {
      if (!isWhitespace(buffer[index])) {
        return {
          position: startPosition + index,
          byte: buffer[index],
        };
      }
    }

    position = startPosition;
  }

  return null;
}

/**
 * Kiểm tra file đầu ra hiện tại:
 *
 * [
 *   {...},
 *   {...}
 * ]
 *
 * Đồng thời tìm vị trí dấu ] cuối cùng để nối thêm dữ liệu.
 *
 * Hàm chỉ đọc từng khối nhỏ, không đưa toàn bộ file vào RAM.
 */
async function inspectExistingJsonArray(filePath) {
  const fileStat = await fsp.stat(filePath);

  if (fileStat.size === 0) {
    throw new Error(
      `File đầu ra đang rỗng: ${filePath}`
    );
  }

  const fileHandle = await fsp.open(
    filePath,
    'r'
  );

  try {
    const firstCharacter =
      await findFirstNonWhitespace(
        fileHandle,
        fileStat.size
      );

    const lastCharacter =
      await findLastNonWhitespace(
        fileHandle,
        fileStat.size
      );

    // 0x5b là ký tự [
    if (
      !firstCharacter ||
      firstCharacter.byte !== 0x5b
    ) {
      throw new Error(
        `File không bắt đầu bằng dấu [: ${filePath}`
      );
    }

    // 0x5d là ký tự ]
    if (
      !lastCharacter ||
      lastCharacter.byte !== 0x5d
    ) {
      throw new Error(
        `File không kết thúc bằng dấu ]: ${filePath}`
      );
    }

    const characterBeforeClosingBracket =
      await findLastNonWhitespace(
        fileHandle,
        lastCharacter.position
      );

    /**
     * Nếu ký tự trước ] không phải [ thì mảng đã có dữ liệu.
     */
    const hasItems = Boolean(
      characterBeforeClosingBracket &&
      characterBeforeClosingBracket.byte !== 0x5b
    );

    return {
      closingBracketPosition:
        lastCharacter.position,

      hasItems,
    };
  } finally {
    await fileHandle.close();
  }
}

// ======================================================
// HÀM QUẢN LÝ FILE
// ======================================================

/**
 * Thay file đầu ra cũ bằng file tạm đã xử lý xong.
 */
async function replaceFile(
  temporaryFilePath,
  targetFilePath
) {
  try {
    await fsp.rename(
      temporaryFilePath,
      targetFilePath
    );
  } catch (error) {
    /**
     * Xử lý trường hợp hệ điều hành không cho phép
     * rename đè lên file đã tồn tại.
     */
    if (
      error.code !== 'EEXIST' &&
      error.code !== 'EPERM'
    ) {
      throw error;
    }

    await fsp.rm(targetFilePath, {
      force: true,
    });

    await fsp.rename(
      temporaryFilePath,
      targetFilePath
    );
  }
}

/**
 * Khi bật OVERWRITE_OUTPUT_FILES,
 * xóa các file .json cũ trong thư mục output.
 */
async function clearOldOutputFiles() {
  const outputExists =
    await fileExists(OUTPUT_DIRECTORY);

  if (!outputExists) {
    return;
  }

  const directoryEntries = await fsp.readdir(
    OUTPUT_DIRECTORY,
    {
      withFileTypes: true,
    }
  );

  const deleteTasks = directoryEntries
    .filter(directoryEntry => {
      return (
        directoryEntry.isFile() &&
        directoryEntry.name
          .toLowerCase()
          .endsWith('.json')
      );
    })
    .map(directoryEntry => {
      const filePath = path.join(
        OUTPUT_DIRECTORY,
        directoryEntry.name
      );

      return fsp.rm(filePath, {
        force: true,
      });
    });

  await Promise.all(deleteTasks);
}

// ======================================================
// LỚP GHI MẢNG JSON
// ======================================================

class JsonArrayWriter {
  constructor(
    targetFilePath,
    appendExistingFile
  ) {
    this.targetFilePath = targetFilePath;
    this.appendExistingFile =
      appendExistingFile;

    /**
     * File tạm giúp tránh làm hỏng file cũ
     * nếu chương trình dừng giữa chừng.
     */
    this.temporaryFilePath =
      `${targetFilePath}.tmp-` +
      `${process.pid}-` +
      crypto.randomBytes(6).toString('hex');

    this.writeStream = null;
    this.hasItems = false;
    this.initialized = false;
    this.completed = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    await fsp.mkdir(
      path.dirname(this.targetFilePath),
      {
        recursive: true,
      }
    );

    const targetFileExists =
      await fileExists(this.targetFilePath);

    /**
     * Nếu file đã có và đang chạy chế độ nối thêm:
     *
     * 1. Copy file cũ sang file tạm.
     * 2. Xóa dấu ] cuối.
     * 3. Ghi tiếp phần tử mới.
     * 4. Thêm lại dấu ] khi hoàn thành.
     */
    if (
      this.appendExistingFile &&
      targetFileExists
    ) {
      const existingFileInformation =
        await inspectExistingJsonArray(
          this.targetFilePath
        );

      await fsp.copyFile(
        this.targetFilePath,
        this.temporaryFilePath
      );

      await fsp.truncate(
        this.temporaryFilePath,
        existingFileInformation
          .closingBracketPosition
      );

      this.hasItems =
        existingFileInformation.hasItems;

      this.writeStream = fs.createWriteStream(
        this.temporaryFilePath,
        {
          flags: 'r+',

          start:
            existingFileInformation
              .closingBracketPosition,

          encoding: 'utf8',
        }
      );
    } else {
      /**
       * File chưa tồn tại hoặc đang chạy ghi mới.
       */
      await fsp.writeFile(
        this.temporaryFilePath,
        '[\n',
        'utf8'
      );

      this.hasItems = false;

      this.writeStream = fs.createWriteStream(
        this.temporaryFilePath,
        {
          flags: 'r+',
          start: Buffer.byteLength('[\n'),
          encoding: 'utf8',
        }
      );
    }

    this.initialized = true;
  }

  /**
   * Ghi một từ vào file JSON tương ứng.
   */
  async write(vocabularyItem) {
    await this.initialize();

    const prefix = this.hasItems
      ? ',\n'
      : '';

    /**
     * Không dùng khoảng trắng thụt dòng để giảm kích thước file.
     */
    const jsonData = JSON.stringify(
      vocabularyItem
    );

    this.hasItems = true;

    /**
     * Nếu bộ đệm ghi đầy thì chờ stream xử lý bớt
     * trước khi đọc phần tử tiếp theo.
     */
    const canContinue = this.writeStream.write(
      prefix + jsonData
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
    if (
      !this.initialized ||
      this.completed
    ) {
      return;
    }

    this.writeStream.end('\n]\n');

    await finished(this.writeStream);

    await replaceFile(
      this.temporaryFilePath,
      this.targetFilePath
    );

    this.completed = true;
  }

  /**
   * Xóa file tạm khi chương trình gặp lỗi.
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
// CHƯƠNG TRÌNH CHÍNH
// ======================================================

async function main() {
  const inputFileExists =
    await fileExists(INPUT_FILE_PATH);

  if (!inputFileExists) {
    throw new Error(
      [
        'Không tìm thấy file nguồn:',
        INPUT_FILE_PATH,
        '',
        'Hãy kiểm tra INPUT_FILE_NAME ở đầu file.',
      ].join('\n')
    );
  }

  const inputFileStat = await fsp.stat(
    INPUT_FILE_PATH
  );

  if (!inputFileStat.isFile()) {
    throw new Error(
      `Đường dẫn nguồn không phải file:\n${INPUT_FILE_PATH}`
    );
  }

  await fsp.mkdir(
    OUTPUT_DIRECTORY,
    {
      recursive: true,
    }
  );

  if (OVERWRITE_OUTPUT_FILES) {
    await clearOldOutputFiles();
  }

  /**
   * Mỗi level sử dụng một JsonArrayWriter.
   *
   * Ví dụ:
   * A1 -> writer của A1.json
   * A2 -> writer của A2.json
   */
  const writers = new Map();

  /**
   * Đếm số lượng từ theo từng level
   * trong lần chạy hiện tại.
   */
  const counts = new Map();

  let processedCount = 0;

  console.log(
    '========================================'
  );

  console.log(
    'PHÂN LOẠI TỪ VỰNG THEO LEVEL'
  );

  console.log(
    '========================================'
  );

  console.log(
    `File nguồn:\n${INPUT_FILE_PATH}`
  );

  console.log(
    `\nThư mục đầu ra:\n${OUTPUT_DIRECTORY}`
  );

  console.log(
    '\nChế độ:',
    OVERWRITE_OUTPUT_FILES
      ? 'Ghi mới hoàn toàn'
      : 'Nối vào file đã tồn tại'
  );

  console.log('');

  function getWriter(level) {
    if (!writers.has(level)) {
      const outputFilePath =
        getOutputFilePath(level);

      const writer = new JsonArrayWriter(
        outputFilePath,
        !OVERWRITE_OUTPUT_FILES
      );

      writers.set(
        level,
        writer
      );
    }

    return writers.get(level);
  }

  try {
    /**
     * File nguồn phải có dạng:
     *
     * [
     *   {
     *     "id": 0,
     *     "value": {
     *       "word": "a",
     *       "level": "A1"
     *     }
     *   }
     * ]
     */
    const vocabularyStream = fs
      .createReadStream(
        INPUT_FILE_PATH,
        {
          highWaterMark:
            READ_BUFFER_SIZE,
        }
      )
      .pipe(parser.asStream())
      .pipe(streamArray.asStream());

    /**
     * Mỗi vòng lặp chỉ nhận một phần tử
     * từ mảng JSON nguồn.
     */
    for await (
      const chunk of vocabularyStream
    ) {
      const vocabularyItem = chunk.value;

      /**
       * Đọc cấp độ từ:
       *
       * vocabularyItem.value.level
       */
      const level = normalizeLevel(
        vocabularyItem?.value?.level
      );

      const writer = getWriter(level);

      /**
       * Chờ ghi xong rồi mới xử lý tiếp,
       * giúp tránh dữ liệu dồn quá nhiều vào RAM.
       */
      await writer.write(
        vocabularyItem
      );

      processedCount += 1;

      counts.set(
        level,
        (counts.get(level) || 0) + 1
      );

      if (
        processedCount %
          PROGRESS_INTERVAL ===
        0
      ) {
        const memoryUsageMB =
          Math.round(
            process.memoryUsage().rss /
              1024 /
              1024
          );

        console.log(
          [
            `Đã xử lý: ${processedCount.toLocaleString('vi-VN')} từ`,
            `RAM khoảng: ${memoryUsageMB} MB`,
          ].join(' | ')
        );
      }
    }

    /**
     * Đóng tất cả file A1.json, A2.json...
     */
    for (
      const writer of writers.values()
    ) {
      await writer.close();
    }
  } catch (error) {
    /**
     * Nếu có lỗi:
     * - Xóa các file tạm.
     * - Không thay đổi file đầu ra cũ.
     */
    await Promise.allSettled(
      [...writers.values()].map(
        writer => writer.abort()
      )
    );

    throw error;
  }

  console.log('');

  console.log(
    '========================================'
  );

  console.log('HOÀN TẤT');

  console.log(
    '========================================'
  );

  console.log(
    `Tổng số từ đã xử lý: ` +
    processedCount.toLocaleString('vi-VN')
  );

  console.log('');

  const sortedCounts = [
    ...counts.entries(),
  ].sort(([levelA], [levelB]) => {
    return levelA.localeCompare(
      levelB,
      undefined,
      {
        numeric: true,
      }
    );
  });

  for (
    const [level, count] of sortedCounts
  ) {
    console.log(
      `${level}.json: ` +
      `${count.toLocaleString('vi-VN')} từ`
    );
  }

  if (!OVERWRITE_OUTPUT_FILES) {
    console.log('');
    console.log(
      'Lưu ý: chương trình đang chạy ở chế độ nối thêm.'
    );

    console.log(
      'Chạy lại cùng file nguồn sẽ làm dữ liệu bị trùng.'
    );
  }
}

main().catch(error => {
  console.error('');

  console.error(
    'Chương trình gặp lỗi:'
  );

  console.error(
    error?.stack || error?.message || error
  );

  process.exitCode = 1;
});