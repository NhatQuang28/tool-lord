# Feedback Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, social-media-style "Góp ý" (feedback) area where anyone can read posts, signed-in users can post/comment/vote (one vote per item), and managers/admins can approve, soft-delete, and reveal author identity.

**Architecture:** A self-contained module at `src/modules/feedback/` (NOT registered in the tools registry — it's a feature, not a tool). Pure logic (`lib/votes.ts`, `lib/anonymize.ts`) is React/Next-free and unit-checkable. A server data layer (`lib/feedback.server.ts`) is the only code touching Firestore (via the Admin SDK, which bypasses security rules). Thin App-Router API routes wrap it. Client components under `components/` render the feed and call the routes. Posts are visible immediately; "approved" is only a highlight badge; soft-delete hides items.

**Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript, Firebase Admin SDK (Firestore + Auth), existing auth helpers (`requireUser`, `requireRole`, `resolveRole`, `authedFetch`, `useAuth`).

## Global Constraints

- UI language is **Vietnamese** (all user-facing strings).
- Path alias `@/*` → `src/*`.
- Node engine: `22.x` (dev machine runs newer; type-strip TS runs natively).
- **`lib/votes.ts` and `lib/anonymize.ts` MUST stay pure** — no React, no Next, no `firebase-admin` imports (only `import type` from module types and pure imports from `@/lib/roles`).
- All Firestore reads/writes go through the **server** (Admin SDK). Clients never read Firestore directly. Do NOT loosen `firestore.rules`.
- Only store `authorUid` on documents — never denormalize email/displayName into the docs.
- No test runner is configured and we are **not** adding one. Pure logic is verified by an executed throwaway Node script; everything else is verified by `npx tsc --noEmit`, `npm run lint`, and a manual dev-server smoke test.
- Money/identity-sensitive: author identity is revealed **only** to callers with role `manager` or `admin`.

Limits (copy verbatim into code as named constants):
- `MAX_POST_LEN = 5000`
- `MAX_COMMENT_LEN = 2000`
- `PAGE_SIZE = 20`

---

## File Structure

**Create:**
- `src/modules/feedback/types.ts` — DTOs + request/response types + constants (client-safe).
- `src/modules/feedback/lib/votes.ts` — pure vote-delta math.
- `src/modules/feedback/lib/anonymize.ts` — pure identity-reveal rules.
- `src/modules/feedback/lib/feedback.server.ts` — server data layer (Firestore + Auth + DTO mapping). Server-only.
- `src/modules/feedback/components/VoteButtons.tsx`
- `src/modules/feedback/components/Composer.tsx`
- `src/modules/feedback/components/PostCard.tsx`
- `src/modules/feedback/components/CommentList.tsx`
- `src/modules/feedback/components/FeedbackFeed.tsx`
- `src/modules/feedback/components/client.ts` — client fetch helper (optional-token GET + authed mutations).
- `src/app/feedback/page.tsx` — public page shell.
- `src/app/api/feedback/route.ts` — `GET` (list), `POST` (create).
- `src/app/api/feedback/[id]/route.ts` — `GET` (detail+comments), `PATCH` (edit/moderate), `DELETE` (soft-delete).
- `src/app/api/feedback/[id]/vote/route.ts` — `POST` (vote on post).
- `src/app/api/feedback/[id]/comments/route.ts` — `POST` (add comment).
- `src/app/api/feedback/[id]/comments/[cid]/route.ts` — `PATCH` (edit/moderate), `DELETE` (soft-delete).
- `src/app/api/feedback/[id]/comments/[cid]/vote/route.ts` — `POST` (vote on comment).

**Modify:**
- `firestore.indexes.json` — add composite index for the "top" sort.
- `src/components/SiteNav.tsx` — add a public "Góp ý" nav link.
- `src/app/globals.css` — feedback styles.

---

### Task 1: Domain types & constants

**Files:**
- Create: `src/modules/feedback/types.ts`

**Interfaces:**
- Produces: `VoteValue`, `MyVote`, `AuthorInfo`, `PostDto`, `CommentDto`, `SortOrder`, all request/response DTOs, and the constants `MAX_POST_LEN`, `MAX_COMMENT_LEN`, `PAGE_SIZE`.

- [ ] **Step 1: Write the file**

```ts
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors introduced by the new file.

- [ ] **Step 3: Commit**

```bash
git add src/modules/feedback/types.ts
git commit -m "feat(feedback): add domain types and constants"
```

---

### Task 2: Pure vote-delta math

**Files:**
- Create: `src/modules/feedback/lib/votes.ts`

**Interfaces:**
- Consumes: `VoteValue`, `MyVote` from `@/modules/feedback/types` (type-only).
- Produces: `VoteDelta` interface and `computeVoteDelta(oldValue: MyVote, clicked: VoteValue): VoteDelta`.

- [ ] **Step 1: Write the failing test (throwaway script)**

Create `C:\Users\nhatq\AppData\Local\Temp\claude\d--Repos-tool-lord\2c391bbf-401d-4c73-bf35-0d8e4251ddbc\scratchpad\votes-check.mts`:

```ts
import assert from "node:assert/strict";
import { computeVoteDelta } from "file:///D:/Repos/tool-lord/src/modules/feedback/lib/votes.ts";

// no prior vote
assert.deepEqual(computeVoteDelta(0, 1), { up: 1, down: 0, newValue: 1 });
assert.deepEqual(computeVoteDelta(0, -1), { up: 0, down: 1, newValue: -1 });
// clicking same direction toggles off
assert.deepEqual(computeVoteDelta(1, 1), { up: -1, down: 0, newValue: 0 });
assert.deepEqual(computeVoteDelta(-1, -1), { up: 0, down: -1, newValue: 0 });
// switching direction
assert.deepEqual(computeVoteDelta(1, -1), { up: -1, down: 1, newValue: -1 });
assert.deepEqual(computeVoteDelta(-1, 1), { up: 1, down: -1, newValue: 1 });

console.log("votes: all assertions passed");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node "C:/Users/nhatq/AppData/Local/Temp/claude/d--Repos-tool-lord/2c391bbf-401d-4c73-bf35-0d8e4251ddbc/scratchpad/votes-check.mts"`
Expected: FAIL — cannot resolve module (votes.ts does not exist yet).

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node "C:/Users/nhatq/AppData/Local/Temp/claude/d--Repos-tool-lord/2c391bbf-401d-4c73-bf35-0d8e4251ddbc/scratchpad/votes-check.mts"`
Expected: prints `votes: all assertions passed`, exit code 0.

- [ ] **Step 5: Type-check and commit** (do NOT commit the scratchpad script)

Run: `npx tsc --noEmit` → no new errors.

```bash
git add src/modules/feedback/lib/votes.ts
git commit -m "feat(feedback): add pure vote-delta math"
```

---

### Task 3: Pure identity-reveal rules

**Files:**
- Create: `src/modules/feedback/lib/anonymize.ts`

**Interfaces:**
- Consumes: `hasAtLeast`, `Role` from `@/lib/roles`; `AuthorInfo` from `@/modules/feedback/types` (type-only).
- Produces: `canRevealIdentity(role: Role): boolean` and `authorFieldFor(role, authorUid, resolved): AuthorInfo | undefined`.

- [ ] **Step 1: Write the file**

```ts
// src/modules/feedback/lib/anonymize.ts
/**
 * Pure rules for how much author identity a caller may see. The UI is anonymous
 * for everyone EXCEPT managers/admins, who may see the author's identity to
 * moderate. Kept pure (only a pure import from @/lib/roles) so it's testable.
 */
import { hasAtLeast, type Role } from "@/lib/roles";
import type { AuthorInfo } from "@/modules/feedback/types";

/** Managers and admins may see author identity; plain users and guests may not. */
export function canRevealIdentity(role: Role): boolean {
  return hasAtLeast(role, "manager");
}

/**
 * Compute the `author` field for a DTO. Returns `undefined` (fully anonymous) for
 * non-privileged callers. For privileged callers, returns the resolved identity,
 * falling back to a uid-only record if the lookup map has no entry.
 */
export function authorFieldFor(
  role: Role,
  authorUid: string,
  resolved: Map<string, { email: string | null; displayName: string | null }>,
): AuthorInfo | undefined {
  if (!canRevealIdentity(role)) return undefined;
  const info = resolved.get(authorUid);
  return {
    uid: authorUid,
    email: info?.email ?? null,
    displayName: info?.displayName ?? null,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/feedback/lib/anonymize.ts
git commit -m "feat(feedback): add pure identity-reveal rules"
```

---

### Task 4: Server data layer

**Files:**
- Create: `src/modules/feedback/lib/feedback.server.ts`

**Interfaces:**
- Consumes: `adminDb`, `adminAuth` (`@/lib/firebase/admin`); `requireUser` (`@/lib/auth/requireUser`); `resolveRole` (`@/lib/auth/roles.server`); `Role`/`hasAtLeast` (`@/lib/roles`); `computeVoteDelta` (`./votes`); `canRevealIdentity`, `authorFieldFor` (`./anonymize`); all DTO types + constants from `../types`.
- Produces (all used by the route tasks):
  - `class FeedbackError extends Error { status: number }`
  - `interface Caller { uid: string | null; role: Role }`
  - `resolveCaller(req: NextRequest): Promise<Caller>`
  - `listPosts(caller: Caller, sort: SortOrder, cursor: string | null): Promise<{ posts: PostDto[]; nextCursor: string | null }>`
  - `getPostWithComments(caller: Caller, postId: string): Promise<{ post: PostDto | null; comments: CommentDto[] }>`
  - `createPost(uid: string, content: string): Promise<PostDto>`
  - `editPostContent(caller: Caller, postId: string, content: string): Promise<PostDto>`
  - `moderatePost(caller: Caller, postId: string, action: "approve" | "unapprove" | "hide" | "restore"): Promise<PostDto>`
  - `softDeletePost(caller: Caller, postId: string): Promise<PostDto>`
  - `addComment(uid: string, postId: string, content: string): Promise<CommentDto>`
  - `editCommentContent(caller: Caller, postId: string, cid: string, content: string): Promise<CommentDto>`
  - `moderateComment(caller: Caller, postId: string, cid: string, action: "hide" | "restore"): Promise<CommentDto>`
  - `softDeleteComment(caller: Caller, postId: string, cid: string): Promise<CommentDto>`
  - `votePost(uid: string, postId: string, value: VoteValue): Promise<VoteResult>`
  - `voteComment(uid: string, postId: string, cid: string, value: VoteValue): Promise<VoteResult>`
  - `type VoteResult = { upCount: number; downCount: number; score: number; myVote: MyVote }`

- [ ] **Step 1: Write the file**

```ts
// src/modules/feedback/lib/feedback.server.ts
import "server-only";
import type { NextRequest } from "next/server";
import {
  Timestamp,
  type DocumentData,
  type Query,
  type CollectionReference,
  type DocumentReference,
} from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireUser } from "@/lib/auth/requireUser";
import { resolveRole } from "@/lib/auth/roles.server";
import { hasAtLeast, type Role } from "@/lib/roles";
import { computeVoteDelta } from "./votes";
import { canRevealIdentity, authorFieldFor } from "./anonymize";
import {
  MAX_POST_LEN,
  MAX_COMMENT_LEN,
  PAGE_SIZE,
  type PostDto,
  type CommentDto,
  type SortOrder,
  type VoteValue,
  type MyVote,
  type AuthorInfo,
} from "../types";

const POSTS = "feedbackPosts";

/** A thrown error carrying an HTTP status; routes map it to a JSON response. */
export class FeedbackError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "FeedbackError";
  }
}

/** Identity of the request's caller. Signed-out callers are role "user", uid null. */
export interface Caller {
  uid: string | null;
  role: Role;
}

export type VoteResult = {
  upCount: number;
  downCount: number;
  score: number;
  myVote: MyVote;
};

/** Resolve the caller from an OPTIONAL bearer token (GET endpoints are public). */
export async function resolveCaller(req: NextRequest): Promise<Caller> {
  const decoded = await requireUser(req);
  if (!decoded) return { uid: null, role: "user" };
  const role = await resolveRole(decoded);
  return { uid: decoded.uid, role };
}

function validateContent(raw: unknown, max: number, label: string): string {
  if (typeof raw !== "string") throw new FeedbackError(400, `${label} không hợp lệ.`);
  const content = raw.trim();
  if (!content) throw new FeedbackError(400, `${label} không được để trống.`);
  if (content.length > max)
    throw new FeedbackError(400, `${label} tối đa ${max} ký tự.`);
  return content;
}

function millis(ts: unknown): number {
  return ts instanceof Timestamp ? ts.toMillis() : 0;
}

// ---- Author-identity resolution (privileged callers only) --------------------

/** Batch-resolve uid → identity for privileged callers; empty map otherwise. */
async function resolveAuthors(
  role: Role,
  uids: string[],
): Promise<Map<string, { email: string | null; displayName: string | null }>> {
  const map = new Map<string, { email: string | null; displayName: string | null }>();
  if (!canRevealIdentity(role) || uids.length === 0) return map;
  const unique = [...new Set(uids)];
  // adminAuth.getUsers accepts up to 100 identifiers per call.
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100).map((uid) => ({ uid }));
    const res = await adminAuth.getUsers(batch);
    for (const u of res.users) {
      map.set(u.uid, { email: u.email ?? null, displayName: u.displayName ?? null });
    }
  }
  return map;
}

// ---- Caller vote lookup ------------------------------------------------------

/** Read the caller's votes for a set of vote-subcollection parents. */
async function callerVotes(
  callerUid: string | null,
  voteRefs: DocumentReference[],
): Promise<Map<string, MyVote>> {
  const map = new Map<string, MyVote>();
  if (!callerUid || voteRefs.length === 0) return map;
  const snaps = await adminDb.getAll(...voteRefs);
  for (const snap of snaps) {
    if (snap.exists) {
      const v = snap.get("value");
      // Key by the parent doc id (vote doc id === callerUid; parent === item id).
      map.set(snap.ref.parent.parent!.id, v === 1 || v === -1 ? v : 0);
    }
  }
  return map;
}

// ---- DTO mapping -------------------------------------------------------------

function mapPost(
  caller: Caller,
  id: string,
  d: DocumentData,
  myVote: MyVote,
  authors: Map<string, { email: string | null; displayName: string | null }>,
): PostDto {
  const authorUid = String(d.authorUid ?? "");
  return {
    id,
    content: String(d.content ?? ""),
    approved: Boolean(d.approved),
    deleted: d.status === "deleted",
    upCount: Number(d.upCount ?? 0),
    downCount: Number(d.downCount ?? 0),
    score: Number(d.score ?? 0),
    commentCount: Number(d.commentCount ?? 0),
    createdAt: millis(d.createdAt),
    editedAt: d.editedAt ? millis(d.editedAt) : null,
    myVote,
    mine: caller.uid !== null && caller.uid === authorUid,
    author: authorFieldFor(caller.role, authorUid, authors),
  };
}

function mapComment(
  caller: Caller,
  id: string,
  d: DocumentData,
  myVote: MyVote,
  authors: Map<string, { email: string | null; displayName: string | null }>,
): CommentDto {
  const authorUid = String(d.authorUid ?? "");
  return {
    id,
    content: String(d.content ?? ""),
    deleted: d.status === "deleted",
    upCount: Number(d.upCount ?? 0),
    downCount: Number(d.downCount ?? 0),
    score: Number(d.score ?? 0),
    createdAt: millis(d.createdAt),
    editedAt: d.editedAt ? millis(d.editedAt) : null,
    myVote,
    mine: caller.uid !== null && caller.uid === authorUid,
    author: authorFieldFor(caller.role, authorUid, authors),
  };
}

// ---- Cursor encode/decode ----------------------------------------------------

function encodeCursor(sort: SortOrder, d: DocumentData): string {
  const payload =
    sort === "top" ? [Number(d.score ?? 0), millis(d.createdAt)] : [millis(d.createdAt)];
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function applyCursor(sort: SortOrder, q: Query, cursor: string | null): Query {
  if (!cursor) return q;
  let payload: number[];
  try {
    payload = JSON.parse(Buffer.from(cursor, "base64url").toString());
  } catch {
    throw new FeedbackError(400, "Con trỏ phân trang không hợp lệ.");
  }
  return sort === "top"
    ? q.startAfter(payload[0], Timestamp.fromMillis(payload[1]))
    : q.startAfter(Timestamp.fromMillis(payload[0]));
}

// ---- Reads -------------------------------------------------------------------

export async function listPosts(
  caller: Caller,
  sort: SortOrder,
  cursor: string | null,
): Promise<{ posts: PostDto[]; nextCursor: string | null }> {
  const col = adminDb.collection(POSTS);
  let q: Query =
    sort === "top"
      ? col.orderBy("score", "desc").orderBy("createdAt", "desc")
      : col.orderBy("createdAt", "desc");
  q = applyCursor(sort, q, cursor).limit(PAGE_SIZE + 1);

  const snap = await q.get();
  const rawDocs = snap.docs;
  const hasMore = rawDocs.length > PAGE_SIZE;
  const pageDocs = rawDocs.slice(0, PAGE_SIZE);

  const privileged = canRevealIdentity(caller.role);
  // Non-privileged callers never see soft-deleted posts.
  const visible = privileged ? pageDocs : pageDocs.filter((doc) => doc.get("status") !== "deleted");

  const authors = await resolveAuthors(
    caller.role,
    visible.map((doc) => String(doc.get("authorUid") ?? "")),
  );
  const votes = await callerVotes(
    caller.uid,
    visible.map((doc) => doc.ref.collection("votes").doc(caller.uid ?? "_")),
  );

  const posts = visible.map((doc) =>
    mapPost(caller, doc.id, doc.data(), votes.get(doc.id) ?? 0, authors),
  );

  // Cursor is based on the last RAW page doc (pagination stays correct even when
  // some docs were filtered out for a public caller).
  const nextCursor =
    hasMore && pageDocs.length > 0
      ? encodeCursor(sort, pageDocs[pageDocs.length - 1].data())
      : null;

  return { posts, nextCursor };
}

export async function getPostWithComments(
  caller: Caller,
  postId: string,
): Promise<{ post: PostDto | null; comments: CommentDto[] }> {
  const postRef = adminDb.collection(POSTS).doc(postId);
  const postSnap = await postRef.get();
  const privileged = canRevealIdentity(caller.role);
  if (!postSnap.exists) return { post: null, comments: [] };
  if (postSnap.get("status") === "deleted" && !privileged) return { post: null, comments: [] };

  const commentSnap = await postRef.collection("comments").orderBy("createdAt", "asc").get();
  const commentDocs = privileged
    ? commentSnap.docs
    : commentSnap.docs.filter((doc) => doc.get("status") !== "deleted");

  const authorUids = [
    String(postSnap.get("authorUid") ?? ""),
    ...commentDocs.map((doc) => String(doc.get("authorUid") ?? "")),
  ];
  const authors = await resolveAuthors(caller.role, authorUids);

  const voteRefs: DocumentReference[] = [
    postRef.collection("votes").doc(caller.uid ?? "_"),
    ...commentDocs.map((doc) => doc.ref.collection("votes").doc(caller.uid ?? "_")),
  ];
  const votes = await callerVotes(caller.uid, voteRefs);

  const post = mapPost(caller, postSnap.id, postSnap.data()!, votes.get(postSnap.id) ?? 0, authors);
  const comments = commentDocs.map((doc) =>
    mapComment(caller, doc.id, doc.data(), votes.get(doc.id) ?? 0, authors),
  );
  return { post, comments };
}

// ---- Helpers for single-item DTO after a mutation ----------------------------

async function postDtoForCaller(caller: Caller, postRef: DocumentReference): Promise<PostDto> {
  const snap = await postRef.get();
  const d = snap.data()!;
  const authors = await resolveAuthors(caller.role, [String(d.authorUid ?? "")]);
  const votes = await callerVotes(caller.uid, [postRef.collection("votes").doc(caller.uid ?? "_")]);
  return mapPost(caller, snap.id, d, votes.get(snap.id) ?? 0, authors);
}

async function commentDtoForCaller(
  caller: Caller,
  commentRef: DocumentReference,
): Promise<CommentDto> {
  const snap = await commentRef.get();
  const d = snap.data()!;
  const authors = await resolveAuthors(caller.role, [String(d.authorUid ?? "")]);
  const votes = await callerVotes(caller.uid, [
    commentRef.collection("votes").doc(caller.uid ?? "_"),
  ]);
  return mapComment(caller, snap.id, d, votes.get(snap.id) ?? 0, authors);
}

// ---- Post mutations ----------------------------------------------------------

export async function createPost(uid: string, content: string): Promise<PostDto> {
  const clean = validateContent(content, MAX_POST_LEN, "Nội dung");
  const now = Timestamp.now();
  const ref = adminDb.collection(POSTS).doc();
  await ref.set({
    authorUid: uid,
    content: clean,
    status: "visible",
    approved: false,
    upCount: 0,
    downCount: 0,
    score: 0,
    commentCount: 0,
    createdAt: now,
  });
  return postDtoForCaller({ uid, role: "user" }, ref);
}

/** Load a post ref + require it to exist; throw 404 otherwise. */
async function requirePost(postId: string): Promise<{ ref: DocumentReference; data: DocumentData }> {
  const ref = adminDb.collection(POSTS).doc(postId);
  const snap = await ref.get();
  if (!snap.exists) throw new FeedbackError(404, "Không tìm thấy bài viết.");
  return { ref, data: snap.data()! };
}

export async function editPostContent(
  caller: Caller,
  postId: string,
  content: string,
): Promise<PostDto> {
  const { ref, data } = await requirePost(postId);
  if (!caller.uid || caller.uid !== data.authorUid)
    throw new FeedbackError(403, "Bạn chỉ có thể sửa bài của mình.");
  const clean = validateContent(content, MAX_POST_LEN, "Nội dung");
  await ref.update({ content: clean, editedAt: Timestamp.now() });
  return postDtoForCaller(caller, ref);
}

export async function moderatePost(
  caller: Caller,
  postId: string,
  action: "approve" | "unapprove" | "hide" | "restore",
): Promise<PostDto> {
  if (!hasAtLeast(caller.role, "manager"))
    throw new FeedbackError(403, "Bạn không có quyền kiểm duyệt.");
  const { ref } = await requirePost(postId);
  const patch: DocumentData = {};
  if (action === "approve") {
    patch.approved = true;
    patch.approvedBy = caller.uid;
    patch.approvedAt = Timestamp.now();
  } else if (action === "unapprove") {
    patch.approved = false;
  } else if (action === "hide") {
    patch.status = "deleted";
  } else {
    patch.status = "visible";
  }
  await ref.update(patch);
  return postDtoForCaller(caller, ref);
}

export async function softDeletePost(caller: Caller, postId: string): Promise<PostDto> {
  const { ref, data } = await requirePost(postId);
  const isOwner = caller.uid !== null && caller.uid === data.authorUid;
  if (!isOwner && !hasAtLeast(caller.role, "manager"))
    throw new FeedbackError(403, "Bạn không có quyền xóa bài này.");
  await ref.update({ status: "deleted" });
  return postDtoForCaller(caller, ref);
}

// ---- Comment mutations -------------------------------------------------------

export async function addComment(
  uid: string,
  postId: string,
  content: string,
): Promise<CommentDto> {
  const clean = validateContent(content, MAX_COMMENT_LEN, "Bình luận");
  const { ref: postRef } = await requirePost(postId);
  const commentRef = postRef.collection("comments").doc();
  await adminDb.runTransaction(async (tx) => {
    tx.set(commentRef, {
      authorUid: uid,
      content: clean,
      status: "visible",
      upCount: 0,
      downCount: 0,
      score: 0,
      createdAt: Timestamp.now(),
    });
    tx.update(postRef, { commentCount: (await tx.get(postRef)).get("commentCount") + 1 });
  });
  return commentDtoForCaller({ uid, role: "user" }, commentRef);
}

async function requireComment(
  postId: string,
  cid: string,
): Promise<{ ref: DocumentReference; data: DocumentData }> {
  const ref = adminDb.collection(POSTS).doc(postId).collection("comments").doc(cid);
  const snap = await ref.get();
  if (!snap.exists) throw new FeedbackError(404, "Không tìm thấy bình luận.");
  return { ref, data: snap.data()! };
}

export async function editCommentContent(
  caller: Caller,
  postId: string,
  cid: string,
  content: string,
): Promise<CommentDto> {
  const { ref, data } = await requireComment(postId, cid);
  if (!caller.uid || caller.uid !== data.authorUid)
    throw new FeedbackError(403, "Bạn chỉ có thể sửa bình luận của mình.");
  const clean = validateContent(content, MAX_COMMENT_LEN, "Bình luận");
  await ref.update({ content: clean, editedAt: Timestamp.now() });
  return commentDtoForCaller(caller, ref);
}

export async function moderateComment(
  caller: Caller,
  postId: string,
  cid: string,
  action: "hide" | "restore",
): Promise<CommentDto> {
  if (!hasAtLeast(caller.role, "manager"))
    throw new FeedbackError(403, "Bạn không có quyền kiểm duyệt.");
  const { ref } = await requireComment(postId, cid);
  await ref.update({ status: action === "hide" ? "deleted" : "visible" });
  return commentDtoForCaller(caller, ref);
}

export async function softDeleteComment(
  caller: Caller,
  postId: string,
  cid: string,
): Promise<CommentDto> {
  const { ref, data } = await requireComment(postId, cid);
  const isOwner = caller.uid !== null && caller.uid === data.authorUid;
  if (!isOwner && !hasAtLeast(caller.role, "manager"))
    throw new FeedbackError(403, "Bạn không có quyền xóa bình luận này.");
  await ref.update({ status: "deleted" });
  return commentDtoForCaller(caller, ref);
}

// ---- Voting ------------------------------------------------------------------

async function voteOn(itemRef: DocumentReference, uid: string, value: VoteValue): Promise<VoteResult> {
  const voteRef = itemRef.collection("votes").doc(uid);
  return adminDb.runTransaction(async (tx) => {
    const itemSnap = await tx.get(itemRef);
    if (!itemSnap.exists) throw new FeedbackError(404, "Mục này không còn tồn tại.");
    const voteSnap = await tx.get(voteRef);
    const stored = voteSnap.exists ? voteSnap.get("value") : 0;
    const oldValue: MyVote = stored === 1 || stored === -1 ? stored : 0;
    const delta = computeVoteDelta(oldValue, value);
    const upCount = Number(itemSnap.get("upCount") ?? 0) + delta.up;
    const downCount = Number(itemSnap.get("downCount") ?? 0) + delta.down;
    const score = upCount - downCount;
    tx.update(itemRef, { upCount, downCount, score });
    if (delta.newValue === 0) tx.delete(voteRef);
    else tx.set(voteRef, { value: delta.newValue });
    return { upCount, downCount, score, myVote: delta.newValue };
  });
}

export async function votePost(uid: string, postId: string, value: VoteValue): Promise<VoteResult> {
  return voteOn(adminDb.collection(POSTS).doc(postId), uid, value);
}

export async function voteComment(
  uid: string,
  postId: string,
  cid: string,
  value: VoteValue,
): Promise<VoteResult> {
  return voteOn(adminDb.collection(POSTS).doc(postId).collection("comments").doc(cid), uid, value);
}
```

> Note on `CollectionReference` import: it is imported for type clarity; if `tsc` reports it unused, remove it from the import list.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `CollectionReference` is flagged unused, delete it from the import and re-run.

- [ ] **Step 3: Commit**

```bash
git add src/modules/feedback/lib/feedback.server.ts
git commit -m "feat(feedback): add server data layer (Firestore + identity + votes)"
```

---

### Task 5: List/detail API routes + composite index

**Files:**
- Create: `src/app/api/feedback/route.ts` (GET list here; POST added in Task 6)
- Create: `src/app/api/feedback/[id]/route.ts` (GET detail here; PATCH/DELETE added in Task 6)
- Modify: `firestore.indexes.json`

**Interfaces:**
- Consumes: `resolveCaller`, `listPosts`, `getPostWithComments`, `FeedbackError` from `feedback.server`; `SortOrder`, `ListPostsResponse`, `PostDetailResponse` from types.

- [ ] **Step 1: Add the composite index for "top" sort**

Replace `firestore.indexes.json` with:

```json
{
  "indexes": [
    {
      "collectionGroup": "feedbackPosts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "score", "order": "DESCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 2: Write the list route**

```ts
// src/app/api/feedback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveCaller, listPosts, FeedbackError } from "@/modules/feedback/lib/feedback.server";
import type { ListPostsResponse, SortOrder } from "@/modules/feedback/types";

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    const url = new URL(req.url);
    const sort: SortOrder = url.searchParams.get("sort") === "top" ? "top" : "new";
    const cursor = url.searchParams.get("cursor");
    const { posts, nextCursor } = await listPosts(caller, sort, cursor);
    return NextResponse.json<ListPostsResponse>({ posts, nextCursor });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không tải được danh sách góp ý.";
    return NextResponse.json<ListPostsResponse>({ posts: [], nextCursor: null, error: message }, { status });
  }
}
```

- [ ] **Step 3: Write the detail route**

```ts
// src/app/api/feedback/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  resolveCaller,
  getPostWithComments,
  FeedbackError,
} from "@/modules/feedback/lib/feedback.server";
import type { PostDetailResponse } from "@/modules/feedback/types";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const caller = await resolveCaller(req);
    const { post, comments } = await getPostWithComments(caller, id);
    if (!post) {
      return NextResponse.json<PostDetailResponse>(
        { post: null, comments: [], error: "Không tìm thấy bài viết." },
        { status: 404 },
      );
    }
    return NextResponse.json<PostDetailResponse>({ post, comments });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không tải được bài viết.";
    return NextResponse.json<PostDetailResponse>({ post: null, comments: [], error: message }, { status });
  }
}
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run build` → compiles; the two `/api/feedback` routes appear in the route list.

- [ ] **Step 5: Deploy the index (record outcome)**

Run: `npx -y firebase-tools@latest deploy --only firestore:indexes`
Expected: index for `feedbackPosts (score DESC, createdAt DESC)` created/enabled. If Firebase CLI auth is unavailable in this environment, note that the index must be deployed before the "Nổi bật" sort will work in production, and continue (the "Mới nhất" sort needs no composite index).

- [ ] **Step 6: Commit**

```bash
git add firestore.indexes.json src/app/api/feedback/route.ts src/app/api/feedback/[id]/route.ts
git commit -m "feat(feedback): add list/detail API routes and top-sort index"
```

---

### Task 6: Post mutation + vote routes

**Files:**
- Modify: `src/app/api/feedback/route.ts` (add `POST`)
- Modify: `src/app/api/feedback/[id]/route.ts` (add `PATCH`, `DELETE`)
- Create: `src/app/api/feedback/[id]/vote/route.ts`

**Interfaces:**
- Consumes: `requireUser` (`@/lib/auth/requireUser`), `resolveCaller`, `createPost`, `editPostContent`, `moderatePost`, `softDeletePost`, `votePost`, `FeedbackError`; DTO types `CreatePostResponse`, `PostMutationResponse`, `UpdatePostRequest`, `VoteRequest`, `VoteResponse`.

- [ ] **Step 1: Add `POST` to the list route**

Append to `src/app/api/feedback/route.ts` (keep the existing `GET`, add these imports + function):

```ts
// add to imports:
// import { requireUser } from "@/lib/auth/requireUser";
// import { createPost } from "@/modules/feedback/lib/feedback.server";
// import type { CreatePostRequest, CreatePostResponse } from "@/modules/feedback/types";

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json<CreatePostResponse>({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  try {
    const body = (await req.json()) as CreatePostRequest;
    const post = await createPost(user.uid, body?.content);
    return NextResponse.json<CreatePostResponse>({ post });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không đăng được bài.";
    return NextResponse.json<CreatePostResponse>({ error: message }, { status });
  }
}
```

The final import block of `route.ts` must be:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  resolveCaller,
  listPosts,
  createPost,
  FeedbackError,
} from "@/modules/feedback/lib/feedback.server";
import type {
  ListPostsResponse,
  SortOrder,
  CreatePostRequest,
  CreatePostResponse,
} from "@/modules/feedback/types";
```

- [ ] **Step 2: Add `PATCH` + `DELETE` to the detail route**

Append to `src/app/api/feedback/[id]/route.ts`:

```ts
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const caller = await resolveCaller(req);
  if (!caller.uid) {
    return NextResponse.json<PostMutationResponse>({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as UpdatePostRequest;
    const post =
      "action" in body
        ? await moderatePost(caller, id, body.action)
        : await editPostContent(caller, id, body.content);
    return NextResponse.json<PostMutationResponse>({ post });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không cập nhật được bài.";
    return NextResponse.json<PostMutationResponse>({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const caller = await resolveCaller(req);
  if (!caller.uid) {
    return NextResponse.json<PostMutationResponse>({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    const post = await softDeletePost(caller, id);
    return NextResponse.json<PostMutationResponse>({ post });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không xóa được bài.";
    return NextResponse.json<PostMutationResponse>({ error: message }, { status });
  }
}
```

Update the detail route's imports to:

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  resolveCaller,
  getPostWithComments,
  editPostContent,
  moderatePost,
  softDeletePost,
  FeedbackError,
} from "@/modules/feedback/lib/feedback.server";
import type { PostDetailResponse, PostMutationResponse, UpdatePostRequest } from "@/modules/feedback/types";
```

- [ ] **Step 3: Write the vote route**

```ts
// src/app/api/feedback/[id]/vote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { votePost, FeedbackError } from "@/modules/feedback/lib/feedback.server";
import type { VoteRequest, VoteResponse } from "@/modules/feedback/types";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json<VoteResponse>(
      { upCount: 0, downCount: 0, score: 0, myVote: 0, error: "Chưa đăng nhập." },
      { status: 401 },
    );
  }
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as VoteRequest;
    if (body?.value !== 1 && body?.value !== -1) {
      throw new FeedbackError(400, "Giá trị vote không hợp lệ.");
    }
    const result = await votePost(user.uid, id, body.value);
    return NextResponse.json<VoteResponse>(result);
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không vote được.";
    return NextResponse.json<VoteResponse>(
      { upCount: 0, downCount: 0, score: 0, myVote: 0, error: message },
      { status },
    );
  }
}
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run build` → compiles.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/feedback/route.ts "src/app/api/feedback/[id]/route.ts" "src/app/api/feedback/[id]/vote/route.ts"
git commit -m "feat(feedback): add post create/edit/moderate/delete/vote routes"
```

---

### Task 7: Comment API routes

**Files:**
- Create: `src/app/api/feedback/[id]/comments/route.ts`
- Create: `src/app/api/feedback/[id]/comments/[cid]/route.ts`
- Create: `src/app/api/feedback/[id]/comments/[cid]/vote/route.ts`

**Interfaces:**
- Consumes: `requireUser`, `resolveCaller`, `addComment`, `editCommentContent`, `moderateComment`, `softDeleteComment`, `voteComment`, `FeedbackError`; types `CreateCommentRequest`, `CommentMutationResponse`, `UpdateCommentRequest`, `VoteRequest`, `VoteResponse`.

- [ ] **Step 1: Write the add-comment route**

```ts
// src/app/api/feedback/[id]/comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { addComment, FeedbackError } from "@/modules/feedback/lib/feedback.server";
import type { CreateCommentRequest, CommentMutationResponse } from "@/modules/feedback/types";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json<CommentMutationResponse>({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as CreateCommentRequest;
    const comment = await addComment(user.uid, id, body?.content);
    return NextResponse.json<CommentMutationResponse>({ comment });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không gửi được bình luận.";
    return NextResponse.json<CommentMutationResponse>({ error: message }, { status });
  }
}
```

- [ ] **Step 2: Write the comment edit/moderate + delete route**

```ts
// src/app/api/feedback/[id]/comments/[cid]/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  resolveCaller,
  editCommentContent,
  moderateComment,
  softDeleteComment,
  FeedbackError,
} from "@/modules/feedback/lib/feedback.server";
import type { CommentMutationResponse, UpdateCommentRequest } from "@/modules/feedback/types";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; cid: string }> }) {
  const caller = await resolveCaller(req);
  if (!caller.uid) {
    return NextResponse.json<CommentMutationResponse>({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  try {
    const { id, cid } = await ctx.params;
    const body = (await req.json()) as UpdateCommentRequest;
    const comment =
      "action" in body
        ? await moderateComment(caller, id, cid, body.action)
        : await editCommentContent(caller, id, cid, body.content);
    return NextResponse.json<CommentMutationResponse>({ comment });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không cập nhật được bình luận.";
    return NextResponse.json<CommentMutationResponse>({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; cid: string }> }) {
  const caller = await resolveCaller(req);
  if (!caller.uid) {
    return NextResponse.json<CommentMutationResponse>({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  try {
    const { id, cid } = await ctx.params;
    const comment = await softDeleteComment(caller, id, cid);
    return NextResponse.json<CommentMutationResponse>({ comment });
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không xóa được bình luận.";
    return NextResponse.json<CommentMutationResponse>({ error: message }, { status });
  }
}
```

- [ ] **Step 3: Write the comment vote route**

```ts
// src/app/api/feedback/[id]/comments/[cid]/vote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { voteComment, FeedbackError } from "@/modules/feedback/lib/feedback.server";
import type { VoteRequest, VoteResponse } from "@/modules/feedback/types";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; cid: string }> }) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json<VoteResponse>(
      { upCount: 0, downCount: 0, score: 0, myVote: 0, error: "Chưa đăng nhập." },
      { status: 401 },
    );
  }
  try {
    const { id, cid } = await ctx.params;
    const body = (await req.json()) as VoteRequest;
    if (body?.value !== 1 && body?.value !== -1) {
      throw new FeedbackError(400, "Giá trị vote không hợp lệ.");
    }
    const result = await voteComment(user.uid, id, cid, body.value);
    return NextResponse.json<VoteResponse>(result);
  } catch (err) {
    const status = err instanceof FeedbackError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Không vote được.";
    return NextResponse.json<VoteResponse>(
      { upCount: 0, downCount: 0, score: 0, myVote: 0, error: message },
      { status },
    );
  }
}
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run build` → compiles; all `/api/feedback/...` routes listed.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/feedback/[id]/comments"
git commit -m "feat(feedback): add comment create/edit/moderate/delete/vote routes"
```

---

### Task 8: Client — feed, composer, post cards, votes, page, nav link

**Files:**
- Create: `src/modules/feedback/components/client.ts`
- Create: `src/modules/feedback/components/VoteButtons.tsx`
- Create: `src/modules/feedback/components/Composer.tsx`
- Create: `src/modules/feedback/components/PostCard.tsx`
- Create: `src/modules/feedback/components/FeedbackFeed.tsx`
- Create: `src/app/feedback/page.tsx`
- Modify: `src/components/SiteNav.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `useAuth` (`@/modules/auth/AuthProvider`), `auth` (`@/lib/firebase/client`), all DTO types.
- Produces: `feedbackGet`, `feedbackSend` helpers; `<VoteButtons>`, `<Composer>`, `<PostCard>`, `<FeedbackFeed>`. `PostCard` renders `<CommentList>` (added in Task 9) via a lazy child; in this task `PostCard` shows a "Bình luận (n)" toggle button that is wired to a no-op placeholder that Task 9 replaces.

- [ ] **Step 1: Write the client fetch helper**

```ts
// src/modules/feedback/components/client.ts
"use client";
/**
 * Client fetch helpers for the feedback feature.
 *  - feedbackGet: public GET that ATTACHES the token when signed in (so the
 *    server can compute `mine`/`myVote` and reveal authors for privileged users),
 *    but never throws when signed out.
 *  - feedbackSend: authed mutation; throws when signed out so callers can prompt.
 */
import { auth } from "@/lib/firebase/client";

export async function feedbackGet(url: string): Promise<Response> {
  const headers = new Headers();
  const user = auth.currentUser;
  if (user) headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  return fetch(url, { headers });
}

export async function feedbackSend(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error("Bạn cần đăng nhập để dùng tính năng này.");
  const headers = new Headers({ Authorization: `Bearer ${await user.getIdToken()}` });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}
```

- [ ] **Step 2: Write VoteButtons**

```tsx
// src/modules/feedback/components/VoteButtons.tsx
"use client";
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
        aria-label="Up"
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
        aria-label="Down"
        aria-pressed={myVote === -1}
        disabled={disabled}
        onClick={() => onVote(-1)}
      >
        <ChevronDown size={18} strokeWidth={2.4} />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Write Composer**

```tsx
// src/modules/feedback/components/Composer.tsx
"use client";
import { useState } from "react";
import { Send } from "lucide-react";
import { MAX_POST_LEN } from "@/modules/feedback/types";

/** Text box for creating a post. `onSubmit` returns a rejected promise on failure. */
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
      <textarea
        className="fb-textarea"
        placeholder="Chia sẻ góp ý của bạn…"
        value={content}
        maxLength={MAX_POST_LEN}
        rows={3}
        onChange={(e) => setContent(e.target.value)}
      />
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
```

- [ ] **Step 4: Write PostCard**

```tsx
// src/modules/feedback/components/PostCard.tsx
"use client";
import { useState } from "react";
import { MessageSquare, Pencil, Trash2, BadgeCheck, Eye, RotateCcw, User } from "lucide-react";
import { useAuth } from "@/modules/auth/AuthProvider";
import { VoteButtons } from "./VoteButtons";
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
  }

  async function remove() {
    if (!confirm("Xóa bài này?")) return;
    const res = await feedbackSend(`/api/feedback/${post.id}`, "DELETE");
    const data = await res.json();
    if (res.ok && data.post) onChanged(data.post);
  }

  async function saveEdit() {
    const res = await feedbackSend(`/api/feedback/${post.id}`, "PATCH", { content: draft.trim() });
    const data = await res.json();
    if (res.ok && data.post) {
      onChanged(data.post);
      setEditing(false);
    }
  }

  return (
    <article className={`fb-card ${post.deleted ? "fb-deleted" : ""}`}>
      <div className="fb-card-main">
        <VoteButtons score={post.score} myVote={post.myVote} onVote={vote} />
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

          {showComments ? <div className="fb-comments-slot" data-post-id={post.id} /> : null}
        </div>
      </div>
    </article>
  );
}
```

> In Task 9, replace the `fb-comments-slot` placeholder with `<CommentList postId={post.id} onCountChange={(n) => onChanged({ ...post, commentCount: n })} />`.

- [ ] **Step 5: Write FeedbackFeed**

```tsx
// src/modules/feedback/components/FeedbackFeed.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/modules/auth/AuthProvider";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import { feedbackGet, feedbackSend } from "./client";
import type { ListPostsResponse, PostDto, SortOrder } from "@/modules/feedback/types";

export function FeedbackFeed() {
  const { user, loading } = useAuth();
  const [posts, setPosts] = useState<PostDto[]>([]);
  const [sort, setSort] = useState<SortOrder>("new");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextSort: SortOrder, nextCursor: string | null) => {
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams({ sort: nextSort });
        if (nextCursor) params.set("cursor", nextCursor);
        const res = await feedbackGet(`/api/feedback?${params.toString()}`);
        const data = (await res.json()) as ListPostsResponse;
        if (!res.ok) throw new Error(data.error ?? "Không tải được góp ý.");
        setPosts((prev) => (nextCursor ? [...prev, ...data.posts] : data.posts));
        setCursor(data.nextCursor);
        setHasMore(data.nextCursor !== null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không tải được góp ý.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  // Reload from scratch when the sort changes or auth finishes resolving (so the
  // token is attached and `mine`/`myVote`/author fields are correct).
  useEffect(() => {
    if (loading) return;
    void load(sort, null);
  }, [sort, loading, user, load]);

  async function createPost(content: string) {
    const res = await feedbackSend("/api/feedback", "POST", { content });
    const data = await res.json();
    if (!res.ok || !data.post) throw new Error(data.error ?? "Không đăng được bài.");
    setPosts((prev) => [data.post as PostDto, ...prev]);
  }

  function onChanged(updated: PostDto) {
    // Managers keep seeing hidden posts (dimmed); regular users drop them.
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  return (
    <div className="fb-feed">
      {loading ? null : user ? (
        <Composer onSubmit={createPost} />
      ) : (
        <div className="fb-signin-hint">
          <p>Đăng nhập để đăng bài, bình luận và vote.</p>
          <Link href="/login" className="btn primary">
            Đăng nhập
          </Link>
        </div>
      )}

      <div className="fb-sortbar">
        <button type="button" className={`fb-sort ${sort === "new" ? "active" : ""}`} onClick={() => setSort("new")}>
          Mới nhất
        </button>
        <button type="button" className={`fb-sort ${sort === "top" ? "active" : ""}`} onClick={() => setSort("top")}>
          Nổi bật
        </button>
      </div>

      {error ? <p className="fb-error">{error}</p> : null}

      <div className="fb-list">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onChanged={onChanged} onVoteError={setError} />
        ))}
        {posts.length === 0 && !busy ? <p className="fb-empty">Chưa có góp ý nào.</p> : null}
      </div>

      {hasMore ? (
        <button type="button" className="btn fb-more" disabled={busy} onClick={() => load(sort, cursor)}>
          {busy ? "Đang tải…" : "Xem thêm"}
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Write the page**

```tsx
// src/app/feedback/page.tsx
import type { Metadata } from "next";
import { SiteNav } from "@/components/SiteNav";
import { FeedbackFeed } from "@/modules/feedback/components/FeedbackFeed";

export const metadata: Metadata = {
  title: "Góp ý",
  description: "Chia sẻ góp ý, đề xuất và bình luận. Ai cũng xem được; đăng nhập để tham gia.",
};

export default function FeedbackPage() {
  return (
    <>
      <SiteNav back={{ href: "/", label: "Trang chủ" }} title="Góp ý" />
      <main className="page">
        <div className="container">
          <FeedbackFeed />
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 7: Add the nav link**

In `src/components/SiteNav.tsx`, add a `Link` to `/feedback` inside `nav-actions` (before `<AuthMenu />`). New import at top: `import Link from "next/link";` already present. Update `nav-actions` block to:

```tsx
<div className="nav-actions">
  <Link href="/feedback" className="nav-link">
    Góp ý
  </Link>
  <AuthMenu />
  <ThemeToggle />
</div>
```

- [ ] **Step 8: Add styles**

Append to `src/app/globals.css`:

```css
/* ---- Feedback feature ---- */
.nav-link {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fg, inherit);
  text-decoration: none;
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
}
.nav-link:hover { background: rgba(127, 127, 127, 0.12); }

.fb-feed { display: flex; flex-direction: column; gap: 1rem; }
.fb-composer, .fb-signin-hint, .fb-card {
  border: 1px solid rgba(127, 127, 127, 0.22);
  border-radius: 14px;
  padding: 1rem;
  background: rgba(127, 127, 127, 0.04);
}
.fb-textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid rgba(127, 127, 127, 0.28);
  border-radius: 10px;
  padding: 0.6rem 0.75rem;
  font: inherit;
  background: transparent;
  color: inherit;
}
.fb-composer-actions, .fb-edit-actions { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-top: 0.5rem; }
.fb-edit-actions { justify-content: flex-end; }
.fb-count { font-size: 0.78rem; opacity: 0.6; }
.fb-sortbar { display: flex; gap: 0.4rem; }
.fb-sort {
  border: 1px solid rgba(127, 127, 127, 0.22);
  background: transparent; color: inherit;
  padding: 0.3rem 0.8rem; border-radius: 999px; cursor: pointer; font-size: 0.85rem;
}
.fb-sort.active { background: var(--accent, #4f46e5); color: #fff; border-color: transparent; }
.fb-list { display: flex; flex-direction: column; gap: 0.75rem; }
.fb-card-main { display: flex; gap: 0.75rem; }
.fb-card-body { flex: 1; min-width: 0; }
.fb-votes { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; }
.fb-vote { border: none; background: transparent; color: inherit; cursor: pointer; border-radius: 8px; padding: 0.15rem; opacity: 0.7; }
.fb-vote:hover:not(:disabled) { opacity: 1; background: rgba(127, 127, 127, 0.12); }
.fb-vote.active.up { color: #16a34a; opacity: 1; }
.fb-vote.active.down { color: #dc2626; opacity: 1; }
.fb-vote:disabled { cursor: default; opacity: 0.4; }
.fb-score { font-weight: 700; font-size: 0.9rem; }
.fb-card-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; font-size: 0.8rem; }
.fb-anon { display: inline-flex; align-items: center; gap: 0.25rem; opacity: 0.65; }
.fb-badge { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.72rem; padding: 0.1rem 0.45rem; border-radius: 999px; }
.fb-badge.approved { background: rgba(22, 163, 74, 0.15); color: #16a34a; }
.fb-badge.deleted { background: rgba(220, 38, 38, 0.12); color: #dc2626; }
.fb-author { margin-left: auto; font-size: 0.75rem; opacity: 0.7; }
.fb-content { white-space: pre-wrap; word-break: break-word; margin: 0.2rem 0 0.5rem; }
.fb-card-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.fb-link { display: inline-flex; align-items: center; gap: 0.3rem; border: none; background: transparent; color: inherit; cursor: pointer; font-size: 0.82rem; opacity: 0.75; padding: 0; }
.fb-link:hover { opacity: 1; }
.fb-link.danger:hover { color: #dc2626; }
.fb-deleted { opacity: 0.55; }
.fb-error { color: #dc2626; font-size: 0.85rem; }
.fb-empty { opacity: 0.6; text-align: center; padding: 1.5rem 0; }
.fb-more { align-self: center; }
.fb-signin-hint { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
```

> Uses existing utility classes `btn`, `primary`, `page`, `container` from the current stylesheet. If `--accent`/`--fg` are not defined project-wide, the fallbacks in the declarations apply.

- [ ] **Step 9: Type-check, lint, build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run lint` → no new errors.
Run: `npm run build` → compiles; `/feedback` route present.

- [ ] **Step 10: Commit**

```bash
git add src/modules/feedback/components src/app/feedback src/components/SiteNav.tsx src/app/globals.css
git commit -m "feat(feedback): add feed UI, composer, post cards, votes, page, nav link"
```

---

### Task 9: Client — comments UI

**Files:**
- Create: `src/modules/feedback/components/CommentList.tsx`
- Modify: `src/modules/feedback/components/PostCard.tsx` (replace the `fb-comments-slot` placeholder)
- Modify: `src/app/globals.css` (comment styles)

**Interfaces:**
- Consumes: `useAuth`, `feedbackGet`, `feedbackSend`, `VoteButtons`, DTO types `PostDetailResponse`, `CommentDto`, `VoteValue`, `MAX_COMMENT_LEN`.
- Produces: `<CommentList postId, onCountChange>`.

- [ ] **Step 1: Write CommentList**

```tsx
// src/modules/feedback/components/CommentList.tsx
"use client";
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
  }

  async function remove(c: CommentDto) {
    if (!confirm("Xóa bình luận này?")) return;
    const res = await feedbackSend(`/api/feedback/${postId}/comments/${c.id}`, "DELETE");
    const data = await res.json();
    if (res.ok && data.comment) replace(data.comment);
  }

  async function saveEdit(c: CommentDto) {
    const res = await feedbackSend(`/api/feedback/${postId}/comments/${c.id}`, "PATCH", { content: editDraft.trim() });
    const data = await res.json();
    if (res.ok && data.comment) {
      replace(data.comment);
      setEditingId(null);
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
```

- [ ] **Step 2: Wire CommentList into PostCard**

In `src/modules/feedback/components/PostCard.tsx`:
- Add import: `import { CommentList } from "./CommentList";`
- Replace the placeholder line
  `{showComments ? <div className="fb-comments-slot" data-post-id={post.id} /> : null}`
  with:
  `{showComments ? <CommentList postId={post.id} onCountChange={(n) => onChanged({ ...post, commentCount: n })} /> : null}`

- [ ] **Step 3: Add comment styles**

Append to `src/app/globals.css`:

```css
.fb-comments { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(127, 127, 127, 0.18); display: flex; flex-direction: column; gap: 0.6rem; }
.fb-comment { display: flex; gap: 0.6rem; }
.fb-comment-body { flex: 1; min-width: 0; }
.fb-comment-add { display: flex; flex-direction: column; gap: 0.35rem; }
```

- [ ] **Step 4: Type-check, lint, build**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run lint` → no new errors.
Run: `npm run build` → compiles.

- [ ] **Step 5: Commit**

```bash
git add src/modules/feedback/components/CommentList.tsx src/modules/feedback/components/PostCard.tsx src/app/globals.css
git commit -m "feat(feedback): add comments UI (list, add, vote, edit, delete, moderate)"
```

---

### Task 10: Manual smoke test (integration verification)

**Files:** none (verification only).

This feature can't be unit-tested end-to-end without live Firebase + auth, so verify against a running dev server with real accounts.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open `http://localhost:3000/feedback`.

- [ ] **Step 2: Guest (signed out) checks**
- Nav shows "Góp ý"; page loads without login.
- Composer is hidden; a "Đăng nhập để…" hint shows instead.
- Vote buttons are disabled; clicking shows the login hint (no crash).
- No author identity is shown anywhere.

- [ ] **Step 3: Signed-in user (role "user") checks**
- Post a message → it appears at the top immediately.
- Up then Down then Down again on your post: score goes +1 → -1 → 0, highlight toggles correctly (verifies `computeVoteDelta` end-to-end).
- Add a comment → count increments; comment appears.
- Edit and delete your own post and comment → "Đã ẩn" / removal behaves; another regular user no longer sees the deleted item (open a second browser/incognito with a different account or signed out to confirm it's gone).
- Confirm you do NOT see any author identity.

- [ ] **Step 4: Manager/admin checks**
- Sign in as a manager/admin (an `ADMIN_EMAILS` account, or promote via the admin panel).
- Author identity chip is visible on posts and comments.
- "Duyệt" adds the "Đã duyệt" badge; "Bỏ duyệt" removes it.
- "Ẩn" then "Khôi phục" on someone else's post works; hidden posts show dimmed (not gone) for the manager.
- Sort "Nổi bật" orders by score (requires the deployed index — if it errors, deploy `firestore:indexes` first).

- [ ] **Step 5: Record results**

Note any failures with the exact console/network error. If all pass, the feature is verified. Do not claim completion without having observed these behaviors.

---

## Self-Review Notes (author checklist — already reconciled)

- **Spec coverage:** public read (Task 5/8 guest path), signed-in post/comment/vote (Tasks 6/7/8/9), one-vote-per-item (`votes/{uid}` + transaction, Task 4/6/7), manager approve + soft-delete posts & comments (Task 4/6/7 + UI 8/9), anonymous UI with server-side identity + privileged reveal (Task 3/4 + UI 8/9), nav entry for everyone (Task 8), content-only posts (Task 1/8), author edit/delete own (Task 4/6/7 + UI), votes on comments too (Task 4/7/9), Cách-A data model (Task 4). All covered.
- **Type consistency:** `computeVoteDelta(MyVote, VoteValue)`, `Caller {uid,role}`, `VoteResult`, and DTO field names (`upCount/downCount/score/myVote/mine/author/deleted/approved`) are used identically across server layer, routes, and components.
- **Placeholders:** the only intentional placeholder (`fb-comments-slot`) is explicitly replaced in Task 9 Step 2.
- **Indexes/rules:** "new" sort needs no composite index; "top" sort's index is added in Task 5. `firestore.rules` default-deny already protects `feedbackPosts` (server-only access) — no rules change.
```
