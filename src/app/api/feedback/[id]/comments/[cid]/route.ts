import { NextRequest, NextResponse } from "next/server";
import {
  resolveCaller,
  editCommentContent,
  moderateComment,
  softDeleteComment,
  FeedbackError,
} from "@/modules/feedback/lib/feedback.server";
import type { CommentMutationResponse, UpdateCommentRequest } from "@/modules/feedback/types";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; cid: string }> }) {
  const caller = await resolveCaller(req);
  if (!caller.uid) {
    return NextResponse.json<CommentMutationResponse>({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  try {
    const { id, cid } = await ctx.params;
    const body = (await req.json()) as UpdateCommentRequest;
    const comment =
      "action" in body
        ? await moderateComment(caller, id, cid, body.action)
        : await editCommentContent(caller, id, cid, body.content);
    return NextResponse.json<CommentMutationResponse>({ comment });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không cập nhật được bình luận.";
    return NextResponse.json<CommentMutationResponse>({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; cid: string }> }) {
  const caller = await resolveCaller(req);
  if (!caller.uid) {
    return NextResponse.json<CommentMutationResponse>({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  try {
    const { id, cid } = await ctx.params;
    const comment = await softDeleteComment(caller, id, cid);
    return NextResponse.json<CommentMutationResponse>({ comment });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không xóa được bình luận.";
    return NextResponse.json<CommentMutationResponse>({ error: message }, { status });
  }
}
