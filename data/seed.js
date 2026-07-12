const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Cấu hình kết nối và đường dẫn tĩnh
const uri = 'mongodb://localhost:27017';
const dbName = 'vocab_battle';
const dirPath = path.join(__dirname, '.', '3000_A2_OF');

async function seedData() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Đã kết nối tới MongoDB');
    
    const db = client.db(dbName);
    const categoryCollection = db.collection('categories');
    const cardCollection = db.collection('cards');

    // 1. ĐÃ BỎ LỆNH XÓA DỮ LIỆU CŨ (deleteMany) Ở ĐÂY ĐỂ GIỮ LẠI DATA

    // 2. Tìm hoặc tạo Category cho bộ từ này
    let categoryId;
    const existingCategory = await categoryCollection.findOne({ name: '3000_WORD_A2' });

    if (existingCategory) {
      categoryId = existingCategory._id;
      console.log(`📁 Đã dùng lại Category hiện tại với ID: ${categoryId}`);
    } else {
      const defaultCategory = {
        name: '3000_WORD_A2',
        description: 'Bộ 3000 từ vựng tiếng Anh A2 cơ bản',
        created_at: new Date()
      };
      const categoryResult = await categoryCollection.insertOne(defaultCategory);
      categoryId = categoryResult.insertedId;
      console.log(`📁 Đã tạo Category mới với ID: ${categoryId}`);
    }

    // 3. Quét tất cả các file trong thư mục
    console.log(`🔍 Đang quét thư mục: ${dirPath}`);
    const files = fs.readdirSync(dirPath);
    
    // Lọc ra chỉ các file có đuôi .json
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    console.log(`📂 Tìm thấy ${jsonFiles.length} file JSON.`);

    let allNewCards = [];

    // 4. Duyệt qua từng file, đọc và transform dữ liệu
    for (const file of jsonFiles) {
      const filePath = path.join(dirPath, file);
      const rawData = fs.readFileSync(filePath, 'utf8');
      
      try {
        const oldCards = JSON.parse(rawData);
        
        // Transform dữ liệu của file hiện tại
        const newCards = oldCards.map(card => ({
          word: card.word,
          type: card.type,
          explanation: {
            en: card.explanation?.en || '',
            vi: card.explanation?.vi || ''
          },
          translation: card.translation?.vi || '',
          example: {
            en: card.example?.en || '',
            vi: card.example?.vi || ''
          },
          phonetics: card.phonetics?.map(p => ({
            text: p.text,
            audio: p.audio,
            locale: p.locale
          })) || [],
          image_url: card.image_url || '',
          difficulty: card.difficulty || 'medium',
          category_id: categoryId
        }));

        // Gom data vào mảng tổng
        allNewCards.push(...newCards);
        console.log(`   - Đã xử lý file ${file}: ${newCards.length} từ`);
      } catch (parseErr) {
        console.error(`   ❌ Lỗi parse JSON tại file ${file}:`, parseErr.message);
      }
    }

    // 5. Insert toàn bộ cards đã format vào Database
    if (allNewCards.length > 0) {
      console.log(`⏳ Đang insert thêm ${allNewCards.length} thẻ từ vựng vào database...`);
      const result = await cardCollection.insertMany(allNewCards);
      console.log(`✅ Đã insert thêm thành công ${result.insertedCount} thẻ từ vựng vào collection 'cards'`);
    } else {
      console.log('⚠️ Không tìm thấy dữ liệu hợp lệ để insert.');
    }

  } catch (error) {
    console.error('❌ Có lỗi xảy ra:', error);
  } finally {
    await client.close();
    console.log('🔌 Đã ngắt kết nối database');
  }
}

// Thực thi
seedData();