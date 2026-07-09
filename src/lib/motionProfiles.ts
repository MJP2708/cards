import type { ThemeTokens } from "@/lib/fieldSchema";

// Sport identity extended into motion, not just color/font/motif — the one
// dimension the design audit flagged as still uniform across categories.
// NBA's hardwood motif gets a quicker, bouncier spring (a ball bounce);
// Football's pitch motif gets a smoother, longer ease (a ball rolling to a
// stop). Everything else (custom categories, the neutral "All" view) keeps
// the original constants as a calm default.
export type MotionProfile = { stiffness: number; damping: number; crossfadeSeconds: number };

const PROFILES: Record<ThemeTokens["motif"], MotionProfile> = {
  hardwood: { stiffness: 620, damping: 26, crossfadeSeconds: 0.14 },
  pitch: { stiffness: 380, damping: 42, crossfadeSeconds: 0.22 },
  holo: { stiffness: 500, damping: 35, crossfadeSeconds: 0.18 },
  frame: { stiffness: 500, damping: 35, crossfadeSeconds: 0.18 },
  none: { stiffness: 500, damping: 35, crossfadeSeconds: 0.18 },
};

export function motionProfileFor(motif: ThemeTokens["motif"] | undefined): MotionProfile {
  return PROFILES[motif ?? "none"] ?? PROFILES.none;
}
