// src/modules/feedback/components/format.ts
// Small presentational helpers for the feedback UI (client-side). Pure functions;
// callers pass `Date.now()` so the logic itself stays deterministic/testable.

/** Vietnamese relative time, e.g. "Vừa xong", "5 phút", "3 giờ", "2 ngày", then a date. */
export function timeAgo(ms: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return "Vừa xong";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} tuần`;
  return new Date(ms).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
