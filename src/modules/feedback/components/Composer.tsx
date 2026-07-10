// src/modules/feedback/components/Composer.tsx
// No "use client" directive: imported only by the client component FeedbackFeed,
// so it renders in the client bundle through that boundary. Keeping it out of the
// client-entry set avoids Next's serializable-props check on its onSubmit callback.
import { useState } from "react";
import { Send, User } from "lucide-react";
import { MAX_POST_LEN } from "@/modules/feedback/types";

/** Facebook-style "create post" card. `onSubmit` returns a rejected promise on failure. */
export function Composer({ onSubmit }: { onSubmit: (content: string) => Promise<void> }) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = content.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      setContent("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đăng được bài.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fb-composer">
      <div className="fb-composer-top">
        <span className="fb-avatar" aria-hidden="true">
          <User size={20} strokeWidth={2.2} />
        </span>
        <textarea
          className="fb-textarea"
          placeholder="Chia sẻ góp ý của bạn…"
          value={content}
          maxLength={MAX_POST_LEN}
          rows={3}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      {error ? <p className="fb-error">{error}</p> : null}
      <div className="fb-composer-actions">
        <span className="fb-count">
          {content.length}/{MAX_POST_LEN}
        </span>
        <button type="button" className="btn primary" disabled={busy || !content.trim()} onClick={submit}>
          <Send size={16} strokeWidth={2.2} /> Đăng
        </button>
      </div>
    </div>
  );
}
