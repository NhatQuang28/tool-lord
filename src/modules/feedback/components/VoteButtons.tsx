// src/modules/feedback/components/VoteButtons.tsx
// No "use client" directive: this component is only imported by other client
// components (PostCard, CommentList), so it lives in the client bundle via that
// boundary. Marking it a client entry would trip Next's serializable-props check
// on its function props (onVote) — which are legitimate client→client callbacks.
import { ThumbsUp, ThumbsDown } from "lucide-react";
import type { MyVote, VoteValue } from "@/modules/feedback/types";

/**
 * Up/Down control. `myVote` highlights the active choice; `onVote` is called with
 * the clicked direction (parent performs the request and updates counts).
 *
 * - `variant="bar"` (posts): two full-width Facebook-style action buttons with
 *   labels ("Thích" / "Không thích") and no inline score — the parent shows the
 *   score separately in its stat row.
 * - `variant="compact"` (comments): small ▲ score ▼ inline control.
 */
export function VoteButtons({
  score,
  myVote,
  onVote,
  disabled,
  variant = "compact",
}: {
  score: number;
  myVote: MyVote;
  onVote: (value: VoteValue) => void;
  disabled?: boolean;
  variant?: "bar" | "compact";
}) {
  if (variant === "bar") {
    return (
      <div className="fb-votebar">
        <button
          type="button"
          className={`fb-actionbtn ${myVote === 1 ? "active up" : ""}`}
          aria-label="Thích"
          aria-pressed={myVote === 1}
          disabled={disabled}
          onClick={() => onVote(1)}
        >
          <ThumbsUp size={18} strokeWidth={2.2} /> Thích
        </button>
        <button
          type="button"
          className={`fb-actionbtn ${myVote === -1 ? "active down" : ""}`}
          aria-label="Không thích"
          aria-pressed={myVote === -1}
          disabled={disabled}
          onClick={() => onVote(-1)}
        >
          <ThumbsDown size={18} strokeWidth={2.2} /> Không thích
        </button>
      </div>
    );
  }

  return (
    <div className="fb-votes">
      <button
        type="button"
        className={`fb-vote ${myVote === 1 ? "active up" : ""}`}
        aria-label="Thích"
        aria-pressed={myVote === 1}
        disabled={disabled}
        onClick={() => onVote(1)}
      >
        <ThumbsUp size={15} strokeWidth={2.2} />
      </button>
      <span className="fb-score">{score}</span>
      <button
        type="button"
        className={`fb-vote ${myVote === -1 ? "active down" : ""}`}
        aria-label="Không thích"
        aria-pressed={myVote === -1}
        disabled={disabled}
        onClick={() => onVote(-1)}
      >
        <ThumbsDown size={15} strokeWidth={2.2} />
      </button>
    </div>
  );
}
