"use client";

import { Command } from "lucide-react";
import { useCommandPaletteStore } from "@/store/commandPaletteStore";

export function CommandPaletteButton() {
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  return (
    <button
      onClick={() => setOpen(true)}
      className="booth-target flex items-center gap-1 rounded-md border border-border-1 px-2.5 py-1.5 text-xs text-foreground/60 hover:bg-surface-1"
      aria-label="Open command palette"
    >
      <Command className="h-3.5 w-3.5" />
      K
    </button>
  );
}
