import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/roles.server";
import { spendCredit, InsufficientCreditsError } from "@/lib/credits";

/**
 * Reference "resource-heavy tool" endpoint showing the full gate pattern:
 *   1. requireRole  — verify identity + role (Admin SDK, server-side).
 *   2. spendCredit  — atomically spend quota (race-safe); no-op for unlimited
 *                     roles (manager/admin), which return `remaining: null`.
 *   3. ...run the actual expensive work only after both pass.
 *
 * Copy this shape for real gated tools. The client calls it via `authedFetch`.
 * Use a higher `min` (e.g. "manager") here to restrict a tool by role.
 */
export async function POST(req: NextRequest) {
  const gate = await requireRole(req, "user");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  try {
    const remaining = await spendCredit(gate.user.uid, gate.role, 1);
    // --- real resource-heavy work would go here, using gate.user.uid ---
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
