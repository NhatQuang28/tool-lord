// src/modules/feedback/lib/feedback.server.ts
import "server-only";
import type { NextRequest } from "next/server";
import {
  Timestamp,
  type DocumentData,
  type Query,
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
    const postSnap = await tx.get(postRef); // READ first
    const current = Number(postSnap.get("commentCount") ?? 0);
    tx.set(commentRef, {
      // WRITES after
      authorUid: uid,
      content: clean,
      status: "visible",
      upCount: 0,
      downCount: 0,
      score: 0,
      createdAt: Timestamp.now(),
    });
    tx.update(postRef, { commentCount: current + 1 });
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
