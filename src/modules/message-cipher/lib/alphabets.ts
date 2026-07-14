import type { CipherStyle } from "../types";

/**
 * Visual styles for the ciphertext. Each style is just an ordered list of
 * unique, single-code-point glyphs; the cipher core treats the list length as
 * a numeral base and maps encrypted bytes onto these glyphs. Any style with
 * >= 2 glyphs works, so adding a new "font" is trivial.
 */

/** Build `count` consecutive code points starting at `start`. */
function range(start: number, count: number): string[] {
  const arr: string[] = [];
  for (let i = 0; i < count; i++) arr.push(String.fromCodePoint(start + i));
  return arr;
}

/** Split a string into unique single-code-point glyphs (order preserved). */
function glyphs(source: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ch of Array.from(source)) {
    if (!seen.has(ch)) {
      seen.add(ch);
      out.push(ch);
    }
  }
  return out;
}

export const STYLES: CipherStyle[] = [
  {
    id: "alien",
    name: "Ngoài hành tinh",
    sample: "🜁🜂🜃🜄",
    // Alchemical symbols block — otherworldly, mystical look.
    glyphs: range(0x1f700, 116),
  },
  {
    id: "arabic",
    name: "Ả Rập cổ",
    sample: "ابجد",
    glyphs: glyphs(
      "ابتثجحخدذرزسشصضطظعغفقكلمنهوىيءآأؤإئةپچژگکیۀۂۃ",
    ),
  },
  {
    id: "runes",
    name: "Rune cổ",
    sample: "ᚠᚢᚦᚨ",
    // Runic block (Elder Futhark and beyond).
    glyphs: range(0x16a0, 75),
  },
  {
    id: "hieroglyph",
    name: "Cổ tự Ai Cập",
    sample: "𓀀𓀁𓀂𓀃",
    // Egyptian hieroglyphs (astral plane; single code points each).
    glyphs: range(0x13000, 96),
  },
  {
    id: "braille",
    name: "Chữ nổi Braille",
    sample: "⠁⠂⠃⠄",
    // Braille patterns: full 256 glyphs -> 1 glyph per byte (compact).
    glyphs: range(0x2800, 256),
  },
  {
    id: "cosmic",
    name: "Ký hiệu vũ trụ",
    sample: "☉☽♁♆",
    // Curated astronomical / geometric / misc symbols.
    glyphs: glyphs(
      "☉☽☿♀♁♂♃♄♅♆♇★☆✦✧✩✪✫✬✭✮✯✰⁂⁎⁑⁕❂❉❊❋✵✶✷✸✹✺✻✼❄❅❆⌘⌬⏦⏥⎔⎈◈◉◊○◌◍◎●◐◑◒◓◔◕",
    ),
  },
  {
    id: "kanji",
    name: "Chữ Hán (Nhật)",
    sample: "一丁丂七",
    // CJK Unified Ideographs block: 256 glyphs -> 1 glyph per byte (compact).
    glyphs: range(0x4e00, 256),
  },
  {
    id: "binary",
    name: "Nhị phân",
    sample: "0101",
    // Base-2: encrypted bytes become strings of 0s and 1s.
    glyphs: glyphs("01"),
  },
];

const STYLE_MAP = new Map(STYLES.map((s) => [s.id, s]));

export function getStyle(id: string): CipherStyle {
  const style = STYLE_MAP.get(id);
  if (!style) throw new Error(`Unknown cipher style: ${id}`);
  return style;
}

// Precomputed glyph lookup per style, for fast detection on every keystroke.
const GLYPH_SETS = STYLES.map((s) => ({ id: s.id, set: new Set(s.glyphs) }));

/**
 * Guess which style a ciphertext was produced with by measuring how many of its
 * glyphs belong to each style's alphabet. Style alphabets are disjoint, so a
 * real ciphertext scores ~100% on its own style and ~0% on the rest. Whitespace
 * is ignored. Returns the best-matching style id, or null when nothing matches
 * well enough (empty text, plain text, or a mixed/unknown script).
 */
export function detectStyleId(text: string): string | null {
  const chars = Array.from(text).filter((c) => !/\s/.test(c));
  if (chars.length === 0) return null;

  let bestId: string | null = null;
  let bestScore = 0;
  for (const { id, set } of GLYPH_SETS) {
    let hits = 0;
    for (const c of chars) if (set.has(c)) hits++;
    const coverage = hits / chars.length;
    if (coverage > bestScore) {
      bestScore = coverage;
      bestId = id;
    }
  }
  // Require a clear majority so stray characters don't trigger a false switch.
  return bestScore >= 0.5 ? bestId : null;
}

export const DEFAULT_STYLE_ID = "alien";

/** Lightweight style metadata for UI pickers (no glyph payload logic). */
export const STYLE_OPTIONS = STYLES.map(({ id, name, sample }) => ({
  id,
  name,
  sample,
}));
