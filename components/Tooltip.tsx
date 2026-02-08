"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Tooltip({
  children,
  content,
  side = "top",
}: {
  children: React.ReactNode;
  content: string;
  side?: "top" | "bottom";
}) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex cursor-help"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.span
            initial={{ opacity: 0, y: side === "top" ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: side === "top" ? 4 : -4 }}
            transition={{ duration: 0.15 }}
            className={`pointer-events-none absolute z-50 max-w-[200px] rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-lg ${
              side === "top" ? "bottom-full left-1/2 mb-2 -translate-x-1/2" : "top-full left-1/2 mt-2 -translate-x-1/2"
            }`}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
