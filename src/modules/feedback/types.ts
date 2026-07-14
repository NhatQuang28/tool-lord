// src/modules/feedback/types.ts
/**
 * Client-safe types for the feedback feature. NO server imports here — this file
 * is bundled into the browser. Dates are epoch milliseconds (numbers) so DTOs are
 * plain JSON. Firestore document shapes live in feedback.server.ts, not here.
 */

/** A cast vote: +1 = up, -1 = down. */
export type VoteValue = 1 | -1;
/** The caller's current vote on an item: their value, or 0 when they haven't voted. */
export type MyVote = VoteValue | 0;

/** Content length + pagination limits (shared by client validation and server). */
export const MAX_POST_LEN = 5000;
export const MAX_COMMENT_LEN = 2000;
export const PAGE_SIZE = 20;

/** Author identity — present ONLY on DTOs returned to manager/admin callers. */
export interface AuthorInfo {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface PostDto {
  id: string;
  content: string;
  approved: boolean;
  /** True when soft-deleted (only privileged callers ever receive deleted items). */
  deleted: boolean;
  upCount: number;
  downCount: number;
  score: number;
  commentCount: number;
  createdAt: number;
  editedAt: number | null;
  /** Caller's own vote (0 when signed out or not voted). */
  myVote: MyVote;
  /** True when the item belongs to the caller. */
  mine: boolean;
  /** Present ONLY for manager/admin callers. */
  author?: AuthorInfo;
}

export interface CommentDto {
  id: string;
  content: string;
  deleted: boolean;
  upCount: number;
  downCount: number;
  score: number;
  createdAt: number;
  editedAt: number | null;
  myVote: MyVote;
  mine: boolean;
  author?: AuthorInfo;
}

export type SortOrder = "new" | "top";

export interface ListPostsResponse {
  posts: PostDto[];
  /** Opaque cursor for the next page, or null when there are no more posts. */
  nextCursor: string | null;
  error?: string;
}

export interface PostDetailResponse {
  post: PostDto | null;
  comments: CommentDto[];
  error?: string;
}

export interface CreatePostRequest {
  content: string;
}
export interface CreatePostResponse {
  post?: PostDto;
  error?: string;
}

/** PATCH body for a post: author edits content, OR manager/admin runs a moderation action. */
export type UpdatePostRequest =
  | { content: string }
  | { action: "approve" | "unapprove" | "hide" | "restore" };

export interface PostMutationResponse {
  post?: PostDto;
  error?: string;
}

export interface VoteRequest {
  value: VoteValue;
}
export interface VoteResponse {
  upCount: number;
  downCount: number;
  score: number;
  myVote: MyVote;
  error?: string;
}

export interface CreateCommentRequest {
  content: string;
}

/** PATCH body for a comment: author edits content, OR manager/admin hides/restores. */
export type UpdateCommentRequest =
  | { content: string }
  | { action: "hide" | "restore" };

export interface CommentMutationResponse {
  comment?: CommentDto;
  error?: string;
}
