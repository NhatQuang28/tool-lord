import { NextRequest, NextResponse } from "next/server";
import { resolveCaller, listPosts, FeedbackError } from "@/modules/feedback/lib/feedback.server";
import type { ListPostsResponse, SortOrder } from "@/modules/feedback/types";

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    const url = new URL(req.url);
    const sort: SortOrder = url.searchParams.get("sort") === "top" ? "top" : "new";
    const cursor = url.searchParams.get("cursor");
    const { posts, nextCursor } = await listPosts(caller, sort, cursor);
    return NextResponse.json<ListPostsResponse>({ posts, nextCursor });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không tải được danh sách góp ý.";
    return NextResponse.json<ListPostsResponse>({ posts: [], nextCursor: null, error: message }, { status });
  }
}
