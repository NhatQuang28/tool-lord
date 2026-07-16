import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { checkRateLimit, tooManyRequests } from "@/lib/rateLimit";
import { voteComment, FeedbackError } from "@/modules/feedback/lib/feedback.server";
import type { VoteRequest, VoteResponse } from "@/modules/feedback/types";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; cid: string }> }) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json<VoteResponse>(
      { upCount: 0, downCount: 0, score: 0, myVote: 0, error: "Chưa đăng nhập." },
      { status: 401 },
    );
  }
  if (!(await checkRateLimit("feedback-vote", user.uid, 60, "1 m"))) {
    return tooManyRequests();
  }
  try {
    const { id, cid } = await ctx.params;
    const body = (await req.json()) as VoteRequest;
    if (body?.value !== 1 && body?.value !== -1) {
      throw new FeedbackError(400, "Giá trị vote không hợp lệ.");
    }
    const result = await voteComment(user.uid, id, cid, body.value);
    return NextResponse.json<VoteResponse>(result);
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không vote được.";
    return NextResponse.json<VoteResponse>(
      { upCount: 0, downCount: 0, score: 0, myVote: 0, error: message },
      { status },
    );
  }
}
