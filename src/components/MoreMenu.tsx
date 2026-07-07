"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BoothModeToggle } from "@/components/BoothModeToggle";
import { DarkModeToggle } from "@/components/DarkModeToggle";

// Consolidates the lower-frequency toggles (language, booth mode, dark mode)
// behind one control so the header's primary row (search, offline status,
// command palette) doesn't compete for attention with settings a seller
// touches once a session, not once a sale.
export function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="More options"
        aria-expanded={open}
        className="booth-target flex items-center justify-center rounded-md border border-border-1 px-2.5 py-1.5 hover:bg-surface-1"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 flex w-56 flex-col gap-2 rounded-md border border-border-1 bg-background p-3 shadow-lg">
          <LanguageSwitcher />
          <BoothModeToggle />
          <DarkModeToggle />
        </div>
      )}
    </div>
  );
}
