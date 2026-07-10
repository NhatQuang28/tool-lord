import { NextRequest, NextResponse } from "next/server";
import {
  resolveCaller,
  getPostWithComments,
  FeedbackError,
} from "@/modules/feedback/lib/feedback.server";
import type { PostDetailResponse } from "@/modules/feedback/types";

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
