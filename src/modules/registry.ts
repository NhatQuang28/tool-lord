import type { ToolDefinition } from "@/lib/tool";
import { messageCipherTool } from "@/modules/message-cipher/config";
import { woodenFishTool } from "@/modules/wooden-fish/config";
import { secretImageTool } from "@/modules/secret-image/config";

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
];

export const enabledTools = tools.filter((t) => t.enabled !== false);

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return tools.find((t) => t.slug === slug);
}
