// src/modules/feedback/lib/votes.ts
/**
 * Pure vote arithmetic. NO framework/SDK imports — safe to unit-test in isolation.
 *
 * Reddit-style toggle: one vote per user per item.
 *  - clicking the direction you already picked removes the vote
 *  - clicking the opposite direction flips it
 */
import type { VoteValue, MyVote } from "@/modules/feedback/types";

export interface VoteDelta {
  /** Delta to apply to upCount. */
  up: number;
  /** Delta to apply to downCount. */
  down: number;
  /** The caller's resulting vote after the click. */
  newValue: MyVote;
}

export function computeVoteDelta(oldValue: MyVote, clicked: VoteValue): VoteDelta {
  if (oldValue === clicked) {
    // Toggle off the existing vote.
    return clicked === 1
      ? { up: -1, down: 0, newValue: 0 }
      : { up: 0, down: -1, newValue: 0 };
  }
  if (oldValue === 0) {
    // First vote in this direction.
    return clicked === 1
      ? { up: 1, down: 0, newValue: 1 }
      : { up: 0, down: 1, newValue: -1 };
  }
  // Switch from the opposite direction.
  return clicked === 1
    ? { up: 1, down: -1, newValue: 1 }
    : { up: -1, down: 1, newValue: -1 };
}
