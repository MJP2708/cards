"use client";

import { useEffect, useRef } from "react";

// Shared outside-click-to-dismiss for popovers/dropdowns — previously
// reimplemented per-component (MoreMenu had its own copy; filter popovers had
// none at all, so they stayed open when a dealer tapped past them).
export function useClickOutside<T extends HTMLElement>(onOutside: () => void, active = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return ref;
}
