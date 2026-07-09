"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const DEFAULT_MS = 450;
// A held finger is never perfectly still — cancelling on the first pixel of
// jitter made long-press fail intermittently on real touchscreens. Motion's
// own drag-start threshold is more forgiving than that, so this needs to be
// too, or the two gestures disagree about when a "hold" became a "drag."
const MOVE_TOLERANCE_PX = 10;

// Platform-standard "long-press to select" gesture (Photos, Gmail, Files) —
// fires once after holding past `ms` without moving past the tolerance, and
// is cancelled by a real drag/scroll so it never fights a gesture layered on
// the same element.
export function useLongPress(onLongPress: () => void, ms = DEFAULT_MS) {
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);
  const originRef = useRef<{ x: number; y: number } | null>(null);

  function cancel() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    originRef.current = null;
    setPressing(false);
  }

  function start(e: ReactPointerEvent) {
    firedRef.current = false;
    originRef.current = { x: e.clientX, y: e.clientY };
    setPressing(true);
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      navigator.vibrate?.(12);
      onLongPress();
      setPressing(false);
    }, ms);
  }

  function move(e: ReactPointerEvent) {
    if (!originRef.current) return;
    const dx = e.clientX - originRef.current.x;
    const dy = e.clientY - originRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) cancel();
  }

  return {
    pressing,
    didFire: () => firedRef.current,
    handlers: {
      onPointerDown: start,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerMove: move,
    },
  };
}
