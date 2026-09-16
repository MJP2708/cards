"use client";

import { useTranslations } from "next-intl";
import { BadgeCheck, AlertTriangle, OctagonAlert, CircleDashed } from "lucide-react";
import type { CardDTO } from "@/lib/data/types";

type Status = CardDTO["verificationStatus"];

/**
 * The three states are colour-coded *and* shaped differently, because a dealer
 * scanning a grid at a booth reads the silhouette before the hue — and roughly
 * one man in twelve cannot separate the red from the green at all.
 */
const STYLES: Record<NonNullable<Status>, { icon: typeof BadgeCheck; className: string }> = {
  VERIFIED: { icon: BadgeCheck, className: "text-emerald-600 dark:text-emerald-400" },
  NEEDS_REVIEW: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-500" },
  LIKELY_INCORRECT: { icon: OctagonAlert, className: "text-red-600 dark:text-red-400" },
};

const LABEL_KEYS: Record<NonNullable<Status>, string> = {
  VERIFIED: "verifiedLabel",
  NEEDS_REVIEW: "needsReviewLabel",
  LIKELY_INCORRECT: "likelyIncorrectLabel",
};

/**
 * Compact indicator for the inventory list.
 *
 * A never-checked card renders a hollow outline rather than nothing at all: the
 * absence of a verdict is information too, and a blank cell reads as "fine".
 */
export function VerificationBadge({
  status,
  notes,
  className = "",
  showLabel = false,
}: {
  status: Status;
  notes?: string | null;
  className?: string;
  showLabel?: boolean;
}) {
  const t = useTranslations("verification");

  if (!status) {
    const label = t("notCheckedLabel");
    return (
      <span
        className={`inline-flex items-center gap-1 text-foreground/30 ${className}`}
        title={t("notCheckedHelp")}
      >
        <CircleDashed className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className={showLabel ? "text-xs" : "sr-only"}>{label}</span>
      </span>
    );
  }

  const { icon: Icon, className: tone } = STYLES[status];
  const label = t(LABEL_KEYS[status]);

  return (
    <span
      className={`inline-flex items-center gap-1 ${tone} ${className}`}
      // The note is the whole value of the flag, so it rides along on hover even
      // in the dense list view where there is no room to print it.
      title={notes ? `${label} — ${notes}` : label}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className={showLabel ? "text-xs font-medium" : "sr-only"}>{label}</span>
    </span>
  );
}
