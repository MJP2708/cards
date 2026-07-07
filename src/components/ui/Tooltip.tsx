"use client";

import { useId, useState } from "react";
import { HelpCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export function HelpTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-describedby={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-foreground/40 hover:text-foreground/70"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">More info</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-md border border-border-1 bg-background p-2 text-xs font-normal text-foreground shadow-lg"
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
