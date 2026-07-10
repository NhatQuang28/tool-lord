import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/roles.server";
import { listAllUsers } from "@/modules/admin/lib/users.server";
import type { ListUsersResponse } from "@/modules/admin/types";

// List every user with their role + credits. Admin-only.
export async function GET(req: NextRequest) {
  const gate = await requireRole(req, "admin");
  if (!gate.ok) {
    return NextResponse.json<ListUsersResponse>(
      { users: [], error: gate.error },
      { status: gate.status },
    );
  }

  try {
    const users = await listAllUsers();
    return NextResponse.json<ListUsersResponse>({ users });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Không tải được danh sách người dùng.";
    return NextResponse.json<ListUsersResponse>(
      { users: [], error: message },
      { status: 500 },
    );
  }
}
