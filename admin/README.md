# Vocab Battle client

Next.js client cho đấu trường từ vựng realtime.

## Chạy local

Đặt URL backend và WebSocket:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_WS_URL=ws://localhost:5000
NEXT_PUBLIC_CARD_PAYLOAD_KEY=<Base64-encoded-32-byte-key>
```

`GET /api/cards` is AES-256-GCM-obfuscated. Set
`CardPayloadEncryption__Key` on the backend to the same value.

Từ thư mục gốc project:

```bash
make dev-client
```

## Upload R2

Thiết lập `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_PUBLIC_URL`, `R2_UPLOAD_PREFIX` và `R2_PRESIGNED_URL_TTL_SECONDS` trong file env
(xem `.env.example`). API `POST /api/uploads/:type` trả về presigned PUT URL; trình duyệt
tải file trực tiếp lên R2. API `DELETE /api/uploads/:type` chỉ xóa URL thuộc `R2_PUBLIC_URL`.

Bucket cần CORS cho origin của client/admin, method `PUT`, và headers `content-type`,
`cache-control`. Endpoint upload cần được bảo vệ bằng cùng lớp xác thực với trang admin
khi đưa lên internet.
