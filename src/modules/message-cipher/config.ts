import type { ToolDefinition } from "@/lib/tool";

export const messageCipherTool: ToolDefinition = {
  slug: "message-cipher",
  name: "Mã hóa tin nhắn",
  description:
    "Biến tin nhắn thành ký tự bí ẩn mà chỉ người có đúng key mới đọc được. Mã hóa hai lớp, dịch tức thì, hàng loạt kiểu chữ độc lạ: ngoài hành tinh, Ả Rập cổ, rune, cổ tự Ai Cập…",
  icon: "lock-keyhole",
  category: "Bảo mật",
  enabled: true,
};
