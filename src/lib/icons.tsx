import {
  HandHeart,
  LockKeyhole,
  Wrench,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * Maps a tool's semantic `icon` key (from its ToolDefinition) to a vector
 * icon. Keeping this map here lets `config.ts` stay a pure metadata module
 * (a string key) while the UI renders a real SVG — no emoji as icons.
 *
 * Add a new tool: pick a key in its config and register it below.
 */
const ICONS: Record<string, LucideIcon> = {
  "lock-keyhole": LockKeyhole,
  "hand-heart": HandHeart,
};

const FALLBACK: LucideIcon = Wrench;

export function ToolIcon({
  name,
  ...props
}: { name: string } & LucideProps) {
  const Icon = ICONS[name] ?? FALLBACK;
  return <Icon aria-hidden {...props} />;
}
