import Link from "next/link";
import { ChevronLeft, Command } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Frosted-glass top navigation, shared across pages.
 * Pass `back` to show an Apple-style back affordance on the left, and
 * `title` for a compact centered page title (kept subtle, iOS-style).
 */
export function SiteNav({
  back,
  title,
}: {
  back?: { href: string; label: string };
  title?: string;
}) {
  return (
    <nav className="nav">
      <div className="nav-inner">
        {back ? (
          <Link href={back.href} className="nav-back">
            <ChevronLeft size={18} strokeWidth={2.4} />
            {back.label}
          </Link>
        ) : (
          <Link href="/" className="brand">
            <span className="brand-mark">
              <Command size={17} strokeWidth={2.4} />
            </span>
            Tool<span className="brand-lord">Lord</span>
          </Link>
        )}
        {title ? <span className="nav-title">{title}</span> : null}
        <ThemeToggle />
      </div>
    </nav>
  );
}
