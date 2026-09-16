"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck, RefreshCw } from "lucide-react";
import type { CardDetailDTO } from "@/lib/data/types";
import { useVerifyCard } from "@/lib/data/cards";
import { VerificationBadge } from "@/components/cards/VerificationBadge";
import { useRelativeTime } from "@/lib/relativeTime";

/**
 * The card-detail view of the audit.
 *
 * Shows the reasons, not just the label: "Needs Review" on its own tells the user
 * there is a problem without telling them what, which leaves them re-deriving the
 * check by hand — the exact work this feature exists to save.
 */
export function VerificationPanel({ card }: { card: CardDetailDTO }) {
  const t = useTranslations("verification");
  const relativeTime = useRelativeTime();
  const verify = useVerifyCard();
  const [error, setError] = useState<string | null>(null);

  // The notes column is a sentence-joined summary; split it back out so each
  // finding reads as its own line rather than a wall of prose.
  const findings = (card.verificationNotes ?? "")
    .split(/(?<=\.)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <section className="space-y-2 rounded-lg border border-border-1 p-3">
      <h3
        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--accent-dark)" }}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {t("panelTitle")}
      </h3>

      <div className="flex flex-wrap items-center gap-2">
        <VerificationBadge status={card.verificationStatus} showLabel />
        {card.verifiedAt && (
          <span className="text-xs text-foreground/50">
            {t("checkedAgo", { time: relativeTime(new Date(card.verifiedAt)) })}
          </span>
        )}
      </div>

      {findings.length > 0 ? (
        <ul className="space-y-1 text-xs text-foreground/70">
          {findings.map((finding, index) => (
            <li key={index} className="flex gap-1.5">
              <span aria-hidden className="text-foreground/30">
                •
              </span>
              <span>{finding}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-foreground/50">{t("noNotes")}</p>
      )}

      {card.verificationStatus && card.verificationStatus !== "VERIFIED" && (
        <p className="rounded-md bg-surface-1 px-2 py-1.5 text-[11px] text-foreground/60">
          {t("neverAutoCorrects")}
        </p>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        onClick={async () => {
          setError(null);
          try {
            await verify.mutateAsync(card.id);
          } catch (e) {
            setError(e instanceof Error ? e.message : t("reverifyFailed"));
          }
        }}
        disabled={verify.isPending}
        className="inline-flex items-center gap-1.5 rounded-md border border-border-1 px-2.5 py-1.5 text-xs hover:bg-surface-1 disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${verify.isPending ? "animate-spin" : ""}`} aria-hidden />
        {verify.isPending ? t("reverifying") : t("reverify")}
      </button>
    </section>
  );
}
