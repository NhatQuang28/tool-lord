/**
 * Material Design "Standard image list" (m2.material.io/components/image-lists).
 * Anatomy: an image-list container holding image-list items; each item is the
 * image plus an optional label ("supporting text") sitting on a gradient
 * "text protection" scrim. Purely presentational — parents pass already
 * DECRYPTED object URLs.
 */
import { Download, Eye } from "lucide-react";

export interface ImageItem {
  /** Stable key. */
  id: string;
  /** Decrypted object URL (blob:). */
  src: string;
  /** Original filename (decrypted). */
  name: string;
}

export function ImageList({
  items,
  onOpen,
  onDownload,
}: {
  items: ImageItem[];
  onOpen?: (index: number) => void;
  onDownload?: (index: number) => void;
}) {
  return (
    <ul className="mdc-image-list" role="list">
      {items.map((item, i) => (
        <li className="mdc-image-list__item" key={item.id}>
          <button
            type="button"
            className="mdc-image-list__surface"
            onClick={() => onOpen?.(i)}
            aria-label={`Xem ${item.name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="mdc-image-list__image"
              src={item.src}
              alt={item.name}
              loading="lazy"
            />
            <span className="mdc-image-list__hover" aria-hidden>
              <Eye size={22} strokeWidth={2} />
            </span>
          </button>
          <span className="mdc-image-list__supporting">
            <span className="mdc-image-list__label" title={item.name}>
              {item.name}
            </span>
            {onDownload ? (
              <button
                type="button"
                className="mdc-image-list__action"
                onClick={() => onDownload(i)}
                aria-label={`Tải ${item.name}`}
                title="Tải ảnh"
              >
                <Download size={16} strokeWidth={2.2} />
              </button>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
