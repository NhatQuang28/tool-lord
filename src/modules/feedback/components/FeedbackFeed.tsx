// src/modules/feedback/components/FeedbackFeed.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/modules/auth/AuthProvider";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import { feedbackGet, feedbackSend } from "./client";
import type { ListPostsResponse, PostDto, SortOrder } from "@/modules/feedback/types";

export function FeedbackFeed() {
  const { user, loading } = useAuth();
  const [posts, setPosts] = useState<PostDto[]>([]);
  const [sort, setSort] = useState<SortOrder>("new");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextSort: SortOrder, nextCursor: string | null) => {
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams({ sort: nextSort });
        if (nextCursor) params.set("cursor", nextCursor);
        const res = await feedbackGet(`/api/feedback?${params.toString()}`);
        const data = (await res.json()) as ListPostsResponse;
        if (!res.ok) throw new Error(data.error ?? "Không tải được góp ý.");
        setPosts((prev) => (nextCursor ? [...prev, ...data.posts] : data.posts));
        setCursor(data.nextCursor);
        setHasMore(data.nextCursor !== null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được góp ý.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  // Reload from scratch when the sort changes or auth finishes resolving (so the
  // token is attached and `mine`/`myVote`/author fields are correct).
  useEffect(() => {
    if (loading) return;
    void load(sort, null);
  }, [sort, loading, user, load]);

  async function createPost(content: string) {
    const res = await feedbackSend("/api/feedback", "POST", { content });
    const data = await res.json();
    if (!res.ok || !data.post) throw new Error(data.error ?? "Không đăng được bài.");
    setPosts((prev) => [data.post as PostDto, ...prev]);
  }

  function onChanged(updated: PostDto) {
    // Managers keep seeing hidden posts (dimmed); regular users drop them.
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  return (
    <div className="fb-feed">
      {loading ? null : user ? (
        <Composer onSubmit={createPost} />
      ) : (
        <div className="fb-signin-hint">
          <p>Đăng nhập để đăng bài, bình luận và vote.</p>
          <Link href="/login" className="btn primary">
            Đăng nhập
          </Link>
        </div>
      )}

      <div className="fb-sortbar">
        <button type="button" className={`fb-sort ${sort === "new" ? "active" : ""}`} onClick={() => setSort("new")}>
          Mới nhất
        </button>
        <button type="button" className={`fb-sort ${sort === "top" ? "active" : ""}`} onClick={() => setSort("top")}>
          Nổi bật
        </button>
      </div>

      {error ? <p className="fb-error">{error}</p> : null}

      <div className="fb-list">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onChanged={onChanged} onVoteError={setError} />
        ))}
        {posts.length === 0 && !busy ? <p className="fb-empty">Chưa có góp ý nào.</p> : null}
      </div>

      {hasMore ? (
        <button type="button" className="btn fb-more" disabled={busy} onClick={() => load(sort, cursor)}>
          {busy ? "Đang tải…" : "Xem thêm"}
        </button>
      ) : null}
    </div>
  );
}
