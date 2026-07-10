import { NextRequest, NextResponse } from "next/server";
import { requireRole, setUserRole } from "@/lib/auth/roles.server";
import { grantCredits } from "@/lib/credits";
import { getAdminUser } from "@/modules/admin/lib/users.server";
import { isRole } from "@/lib/roles";
import type { UpdateUserRequest, UpdateUserResponse } from "@/modules/admin/types";

/**
 * Change a user's role and/or grant them credits. Admin-only.
 *
 * Safety: an admin cannot demote THEMSELVES (would risk locking the app out of
 * its last admin by accident). Removing another admin is allowed.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  const gate = await requireRole(req, "admin");
  if (!gate.ok) {
    return NextResponse.json<UpdateUserResponse>(
      { error: gate.error },
      { status: gate.status },
    );
  }

  const { uid } = await params;

  let body: UpdateUserRequest;
  try {
    body = (await req.json()) as UpdateUserRequest;
  } catch {
    return NextResponse.json<UpdateUserResponse>(
      { error: "Body không phải JSON hợp lệ." },
      { status: 400 },
    );
  }

  // --- Validate role change ---
  if (body.role !== undefined) {
    if (!isRole(body.role)) {
      return NextResponse.json<UpdateUserResponse>(
        { error: "Vai trò không hợp lệ." },
        { status: 400 },
      );
    }
    if (uid === gate.user.uid && body.role !== "admin") {
      return NextResponse.json<UpdateUserResponse>(
        { error: "Bạn không thể tự hạ quyền của chính mình." },
        { status: 400 },
      );
    }
  }

  // --- Validate credit grant ---
  if (body.grantCredits !== undefined) {
    if (!Number.isInteger(body.grantCredits) || body.grantCredits <= 0) {
      return NextResponse.json<UpdateUserResponse>(
        { error: "Số credits phải là số nguyên dương." },
        { status: 400 },
      );
    }
  }

  if (body.role === undefined && body.grantCredits === undefined) {
    return NextResponse.json<UpdateUserResponse>(
      { error: "Không có thay đổi nào được yêu cầu." },
      { status: 400 },
    );
  }

  try {
    if (body.role !== undefined) await setUserRole(uid, body.role);
    if (body.grantCredits !== undefined) await grantCredits(uid, body.grantCredits);

    const user = await getAdminUser(uid);
    if (!user) {
      return NextResponse.json<UpdateUserResponse>(
        { error: "Không tìm thấy người dùng sau khi cập nhật." },
        { status: 404 },
      );
    }
    return NextResponse.json<UpdateUserResponse>({ user });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Không cập nhật được người dùng.";
    return NextResponse.json<UpdateUserResponse>(
      { error: message },
      { status: 500 },
    );
  }
}
