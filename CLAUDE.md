# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
cp .env.example .env.local   # then set WEB_SECRET_KEY to a long random string
npm run dev                  # dev server at http://localhost:3000
npm run build && npm start   # production build + serve
npm run lint                 # next lint
```

There is no test runner configured yet — `package.json` has no `test` script and no test framework is installed. The `lib/` folders are written to be pure and unit-testable; if you add tests, wire up the runner and a `test` script first.

## Architecture

Next.js 15 (App Router) + React 19 + TypeScript, fullstack. UI language is Vietnamese. Path alias `@/*` → `src/*`.

The core idea is **one tool = one self-contained module**. Everything about a tool lives under `src/modules/<slug>/`; the rest of the app discovers it generically through a registry, so adding a tool never requires editing existing tools.

### The tool contract and registry

- [src/lib/tool.ts](src/lib/tool.ts) defines `ToolDefinition` (slug, name, description, icon, optional category/enabled) — the metadata contract every tool exports from its `config.ts`.
- [src/modules/registry.ts](src/modules/registry.ts) is the single place that imports each tool's config into the `tools` array. `enabledTools` and `getToolBySlug` are derived from it.
- [src/app/page.tsx](src/app/page.tsx) renders the home grid by mapping over `enabledTools` — it never hardcodes tools.

### Per-module layout (see `src/modules/message-cipher/`)

```
config.ts        # exports the ToolDefinition (metadata only)
types.ts         # request/response + domain types
lib/             # pure logic, no React, no Next — unit-testable
components/       # "use client" React UI for the tool
```

Routes live under `src/app/` and stay thin — they wire a module's config/components/lib into Next.js:
- `src/app/tools/<slug>/page.tsx` — the tool page (imports the module's config for metadata + its client component).
- `src/app/api/tools/<slug>/route.ts` — server API for the tool (only if it needs server-side work).

### Adding a tool

1. Create `src/modules/<slug>/config.ts` exporting a `ToolDefinition`.
2. Import it into the `tools` array in `src/modules/registry.ts`.
3. Add `src/app/tools/<slug>/page.tsx` (and `src/app/api/tools/<slug>/route.ts` if it needs a server).

The home page then lists it automatically.

## message-cipher module: server-secret invariant

The reference tool encrypts/decrypts messages. The critical constraint: **`WEB_SECRET_KEY` is a server-only secret and must never reach the client.** Therefore all encryption/decryption runs on the server.

- The client component ([components/MessageCipherTool.tsx](src/modules/message-cipher/components/MessageCipherTool.tsx)) never calls the cipher directly. It POSTs to `/api/tools/message-cipher` (debounced 200ms for real-time translation, with request cancellation via `AbortController`).
- The API route ([route.ts](src/app/api/tools/message-cipher/route.ts)) reads `WEB_SECRET_KEY` from env, calls `combineKeys(WEB_SECRET_KEY, userKey)`, and runs the pure cipher. The effective key is always `WEB_SECRET_KEY::userKey` — both halves are required to decrypt.
- [lib/cipher.ts](src/modules/message-cipher/lib/cipher.ts) is the pure core: a Vigenère-style keystream (seeded via xmur3 → mulberry32) over UTF-8 bytes, then bytes are encoded into a chosen glyph set treated as a numeral base. Fully reversible; obfuscation-grade, not real crypto.
- [lib/alphabets.ts](src/modules/message-cipher/lib/alphabets.ts) — each visual "style" is just an ordered list of unique single-code-point glyphs (list length = numeral base; ≥2 glyphs works). Add a new style by appending to `STYLES`. Braille uses 256 glyphs (1 glyph/byte, most compact).

Keep new logic in `lib/` pure (no React/Next imports) so it stays testable and reusable across client and server.
