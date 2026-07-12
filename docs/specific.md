TÀI LIỆU THIẾT KẾ HỆ THỐNG - TRÒ CHƠI VOCAB BATTLE

1. CÔNG NGHỆ SỬ DỤNG
- Frontend: Next.js (Phiên bản mới nhất - App Router), React, TailwindCSS, Zustand/Redux (Quản lý state), Socket.io-client hoặc native WebSocket.
- Backend: Go (Golang) sử dụng framework Gin hoặc Fiber. Real-time communication xử lý qua Gorilla WebSocket.
- Cơ sở dữ liệu (Database): MongoDB (Khuyên dùng do cấu trúc dữ liệu Card có nhiều trường JSON lồng nhau phức tạp và linh hoạt) hoặc PostgreSQL (dùng kiểu dữ liệu JSONB).
- In-memory/Cache: Redis (quản lý trạng thái phòng chơi theo thời gian thực).

2. CẤU TRÚC CƠ SỞ DỮ LIỆU (DATABASE SCHEMA)

a. Collection Categories (Phân loại từ vựng)
- category_id: ObjectID (Primary Key)
- name: String (Ví dụ: "A1", "A2", "TOEIC")
- description: String
- created_at: DateTime

b. Collection Cards (Từ vựng - cấu trúc mẫu từ yêu cầu)
- card_id: ObjectID / String (Primary Key)
- word: String
- explanation: Object (hỗ trợ nhiều ngôn ngữ: en, vi, th, id, ar...)
- translation: Object (vi, th, id, ar, ja...)
- type: String (ví dụ: "adjective", "noun", "verb")
- phonetics: Array of Objects [{ text, audio, locale }]
- example: Object (en, vi, th, id, ar)
- image_url: String
- notes: String
- difficulty: String
- group_id: String
- group_name: String
- deck_id: String
- deck_name: String
- quiz_options: Array
- category_id: ObjectID (Foreign key tham chiếu tới Collection Categories)

c. Trạng thái Phòng chơi (Lưu trên Redis hoặc In-memory của Go server)
- room_code: String (Mã phòng, VD: 6 chữ số ngẫu nhiên)
- host_id: String (ID của người tạo phòng)
- status: String ("WAITING", "PLAYING", "FINISHED")
- config: 
  + max_players: Int (Số lượng người chơi tối đa)
  + category_id: String (Loại từ vựng được chọn)
  + total_questions: Int (Số lượng câu hỏi trong trận)
- players: Array [{ player_id, name, score, avatar, is_ready }]
- current_cards: Array (Danh sách các từ vựng đã được truy vấn cho trận này)
- current_question_index: Int

3. LUỒNG HOẠT ĐỘNG CHÍNH (GAME FLOW)

Bước 1: Tạo phòng (Host)
- Người chơi cấu hình phòng trên giao diện (chọn Category, số người, số câu).
- Client gửi HTTP POST request (/api/rooms) đến Go Backend.
- Go Backend: Tạo Room ID, lưu thông tin cấu hình phòng, thiết lập trạng thái WAITING.
- Backend trả về Room Code cho Client. Người tạo trở thành Host.

Bước 2: Tham gia phòng (Guest)
- Người chơi khác nhập Room Code.
- Client thực hiện kết nối WebSocket (ws://domain/ws/room/{room_code}).
- Server xác thực phòng có tồn tại và chưa đầy.
- Thêm người chơi vào danh sách `players`.
- Broadcast sự kiện `PLAYER_JOINED` cho tất cả người chơi trong phòng để cập nhật giao diện Lobby.

Bước 3: Bắt đầu và diễn biến trận đấu
- Khi mọi người đã sẵn sàng, Host nhấn "Bắt đầu".
- Server nhận event `START_GAME` từ Host.
- Server truy xuất ngẫu nhiên N (total_questions) thẻ từ Collection `Cards` dựa vào `category_id`.
- Server broadcast sự kiện `NEXT_QUESTION` với dữ liệu đã bị che đi đáp án (chỉ gửi image_url, phonetics audio, explanation; ẨN 'word' và 'translation').
- Client (Next.js) hiển thị hình ảnh, gợi ý và các ô trống để nhập chữ (như trong thiết kế).
- Người chơi gõ đáp án và gửi qua WebSocket event `SUBMIT_ANSWER`.
- Server kiểm tra:
  + Nếu sai: Phản hồi lỗi riêng cho người đó.
  + Nếu đúng (Người đầu tiên đoán đúng):
    * Tính toán cộng điểm.
    * Broadcast event `CORRECT_ANSWER` (báo hiệu người chơi X đã đoán đúng, lật mở đáp án từ vựng).
    * Sau delay 3-5 giây, Server tự động chuyển sang câu tiếp theo bằng cách broadcast lại event `NEXT_QUESTION`.
- Lặp lại cho đến khi hết `current_question_index`.

Bước 4: Kết thúc trò chơi
- Sau câu hỏi cuối, Server xử lý tính tổng điểm.
- Gửi event `GAME_OVER` kèm mảng `players` đã sắp xếp điểm số.
- Client hiển thị màn hình bảng xếp hạng (Leaderboard) chung cuộc.

4. DANH SÁCH API & WEBSOCKET EVENTS ĐỀ XUẤT

REST API:
- GET /api/categories: Lấy danh sách các bộ từ (A1, A2, TOEIC...)
- POST /api/rooms: Tạo phòng và trả về cấu hình
- GET /api/cards?category_id=...: Lấy danh sách từ (Internal use)

WebSocket (Real-time Payload):
- Phía Client Gửi:
  + "JOIN_ROOM": { room_code, player_info }
  + "START_GAME": { room_code }
  + "SUBMIT_ANSWER": { room_code, player_id, answer_word }
  
- Phía Server Gửi (Broadcast):
  + "ROOM_UPDATED": { room_info, players_list }
  + "NEW_QUESTION": { question_index, image_url, explanation_hint, length_of_word }
  + "SCORE_UPDATE": { player_id, score_added, is_correct, word_revealed }
  + "GAME_END": { leaderboard }