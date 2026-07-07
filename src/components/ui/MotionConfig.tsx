"use client";

import { MotionConfig as FramerMotionConfig } from "motion/react";
import { useUiStore } from "@/store/uiStore";

// Centralizes reduced-motion handling so individual components never check
// prefers-reduced-motion themselves — "always" honors the explicit in-app
// Settings toggle; "user" falls back to the OS/browser preference.
export function MotionConfig({ children }: { children: React.ReactNode }) {
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  return (
    <FramerMotionConfig reducedMotion={reducedMotion ? "always" : "user"}>{children}</FramerMotionConfig>
  );
}
