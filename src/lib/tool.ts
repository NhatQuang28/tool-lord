/**
 * Shared contract for every tool module in the app.
 *
 * Each tool lives under `src/modules/<slug>/` and exports a `ToolDefinition`
 * from its `config.ts`. The central registry (`src/modules/registry.ts`)
 * collects them so the home page can list tools generically and routing stays
 * consistent. Adding a new tool = create a module + register it. Nothing else
 * needs to know about the tool.
 */
export interface ToolDefinition {
  /** URL segment, e.g. "message-cipher" -> /tools/message-cipher */
  slug: string;
  /** Human-friendly name shown in the UI. */
  name: string;
  /** Short one-line description for the tool card. */
  description: string;
  /**
   * Semantic icon key resolved to a vector (Lucide) icon by the UI layer.
   * See `src/lib/icons.tsx` for the registry; add a mapping there when you
   * introduce a new key. Keep config pure (no React imports) by using a string.
   */
  icon: string;
  /** Optional grouping label. */
  category?: string;
  /** Set false to hide from the home listing (still routable). */
  enabled?: boolean;
}
