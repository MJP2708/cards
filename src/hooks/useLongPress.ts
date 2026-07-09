"use client";

import { useRef, useState } from "react";

const DEFAULT_MS = 450;

// Platform-standard "long-press to select" gesture (Photos, Gmail, Files) —
// fires once after holding past `ms` without moving, and is cancelled by any
// pointer movement so it never fights a scroll or a drag gesture layered on
// the same element.
export function useLongPress(onLongPress: () => void, ms = DEFAULT_MS) {
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  function cancel(_e?: unknown) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setPressing(false);
  }

  function start(_e?: unknown) {
    firedRef.current = false;
    setPressing(true);
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      navigator.vibrate?.(12);
      onLongPress();
      setPressing(false);
    }, ms);
  }

  return {
    pressing,
    didFire: () => firedRef.current,
    handlers: {
      onPointerDown: start,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerMove: cancel,
    },
  };
}
