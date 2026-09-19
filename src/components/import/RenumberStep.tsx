"use client";

import { useTranslations } from "next-intl";
import type { RenumberPlan, RenumberStatus } from "@/lib/import/renumber";

const STATUS_KEYS: Record<RenumberStatus, string> = {
  renumber: "reStatusRenumber",
  already_correct: "reStatusCorrect",
  not_found: "reStatusNotFound",
  invalid: "reStatusInvalid",
  conflict: "reStatusConflict",
};

const STATUS_STYLES: Record<RenumberStatus, string> = {
  renumber: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  already_correct: "bg-foreground/10 text-foreground/60",
  not_found: "bg-amber-500/10 text-amber-700 dark:text-amber-500",
  invalid: "bg-red-500/10 text-red-700 dark:text-red-400",
  conflict: "bg-red-500/10 text-red-700 dark:text-red-400",
};

/**
 * Preview of re-aligning numbers to a sheet.
 *
 * Renumbering is not additive — it rewrites identifiers already written on
 * physical sleeves — so every row's before-and-after is shown, and the rows
 * that cannot be matched are shown just as prominently as the ones that can.
 */
export function RenumberStep({
  plan,
  evictBlockers,
  onEvictChange,
}: {
  plan: RenumberPlan;
  evictBlockers: boolean;
  onEvictChange: (next: boolean) => void;
}) {
  const t = useTranslations("import");

  return (
    <div>
      <h2 className="text-lg font-semibold">{t("reHeading")}</h2>
      <p className="mt-1 text-sm text-foreground/60">{t("reIntro")}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(
          [
            ["renumber", plan.summary.renumber],
            ["already_correct", plan.summary.alreadyCorrect],
            ["not_found", plan.summary.notFound],
            ["invalid", plan.summary.invalid],
            ["conflict", plan.summary.conflict],
          ] as [RenumberStatus, number][]
        ).map(([status, count]) => (
          <div key={status} className="rounded-md border border-border-1 p-2">
            <p className="text-xl font-semibold">{count}</p>
            <p className="text-xs text-foreground/60">{t(STATUS_KEYS[status])}</p>
          </div>
        ))}
      </div>

      {plan.blockers.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <p>
            {t("reBlockers", {
              count: plan.blockers.length,
              examples: plan.blockers
                .slice(0, 5)
                .map((b) => `#${b.currentNumber} ${b.name}`)
                .join(", "),
            })}
          </p>
          <label className="mt-2 flex items-start gap-2">
            <input
              type="checkbox"
              checked={evictBlockers}
              onChange={(e) => onEvictChange(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              {t("reEvict", {
                from: plan.blockers[0]?.proposedNumber ?? 0,
                to: plan.blockers[plan.blockers.length - 1]?.proposedNumber ?? 0,
              })}
            </span>
          </label>
        </div>
      )}

      {plan.untouched.length > 0 && (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {t("reUntouched", {
            count: plan.untouched.length,
            examples: plan.untouched
              .slice(0, 5)
              .map((c) => `#${c.currentNumber} ${c.name}`)
              .join(", "),
          })}
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="border-b border-border-1 text-xs uppercase text-foreground/50">
            <tr>
              <th className="py-2 pr-3">{t("colRow")}</th>
              <th className="py-2 pr-3">{t("reColChange")}</th>
              <th className="py-2 pr-3">{t("colStatus")}</th>
              <th className="py-2 pr-3">{t("colName")}</th>
              <th className="py-2">{t("colIssues")}</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((row) => (
              <tr key={row.rowNumber} className="border-b border-border-1/50 align-top">
                <td className="py-2 pr-3 text-foreground/50">{row.rowNumber}</td>
                <td className="whitespace-nowrap py-2 pr-3 font-mono text-xs">
                  {row.status === "renumber" && row.card ? (
                    <>
                      <span className="text-foreground/40 line-through">#{row.card.currentNumber}</span>{" "}
                      <span className="font-semibold">#{row.lookupNumber}</span>
                    </>
                  ) : row.lookupNumber !== null ? (
                    <span className="text-foreground/50">#{row.lookupNumber}</span>
                  ) : (
                    <span className="text-foreground/30">—</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}
                  >
                    {t(STATUS_KEYS[row.status])}
                  </span>
                </td>
                <td className="py-2 pr-3">{row.card?.name ?? "—"}</td>
                <td className="py-2 text-xs text-foreground/60">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
