// src/modules/feedback/components/VoteButtons.tsx
// No "use client" directive: this component is only imported by other client
// components (PostCard, CommentList), so it lives in the client bundle via that
// boundary. Marking it a client entry would trip Next's serializable-props check
// on its function props (onVote) — which are legitimate client→client callbacks.
import { ChevronUp, ChevronDown } from "lucide-react";
import type { MyVote, VoteValue } from "@/modules/feedback/types";

/**
 * Up/Down control with the running score. `myVote` highlights the active choice.
 * `onVote` is called with the clicked direction; the parent performs the request
 * and updates counts. `disabled` (e.g. signed out) shows a login hint on click.
 */
export function VoteButtons({
  score,
  myVote,
  onVote,
  disabled,
}: {
  score: number;
  myVote: MyVote;
  onVote: (value: VoteValue) => void;
  disabled?: boolean;
}) {
  return (
    <div className="fb-votes">
      <button
        type="button"
        className={`fb-vote ${myVote === 1 ? "active up" : ""}`}
        aria-label="Tăng"
        aria-pressed={myVote === 1}
        disabled={disabled}
        onClick={() => onVote(1)}
      >
        <ChevronUp size={18} strokeWidth={2.4} />
      </button>
      <span className="fb-score">{score}</span>
      <button
        type="button"
        className={`fb-vote ${myVote === -1 ? "active down" : ""}`}
        aria-label="Giảm"
        aria-pressed={myVote === -1}
        disabled={disabled}
        onClick={() => onVote(-1)}
      >
        <ChevronDown size={18} strokeWidth={2.4} />
      </button>
    </div>
  );
}
