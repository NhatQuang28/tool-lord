import { NextRequest, NextResponse } from "next/server";
import {
  combineKeys,
  decryptMessage,
  encryptMessage,
} from "@/modules/message-cipher/lib/cipher";
import type {
  CipherRequest,
  CipherResponse,
} from "@/modules/message-cipher/types";

// The web's own secret key lives only on the server.
const WEB_SECRET_KEY = process.env.WEB_SECRET_KEY ?? "tool-lord-fallback-secret";

export async function POST(req: NextRequest) {
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
