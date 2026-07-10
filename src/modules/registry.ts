import type { ToolDefinition } from "@/lib/tool";
import { messageCipherTool } from "@/modules/message-cipher/config";
import { woodenFishTool } from "@/modules/wooden-fish/config";
import { secretImageTool } from "@/modules/secret-image/config";
import { adminTool } from "@/modules/admin/config";

/**
 * Central registry of every tool in the app.
 *
 * To add a new tool:
 *   1. Create `src/modules/<slug>/` with a `config.ts` exporting a ToolDefinition.
 *   2. Add its metadata import here.
 *   3. Create the route at `src/app/tools/<slug>/page.tsx`.
 */
export const tools: ToolDefinition[] = [
  messageCipherTool,
  woodenFishTool,
  secretImageTool,
  adminTool,
];

export const enabledTools = tools.filter((t) => t.enabled !== false);

/**
 * Tools safe to advertise publicly (sitemap, home-page structured data). Role-
 * gated tools (`minRole`, e.g. the admin panel) are excluded — their pages are
 * noindexed and only shown to authorized users, so they must not leak into SEO
 * surfaces. The home grid still receives `enabledTools` and filters by role on
 * the client.
 */
export const listedTools = enabledTools.filter((t) => !t.minRole);

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return tools.find((t) => t.slug === slug);
}
