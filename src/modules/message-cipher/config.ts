import type { ToolDefinition } from "@/lib/tool";

export const messageCipherTool: ToolDefinition = {
  slug: "message-cipher",
  name: "Mã hóa tin nhắn",
  description:
    "Mã hóa / giải mã tin nhắn hai chiều bằng key riêng của web kết hợp key của bạn. Dịch real-time, nhiều kiểu chữ (ngoài hành tinh, Ả Rập cổ, rune, cổ tự Ai Cập...).",
  icon: "lock-keyhole",
  category: "Bảo mật",
  enabled: true,
};
