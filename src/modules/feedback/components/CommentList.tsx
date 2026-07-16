// src/modules/feedback/components/CommentList.tsx
// No "use client" directive: imported only by PostCard within the FeedbackFeed
// client boundary, so it renders client-side through that boundary. Keeping it out
// of the client-entry set avoids Next's serializable-props check on onCountChange.
import { useEffect, useState } from "react";
import { User, Send } from "lucide-react";
import { useAuth } from "@/modules/auth/AuthProvider";
import { VoteButtons } from "./VoteButtons";
import { feedbackGet, feedbackSend } from "./client";
import { useFeedbackStream } from "./useFeedbackStream";
import { timeAgo } from "./format";
import { computeVoteDelta } from "@/modules/feedback/lib/votes";
import {
  MAX_COMMENT_LEN,
  type CommentDto,
  type PostDetailResponse,
  type VoteValue,
} from "@/modules/feedback/types";

export function CommentList({
  postId,
  onCountChange,
}: {
  postId: string;
  onCountChange: (count: number) => void;
}) {
  const { user, hasRole } = useAuth();
  const isManager = hasRole("manager");
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await feedbackGet(`/api/feedback/${postId}`);
      const data = (await res.json()) as PostDetailResponse;
      if (!active) return;
      setComments(res.ok ? data.comments : []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [postId, user]);

  // Realtime: merge live comment changes for this post pushed over SSE. The
  // post's own commentCount is refreshed separately by the feed stream, so we
  // only reconcile the visible bubbles here.
  useFeedbackStream(`/api/feedback/${postId}/stream`, user?.uid ?? null, {
    comment: (data) => {
      const incoming = data as CommentDto;
      setComments((prev) => {
        if (incoming.deleted && !isManager) {
          return prev.filter((c) => c.id !== incoming.id);
        }
        const idx = prev.findIndex((c) => c.id === incoming.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = incoming;
          return next;
        }
        return [...prev, incoming];
      });
    },
    remove: (cid) => setComments((prev) => prev.filter((c) => c.id !== cid)),
  });

  function replace(updated: CommentDto) {
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function add() {
    const content = draft.trim();
    if (!content) return;
    setError(null);

    // Optimistic: show the comment instantly with a temp id, clear the box, then
    // swap in the server's real DTO (or roll back + restore the draft on error).
    const tempId = `temp-${Date.now()}`;
    const optimistic: CommentDto = {
      id: tempId,
      content,
      deleted: false,
      upCount: 0,
      downCount: 0,
      score: 0,
      createdAt: Date.now(),
      editedAt: null,
      myVote: 0,
      mine: true,
    };
    setComments((prev) => {
      const next = [...prev, optimistic];
      onCountChange(next.length);
      return next;
    });
    setDraft("");

    try {
      const res = await feedbackSend(`/api/feedback/${postId}/comments`, "POST", { content });
      const data = await res.json();
      if (!res.ok || !data.comment) throw new Error(data.error ?? "Không gửi được bình luận.");
      const real = data.comment as CommentDto;
      setComments((prev) => {
        // The SSE stream may have already appended the real comment; drop any
        // such duplicate before swapping the temp entry for the authoritative one.
        const deduped = prev.filter((c) => c.id !== real.id);
        return deduped.map((c) => (c.id === tempId ? real : c));
      });
    } catch (e) {
      setComments((prev) => {
        const next = prev.filter((c) => c.id !== tempId);
        onCountChange(next.length);
        return next;
      });
      setDraft(content);
      setError(e instanceof Error ? e.message : "Không gửi được bình luận.");
    }
  }

  async function vote(c: CommentDto, value: VoteValue) {
    if (!user) return setError("Bạn cần đăng nhập để vote.");
    // Optimistic: update the comment instantly, then reconcile / roll back.
    const delta = computeVoteDelta(c.myVote, value);
    const up = c.upCount + delta.up;
    const down = c.downCount + delta.down;
    replace({ ...c, upCount: up, downCount: down, score: up - down, myVote: delta.newValue });
    const res = await feedbackSend(`/api/feedback/${postId}/comments/${c.id}/vote`, "POST", { value });
    const data = await res.json();
    if (res.ok) replace({ ...c, upCount: data.upCount, downCount: data.downCount, score: data.score, myVote: data.myVote });
    else replace(c);
  }

  async function patch(c: CommentDto, body: unknown) {
    const res = await feedbackSend(`/api/feedback/${postId}/comments/${c.id}`, "PATCH", body);
    const data = await res.json();
    if (res.ok && data.comment) replace(data.comment);
    else setError(data.error ?? "Không cập nhật được bình luận.");
  }

  async function remove(c: CommentDto) {
    if (!confirm("Xóa bình luận này?")) return;
    const res = await feedbackSend(`/api/feedback/${postId}/comments/${c.id}`, "DELETE");
    const data = await res.json();
    if (res.ok && data.comment) replace(data.comment);
    else setError(data.error ?? "Không xóa được bình luận.");
  }

  async function saveEdit(c: CommentDto) {
    const res = await feedbackSend(`/api/feedback/${postId}/comments/${c.id}`, "PATCH", { content: editDraft.trim() });
    const data = await res.json();
    if (res.ok && data.comment) {
      replace(data.comment);
      setEditingId(null);
    } else {
      setError(data.error ?? "Không lưu được bình luận.");
    }
  }

  return (
    <div className="fb-comments">
      {loading
        ? null
        : comments.map((c) => (
          <div key={c.id} className={`fb-comment ${c.deleted ? "fb-deleted" : ""}`}>
            <span className="fb-avatar sm" aria-hidden="true">
              <User size={16} strokeWidth={2.2} />
            </span>
            <div className="fb-comment-body">
              {editingId === c.id ? (
                <div className="fb-edit">
                  <textarea
                    className="fb-textarea"
                    value={editDraft}
                    maxLength={MAX_COMMENT_LEN}
                    rows={2}
                    onChange={(e) => setEditDraft(e.target.value)}
                  />
                  <div className="fb-edit-actions">
                    <button type="button" className="btn" onClick={() => setEditingId(null)}>
                      Hủy
                    </button>
                    <button type="button" className="btn primary" disabled={!editDraft.trim()} onClick={() => saveEdit(c)}>
                      Lưu
                    </button>
                  </div>
                </div>
              ) : (
                <div className="fb-bubble">
                  <div className="fb-bubble-head">
                    <span className="fb-name">Ẩn danh</span>
                    {c.deleted ? <span className="fb-badge deleted">Đã ẩn</span> : null}
                    {isManager && c.author ? (
                      <span className="fb-author" title={c.author.uid}>
                        {c.author.email ?? c.author.displayName ?? c.author.uid}
                      </span>
                    ) : null}
                  </div>
                  <p className="fb-bubble-text">{c.content}</p>
                </div>
              )}
              <div className="fb-comment-actions">
                <VoteButtons
                  variant="compact"
                  upCount={c.upCount}
                  downCount={c.downCount}
                  myVote={c.myVote}
                  onVote={(v) => vote(c, v)}
                  disabled={!user}
                />
                <time className="fb-time">{timeAgo(c.createdAt)}</time>
                {c.mine && editingId !== c.id ? (
                  <>
                    <button
                      type="button"
                      className="fb-link"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditDraft(c.content);
                      }}
                    >
                      Sửa
                    </button>
                    <button type="button" className="fb-link danger" onClick={() => remove(c)}>
                      Xóa
                    </button>
                  </>
                ) : null}
                {isManager ? (
                  <button type="button" className="fb-link" onClick={() => patch(c, { action: c.deleted ? "restore" : "hide" })}>
                    {c.deleted ? "Khôi phục" : "Ẩn"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          ))}

      {error ? <p className="fb-error">{error}</p> : null}

      {user ? (
        <div className="fb-comment-compose">
          <span className="fb-avatar sm" aria-hidden="true">
            <User size={16} strokeWidth={2.2} />
          </span>
          <div className="fb-comment-inputwrap">
            <textarea
              className="fb-comment-input"
              placeholder="Viết bình luận…"
              value={draft}
              maxLength={MAX_COMMENT_LEN}
              rows={1}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="button" className="fb-send-btn" aria-label="Gửi bình luận" disabled={!draft.trim()} onClick={add}>
              <Send size={16} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      ) : (
        <p className="fb-empty">Đăng nhập để bình luận.</p>
      )}
    </div>
  );
}
