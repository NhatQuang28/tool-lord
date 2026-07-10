import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  resolveCaller,
  listPosts,
  createPost,
  FeedbackError,
} from "@/modules/feedback/lib/feedback.server";
import type {
  ListPostsResponse,
  SortOrder,
  CreatePostRequest,
  CreatePostResponse,
} from "@/modules/feedback/types";

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

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json<CreatePostResponse>({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  try {
    const body = (await req.json()) as CreatePostRequest;
    const post = await createPost(user.uid, body?.content);
    return NextResponse.json<CreatePostResponse>({ post });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không đăng được bài.";
    return NextResponse.json<CreatePostResponse>({ error: message }, { status });
  }
}
