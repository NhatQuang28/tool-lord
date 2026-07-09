import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo";

/**
 * Default social share card (applies to every route without its own override).
 * Apple-style: near-black gradient, generous whitespace, gradient app tile with
 * the brand command glyph, large title + muted tagline.
 */
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COMMAND_MARK = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3'/></svg>`,
)}`;

// Fetch an Inter subset covering exactly the glyphs we render, so Vietnamese
// diacritics stay crisp. Soft-fails to the built-in font on any network error.
async function loadFonts(text: string) {
  const fetchOne = async (weight: number) => {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&text=${encodeURIComponent(
          text,
        )}`,
        {
          headers: {
            // Old UA nudges Google Fonts to serve a satori-compatible format.
            "User-Agent":
              "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)",
          },
        },
      )
    ).text();
    const url = css.match(/src:\s*url\(([^)]+?)\)/)?.[1];
    if (!url) throw new Error("font url not found");
    return (await fetch(url)).arrayBuffer();
  };
  try {
    const [regular, bold] = await Promise.all([fetchOne(400), fetchOne(800)]);
    return [
      { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: bold, weight: 800 as const, style: "normal" as const },
    ];
  } catch {
    return undefined;
  }
}

export default async function OpengraphImage() {
  const domain = SITE_URL.replace(/^https?:\/\//, "");
  const fonts = await loadFonts(
    `${SITE_NAME}${SITE_TAGLINE}${domain}Miễn phí·Không cần đăng ký·Riêng tư`,
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          fontFamily: "Inter",
          color: "#f5f5f7",
          backgroundColor: "#000000",
          backgroundImage:
            "radial-gradient(120% 90% at 15% -10%, #1c2740 0%, #000000 60%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "132px",
              height: "132px",
              borderRadius: "34px",
              backgroundImage: "linear-gradient(150deg, #0071e3, #7c5cff)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={COMMAND_MARK} width={80} height={80} alt="" />
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 400,
              color: "#8a94a6",
              letterSpacing: "0.02em",
            }}
          >
            {domain}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 108,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            marginTop: "48px",
            lineHeight: 1.05,
          }}
        >
          {SITE_NAME}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 42,
            fontWeight: 400,
            color: "#c7cdd6",
            marginTop: "20px",
            maxWidth: "820px",
            lineHeight: 1.25,
          }}
        >
          {SITE_TAGLINE}
        </div>

        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "44px",
            fontSize: 26,
            color: "#0071e3",
          }}
        >
          <span>Miễn phí</span>
          <span style={{ color: "#4a5163" }}>·</span>
          <span>Không cần đăng ký</span>
          <span style={{ color: "#4a5163" }}>·</span>
          <span>Riêng tư</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
