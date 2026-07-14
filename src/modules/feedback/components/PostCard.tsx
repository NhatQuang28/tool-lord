// src/modules/feedback/components/PostCard.tsx
// No "use client" directive: imported only by the client component FeedbackFeed
// (and it in turn imports client-only children), so it lives in the client bundle
// through that boundary. Keeping it out of the client-entry set avoids Next's
// serializable-props check on its onChanged/onVoteError callbacks.
import { useState } from "react";
import {
  MessageSquare,
  Pencil,
  Trash2,
  BadgeCheck,
  Eye,
  RotateCcw,
  User,
  ThumbsUp,
  MoreHorizontal,
} from "lucide-react";
import { useAuth } from "@/modules/auth/AuthProvider";
import { VoteButtons } from "./VoteButtons";
import { CommentList } from "./CommentList";
import { feedbackSend } from "./client";
import { timeAgo } from "./format";
import { MAX_POST_LEN, type PostDto, type VoteValue } from "@/modules/feedback/types";

/**
 * A single feedback post, styled as a Facebook-style card: author header (avatar +
 * anonymous name + relative time), content, a reaction/comment stat row, and a
 * full-width action bar. Author-only edit/delete and manager/admin moderation live
 * in a "⋯" menu. `onChanged` hands an updated DTO back to the feed; `onVoteError`
 * surfaces messages (e.g. the login hint).
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
  const [menuOpen, setMenuOpen] = useState(false);

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
    } else onVoteError(data.error ?? "Không lưu được bài.");
  }

  return (
    <article className={`fb-card ${post.deleted ? "fb-deleted" : ""}`}>
      <header className="fb-post-head">
        <span className="fb-avatar" aria-hidden="true">
          <User size={20} strokeWidth={2.2} />
        </span>
        <div className="fb-post-meta">
          <div className="fb-post-namerow">
            <span className="fb-name">Ẩn danh</span>
            {post.approved ? (
              <span className="fb-badge approved">
                <BadgeCheck size={13} strokeWidth={2.4} /> Đã duyệt
              </span>
            ) : null}
            {post.deleted ? <span className="fb-badge deleted">Đã ẩn</span> : null}
          </div>
          <div className="fb-post-sub">
            <time className="fb-time">{timeAgo(post.createdAt)}</time>
            {post.editedAt ? <span className="fb-time">· đã sửa</span> : null}
            {isManager && post.author ? (
              <span className="fb-author" title={post.author.uid}>
                · {post.author.email ?? post.author.displayName ?? post.author.uid}
              </span>
            ) : null}
          </div>
        </div>
        {post.mine || isManager ? (
          <div className="fb-menu-wrap">
            <button
              type="button"
              className="fb-icon-btn"
              aria-label="Tùy chọn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreHorizontal size={18} strokeWidth={2.2} />
            </button>
            {menuOpen ? (
              <>
                <button
                  type="button"
                  className="fb-menu-backdrop"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                />
                <div className="fb-menu" role="menu">
                  {post.mine ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className="fb-menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          setDraft(post.content);
                          setEditing(true);
                        }}
                      >
                        <Pencil size={15} strokeWidth={2.2} /> Sửa bài
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="fb-menu-item danger"
                        onClick={() => {
                          setMenuOpen(false);
                          void remove();
                        }}
                      >
                        <Trash2 size={15} strokeWidth={2.2} /> Xóa bài
                      </button>
                    </>
                  ) : null}
                  {isManager ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className="fb-menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          void patch({ action: post.approved ? "unapprove" : "approve" });
                        }}
                      >
                        <BadgeCheck size={15} strokeWidth={2.2} /> {post.approved ? "Bỏ duyệt" : "Duyệt bài"}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="fb-menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          void patch({ action: post.deleted ? "restore" : "hide" });
                        }}
                      >
                        {post.deleted ? <RotateCcw size={15} strokeWidth={2.2} /> : <Eye size={15} strokeWidth={2.2} />}{" "}
                        {post.deleted ? "Khôi phục" : "Ẩn bài"}
                      </button>
                    </>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </header>

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

      <div className="fb-stat-row">
        <span className="fb-stat-score">
          <span className="fb-reaction">
            <ThumbsUp size={11} strokeWidth={2.6} />
          </span>
          {post.score}
        </span>
        <button type="button" className="fb-stat-comments" onClick={() => setShowComments((s) => !s)}>
          {post.commentCount} bình luận
        </button>
      </div>

      <div className="fb-actionbar">
        <VoteButtons variant="bar" score={post.score} myVote={post.myVote} onVote={vote} disabled={!user} />
        <button type="button" className="fb-actionbtn" onClick={() => setShowComments((s) => !s)}>
          <MessageSquare size={18} strokeWidth={2.2} /> Bình luận
        </button>
      </div>

      {showComments ? (
        <CommentList postId={post.id} onCountChange={(n) => onChanged({ ...post, commentCount: n })} />
      ) : null}
    </article>
  );
}
