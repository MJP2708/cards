"use client";

import { useUiStore } from "@/store/uiStore";

export function BoothModeToggle() {
  const boothMode = useUiStore((s) => s.boothMode);
  const toggleBoothMode = useUiStore((s) => s.toggleBoothMode);

  return (
    <button
      type="button"
      onClick={toggleBoothMode}
      aria-pressed={boothMode}
      className={`booth-target rounded-md border px-2.5 py-1.5 text-sm ${
        boothMode
          ? "border-accent bg-accent text-white"
          : "border-border-1 hover:bg-surface-1"
      }`}
    >
      Booth mode
    </button>
  );
}
