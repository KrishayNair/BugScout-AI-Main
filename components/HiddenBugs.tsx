"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BUG_SPOTS: { top: string; left?: string; right?: string }[] = [
  { top: "18%", right: "8%" },
  { top: "45%", left: "4%" },
  { top: "65%", right: "6%" },
  { top: "85%", left: "10%" },
];

export function HiddenBugs() {
  const [caught, setCaught] = useState<Set<number>>(new Set());

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {BUG_SPOTS.map((pos, i) => (
        <div
          key={i}
          className="pointer-events-auto absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2"
          style={{
            top: pos.top,
            left: pos.left,
            right: pos.right,
          }}
        >
          {!caught.has(i) ? (
            <motion.button
              type="button"
              aria-label="Hover to catch"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40"
              onMouseEnter={() => setCaught((prev) => new Set(prev).add(i))}
              whileHover={{ scale: 1.2 }}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 0.6 }}
            >
              <span className="h-2 w-2 rounded-full bg-primary/70" />
            </motion.button>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ scale: 1, opacity: 0.9 }}
                animate={{
                  scale: 1.4,
                  opacity: 0,
                  transition: { duration: 0.35, ease: "easeOut" },
                }}
                className="flex h-8 w-8 items-center justify-center"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-medium text-primary">
                  ✓
                </span>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      ))}
    </div>
  );
}
