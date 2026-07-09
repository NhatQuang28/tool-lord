import type { ToolDefinition } from "@/lib/tool";

export const secretImageTool: ToolDefinition = {
  slug: "secret-image",
  name: "Chia sẻ ảnh bí mật",
  description:
    "Tải nhiều ảnh lên thành một album, nhận một mã chia sẻ duy nhất. Ảnh được mã hóa ngay trên máy bạn trước khi rời trình duyệt — máy chủ và cả nơi lưu trữ đều chỉ thấy dữ liệu vô nghĩa. Chỉ ai có mã mới xem được.",
  icon: "images",
  category: "Bảo mật",
  enabled: true,
  requiresAuth: true,
};
