"use client";

/**
 * Viewer for a shared secret-image folder.
 *
 * The decryption key is read from the URL fragment (`#…`) — the browser never
 * sends the fragment to the server, so the key stays client-side. We fetch the
 * encrypted manifest + presigned GET URLs, download each blob straight from R2,
 * and decrypt everything here before rendering. If the key is wrong, AES-GCM
 * authentication fails and we surface a friendly error instead of garbage.
 */
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { ImageList, type ImageItem } from "./ImageList";
import { decryptBytes, decryptMeta, importKey } from "../lib/crypto";
import type { ViewShareResponse } from "../types";

type Status = "loading" | "ready" | "error";

export function SecretImageViewer({ id }: { id: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [items, setItems] = useState<ImageItem[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];

    async function run() {
      // The key lives only in the fragment.
      const keyB64url = window.location.hash.replace(/^#/, "").trim();
      if (!keyB64url) {
        setError(
          "Thiếu khóa giải mã trong đường dẫn. Hãy mở đúng link chia sẻ đầy đủ (có phần sau dấu #).",
        );
        setStatus("error");
        return;
      }

      try {
        const res = await fetch(
          `/api/tools/secret-image/${encodeURIComponent(id)}`,
        );
        const data = (await res.json()) as ViewShareResponse;
        if (!res.ok || data.error) {
          throw new Error(data.error || "Không tải được album.");
        }

        const key = await importKey(keyB64url);

        const results = await Promise.all(
          data.files.map(async (f, i) => {
            const blobRes = await fetch(f.url);
            if (!blobRes.ok) throw new Error("Không tải được dữ liệu ảnh.");
            const cipher = await blobRes.arrayBuffer();
            const plain = await decryptBytes(key, cipher, f.imageIv);
            const meta = await decryptMeta(key, f.metaCipher, f.metaIv);
            const url = URL.createObjectURL(
              new Blob([plain], { type: meta.type || "image/*" }),
            );
            created.push(url);
            return { id: `${i}`, src: url, name: meta.name || `anh-${i + 1}` };
          }),
        );

        if (cancelled) {
          created.forEach((u) => URL.revokeObjectURL(u));
          return;
        }
        setItems(results);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        const name = (err as Error)?.name;
        // OperationError = AES-GCM auth failed => wrong key / tampered data.
        const msg =
          name === "OperationError"
            ? "Giải mã thất bại — mã chia sẻ không đúng hoặc dữ liệu đã hỏng."
            : (err as Error)?.message || "Có lỗi khi mở album.";
        setError(msg);
        setStatus("error");
      }
    }

    run();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [id]);

  const download = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      const a = document.createElement("a");
      a.href = item.src;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    [items],
  );

  // Lightbox keyboard navigation.
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight")
        setLightbox((i) => (i === null ? i : Math.min(items.length - 1, i + 1)));
      if (e.key === "ArrowLeft")
        setLightbox((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, items.length]);

  if (status === "loading") {
    return (
      <div className="panel si-center">
        <Loader2 className="spin" size={22} strokeWidth={2.2} />
        <p style={{ margin: 0 }}>Đang tải và giải mã ảnh…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="panel">
        <div className="error" role="alert" style={{ marginTop: 0 }}>
          <AlertCircle size={18} strokeWidth={2.2} /> {error}
        </div>
      </div>
    );
  }

  const current = lightbox === null ? null : items[lightbox];

  return (
    <div className="panel">
      <div className="si-viewer-head">
        <h2 className="si-h2">Album ảnh bí mật</h2>
        <span className="si-count">{items.length} ảnh · đã giải mã trên máy bạn</span>
      </div>

      <ImageList items={items} onOpen={setLightbox} onDownload={download} />

      {current ? (
        <div
          className="si-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={current.name}
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="si-lb-close"
            onClick={() => setLightbox(null)}
            aria-label="Đóng"
          >
            <X size={22} strokeWidth={2.2} />
          </button>
          {lightbox! > 0 ? (
            <button
              type="button"
              className="si-lb-nav si-lb-prev"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((i) => (i === null ? i : Math.max(0, i - 1)));
              }}
              aria-label="Ảnh trước"
            >
              <ChevronLeft size={26} strokeWidth={2.2} />
            </button>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="si-lb-img"
            src={current.src}
            alt={current.name}
            onClick={(e) => e.stopPropagation()}
          />
          {lightbox! < items.length - 1 ? (
            <button
              type="button"
              className="si-lb-nav si-lb-next"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((i) =>
                  i === null ? i : Math.min(items.length - 1, i + 1),
                );
              }}
              aria-label="Ảnh sau"
            >
              <ChevronRight size={26} strokeWidth={2.2} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
