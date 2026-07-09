import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { presignGet } from "@/lib/r2";
import type { ViewFile, ViewShareResponse } from "@/modules/secret-image/types";

interface StoredFile {
  objectKey: string;
  imageIv: string;
  metaCipher: string;
  metaIv: string;
  size: number;
}

/**
 * Return a folder's ENCRYPTED manifest plus presigned GET URLs.
 *
 * Intentionally public: per the product decision, anyone holding the share
 * code can view. This is safe because the response contains only ciphertext
 * and IVs — the decryption key travels in the URL fragment and never reaches
 * this endpoint, so a bare id (without the key) yields nothing readable. Ids
 * are 128-bit random, so they can't be enumerated.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const snap = await getAdminDb().collection("imageShares").doc(id).get();
  if (!snap.exists) {
    return NextResponse.json<ViewShareResponse>(
      { files: [], error: "Không tìm thấy album này (mã sai hoặc đã bị xóa)." },
      { status: 404 },
    );
  }

  const stored = (snap.get("files") as StoredFile[] | undefined) ?? [];

  let files: ViewFile[];
  try {
    files = await Promise.all(
      stored.map(async (f) => ({
        imageIv: f.imageIv,
        metaCipher: f.metaCipher,
        metaIv: f.metaIv,
        url: await presignGet(f.objectKey),
      })),
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Không tạo được link tải ảnh.";
    return NextResponse.json<ViewShareResponse>(
      { files: [], error: message },
      { status: 500 },
    );
  }

  return NextResponse.json<ViewShareResponse>({ files });
}
