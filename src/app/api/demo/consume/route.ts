import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { consumeCredit, InsufficientCreditsError } from "@/lib/credits";

/**
 * Reference "resource-heavy tool" endpoint showing the full gate pattern:
 *   1. requireUser  — verify identity (Admin SDK, server-side).
 *   2. consumeCredit — atomically spend quota (race-condition safe).
 *   3. ...run the actual expensive work only after both pass.
 *
 * Copy this shape for real gated tools. The client calls it via `authedFetch`.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  try {
    const remaining = await consumeCredit(user.uid, 1);
    // --- real resource-heavy work would go here, using user.uid ---
    return NextResponse.json({ ok: true, remaining });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "Hết credit.", remaining: err.remaining },
        { status: 402 },
      );
    }
    throw err;
  }
}
