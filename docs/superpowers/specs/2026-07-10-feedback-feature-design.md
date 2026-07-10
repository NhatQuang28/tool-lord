# Thiết kế tính năng "Góp ý" (Feedback)

Ngày: 2026-07-10

## Mục tiêu

Một khu vực "Góp ý" dạng mạng xã hội cho ToolLord:

- Mọi người (kể cả khách chưa đăng nhập) **xem được** các bài góp ý.
- Người đã đăng nhập có thể **đăng bài**, **bình luận**, và **vote Up/Down** (mỗi người một lần trên mỗi mục).
- Manager/admin có thể **xóa mềm** (ẩn) và **phê duyệt** (gắn nhãn nổi bật) bài.
- Trên UI **ẩn danh**, nhưng hệ thống lưu được ai là tác giả; manager/admin xem được danh tính.

## Quyết định đã chốt

- **Luồng duyệt bài**: bài đăng lên **hiển thị ngay** (như Facebook). "Phê duyệt" chỉ là **nhãn nổi bật/chính thức**, không phải điều kiện để hiển thị. Soft-delete để ẩn bài xấu.
- **Ẩn danh**: khách và user thường thấy ẩn danh; **manager/admin xem được danh tính** ngay trên UI (phục vụ kiểm duyệt).
- **Lối vào**: link "Góp ý" trên `SiteNav`, hiển thị cho **tất cả**. Trang riêng tại `/feedback` (xem được khi chưa đăng nhập).
- **Cấu trúc bài**: chỉ một ô **nội dung text** (như đăng status Facebook). Không tiêu đề, không danh mục.
- **Quyền thao tác**:
  - Tác giả: **sửa** và **xóa** (soft-delete) bài & bình luận của chính mình.
  - Manager/admin: **soft-delete + khôi phục**, **duyệt/bỏ duyệt** bài; **soft-delete** bình luận.
  - Vote Up/Down trên **cả bài lẫn bình luận**, mỗi người một lần trên mỗi mục.
- **Mô hình dữ liệu**: Cách A — subcollection + bộ đếm denormalized (xem phần dưới).

## 1. Vị trí & bố cục module

Theo pattern "một thứ = một module", nhưng **không** đăng ký vào `src/modules/registry.ts` (đây là tính năng, không phải tool).

```
src/modules/feedback/
  types.ts                     # Post, Comment, Vote + DTO request/response
  lib/
    votes.ts                   # logic toggle vote (thuần, unit-testable)
    anonymize.ts               # quy tắc lộ/giấu danh tính theo role (thuần)
  components/
    FeedbackFeed.tsx           # "use client" — danh sách bài + ô đăng
    PostCard.tsx
    CommentList.tsx
    VoteButtons.tsx
    Composer.tsx
src/app/feedback/page.tsx      # trang công khai (shell + feed client)
src/app/api/feedback/...       # các route mỏng (xem phần 3)
```

Thêm link "Góp ý" vào `src/components/SiteNav.tsx`, hiển thị cho mọi người. `/feedback` xem được khi chưa đăng nhập.

## 2. Mô hình dữ liệu (Firestore — Cách A)

```
feedbackPosts/{postId}
  authorUid: string            # CHỈ lưu uid, KHÔNG denormalize email
  content: string
  status: "visible" | "deleted"
  approved: boolean
  approvedBy?: string
  approvedAt?: Timestamp
  upCount: number
  downCount: number
  score: number                # = upCount - downCount, để sắp xếp "Nổi bật"
  commentCount: number
  createdAt: Timestamp
  editedAt?: Timestamp
  ├─ comments/{commentId}
  │     authorUid, content, status: "visible"|"deleted"
  │     upCount, downCount, score, createdAt, editedAt?
  ├─ votes/{uid}                       { value: 1 | -1 }
  └─ comments/{commentId}/votes/{uid}  { value: 1 | -1 }
```

- **Danh tính chỉ là `authorUid`** → không rò rỉ qua doc; khi cần lộ thì server tra `adminAuth.getUser(uid)`.
- Mọi đọc/ghi đi qua **Admin SDK trên server** (không cho client đọc Firestore trực tiếp) → không cần Firestore security rules, khớp cách module `secret-image` đang làm.

## 3. API routes (mỏng, gọi vào lib)

| Method & path | Ai được gọi | Việc |
|---|---|---|
| `GET /api/feedback` | công khai | Trả bài `visible`, phân trang (limit 20 + cursor). Sắp theo `?sort=new\|top` (mặc định `new`). Ẩn danh server-side: user thường không nhận thông tin tác giả; manager/admin nhận `{email, displayName}` (tra `adminAuth`). Kèm `myVote` (1/-1/0) & `mine` cho caller. |
| `GET /api/feedback/[id]` | công khai | Chi tiết 1 bài + danh sách bình luận (cùng quy tắc ẩn danh). |
| `POST /api/feedback` | đăng nhập | Tạo bài. Validate: không rỗng, ≤ 5000 ký tự. |
| `PATCH /api/feedback/[id]` | tác giả **hoặc** manager/admin | Tác giả: sửa `content`. Manager/admin: `approve`/`unapprove`, `hide`/`restore`. |
| `DELETE /api/feedback/[id]` | tác giả hoặc manager/admin | Soft-delete (`status="deleted"`). |
| `POST /api/feedback/[id]/vote` | đăng nhập | Body `{ value: 1 \| -1 }` — chạy transaction toggle. |
| `POST /api/feedback/[id]/comments` | đăng nhập | Thêm bình luận. Validate: không rỗng, ≤ 2000 ký tự. |
| `PATCH /api/feedback/[id]/comments/[cid]` | tác giả hoặc manager/admin | Sửa (tác giả) / ẩn-khôi phục (manager/admin) bình luận. |
| `DELETE /api/feedback/[id]/comments/[cid]` | tác giả hoặc manager/admin | Soft-delete bình luận. |
| `POST /api/feedback/[id]/comments/[cid]/vote` | đăng nhập | Toggle vote bình luận. |

Bảo vệ bằng `requireUser` / `requireRole(req, "manager")` sẵn có. Kiểm tra quyền sở hữu: so `authorUid` với `user.uid`; nếu không phải chủ thì yêu cầu tối thiểu role `manager`.

## 4. Logic vote (transaction)

Kiểu Reddit, một vote/người/mục:

- Chưa vote → tạo `votes/{uid}={value}`; `+1` cho chiều tương ứng.
- Bấm lại đúng chiều đang chọn → **gỡ** vote (xóa doc; `-1`).
- Bấm chiều ngược → **đổi** (ví dụ up→down: `downCount+1`, `upCount-1`).

Toàn bộ (đọc vote-doc hiện tại + cập nhật `upCount/downCount/score`) chạy trong **một transaction** để tránh tranh chấp. `lib/votes.ts` chứa hàm thuần:

```
computeVoteDelta(oldValue: 1|-1|0, clicked: 1|-1)
  → { up: number; down: number; newValue: 1|-1|0 }
```

để unit-test độc lập; route chỉ ráp kết quả vào transaction (`score` suy ra từ `up/down`).

## 5. Ẩn danh & lộ danh tính (`lib/anonymize.ts`)

- Hàm thuần: `(item, callerRole, callerUid) → DTO đã lọc`.
  - User thường / khách: bỏ mọi trường tác giả; chỉ gắn `mine: true` nếu item thuộc chính caller (để hiện nút Sửa/Xóa).
  - Manager/admin: gắn `author: { email, displayName }`.
- Việc tra `uid → {email, displayName}` được **gom (batch)** một lần cho cả trang, và **chỉ** khi caller là manager/admin (dùng `adminAuth.getUsers`).

## 6. UI/UX (tiếng Việt, theo phong cách hiện có)

- `/feedback`:
  - Ô soạn bài (`Composer`) trên cùng; ẩn nếu chưa đăng nhập → hiện lời mời đăng nhập.
  - Danh sách bài (`PostCard`): nội dung, nút vote ↑/↓ + điểm, số bình luận, nhãn **"Đã duyệt"** nếu `approved`.
  - Toggle sắp xếp **Mới nhất / Nổi bật** (map sang `?sort=new|top`).
  - Nút "Xem thêm" (phân trang bằng cursor).
- Item của mình: nút **Sửa / Xóa**.
- Manager/admin: nút **Duyệt/Bỏ duyệt**, **Ẩn/Khôi phục**, và chip **xem tác giả** (email/displayName). Bài `deleted` ẩn với công chúng; manager/admin thấy mờ (dimmed) và khôi phục được.
- Vote/bình luận khi chưa đăng nhập → nhắc đăng nhập.
- Dùng `authedFetch` cho thao tác cần token; `GET` công khai dùng `fetch` thường (không token).

## 7. Xử lý lỗi & biên

- Validate độ dài/rỗng nội dung; trả lỗi tiếng Việt theo phong cách các route hiện có.
- Thao tác lên bài không tồn tại / đã xóa → 404 (với user thường); manager/admin vẫn thao tác được lên bài `deleted` (để khôi phục).
- Chống double-vote nhờ doc `votes/{uid}` (khóa theo uid) + transaction.
- **Sửa bài không tự bỏ duyệt** (giữ đơn giản). Nếu sau này muốn ngược lại thì đổi trong `PATCH`.

## 8. Kiểm thử

Repo chưa cấu hình test runner (không có script `test`). Các file `lib/votes.ts` và `lib/anonymize.ts` được viết **thuần** (không import React/Next) để sẵn sàng unit-test. Sẽ **không** tự dựng test runner trừ khi được yêu cầu, nhưng logic tách khỏi UI để test được sau này.

## Ngoài phạm vi (YAGNI)

- Không có tiêu đề, danh mục, tag, hay tìm kiếm.
- Không có bình luận lồng nhiều tầng (chỉ một tầng bình luận trên bài).
- Không có thông báo (notification), rate-limit theo thời gian, hay chống spam nâng cao.
- Không có biệt danh ổn định — user thường chỉ thấy "Ẩn danh".
