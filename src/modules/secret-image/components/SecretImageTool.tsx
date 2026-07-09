"use client";

/**
 * Upload side of the secret-image tool + a "open by code" box.
 *
 * The whole flow keeps the decryption key on the client:
 *   1. generate one AES key for the folder,
 *   2. encrypt every image (and its name/type) in the browser,
 *   3. ask the server for presigned PUT URLs (sending only ciphertext meta),
 *   4. upload the encrypted blobs straight to R2,
 *   5. build the share code = <id>.<key> — the key half never touched a server.
 */
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Lock,
  LogIn,
  Trash2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/modules/auth/AuthProvider";
import { authedFetch } from "@/lib/auth/authedFetch";
import {
  encryptBytes,
  encryptMeta,
  exportKey,
  generateKey,
} from "../lib/crypto";
import { BLOB_CONTENT_TYPE, encodeShareCode, decodeShareCode } from "../lib/shareCode";
import type { CreateShareResponse } from "../types";

interface Picked {
  file: File;
  id: string;
}

interface ShareResult {
  code: string;
  url: string;
}

/** Human-friendly byte size, Vietnamese decimal comma (e.g. "1,2 MB"). */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const digits = value >= 100 ? 0 : 1;
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: digits })} ${units[i]}`;
}

export function SecretImageTool() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [picked, setPicked] = useState<Picked[]>([]);
  const [phase, setPhase] = useState<"idle" | "working" | "done">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [result, setResult] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState<"code" | "url" | null>(null);
  const [dragging, setDragging] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    setPicked((prev) => [
      ...prev,
      ...images.map((file) => ({ file, id: crypto.randomUUID() })),
    ]);
    setError("");
  }, []);

  const removeAt = (index: number) => {
    setPicked((prev) => prev.filter((_, i) => i !== index));
  };

  const reset = () => {
    setPicked([]);
    setResult(null);
    setPhase("idle");
    setProgress({ done: 0, total: 0 });
    setError("");
  };

  const totalBytes = picked.reduce((sum, p) => sum + p.file.size, 0);

  const upload = async () => {
    if (picked.length === 0) return;
    setPhase("working");
    setError("");
    setProgress({ done: 0, total: picked.length });

    try {
      // 1. One key for the whole folder.
      const key = await generateKey();

      // 2. Encrypt every image + its metadata, in the browser.
      const encrypted = await Promise.all(
        picked.map(async ({ file }) => {
          const buf = await file.arrayBuffer();
          const { cipher, ivB64 } = await encryptBytes(key, buf);
          const { metaCipher, metaIv } = await encryptMeta(key, {
            name: file.name,
            type: file.type,
          });
          return {
            cipher,
            imageIv: ivB64,
            metaCipher,
            metaIv,
            size: cipher.byteLength,
          };
        }),
      );

      // 3. Ask the server for upload targets (no plaintext, no key).
      const res = await authedFetch("/api/tools/secret-image/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: encrypted.map((e) => ({
            imageIv: e.imageIv,
            metaCipher: e.metaCipher,
            metaIv: e.metaIv,
            size: e.size,
          })),
        }),
      });
      // The server always answers with JSON; if we get something else (e.g. an
      // HTML error page from a crashed route or a proxy), surface a readable
      // message instead of a cryptic "Unexpected token '<'" JSON parse error.
      let data: CreateShareResponse;
      try {
        data = (await res.json()) as CreateShareResponse;
      } catch {
        throw new Error(
          `Máy chủ trả về phản hồi không hợp lệ (HTTP ${res.status}). Vui lòng thử lại sau.`,
        );
      }
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không tạo được album.");
      }

      // 4. Upload each encrypted blob straight to R2.
      for (let i = 0; i < data.uploads.length; i++) {
        const put = await fetch(data.uploads[i].url, {
          method: "PUT",
          headers: { "Content-Type": BLOB_CONTENT_TYPE },
          body: encrypted[i].cipher,
        });
        if (!put.ok) {
          throw new Error(
            "Tải ảnh lên thất bại. Kiểm tra cấu hình CORS của bucket R2.",
          );
        }
        setProgress({ done: i + 1, total: data.uploads.length });
      }

      // 5. Build the share code + deep link. The key lives only here + in these.
      const keyB64 = await exportKey(key);
      const code = encodeShareCode(data.id, keyB64);
      const url = `${window.location.origin}/tools/secret-image/v/${data.id}#${keyB64}`;
      setResult({ code, url });
      setPhase("done");
    } catch (err) {
      setError((err as Error)?.message || "Có lỗi khi tải lên.");
      setPhase("idle");
    }
  };

  const copy = async (what: "code" | "url") => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(
        what === "code" ? result.code : result.url,
      );
      setCopied(what);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard may be blocked */
    }
  };

  const openByCode = () => {
    const parsed = decodeShareCode(codeInput);
    if (!parsed) {
      setCodeError("Mã không hợp lệ. Dán đúng mã chia sẻ hoặc link đầy đủ.");
      return;
    }
    setCodeError("");
    router.push(
      `/tools/secret-image/v/${encodeURIComponent(parsed.id)}#${parsed.keyB64url}`,
    );
  };

  // --- auth gate -----------------------------------------------------------
  if (loading) {
    return (
      <div className="panel si-center">
        <Loader2 className="spin" size={22} strokeWidth={2.2} />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="panel si-center">
        <span className="icon-tile" aria-hidden>
          <Lock size={24} strokeWidth={2} />
        </span>
        <h2 className="si-h2">Cần đăng nhập</h2>
        <p style={{ color: "var(--text-secondary)", margin: 0, textAlign: "center" }}>
          Công cụ chia sẻ ảnh bí mật chỉ dùng được khi bạn đã đăng nhập.
        </p>
        <a href="/login" className="btn primary" style={{ marginTop: 8 }}>
          <LogIn size={17} strokeWidth={2.2} /> Đăng nhập
        </a>
      </div>
    );
  }

  // --- result screen -------------------------------------------------------
  if (phase === "done" && result) {
    return (
      <div className="panel">
        <div className="si-center" style={{ paddingBottom: 8 }}>
          <span className="icon-tile" aria-hidden>
            <Check size={24} strokeWidth={2.4} />
          </span>
          <h2 className="si-h2">Đã tạo album bí mật!</h2>
          <p style={{ color: "var(--text-secondary)", margin: 0, textAlign: "center" }}>
            Chia sẻ mã hoặc link dưới đây. Bất kỳ ai có nó đều xem được — hãy giữ
            cẩn thận, vì khóa giải mã nằm ngay trong đó.
          </p>
        </div>

        <div className="field">
          <label className="field-label">Link chia sẻ</label>
          <div className="key-row">
            <input type="text" value={result.url} readOnly spellCheck={false} />
            <button type="button" className="btn small" onClick={() => copy("url")}>
              {copied === "url" ? (
                <>
                  <Check size={16} strokeWidth={2.4} /> Đã chép
                </>
              ) : (
                <>
                  <Copy size={16} strokeWidth={2.2} /> Chép
                </>
              )}
            </button>
          </div>
        </div>

        <div className="field">
          <label className="field-label">Mã chia sẻ (nhập ở ô "Mở album")</label>
          <div className="key-row">
            <input type="text" value={result.code} readOnly spellCheck={false} />
            <button type="button" className="btn small" onClick={() => copy("code")}>
              {copied === "code" ? (
                <>
                  <Check size={16} strokeWidth={2.4} /> Đã chép
                </>
              ) : (
                <>
                  <Copy size={16} strokeWidth={2.2} /> Chép
                </>
              )}
            </button>
          </div>
          <p className="hint">
            Khóa giải mã (phần sau dấu <strong>#</strong> / dấu <strong>.</strong>)
            chưa bao giờ được gửi lên máy chủ. Không có nó thì ảnh chỉ là dữ liệu
            vô nghĩa.
          </p>
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <a href={result.url} target="_blank" rel="noreferrer" className="btn primary">
            Mở album <ArrowRight size={17} strokeWidth={2.2} />
          </a>
          <button type="button" className="btn" onClick={reset}>
            <ImagePlus size={17} strokeWidth={2.2} /> Tạo album khác
          </button>
        </div>
      </div>
    );
  }

  // --- upload screen -------------------------------------------------------
  const working = phase === "working";

  return (
    <>
      <div className="panel">
        <div
          className={dragging ? "si-drop si-drop--over" : "si-drop"}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          <span className="icon-tile" aria-hidden>
            <ImagePlus size={24} strokeWidth={2} />
          </span>
          <p className="si-drop-title">Kéo thả ảnh vào đây, hoặc bấm để chọn</p>
          <p className="hint" style={{ marginTop: 4 }}>
            Nhiều ảnh cùng lúc · tối đa 30 ảnh, 25MB mỗi ảnh
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {picked.length > 0 ? (
          <>
            <ul className="si-filelist" role="list">
              {picked.map((p, i) => (
                <li className="si-file-row" key={p.id}>
                  <span className="si-file-icon" aria-hidden>
                    <ImageIcon size={18} strokeWidth={2} />
                  </span>
                  <span className="si-file-name" title={p.file.name}>
                    {p.file.name}
                  </span>
                  <span className="si-file-size">{formatBytes(p.file.size)}</span>
                  {!working ? (
                    <button
                      type="button"
                      className="si-file-remove"
                      onClick={() => removeAt(i)}
                      aria-label={`Bỏ ${p.file.name}`}
                      title="Bỏ ảnh này"
                    >
                      <Trash2 size={16} strokeWidth={2.2} />
                    </button>
                  ) : (
                    <span className="si-file-remove-spacer" aria-hidden />
                  )}
                </li>
              ))}
              <li className="si-file-summary">
                <span className="si-file-summary-label">
                  {picked.length} ảnh
                </span>
                <span className="si-file-summary-total">
                  {formatBytes(totalBytes)}
                </span>
              </li>
            </ul>

            {error ? (
              <div className="error" role="alert">
                <AlertCircle size={16} strokeWidth={2.2} /> {error}
              </div>
            ) : null}

            {working ? (
              <div className="si-progress" aria-live="polite">
                <Loader2 className="spin" size={16} strokeWidth={2.4} />
                Đang mã hóa &amp; tải lên… {progress.done}/{progress.total}
                <div className="si-bar">
                  <div
                    className="si-bar-fill"
                    style={{
                      width: `${
                        progress.total
                          ? (progress.done / progress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="row" style={{ marginTop: 16 }}>
                <button type="button" className="btn primary" onClick={upload}>
                  <Upload size={17} strokeWidth={2.2} /> Mã hóa &amp; tạo link (
                  {picked.length})
                </button>
                <button type="button" className="btn" onClick={reset}>
                  Xóa hết
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Open an existing album by code */}
      <div className="panel" style={{ marginTop: "var(--space-4)" }}>
        <label className="field-label">Mở album bằng mã chia sẻ</label>
        <div className="key-row">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Dán mã hoặc link chia sẻ vào đây…"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === "Enter") openByCode();
            }}
          />
          <button type="button" className="btn" onClick={openByCode}>
            Xem <ArrowRight size={16} strokeWidth={2.2} />
          </button>
        </div>
        {codeError ? (
          <div className="error" role="alert">
            <AlertCircle size={16} strokeWidth={2.2} /> {codeError}
          </div>
        ) : null}
      </div>
    </>
  );
}
