import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getCredits } from "@/lib/credits";

// Read the signed-in user's remaining credits. Requires a valid ID token.
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  const credits = await getCredits(user.uid);
  return NextResponse.json({ credits });
}
