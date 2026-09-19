"use client";

import { useTranslations } from "next-intl";

/**
 * The store's quick-reference number, as called out at the table.
 *
 * Monospaced and always prefixed with "#" so it reads as a reference rather than
 * a quantity or a price, which are the other numbers competing for attention on
 * the same row.
 */
export function LookupBadge({
  lookupNumber,
  className = "",
}: {
  lookupNumber: number | null;
  className?: string;
}) {
  const t = useTranslations("inventory");

  // An offline-created card genuinely has no number until it syncs. Saying so is
  // better than showing a placeholder digit someone might read out to a customer.
  if (lookupNumber === null) {
    return (
      <span
        className={`inline-flex shrink-0 items-center rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-[11px] text-foreground/40 ${className}`}
        title={t("lookupPendingHelp")}
      >
        #—
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-foreground/70 ${className}`}
    >
      #{lookupNumber}
    </span>
  );
}
