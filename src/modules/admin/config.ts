import type { ToolDefinition } from "@/lib/tool";

/**
 * The admin panel is modeled as an admin-only "tool" so it appears in the home
 * grid (only for admins, via `minRole`) and reuses the standard routing. Its
 * page lives at /admin (not /tools/admin) since it's an app surface, not a
 * public utility — see src/app/admin/page.tsx.
 */
export const adminTool: ToolDefinition = {
  slug: "admin",
  name: "Quản trị người dùng",
  description:
    "Xem danh sách người dùng, thay đổi vai trò (người dùng / quản lý / quản trị) và nạp thêm credits. Chỉ dành cho quản trị viên.",
  icon: "shield",
  category: "Hệ thống",
  enabled: true,
  minRole: "admin",
};
