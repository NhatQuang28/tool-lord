/**
 * Cloudflare R2 access via the S3-compatible API (server-side only).
 *
 * R2 credentials are server-only secrets; the browser never sees them. Instead
 * the server hands out short-lived *presigned* URLs so the client can PUT/GET
 * encrypted blobs directly to/from R2 — no image bytes flow through this app's
 * own server, and R2 only ever stores ciphertext.
 */
import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BLOB_CONTENT_TYPE } from "@/modules/secret-image/lib/shareCode";

/** How long presigned URLs stay valid (seconds). */
const UPLOAD_TTL = 600; // 10 min — a few large images over a slow link.
const DOWNLOAD_TTL = 600;

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Thiếu cấu hình R2 (${name}). Xem hướng dẫn trong .env.example.`,
    );
  }
  return value;
}

// Lazily built so a missing env var only errors when the tool is actually used,
// not at import time for the whole app.
let client: S3Client | null = null;
function r2(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: "auto",
    endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    },
    // Recent AWS SDK versions add a default CRC32 checksum to every request.
    // For a browser-uploaded presigned PUT that injects `x-amz-checksum-crc32`
    // / `x-amz-sdk-checksum-algorithm` into the URL with a checksum of an EMPTY
    // body — R2 then rejects the real upload. Disable it so presigned URLs stay
    // clean and the browser PUT succeeds.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

export function bucket(): string {
  return env("R2_BUCKET");
}

/**
 * Presigned PUT URL for uploading one encrypted blob to `objectKey`.
 *
 * `contentLength` is BAKED INTO THE SIGNATURE: the browser's PUT must send a
 * body of exactly this many bytes or R2 rejects it with a signature mismatch.
 * This is what stops a client from declaring a tiny `size` to pass the server's
 * size/quota checks and then uploading an arbitrarily large blob (storage/cost
 * abuse). The client always reports the exact ciphertext byte length, so
 * legitimate uploads match precisely.
 */
export function presignPut(objectKey: string, contentLength: number): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: bucket(),
    Key: objectKey,
    ContentType: BLOB_CONTENT_TYPE,
    ContentLength: contentLength,
  });
  return getSignedUrl(r2(), cmd, { expiresIn: UPLOAD_TTL });
}

/** Presigned GET URL for downloading one encrypted blob. */
export function presignGet(objectKey: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket(), Key: objectKey });
  return getSignedUrl(r2(), cmd, { expiresIn: DOWNLOAD_TTL });
}

/**
 * Storage cap in bytes, from `R2_MAX_STORAGE_GB`. Returns `null` when the var
 * is unset/empty/invalid — meaning the feature is OFF (no limit). Set e.g.
 * `R2_MAX_STORAGE_GB=10` to stop all new uploads once the bucket hits 10 GB.
 */
export function storageLimitBytes(): number | null {
  const raw = process.env.R2_MAX_STORAGE_GB?.trim();
  if (!raw) return null;
  const gb = Number(raw);
  if (!Number.isFinite(gb) || gb <= 0) return null;
  return Math.floor(gb * 1024 * 1024 * 1024);
}

/** Total bytes currently stored in the bucket (sums all objects, paginated). */
export async function getBucketUsageBytes(): Promise<number> {
  let total = 0;
  let token: string | undefined;
  do {
    const res = await r2().send(
      new ListObjectsV2Command({ Bucket: bucket(), ContinuationToken: token }),
    );
    for (const obj of res.Contents ?? []) total += obj.Size ?? 0;
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return total;
}
