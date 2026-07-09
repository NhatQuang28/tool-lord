import { ImageResponse } from "next/og";

// Apple touch icon (iOS applies its own rounded mask, so we render a full-bleed
// gradient tile with the brand command glyph — matching the in-app brand-mark).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const COMMAND_MARK = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='104' height='104' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'><path d='M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3'/></svg>`,
)}`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: "linear-gradient(150deg, #0071e3, #7c5cff)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={COMMAND_MARK} width={104} height={104} alt="" />
      </div>
    ),
    { ...size },
  );
}
