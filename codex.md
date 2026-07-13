# Codex project guide — Vocab Battle

## Mục đích

Vocab Battle là game đoán từ vựng tiếng Anh nhiều người chơi theo phòng. Frontend Next.js mở kết nối WebSocket tới backend Go; backend giữ trạng thái trận đấu trong memory và lấy thẻ từ MongoDB. MongoDB cũng lưu category và card được nhập từ các corpus JSON trong `data/`.

Khi tài liệu và code khác nhau, ưu tiên code đang chạy theo thứ tự:

1. `backend/` và `vocab-battle-client/`.
2. `data/seed.js` và dữ liệu JSON.
3. `docker-compose.yaml` và các Dockerfile.
4. `CLAUDE.md`, `docs/specific.md`, rồi README mặc định của Next.js.

`CLAUDE.md` mô tả project khá đầy đủ nhưng có thể chậm hơn code. `vocab-battle-client/README.md` vẫn là README mặc định của create-next-app, không phải đặc tả sản phẩm.

## Kiến trúc hiện tại

```text
Browser / Next.js :3000
  ├─ REST GET ───────────────┐
  └─ native WebSocket ───────┤
                             v
                    Go + Gin :8080
                    ├─ Hub → Room → Client
                    └─ Repository / Models
                             |
                             v
                       MongoDB :27017
                       ├─ categories
                       └─ cards
```

- Frontend: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Zustand, Framer Motion.
- Backend: Go 1.25.4, Gin, Gorilla WebSocket, MongoDB driver.
- Database: MongoDB 6 trong Docker Compose.
- Realtime: native WebSocket; không dùng Socket.io.
- Room/game state: chỉ nằm trong process Go, không persist và không dùng Redis.
- Vocabulary: các corpus JSON được `data/seed.js` chuẩn hóa rồi insert vào MongoDB.

## Bản đồ source code

### Backend

- `backend/cmd/server/main.go`: entry point; kết nối MongoDB, tạo Gin router, bật CORS, tạo Hub và đăng ký REST/WebSocket routes.
- `backend/db/mongo.go`: tạo Mongo client và các global collection `cards`, `categories`.
- `backend/models/card.go`: BSON/JSON model cho `Category`, `Card`, `BilingualText`, `Phonetic` và payload câu hỏi.
- `backend/repository/card_repo.go`: đọc categories và dùng MongoDB aggregation `$match` + `$sample` để chọn câu hỏi.
- `backend/ws/message.go`: envelope `{type, payload}` và các payload client gửi lên.
- `backend/ws/client.go`: WebSocket upgrade, join/host authentication, `readPump`, `writePump` và routing event client → room.
- `backend/ws/hub.go`: registry `map[roomCode]*Room`, tạo/xóa phòng và snapshot cho admin.
- `backend/ws/room.go`: state machine và nghiệp vụ chính: membership, ready state, câu hỏi, chấm điểm, timeout, phonetics, broadcast, game over và rematch.
- `backend/ws/room_test.go`: regression test cho readiness và cleanup người chơi/phòng khi WebSocket ngắt.

### Frontend

- `vocab-battle-client/app/page.tsx`: trang `/`; tải categories/rooms, tạo hoặc tham gia phòng, lưu cấu hình tạm vào `sessionStorage`.
- `vocab-battle-client/app/room/[code]/page.tsx`: màn hình lobby/game/result; mở WebSocket, xử lý toàn bộ server event, chạy timer 30 giây và gửi answer/timeout/ready.
- `vocab-battle-client/app/admin/page.tsx`: poll `GET /api/admin/rooms` mỗi 2 giây để xem room đang hoạt động.
- `vocab-battle-client/lib/store.ts`: Zustand store cho identity, room state, players, question, winner và ready state.
- `vocab-battle-client/app/layout.tsx`: root layout và font; metadata hiện vẫn là giá trị mặc định create-next-app.
- `vocab-battle-client/app/globals.css`: Tailwind import và global theme tối/sáng.

### Dữ liệu và hạ tầng

- `data/seed.js`: đọc một thư mục corpus được hardcode, transform card, tái sử dụng/tạo category rồi `insertMany` vào MongoDB.
- `data/1000_WORD_COMMOM/`, `data/3000_A1_OF/`, `data/3000_A2_OF/`, `data/600_IELTS_BASIC/`, `data/600_TOEIC_BASIC/`, `data/BAND_4_5_IELTS/`: nguồn JSON đa ngôn ngữ.
- `docker-compose.yaml`: hiện chỉ bật service MongoDB và named volume `mongo_data`; backend/frontend đang comment.
- `backend/dockerfile`, `vocab-battle-client/dockerfile`: multi-stage image cho từng ứng dụng.

## Luồng runtime

### Tạo phòng

1. Trang chủ tạo `playerId`, `playerName`, room code, category, số câu và password.
2. Frontend lưu config vào `sessionStorage`; không có REST API tạo phòng.
3. Frontend chuyển tới `/room/<code>` và mở WebSocket với `isHost=1`.
4. Backend tạo room lazy trong `Hub`, gán host/password và chạy goroutine `Room.Run()`.

### Tham gia phòng

1. Trang chủ poll danh sách room từ admin endpoint để kiểm tra room code.
2. Guest mở WebSocket với `isHost=0` và password trong query string.
3. Backend chỉ cho join room đã tồn tại và kiểm tra password trước khi register client.
4. Client mới nhận `ROOM_STATE`; room broadcast `PLAYER_JOINED` nếu đây là player mới.

### Chơi một vòng

1. Host gửi `START_GAME` với category và tổng số câu.
2. Backend lấy card ngẫu nhiên, reset score và chuyển room sang `PLAYING`.
3. `NEXT_QUESTION` che từ cần đoán trong explanation/example/phonetic text và chỉ gửi hint cần thiết.
4. Frontend chạy timer 30 giây. Sau 15 giây mới hiện `hint_pattern`; 7 giây cuối mới hiện nút phonetics.
5. `SUBMIT_ANSWER` được so sánh bằng lowercase + trim. Đúng đầu tiên khóa câu, cộng 1 điểm và reveal card; sai được broadcast cho cả phòng.
6. Sau đáp án đúng hoặc timeout, backend chờ 3 giây rồi gửi câu tiếp theo.
7. Hết card thì backend gửi `GAME_OVER`; người chơi dùng `SET_READY` cho rematch.

## Hợp đồng HTTP và WebSocket

REST routes thực sự có trong code:

| Method | Path | Vai trò |
|---|---|---|
| `GET` | `/api/categories` | Danh sách category từ MongoDB |
| `GET` | `/api/admin/rooms` | Snapshot tất cả room in-memory |
| `GET` | `/ws/room/:roomCode` | Upgrade WebSocket |

Không có `POST /api/rooms`; room được tạo khi host kết nối WebSocket.

Client → server:

| Event | Payload |
|---|---|
| `START_GAME` | `{category_id, total_questions}` |
| `SUBMIT_ANSWER` | `{answer}` |
| `TIMEOUT` | không bắt buộc payload |
| `GET_PHONETICS` | không bắt buộc payload |
| `SET_READY` | không bắt buộc payload |

Server → client:

| Event | Ý nghĩa |
|---|---|
| `ROOM_STATE` | players, `is_host`, `has_password` cho client mới |
| `PLAYER_JOINED`, `PLAYER_LEFT` | cập nhật player list |
| `NEXT_QUESTION` | câu hỏi đã che đáp án, round và hint |
| `PHONETICS` | audio/text phát âm cho client yêu cầu |
| `WRONG_ANSWER` | công khai lượt đoán sai |
| `CORRECT_ANSWER` | người thắng câu, full card, scoreboard |
| `TIMEOUT_SKIP` | reveal card khi hết giờ |
| `LAST_MAN_STANDING` | người còn lại thắng khi đối thủ rời game |
| `GAME_OVER` | player list cuối trận |
| `READY_UPDATE` | danh sách player sẵn sàng rematch |
| `HOST_LEFT` | đóng phòng khi host rời |
| `ERROR` | lỗi room/password/start game |

Tên trạng thái phải đồng bộ giữa `backend/ws/room.go` và `vocab-battle-client/lib/store.ts`: `LOBBY`, `PLAYING`, `FINISHED`. Khi đổi event hoặc payload, sửa đồng thời backend router, room broadcaster và frontend `onmessage` switch.

## Data model

MongoDB database được hardcode là `vocab_battle`:

- `categories`: `_id`, `name`, `description`, `created_at`.
- `cards`: `_id`, `word`, `type`, `explanation.{en,vi}`, `translation`, `example.{en,vi}`, `phonetics[]`, `image_url`, `difficulty`, `category_id`.

Corpus gốc có thêm ngôn ngữ và metadata như `deck_id`, `group_id`, `notes`, `quiz_options`; seed script chỉ giữ phần mà backend model sử dụng. `translation` được rút về chuỗi tiếng Việt.

## Chạy local

Yêu cầu: Docker, Go theo `backend/go.mod`, Node.js phù hợp với Next.js 16 và pnpm.

```bash
# 1. Tạo cấu hình local (chỉ cần lần đầu)
cp .env.example .env

# 2. MongoDB
docker compose up -d mongodb

# 3. Cài dependency cho seed (chỉ cần lần đầu), rồi seed dữ liệu
cd data && npm install && cd ..
make seed

# 4. Backend
make dev-backend

# 5. Frontend (terminal khác; chạy `pnpm install` trong thư mục client lần đầu)
make dev-client
```

Mặc định dev: frontend cổng `3000`, backend cổng `8080`. Docker production dùng
cổng host `3001` và `8081`; toàn bộ giá trị nằm trong `.env`.

Frontend lấy API/WS URL bắt buộc từ biến môi trường; không còn fallback hardcode.

## Kiểm tra trước khi hoàn tất thay đổi

Test coverage hiện còn rất nhỏ. Dùng các check tối thiểu sau:

```bash
cd backend
go test ./...

cd ../vocab-battle-client
pnpm lint
pnpm build
```

Nếu sửa realtime flow, test thủ công với ít nhất hai tab/browser:

1. Host tạo room, guest join đúng/sai password.
2. Hai player ready và host start.
3. Sai answer, đúng answer, timeout và game over.
4. Rematch ready flow.
5. Guest rời giữa game; host rời phòng.

## Quy tắc khi sửa code

- Giữ backend là nguồn quyết định score, current question và room status.
- Không gửi `Card.Word` trước khi câu kết thúc; khi thêm field mới phải kiểm tra lại masking.
- Không đổi chuỗi event/status ở một phía duy nhất.
- Bảo vệ shared room/hub state bằng mutex hoặc channel ownership; kiểm tra lock ordering giữa Hub và Room.
- Không thêm abstraction hoặc dependency nếu stdlib/platform hiện tại đủ dùng.
- Không sửa hàng loạt corpus JSON cho thay đổi schema runtime; ưu tiên transform trong seed script nếu dữ liệu gốc vẫn hợp lệ.
- Tôn trọng thay đổi chưa commit của người dùng. Hiện `data/seed.js` có chỉnh sửa local chọn corpus `3000_A1_OF`; không ghi đè ngoài yêu cầu.
- Khi thay đổi seed, nhớ rằng script hiện insert lại card mỗi lần chạy và chưa idempotent.

## Giới hạn và rủi ro đã biết

- Timer do client host điều khiển; server không có clock authoritative. `HandleTimeout` cũng chưa xác minh sender là host.
- Password nằm trong WebSocket query string, được so sánh plaintext và hiện có log chứa password trong backend.
- `websocket.Upgrader.CheckOrigin` luôn trả `true`; admin rooms endpoint không có authentication.
- Room state mất khi backend restart và không hỗ trợ scale nhiều instance.
- Không có reconnect protocol giữ state; frontend redirect về `/` khi socket đóng bất ngờ.
- `seed.js` không deduplicate card; chạy lại sẽ insert trùng.
- Backend Mongo URI/database đang hardcode; frontend URL handling chưa thống nhất hoàn toàn với env.
- Dockerfile backend dùng Go 1.21 trong khi `go.mod` yêu cầu Go 1.25.4; Dockerfile frontend dùng Node 18 trong khi Next.js 16 có thể cần runtime mới hơn.
- Compose chỉ chạy MongoDB; hai service ứng dụng vẫn bị comment và context backend mẫu không khớp tên thư mục hiện tại.
- Test coverage hiện chỉ bảo vệ readiness và disconnect cleanup; chưa có integration/E2E test cho toàn bộ game flow.

## Knowledge graph

Phân tích kiến trúc được lưu tại `.ua/knowledge-graph.json`:

- 268 file đã quét sau khi loại metadata/tooling `.codex/`, `.claude/`, `.ua/`.
- 322 node, 150 edge, 8 architectural layer và guided tour 10 bước.
- 238 corpus/config node không có edge vì là dữ liệu tĩnh độc lập; graph không có dangling reference hoặc validation error.
