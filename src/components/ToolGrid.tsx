"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { ToolIcon } from "@/lib/icons";
import type { ToolDefinition } from "@/lib/tool";
import { useAuth } from "@/modules/auth/AuthProvider";

const MotionLink = motion.create(Link);

export function ToolGrid({ tools }: { tools: ToolDefinition[] }) {
  const reduce = useReducedMotion();
  const { user, loading } = useAuth();

  // Auth-gated tools are only shown to signed-in users. While the first
  // auth-state resolution is pending we hide them to avoid flashing a card
  // that then disappears.
  const visible = tools.filter(
    (tool) => !tool.requiresAuth || (!loading && user),
  );

  return (
    <motion.div
      className="tool-grid"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
    >
      {visible.map((tool) => (
        <MotionLink
          key={tool.slug}
          href={`/tools/${tool.slug}`}
          className="tool-card"
          variants={{
            hidden: { opacity: 0, y: reduce ? 0 : 18 },
            show: {
              opacity: 1,
              y: 0,
              transition: { type: "spring", stiffness: 320, damping: 26 },
            },
          }}
          whileHover={
            reduce
              ? undefined
              : { y: -6, transition: { type: "spring", stiffness: 400, damping: 20 } }
          }
          whileTap={reduce ? undefined : { scale: 0.98 }}
        >
          <span className="icon-tile">
            <ToolIcon name={tool.icon} size={26} strokeWidth={2} />
          </span>
          <h3>{tool.name}</h3>
          <p>{tool.description}</p>
          <div className="card-footer">
            {tool.category ? (
              <span className="tag">{tool.category}</span>
            ) : (
              <span />
            )}
            <ArrowRight className="arrow" size={20} strokeWidth={2} />
          </div>
        </MotionLink>
      ))}
    </motion.div>
  );
}
