// src/modules/feedback/components/CommentList.tsx
// No "use client" directive: imported only by PostCard within the FeedbackFeed
// client boundary, so it renders client-side through that boundary. Keeping it out
// of the client-entry set avoids Next's serializable-props check on onCountChange.
import { useEffect, useState } from "react";
import { Pencil, Trash2, Eye, RotateCcw, User } from "lucide-react";
import { useAuth } from "@/modules/auth/AuthProvider";
import { VoteButtons } from "./VoteButtons";
import { feedbackGet, feedbackSend } from "./client";
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

  function replace(updated: CommentDto) {
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function add() {
    const content = draft.trim();
    if (!content) return;
    setError(null);
    try {
      const res = await feedbackSend(`/api/feedback/${postId}/comments`, "POST", { content });
      const data = await res.json();
      if (!res.ok || !data.comment) throw new Error(data.error ?? "Không gửi được bình luận.");
      setComments((prev) => {
        const next = [...prev, data.comment as CommentDto];
        onCountChange(next.length);
        return next;
      });
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gửi được bình luận.");
    }
  }

  async function vote(c: CommentDto, value: VoteValue) {
    if (!user) return setError("Bạn cần đăng nhập để vote.");
    const res = await feedbackSend(`/api/feedback/${postId}/comments/${c.id}/vote`, "POST", { value });
    const data = await res.json();
    if (res.ok) replace({ ...c, upCount: data.upCount, downCount: data.downCount, score: data.score, myVote: data.myVote });
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
      {loading ? (
        <p className="fb-empty">Đang tải bình luận…</p>
      ) : (
        comments.map((c) => (
          <div key={c.id} className={`fb-comment ${c.deleted ? "fb-deleted" : ""}`}>
            <VoteButtons score={c.score} myVote={c.myVote} onVote={(v) => vote(c, v)} disabled={!user} />
            <div className="fb-comment-body">
              <div className="fb-card-head">
                <span className="fb-anon">
                  <User size={13} strokeWidth={2.2} /> Ẩn danh
                </span>
                {c.deleted ? <span className="fb-badge deleted">Đã ẩn</span> : null}
                {isManager && c.author ? (
                  <span className="fb-author" title={c.author.uid}>
                    {c.author.email ?? c.author.displayName ?? c.author.uid}
                  </span>
                ) : null}
              </div>
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
                <p className="fb-content">{c.content}</p>
              )}
              <div className="fb-card-actions">
                {c.mine && editingId !== c.id ? (
                  <>
                    <button type="button" className="fb-link" onClick={() => { setEditingId(c.id); setEditDraft(c.content); }}>
                      <Pencil size={14} strokeWidth={2.2} /> Sửa
                    </button>
                    <button type="button" className="fb-link danger" onClick={() => remove(c)}>
                      <Trash2 size={14} strokeWidth={2.2} /> Xóa
                    </button>
                  </>
                ) : null}
                {isManager ? (
                  <button type="button" className="fb-link" onClick={() => patch(c, { action: c.deleted ? "restore" : "hide" })}>
                    {c.deleted ? <RotateCcw size={14} strokeWidth={2.2} /> : <Eye size={14} strokeWidth={2.2} />}{" "}
                    {c.deleted ? "Khôi phục" : "Ẩn"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))
      )}

      {error ? <p className="fb-error">{error}</p> : null}

      {user ? (
        <div className="fb-comment-add">
          <textarea
            className="fb-textarea"
            placeholder="Viết bình luận…"
            value={draft}
            maxLength={MAX_COMMENT_LEN}
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="fb-edit-actions">
            <button type="button" className="btn primary" disabled={!draft.trim()} onClick={add}>
              Gửi
            </button>
          </div>
        </div>
      ) : (
        <p className="fb-empty">Đăng nhập để bình luận.</p>
      )}
    </div>
  );
}
