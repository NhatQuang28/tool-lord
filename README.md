# Tool Lord

Bộ sưu tập công cụ web nhỏ, xây bằng **Next.js (App Router) fullstack + TypeScript**.
Mỗi tool là một **module độc lập** để dễ thêm/bớt mà không ảnh hưởng tool khác.

## Chạy dự án

```bash
npm install
cp .env.example .env.local   # rồi đổi WEB_SECRET_KEY thành chuỗi ngẫu nhiên dài
npm run dev                  # http://localhost:3000
```

Build production:

```bash
npm run build && npm start
```

## Kiến trúc module

```
src/
├── app/                          # Next.js App Router (routes + API)
│   ├── page.tsx                  # Trang chủ: tự liệt kê tool từ registry
│   ├── tools/<slug>/page.tsx     # Trang của từng tool
│   └── api/tools/<slug>/route.ts # API server-side của từng tool
├── lib/tool.ts                   # ToolDefinition (contract chung)
└── modules/
    ├── registry.ts               # Đăng ký tất cả tool
    └── <slug>/                    # 1 module = 1 tool, tự chứa
        ├── config.ts             # Metadata (tên, icon, mô tả)
        ├── types.ts
        ├── lib/                  # Logic thuần (test được, không phụ thuộc UI)
        └── components/           # UI React của tool
```

### Thêm một tool mới

1. Tạo `src/modules/<slug>/config.ts` export một `ToolDefinition`.
2. Thêm tool đó vào mảng trong `src/modules/registry.ts`.
3. Tạo route `src/app/tools/<slug>/page.tsx` (và `api/tools/<slug>/route.ts` nếu cần server).

Trang chủ sẽ tự động hiển thị tool mới.

## Tool: Mã hóa tin nhắn (`message-cipher`)

- Mã hóa / giải mã **hai chiều**, **dịch real-time** khi gõ (debounce 200ms).
- Key = **key riêng của web** (biến môi trường `WEB_SECRET_KEY`, chỉ nằm ở máy chủ)
  kết hợp với **key của người dùng** (tự gen hoặc dán vào).
- Nhiều **kiểu chữ**: ngoài hành tinh, Ả Rập cổ, rune cổ, cổ tự Ai Cập, chữ nổi
  Braille, ký hiệu vũ trụ. Thêm kiểu mới chỉ cần thêm một mảng glyph trong
  `src/modules/message-cipher/lib/alphabets.ts`.
- Người nhận cần **đúng key** và **đúng kiểu chữ** để giải mã.

### Cách hoạt động

1. Tin nhắn → byte UTF-8 (hỗ trợ tiếng Việt, emoji).
2. Stream cipher (kiểu Vigenère) cộng keystream sinh từ `WEB_SECRET_KEY::userKey`.
3. Byte mã hóa được mã sang bộ glyph của kiểu chữ đã chọn (mỗi kiểu là một cơ số).

> ⚠️ Đây là mã hóa dạng **che giấu/giải trí**, không phải crypto cấp bảo mật cao.
> Đừng dùng để bảo vệ bí mật giá trị lớn.
