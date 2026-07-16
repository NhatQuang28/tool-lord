import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";
import {
  combineKeys,
  decryptMessage,
  encryptMessage,
} from "@/modules/message-cipher/lib/cipher";
import type {
  CipherRequest,
  CipherResponse,
} from "@/modules/message-cipher/types";

// The web's own secret key lives only on the server. No hardcoded fallback: a
// committed default would silently weaken every ciphertext in production if the
// env var were ever missing, so we fail loudly instead (checked per request).
const WEB_SECRET_KEY = process.env.WEB_SECRET_KEY;

// Cap input size so this unauthenticated, CPU-bound endpoint can't be abused
// with huge payloads.
const MAX_TEXT_LEN = 20_000;

export async function POST(req: NextRequest) {
  // Unauthenticated + does per-byte crypto work → throttle by IP.
  if (!(await checkRateLimit("message-cipher", clientIp(req), 60, "1 m"))) {
    return tooManyRequests();
  }

  if (!WEB_SECRET_KEY) {
    return NextResponse.json<CipherResponse>(
      { result: "", error: "Máy chủ chưa được cấu hình khóa bí mật." },
      { status: 500 },
    );
  }

  let body: CipherRequest;
  try {
    body = (await req.json()) as CipherRequest;
  } catch {
    return NextResponse.json<CipherResponse>(
      { result: "", error: "Body không phải JSON hợp lệ." },
      { status: 400 },
    );
  }

  const { mode, text, userKey, styleId } = body ?? {};

  if (mode !== "encrypt" && mode !== "decrypt") {
    return NextResponse.json<CipherResponse>(
      { result: "", error: "mode phải là 'encrypt' hoặc 'decrypt'." },
      { status: 400 },
    );
  }
  if (typeof text !== "string" || typeof styleId !== "string") {
    return NextResponse.json<CipherResponse>(
      { result: "", error: "Thiếu 'text' hoặc 'styleId'." },
      { status: 400 },
    );
  }
  if (text.length > MAX_TEXT_LEN) {
    return NextResponse.json<CipherResponse>(
      { result: "", error: `Nội dung tối đa ${MAX_TEXT_LEN.toLocaleString("vi-VN")} ký tự.` },
      { status: 400 },
    );
  }

  const combined = combineKeys(WEB_SECRET_KEY, userKey ?? "");

  try {
    const result =
      mode === "encrypt"
        ? encryptMessage(text, combined, styleId)
        : decryptMessage(text, combined, styleId);
    return NextResponse.json<CipherResponse>({ result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Lỗi xử lý không xác định.";
    return NextResponse.json<CipherResponse>(
      { result: "", error: message },
      { status: 422 },
    );
  }
}
