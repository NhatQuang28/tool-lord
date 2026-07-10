// src/modules/feedback/components/PostCard.tsx
// No "use client" directive: imported only by the client component FeedbackFeed
// (and it in turn imports client-only children), so it lives in the client bundle
// through that boundary. Keeping it out of the client-entry set avoids Next's
// serializable-props check on its onChanged/onVoteError callbacks.
import { useState } from "react";
import { MessageSquare, Pencil, Trash2, BadgeCheck, Eye, RotateCcw, User } from "lucide-react";
import { useAuth } from "@/modules/auth/AuthProvider";
import { VoteButtons } from "./VoteButtons";
import { CommentList } from "./CommentList";
import { feedbackSend } from "./client";
import { MAX_POST_LEN, type PostDto, type VoteValue } from "@/modules/feedback/types";

/**
 * A single feedback post with vote control, author-only edit/delete, and
 * manager/admin moderation (approve, hide/restore, reveal author). `onChanged`
 * hands an updated DTO back to the feed; `onVoteError` surfaces the login hint.
 */
export function PostCard({
  post,
  onChanged,
  onVoteError,
}: {
  post: PostDto;
  onChanged: (post: PostDto) => void;
  onVoteError: (message: string) => void;
}) {
  const { user, hasRole } = useAuth();
  const isManager = hasRole("manager");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [showComments, setShowComments] = useState(false);

  async function vote(value: VoteValue) {
    if (!user) return onVoteError("Bạn cần đăng nhập để vote.");
    const res = await feedbackSend(`/api/feedback/${post.id}/vote`, "POST", { value });
    const data = await res.json();
    if (!res.ok) return onVoteError(data.error ?? "Không vote được.");
    onChanged({ ...post, upCount: data.upCount, downCount: data.downCount, score: data.score, myVote: data.myVote });
  }

  async function patch(body: unknown) {
    const res = await feedbackSend(`/api/feedback/${post.id}`, "PATCH", body);
    const data = await res.json();
    if (res.ok && data.post) onChanged(data.post);
    else onVoteError(data.error ?? "Không cập nhật được bài.");
  }

  async function remove() {
    if (!confirm("Xóa bài này?")) return;
    const res = await feedbackSend(`/api/feedback/${post.id}`, "DELETE");
    const data = await res.json();
    if (res.ok && data.post) onChanged(data.post);
    else onVoteError(data.error ?? "Không xóa được bài.");
  }

  async function saveEdit() {
    const res = await feedbackSend(`/api/feedback/${post.id}`, "PATCH", { content: draft.trim() });
    const data = await res.json();
    if (res.ok && data.post) {
      onChanged(data.post);
      setEditing(false);
    } else {
      onVoteError(data.error ?? "Không lưu được bài.");
    }
  }

  return (
    <article className={`fb-card ${post.deleted ? "fb-deleted" : ""}`}>
      <div className="fb-card-main">
        <VoteButtons score={post.score} myVote={post.myVote} onVote={vote} disabled={!user} />
        <div className="fb-card-body">
          <div className="fb-card-head">
            <span className="fb-anon">
              <User size={14} strokeWidth={2.2} /> Ẩn danh
            </span>
            {post.approved ? (
              <span className="fb-badge approved">
                <BadgeCheck size={14} strokeWidth={2.4} /> Đã duyệt
              </span>
            ) : null}
            {post.deleted ? <span className="fb-badge deleted">Đã ẩn</span> : null}
            {isManager && post.author ? (
              <span className="fb-author" title={post.author.uid}>
                {post.author.email ?? post.author.displayName ?? post.author.uid}
              </span>
            ) : null}
          </div>

          {editing ? (
            <div className="fb-edit">
              <textarea
                className="fb-textarea"
                value={draft}
                maxLength={MAX_POST_LEN}
                rows={3}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="fb-edit-actions">
                <button type="button" className="btn" onClick={() => setEditing(false)}>
                  Hủy
                </button>
                <button type="button" className="btn primary" disabled={!draft.trim()} onClick={saveEdit}>
                  Lưu
                </button>
              </div>
            </div>
          ) : (
            <p className="fb-content">{post.content}</p>
          )}

          <div className="fb-card-actions">
            <button type="button" className="fb-link" onClick={() => setShowComments((s) => !s)}>
              <MessageSquare size={15} strokeWidth={2.2} /> Bình luận ({post.commentCount})
            </button>
            {post.mine && !editing ? (
              <>
                <button type="button" className="fb-link" onClick={() => setEditing(true)}>
                  <Pencil size={15} strokeWidth={2.2} /> Sửa
                </button>
                <button type="button" className="fb-link danger" onClick={remove}>
                  <Trash2 size={15} strokeWidth={2.2} /> Xóa
                </button>
              </>
            ) : null}
            {isManager ? (
              <>
                <button type="button" className="fb-link" onClick={() => patch({ action: post.approved ? "unapprove" : "approve" })}>
                  <BadgeCheck size={15} strokeWidth={2.2} /> {post.approved ? "Bỏ duyệt" : "Duyệt"}
                </button>
                <button type="button" className="fb-link" onClick={() => patch({ action: post.deleted ? "restore" : "hide" })}>
                  {post.deleted ? <RotateCcw size={15} strokeWidth={2.2} /> : <Eye size={15} strokeWidth={2.2} />}{" "}
                  {post.deleted ? "Khôi phục" : "Ẩn"}
                </button>
              </>
            ) : null}
          </div>

          {showComments ? <CommentList postId={post.id} onCountChange={(n) => onChanged({ ...post, commentCount: n })} /> : null}
        </div>
      </div>
    </article>
  );
}
