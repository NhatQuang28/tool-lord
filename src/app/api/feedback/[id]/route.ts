import { NextRequest, NextResponse } from "next/server";
import {
  resolveCaller,
  getPostWithComments,
  editPostContent,
  moderatePost,
  softDeletePost,
  FeedbackError,
} from "@/modules/feedback/lib/feedback.server";
import type { PostDetailResponse, PostMutationResponse, UpdatePostRequest } from "@/modules/feedback/types";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const caller = await resolveCaller(req);
    const { post, comments } = await getPostWithComments(caller, id);
    if (!post) {
      return NextResponse.json<PostDetailResponse>(
        { post: null, comments: [], error: "Không tìm thấy bài viết." },
        { status: 404 },
      );
    }
    return NextResponse.json<PostDetailResponse>({ post, comments });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không tải được bài viết.";
    return NextResponse.json<PostDetailResponse>({ post: null, comments: [], error: message }, { status });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const caller = await resolveCaller(req);
  if (!caller.uid) {
    return NextResponse.json<PostMutationResponse>({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as UpdatePostRequest;
    const post =
      "action" in body
        ? await moderatePost(caller, id, body.action)
        : await editPostContent(caller, id, body.content);
    return NextResponse.json<PostMutationResponse>({ post });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không cập nhật được bài.";
    return NextResponse.json<PostMutationResponse>({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const caller = await resolveCaller(req);
  if (!caller.uid) {
    return NextResponse.json<PostMutationResponse>({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    const post = await softDeletePost(caller, id);
    return NextResponse.json<PostMutationResponse>({ post });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không xóa được bài.";
    return NextResponse.json<PostMutationResponse>({ error: message }, { status });
  }
}
