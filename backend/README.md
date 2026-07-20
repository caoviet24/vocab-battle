# Vocab Battle — C# server

Server ASP.NET Core thay thế tương thích với server Go hiện tại. Frontend không cần đổi giao thức: server giữ nguyên REST routes, WebSocket URL, message type và JSON `snake_case`.

## Kiến trúc

```text
VocabBattle.Domain
  Aggregates/Entities/ValueObjects/Repositories
          ↑
VocabBattle.Application
  MediatR Commands/Queries, DTOs, interfaces, mappers
          ↑
VocabBattle.Infrastructure
  MongoDB repositories, documents/mappers, room manager
          ↑
VocabBattle.Api
  REST endpoints, native WebSocket GameHub, serialization
```

Dependency chỉ hướng vào trong. Domain không phụ thuộc MongoDB, ASP.NET Core hoặc MediatR. `GameHub` dùng native WebSocket thay vì SignalR để tương thích trực tiếp với client hiện tại.

## Chạy local

Từ thư mục gốc project:

```bash
make dev-dotnet
```

Lệnh này đọc `PORT` và `MONGO_URI` từ `.env.local`; môi trường Development tự dùng database `vocab_battle_dev`. Hoặc chạy trực tiếp:

```bash
cd backend
PORT=8080 MONGO_URI=mongodb://localhost:27017 \
  dotnet run --project src/VocabBattle.Api
```

Các endpoint tương thích:

- `GET /health`
- `GET /api/categories`
- `GET /api/admin/rooms`
- `GET /ws/room/{roomCode}?playerId=...&playerName=...&password=...&isHost=1`

WebSocket nhận `START_GAME`, `SUBMIT_ANSWER`, `TIMEOUT`, `GET_PHONETICS`, `SET_READY`. `NEXT_QUESTION` không lộ đáp án hay phonetic; phonetic chỉ được gửi qua `PHONETICS`.

## Kiểm thử và Docker

```bash
make test-dotnet
docker build -t vocab-battle-dotnet ./backend
```
