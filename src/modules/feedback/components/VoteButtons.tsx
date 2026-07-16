// src/modules/feedback/components/VoteButtons.tsx
// No "use client" directive: this component is only imported by other client
// components (PostCard, CommentList), so it lives in the client bundle via that
// boundary. Marking it a client entry would trip Next's serializable-props check
// on its function props (onVote) — which are legitimate client→client callbacks.
import { ArrowUp, ArrowDown } from "lucide-react";
import type { MyVote, VoteValue } from "@/modules/feedback/types";

/**
 * Up/Down control with two independent counts (never a combined score). `myVote`
 * highlights the active choice; `onVote` is called with the clicked direction
 * (parent performs the request and updates counts).
 *
 * - `variant="bar"` (posts): two full-width action buttons with ▲ Up / ▼ Down
 *   labels; the parent shows the per-direction tallies separately in its stat row.
 * - `variant="compact"` (comments): small ▲ n  ▼ n inline control.
 */
export function VoteButtons({
  upCount,
  downCount,
  myVote,
  onVote,
  disabled,
  variant = "compact",
}: {
  upCount: number;
  downCount: number;
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
          aria-label="Up"
          aria-pressed={myVote === 1}
          disabled={disabled}
          onClick={() => onVote(1)}
        >
          <ArrowUp size={18} strokeWidth={2.4} /> Up
        </button>
        <button
          type="button"
          className={`fb-actionbtn ${myVote === -1 ? "active down" : ""}`}
          aria-label="Down"
          aria-pressed={myVote === -1}
          disabled={disabled}
          onClick={() => onVote(-1)}
        >
          <ArrowDown size={18} strokeWidth={2.4} /> Down
        </button>
      </div>
    );
  }

  return (
    <div className="fb-votes">
      <button
        type="button"
        className={`fb-vote ${myVote === 1 ? "active up" : ""}`}
        aria-label="Up"
        aria-pressed={myVote === 1}
        disabled={disabled}
        onClick={() => onVote(1)}
      >
        <ArrowUp size={15} strokeWidth={2.4} />
        <span className="fb-vote-count">{upCount}</span>
      </button>
      <button
        type="button"
        className={`fb-vote ${myVote === -1 ? "active down" : ""}`}
        aria-label="Down"
        aria-pressed={myVote === -1}
        disabled={disabled}
        onClick={() => onVote(-1)}
      >
        <ArrowDown size={15} strokeWidth={2.4} />
        <span className="fb-vote-count">{downCount}</span>
      </button>
    </div>
  );
}
