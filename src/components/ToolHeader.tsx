import type { ToolDefinition } from "@/lib/tool";

/**
 * Large Apple-style page title for a tool: the tool name as the page's single
 * <h1> (important for SEO) plus its description. The compact centered title in
 * the nav is a separate, secondary affordance.
 */
export function ToolHeader({ tool }: { tool: ToolDefinition }) {
  return (
    <header className="tool-header">
      <h1>{tool.name}</h1>
      <p>{tool.description}</p>
    </header>
  );
}
