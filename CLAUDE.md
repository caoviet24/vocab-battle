# Vocab Battle

Trò chơi đoán từ vựng tiếng Anh realtime — multiplayer, room-based, WebSocket-driven.

## Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | Next.js 16 (App Router), React 19, TailwindCSS 4, Zustand 5, Framer Motion | SP cổng 3000 |
| Backend | Go 1.25, Gin, Gorilla WebSocket | SP cổng 8080 |
| Database | MongoDB 6 | vocab_battle DB |
| Real-time | Native WebSocket (gorilla/websocket + browser WebSocket) | Không dùng Socket.io |
| Devops | Docker Compose (chỉ MongoDB được uncomment, backend/frontend bị comment out — chạy local chưa containerize) | |

## Cấu trúc thư mục

```
vocab-battle/
├── backend/                    # Go API + WebSocket server
│   ├── cmd/server/main.go      # Entry point, Gin routes
│   ├── db/mongo.go             # MongoDB connection (MongoClient, CardCollection, CategoryCollection)
│   ├── models/card.go          # Category, Card, Phonetic, BilingualText structs
│   ├── repository/card_repo.go # FetchAllCategories(), FetchRoundCards() (aggregation pipeline, $sample)
│   └── ws/                     # WebSocket core
│       ├── hub.go              # Hub quản lý Rooms map (getOrCreateRoom, removeRoom)
│       ├── room.go             # Room: game state machine (LOBBY → PLAYING → FINISHED), answer handling, masking
│       ├── client.go           # readPump/writePump, message routing (START_GAME, SUBMIT_ANSWER, TIMEOUT, GET_PHONETICS)
│       └── message.go          # Message, AnswerPayload, StartGamePayload, ErrorPayload structs
├── vocab-battle-client/        # Next.js frontend
│   ├── app/
│   │   ├── layout.tsx          # Root layout (Geist font)
│   │   ├── globals.css         # Tailwind v4 imports
│   │   ├── page.tsx            # Home: join/create room UI, password modal, category selector
│   │   └── room/[code]/page.tsx # Game room: lobby → playing → finished screens, 30s countdown timer
│   └── lib/store.ts            # Zustand store (players, currentQuestion, gameStatus, isHost, winnerInfo)
├── data/                       # Seed script + raw JSON word decks
│   ├── seed.js                 # MongoDB seed script (node seed.js), upserts categories + inserts cards
│   ├── 3000_A1_OF/             # 20 JSON files (~3000 từ A1), multi-lang (en/vi/th/id/ar/ja)
│   └── 600_TOEIC_BASIC/        # 29 JSON files (~600 từ TOEIC)
├── docs/specific.md            # Tài liệu thiết kế hệ thống gốc (tiếng Việt)
└── docker-compose.yaml         # MongoDB container (backend/frontend services commented out)
```

## Luồng hoạt động (Game Flow)

### 1. Tạo phòng (Host)
- Host nhập mã phòng tùy chọn, chọn category + số câu hỏi + password (optional) trên `/` (Home page)
- Dữ liệu config lưu vào `sessionStorage` (không gọi REST API tạo phòng — phòng được tạo lazy khi WS connect)
- Navigate đến `/room/<code>`

### 2. Tham gia phòng (Guest)
- Guest nhập room code + password (nếu có) trên `/`
- Navigate đến `/room/<code>`

### 3. WebSocket Connect — Kết nối & xác thực
- Client mở WS đến `ws://host:8080/ws/room/<code>?playerId=...&playerName=...&password=...&isHost=0|1`
- Server (`ServeWs`):
  - `Hub.GetOrCreateRoom(roomCode)` — tạo phòng nếu chưa có
  - Nếu `isHost=1` → `Room.SetPasswordAndHost(password, playerID)`
  - Nếu không phải host → `Room.VerifyPassword(password)`, nếu sai đóng WS kèm `ERROR: WRONG_PASSWORD`
  - Register client vào room channel
  - readPump đọc message từ client (JSON), writePump gửi message sang client

### 4. Sảnh chờ (LOBBY)
- Server gửi `ROOM_STATE` (players list, isHost flag, hasPassword flag) cho client vừa connect
- Nếu client mới → broadcast `PLAYER_JOINED` cho cả phòng
- Chỉ Host được bấm Start, cần ≥2 người

### 5. Đang chơi (PLAYING)
- Host gửi `START_GAME` (category_id, total_questions) qua WS
- Server: `repository.FetchRoundCards()` dùng MongoDB `$sample` pipeline bốc ngẫu nhiên cards
- Server gửi `NEXT_QUESTION` với dữ liệu ĐÃ CHE ĐÁP ÁN: word masked thành `****` trong explanation/example/phonetics, chỉ gửi translation + image_url + word_length + hint_pattern
- Client hiển thị: ảnh, giải thích, ví dụ, letter boxes, bản dịch
- Countdown 30s client-side, host gửi `TIMEOUT` khi về 0
- 15s đầu: tất cả blank; 15s cuối: hiện hint pattern (mỗi ký tự thứ 3 bắt đầu từ vị trí 3,6,9...)
- 7s cuối: hiện nút nghe phonetic, gửi `GET_PHONETICS` → server trả phonetics audio
- Người chơi gửi `SUBMIT_ANSWER` (answer string)
- Server so sánh case-insensitive, trim whitespace:
  - **Sai** → broadcast `WRONG_ANSWER` (player_name, answer)
  - **Đúng** → khóa câu hỏi (QuestionLocked=true), cộng 1 điểm, broadcast `CORRECT_ANSWER` (full card reveal + scoreboard), sau 3s auto `NEXT_QUESTION`
- Khi đối thủ thoát giữa game → `LAST_MAN_STANDING` (người còn lại thắng, về LOBBY)

### 6. Kết thúc (FINISHED)
- Sau câu cuối → server gửi `GAME_OVER` kèm sorted players list
- Client hiển thị leaderboard, nút "Trở lại sảnh chờ" quay về LOBBY

## WebSocket Events

**Client → Server:**
| Event | Payload | When |
|-------|---------|------|
| `START_GAME` | `{category_id, total_questions}` | Host starts game |
| `SUBMIT_ANSWER` | `{answer}` | Player submits guess |
| `TIMEOUT` | (none) | Host's timer hits 0 |
| `GET_PHONETICS` | (none) | Player clicks listen button |

**Server → Client:**
| Event | Payload | When |
|-------|---------|------|
| `ROOM_STATE` | `{players[], is_host, has_password}` | On WS connect |
| `PLAYER_JOINED` | `Player[]` | New player joins |
| `PLAYER_LEFT` | `Player[]` | Player disconnects |
| `NEXT_QUESTION` | `{card_id, type, explanation, translation, example, phonetics_text, image_url, word_length, hint_pattern, round, total_rounds}` | New round |
| `PHONETICS` | `{phonetics[]}` | Response to GET_PHONETICS |
| `WRONG_ANSWER` | `{player_id, player_name, answer}` | Someone guessed wrong |
| `CORRECT_ANSWER` | `{winner_id, winner_name, card, scoreboard[]}` | First correct answer |
| `TIMEOUT_SKIP` | `{card, scoreboard[]}` | Timer ran out, no one guessed |
| `LAST_MAN_STANDING` | `{winner_id, winner_name, scoreboard[]}` | Opponent left mid-game |
| `GAME_OVER` | `Player[]` | All rounds done |
| `ERROR` | `{code, message}` | Wrong password, start denied, etc. |

## REST API

Chỉ 2 endpoint, tối thiểu:

- `GET /api/categories` — trả về `[]Category` từ MongoDB `categories` collection
- `GET /ws/room/:roomCode` — WebSocket upgrade endpoint (query params: playerId, playerName, password, isHost)

`POST /api/rooms` tồn tại nhưng chỉ trả hardcoded `123456` — chưa implement, phòng được tạo lazy qua WS.

## Database

**MongoDB** (`vocab_battle`):
- `categories`: `{_id, name, description, created_at}`
- `cards`: `{_id, word, type, explanation:{en,vi}, translation, example:{en,vi}, phonetics:[{text,audio,locale}], image_url, difficulty, category_id}`

Không dùng Redis — room state được giữ in-memory trong Go `Hub.Rooms` map, mất khi server restart.

## Cách chạy local

```bash
# 1. Tạo cấu hình local (chỉ cần lần đầu)
cp .env.example .env

# 2. Khởi động MongoDB và seed data
docker compose up -d mongodb
cd data && npm install && cd .. && make seed

# 3. Backend
make dev-backend

# 4. Frontend
make dev-client
```

Backend, frontend, seed và Docker Compose cùng lấy cấu hình từ `.env`; chỉ
`.env.example` được commit.

## Những điểm đáng lưu ý

- **Phòng in-memory**: không persistence, restart server → mất hết room state. OK cho prototype, cần Redis nếu muốn survive restart.
- **Lazy room creation**: không REST endpoint tạo phòng thực sự, phòng được tạo khi WS connect đầu tiên. `POST /api/rooms` chưa dùng.
- **Password qua query param**: gửi plaintext trong URL (không production-ready, OK cho local/internal).
- **Client-side timer authority**: timer chạy ở client, chỉ host gửi TIMEOUT. Nếu host cheat (chỉnh JS timer chậm hơn) → lợi thế. Production nên đưa timer về server.
- **No reconnect logic**: WS mất → player bị xóa khỏi room và `PLAYER_LEFT` broadcast. Không có cơ chế reconnect/rejoin giữ state.
- **Single point of score**: mỗi câu đúng = 1 điểm. Không weighted score, không streak bonus.
- **Card masking**: `maskWordInText` dùng case-insensitive substring replace — có thể mask nhầm nếu từ là substring của từ khác (vd: "a" trong "apple"). Hiếm gặp trong thực tế với từ vựng tiếng Anh.
