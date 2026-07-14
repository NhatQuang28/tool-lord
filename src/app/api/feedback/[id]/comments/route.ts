import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { addComment, FeedbackError } from "@/modules/feedback/lib/feedback.server";
import type { CreateCommentRequest, CommentMutationResponse } from "@/modules/feedback/types";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json<CommentMutationResponse>({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as CreateCommentRequest;
    const comment = await addComment(user.uid, id, body?.content);
    return NextResponse.json<CommentMutationResponse>({ comment });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không gửi được bình luận.";
    return NextResponse.json<CommentMutationResponse>({ error: message }, { status });
  }
}
