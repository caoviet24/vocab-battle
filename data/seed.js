const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const dbName = 'vocab_battle';

// seed.js đang nằm ngay trong thư mục data
const dataDir = __dirname;

/**
 * Tạo mô tả category từ tên thư mục.
 */
function getCategoryDescription(categoryName) {
  const descriptions = {
    '1000_WORD_COMMOM': 'Bộ 1000 từ vựng tiếng Anh thông dụng',
    '3000_A1_OF': 'Bộ từ vựng tiếng Anh trình độ A1',
    '3000_A2_OF': 'Bộ từ vựng tiếng Anh trình độ A2',
    '600_IELTS_BASIC': 'Bộ 600 từ vựng IELTS cơ bản',
    '600_TOEIC_BASIC': 'Bộ 600 từ vựng TOEIC cơ bản',
    'BAND_4_5_IELTS': 'Bộ từ vựng IELTS Band 4.5'
  };

  return descriptions[categoryName]
    || `Bộ từ vựng ${categoryName.replaceAll('_', ' ')}`;
}

/**
 * Lấy tất cả file JSON trong một thư mục.
 * Hàm này hỗ trợ cả trường hợp thư mục có nhiều cấp con.
 */
function getJsonFilesRecursive(directoryPath) {
  let jsonFiles = [];

  const entries = fs.readdirSync(directoryPath, {
    withFileTypes: true
  });

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      jsonFiles.push(...getJsonFilesRecursive(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      jsonFiles.push(fullPath);
    }
  }

  return jsonFiles;
}

/**
 * Chuẩn hóa dữ liệu một card trước khi lưu MongoDB.
 */
function transformCard(card, categoryId, sourceFile) {
  return {
    word: String(card.word || '').trim(),
    type: card.type || '',

    explanation: {
      en: card.explanation?.en || '',
      vi: card.explanation?.vi || ''
    },

    translation:
      card.translation?.vi
      || card.translation
      || '',

    example: {
      en: card.example?.en || '',
      vi: card.example?.vi || ''
    },

    phonetics: Array.isArray(card.phonetics)
      ? card.phonetics.map(phonetic => ({
          text: phonetic.text || '',
          audio: phonetic.audio || '',
          locale: phonetic.locale || ''
        }))
      : [],

    image_url: card.image_url || '',
    difficulty: card.difficulty || 'medium',

    category_id: categoryId,

    // Lưu lại tên file nguồn để tiện kiểm tra dữ liệu
    source_file: sourceFile,

    updated_at: new Date()
  };
}

/**
 * Tạo mới hoặc lấy lại category theo tên thư mục.
 */
async function getOrCreateCategory(categoryCollection, categoryName) {
  const now = new Date();

  const result = await categoryCollection.findOneAndUpdate(
    {
      name: categoryName
    },
    {
      $set: {
        description: getCategoryDescription(categoryName),
        updated_at: now
      },
      $setOnInsert: {
        name: categoryName,
        created_at: now
      }
    },
    {
      upsert: true,
      returnDocument: 'after'
    }
  );

  return result;
}

/**
 * Import dữ liệu của một thư mục category.
 */
async function importCategoryFolder(
  folderPath,
  categoryName,
  categoryCollection,
  cardCollection
) {
  console.log('\n==================================================');
  console.log(`📁 Đang xử lý category: ${categoryName}`);
  console.log(`📂 Đường dẫn: ${folderPath}`);

  const category = await getOrCreateCategory(
    categoryCollection,
    categoryName
  );

  if (!category) {
    throw new Error(`Không thể tạo hoặc tìm category ${categoryName}`);
  }

  const categoryId = category._id;

  console.log(`✅ Category ID: ${categoryId}`);

  const jsonFiles = getJsonFilesRecursive(folderPath);

  console.log(`🔍 Tìm thấy ${jsonFiles.length} file JSON`);

  if (jsonFiles.length === 0) {
    console.log('⚠️ Category này không có file JSON');
    return {
      categoryName,
      fileCount: 0,
      cardCount: 0,
      insertedCount: 0,
      updatedCount: 0
    };
  }

  let totalCards = 0;
  let insertedCount = 0;
  let updatedCount = 0;

  for (const filePath of jsonFiles) {
    const fileName = path.basename(filePath);

    try {
      const rawData = fs.readFileSync(filePath, 'utf8');
      const parsedData = JSON.parse(rawData);

      /*
       * Hỗ trợ hai kiểu JSON:
       *
       * 1. Mảng trực tiếp:
       * [
       *   { "word": "apple" }
       * ]
       *
       * 2. Object chứa mảng cards:
       * {
       *   "cards": [
       *     { "word": "apple" }
       *   ]
       * }
       */
      const oldCards = Array.isArray(parsedData)
        ? parsedData
        : parsedData.cards;

      if (!Array.isArray(oldCards)) {
        console.error(
          `❌ File ${fileName} không phải mảng JSON hoặc không có trường cards`
        );
        continue;
      }

      const validCards = oldCards
        .filter(card => card && String(card.word || '').trim())
        .map(card =>
          transformCard(
            card,
            categoryId,
            path.relative(dataDir, filePath)
          )
        );

      if (validCards.length === 0) {
        console.log(`⚠️ File ${fileName} không có từ vựng hợp lệ`);
        continue;
      }

      /*
       * Dùng bulkWrite + upsert:
       * - Chưa có word trong category: insert.
       * - Đã có word trong category: update.
       *
       * Nhờ đó chạy lại seed.js không bị nhân đôi dữ liệu.
       */
      const operations = validCards.map(card => ({
        updateOne: {
          filter: {
            word: card.word,
            category_id: categoryId
          },
          update: {
            $set: card,
            $setOnInsert: {
              created_at: new Date()
            }
          },
          upsert: true
        }
      }));

      const result = await cardCollection.bulkWrite(
        operations,
        {
          ordered: false
        }
      );

      totalCards += validCards.length;
      insertedCount += result.upsertedCount || 0;
      updatedCount += result.modifiedCount || 0;

      console.log(
        `   ✅ ${fileName}: `
        + `${validCards.length} từ, `
        + `thêm mới ${result.upsertedCount || 0}, `
        + `cập nhật ${result.modifiedCount || 0}`
      );
    } catch (error) {
      console.error(`   ❌ Lỗi file ${fileName}: ${error.message}`);
    }
  }

  console.log(`📊 Tổng dữ liệu category ${categoryName}:`);
  console.log(`   - Số file: ${jsonFiles.length}`);
  console.log(`   - Số card xử lý: ${totalCards}`);
  console.log(`   - Thêm mới: ${insertedCount}`);
  console.log(`   - Cập nhật: ${updatedCount}`);

  return {
    categoryName,
    fileCount: jsonFiles.length,
    cardCount: totalCards,
    insertedCount,
    updatedCount
  };
}

async function seedData() {
  const client = new MongoClient(uri);

  try {
    await client.connect();

    console.log('✅ Đã kết nối tới MongoDB');
    console.log(`📂 Thư mục dữ liệu: ${dataDir}`);

    const db = client.db(dbName);
    const categoryCollection = db.collection('categories');
    const cardCollection = db.collection('cards');

    /*
     * Tạo index để bảo đảm:
     * - Tên category không bị trùng.
     * - Một word không bị trùng trong cùng category.
     */
    await categoryCollection.createIndex(
      { name: 1 },
      { unique: true }
    );

    await cardCollection.createIndex(
      {
        category_id: 1,
        word: 1
      },
      {
        unique: true
      }
    );

    /*
     * Chỉ lấy các thư mục con.
     * node_modules sẽ bị bỏ qua.
     */
    const ignoredDirectories = new Set([
      'node_modules',
      '.git',
      '.idea',
      '.vscode'
    ]);

    const categoryFolders = fs
      .readdirSync(dataDir, { withFileTypes: true })
      .filter(entry => {
        return (
          entry.isDirectory()
          && !ignoredDirectories.has(entry.name)
          && !entry.name.startsWith('.')
        );
      });

    console.log(
      `🔍 Tìm thấy ${categoryFolders.length} thư mục category`
    );

    const summaries = [];

    /*
     * Lặp qua từng thư mục:
     * 1000_WORD_COMMOM
     * 3000_A1_OF
     * 3000_A2_OF
     * 600_IELTS_BASIC
     * 600_TOEIC_BASIC
     * BAND_4_5_IELTS
     */
    for (const folder of categoryFolders) {
      const categoryName = folder.name;
      const folderPath = path.join(dataDir, folder.name);

      const summary = await importCategoryFolder(
        folderPath,
        categoryName,
        categoryCollection,
        cardCollection
      );

      summaries.push(summary);
    }

    console.log('\n==================================================');
    console.log('🎉 HOÀN THÀNH IMPORT DỮ LIỆU');
    console.log('==================================================');

    let totalFiles = 0;
    let totalCards = 0;
    let totalInserted = 0;
    let totalUpdated = 0;

    for (const summary of summaries) {
      console.log(
        `📁 ${summary.categoryName}: `
        + `${summary.cardCount} card, `
        + `thêm ${summary.insertedCount}, `
        + `cập nhật ${summary.updatedCount}`
      );

      totalFiles += summary.fileCount;
      totalCards += summary.cardCount;
      totalInserted += summary.insertedCount;
      totalUpdated += summary.updatedCount;
    }

    console.log('--------------------------------------------------');
    console.log(`📂 Tổng file JSON: ${totalFiles}`);
    console.log(`🗂️ Tổng card xử lý: ${totalCards}`);
    console.log(`➕ Tổng card thêm mới: ${totalInserted}`);
    console.log(`♻️ Tổng card cập nhật: ${totalUpdated}`);
  } catch (error) {
    console.error('❌ Có lỗi xảy ra:', error);
    process.exitCode = 1;
  } finally {
    await client.close();
    console.log('🔌 Đã ngắt kết nối MongoDB');
  }
}

seedData();