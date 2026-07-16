import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireUser } from "@/lib/auth/requireUser";
import { checkRateLimit, tooManyRequests } from "@/lib/rateLimit";
import { adminDb } from "@/lib/firebase/admin";
import {
  presignPut,
  storageLimitBytes,
  getBucketUsageBytes,
} from "@/lib/r2";
import type {
  CreateFileInput,
  CreateShareRequest,
  CreateShareResponse,
  UploadTarget,
} from "@/modules/secret-image/types";

// Guardrails. Sizes are of the ENCRYPTED blob (~ original + 16-byte GCM tag).
const MAX_FILES = 30;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB / file
const MAX_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MB / folder

/** Unguessable share id: 16 random bytes, URL-safe base64 (no padding). */
function newShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isValidFile(f: unknown): f is CreateFileInput {
  if (!f || typeof f !== "object") return false;
  const o = f as Record<string, unknown>;
  return (
    typeof o.imageIv === "string" &&
    typeof o.metaCipher === "string" &&
    typeof o.metaIv === "string" &&
    typeof o.size === "number" &&
    o.size >= 0
  );
}

export async function POST(req: NextRequest) {
  // 1. Only signed-in users may create shares.
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json<CreateShareResponse>(
      { id: "", uploads: [], error: "Chưa đăng nhập." },
      { status: 401 },
    );
  }

  // 1b. Throttle share creation per user (each call presigns URLs + a bucket
  // usage scan, so it's relatively expensive).
  if (!(await checkRateLimit("secret-image-create", user.uid, 10, "1 m"))) {
    return tooManyRequests();
  }

  // 2. Parse + validate the (secret-free) metadata payload.
  let body: CreateShareRequest;
  try {
    body = (await req.json()) as CreateShareRequest;
  } catch {
    return NextResponse.json<CreateShareResponse>(
      { id: "", uploads: [], error: "Body không phải JSON hợp lệ." },
      { status: 400 },
    );
  }

  const files = body?.files;
  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json<CreateShareResponse>(
      { id: "", uploads: [], error: "Chưa có ảnh nào để tải lên." },
      { status: 400 },
    );
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json<CreateShareResponse>(
      { id: "", uploads: [], error: `Tối đa ${MAX_FILES} ảnh mỗi lần.` },
      { status: 400 },
    );
  }
  if (!files.every(isValidFile)) {
    return NextResponse.json<CreateShareResponse>(
      { id: "", uploads: [], error: "Dữ liệu ảnh không hợp lệ." },
      { status: 400 },
    );
  }
  let total = 0;
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json<CreateShareResponse>(
        { id: "", uploads: [], error: "Có ảnh vượt quá 25MB." },
        { status: 400 },
      );
    }
    total += f.size;
  }
  if (total > MAX_TOTAL_BYTES) {
    return NextResponse.json<CreateShareResponse>(
      { id: "", uploads: [], error: "Tổng dung lượng vượt quá 100MB." },
      { status: 400 },
    );
  }

  // 2b. Global storage cap: once the bucket reaches R2_MAX_STORAGE_GB, refuse
  // every new upload. Skipped entirely when the var is unset (feature off).
  const limit = storageLimitBytes();
  if (limit !== null) {
    let usage: number;
    try {
      usage = await getBucketUsageBytes();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Không kiểm tra được dung lượng kho lưu trữ.";
      return NextResponse.json<CreateShareResponse>(
        { id: "", uploads: [], error: message },
        { status: 500 },
      );
    }
    if (usage + total > limit) {
      const gb = (limit / (1024 * 1024 * 1024)).toFixed(0);
      return NextResponse.json<CreateShareResponse>(
        {
          id: "",
          uploads: [],
          error: `Kho lưu trữ đã đầy (đạt giới hạn ${gb}GB). Tạm thời không thể tải thêm ảnh.`,
        },
        { status: 507 },
      );
    }
  }

  // 3. Allocate object keys and presign an upload URL per file.
  const id = newShareId();
  const storedFiles = files.map((f, i) => ({
    objectKey: `${id}/${i}`,
    imageIv: f.imageIv,
    metaCipher: f.metaCipher,
    metaIv: f.metaIv,
    size: f.size,
  }));

  let uploads: UploadTarget[];
  try {
    uploads = await Promise.all(
      storedFiles.map(async (f) => ({
        objectKey: f.objectKey,
        // Bind the exact declared size into the presigned URL so the actual
        // upload can't exceed the size we validated above (see presignPut).
        url: await presignPut(f.objectKey, f.size),
      })),
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Không tạo được link tải lên.";
    return NextResponse.json<CreateShareResponse>(
      { id: "", uploads: [], error: message },
      { status: 500 },
    );
  }

  // 4. Persist the folder manifest. NOTE: the decryption key is never sent
  // here — it stays in the browser — so this document is useless without it.
  // The client uploads the blobs to the presigned URLs after this returns; a
  // failed upload leaves an orphan manifest, which is harmless (nothing to
  // decrypt) and can be swept later by object lifecycle rules.
  try {
    await adminDb
      .collection("imageShares")
      .doc(id)
      .set({
        ownerUid: user.uid,
        createdAt: FieldValue.serverTimestamp(),
        files: storedFiles,
      });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Không lưu được album.";
    return NextResponse.json<CreateShareResponse>(
      { id: "", uploads: [], error: message },
      { status: 500 },
    );
  }

  return NextResponse.json<CreateShareResponse>({ id, uploads });
}
