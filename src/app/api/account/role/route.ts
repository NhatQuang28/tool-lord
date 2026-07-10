import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { resolveRole } from "@/lib/auth/roles.server";
import { DEFAULT_ROLE } from "@/lib/roles";

/**
 * Return the signed-in user's effective role. Calling this also APPLIES the
 * `ADMIN_EMAILS` bootstrap as a side effect (resolveRole writes the custom claim
 * + Firestore the first time it elevates an account). The client calls it right
 * after sign-in, then force-refreshes its token to pick up a newly-set claim —
 * so a freshly bootstrapped admin sees the admin UI without a manual reload.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json(
      { role: DEFAULT_ROLE, error: "Chưa đăng nhập." },
      { status: 401 },
    );
  }
  const role = await resolveRole(user);
  return NextResponse.json({ role });
}
