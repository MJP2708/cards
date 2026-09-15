"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { MatchStatus, RowAction, StagedImport, StagedRow } from "@/lib/import/stage";

const MATCH_KEYS: Record<MatchStatus, string> = {
  new: "matchNew",
  exact_unchanged: "matchExactUnchanged",
  exact_changed: "matchExactChanged",
  possible: "matchPossible",
  failed: "matchFailed",
};

const MATCH_STYLES: Record<MatchStatus, string> = {
  new: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  exact_unchanged: "bg-foreground/10 text-foreground/60",
  exact_changed: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  possible: "bg-amber-500/10 text-amber-700 dark:text-amber-500",
  failed: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const ACTION_KEYS: Record<RowAction, string> = {
  new: "actionNew",
  update: "actionUpdate",
  merge: "actionMerge",
  skip: "actionSkip",
  undecided: "actionUndecided",
};

/** Which actions make sense for a row, given what it matched. */
function actionsFor(row: StagedRow): RowAction[] {
  if (row.match === "failed") return ["skip"];
  if (!row.existing) return row.match === "possible" ? ["undecided", "new", "skip"] : ["new", "skip"];
  return ["undecided", "update", "merge", "new", "skip"];
}

/** The bulk-action groups, in the order they are offered. */
const BULK_GROUPS: { status: MatchStatus; options: RowAction[] }[] = [
  { status: "new", options: ["new", "skip"] },
  { status: "exact_unchanged", options: ["skip", "update", "merge", "new"] },
  { status: "exact_changed", options: ["update", "merge", "new", "skip"] },
  { status: "possible", options: ["new", "update", "merge", "skip"] },
];

export function StagingStep({
  staged,
  actions,
  onActionChange,
  onBulkChange,
}: {
  staged: StagedImport;
  actions: Record<number, RowAction>;
  onActionChange: (rowNumber: number, action: RowAction) => void;
  onBulkChange: (status: MatchStatus, action: RowAction) => void;
}) {
  const t = useTranslations("import");

  /**
   * The outcome summary, computed from the *current* choices rather than from the
   * match statuses — the whole point of the bulk controls is that the user can
   * change them, and a summary that reported the defaults would be a lie.
   */
  const outcome = useMemo(() => {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let flagged = 0;
    for (const row of staged.rows) {
      const action = actions[row.rowNumber] ?? row.suggestedAction;
      if (action === "new") created++;
      else if (action === "update" || action === "merge") updated++;
      else {
        skipped++;
        if (action === "undecided") flagged++;
      }
    }
    return { created, updated, skipped, flagged };
  }, [staged.rows, actions]);

  const countByStatus = useMemo(() => {
    const counts = new Map<MatchStatus, number>();
    for (const row of staged.rows) counts.set(row.match, (counts.get(row.match) ?? 0) + 1);
    return counts;
  }, [staged.rows]);

  return (
    <div>
      <h2 className="text-lg font-semibold">{t("stageHeading")}</h2>
      <p className="mt-1 text-sm text-foreground/60">{t("stageIntro")}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(
          [
            ["new", staged.summary.new],
            ["exact_unchanged", staged.summary.exactUnchanged],
            ["exact_changed", staged.summary.exactChanged],
            ["possible", staged.summary.possible],
            ["failed", staged.summary.failed],
          ] as [MatchStatus, number][]
        ).map(([status, count]) => (
          <div key={status} className="rounded-md border border-border-1 p-2">
            <p className="text-xl font-semibold">{count}</p>
            <p className="text-xs text-foreground/60">{t(MATCH_KEYS[status])}</p>
          </div>
        ))}
      </div>

      {/* Bulk actions — one decision per status group, still overridable per row below. */}
      <div className="mt-4 rounded-md border border-border-1 p-3">
        <h3 className="text-sm font-semibold">{t("bulkHeading")}</h3>
        <p className="mt-0.5 text-xs text-foreground/60">{t("bulkIntro")}</p>
        <div className="mt-2 space-y-2">
          {BULK_GROUPS.filter((group) => (countByStatus.get(group.status) ?? 0) > 0).map((group) => (
            <div key={group.status} className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${MATCH_STYLES[group.status]}`}>
                {t(MATCH_KEYS[group.status])} ({countByStatus.get(group.status) ?? 0})
              </span>
              {group.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onBulkChange(group.status, option)}
                  className="rounded border border-border-1 px-2 py-1 text-xs hover:bg-surface-1"
                >
                  {t(ACTION_KEYS[option])}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="border-b border-border-1 text-xs uppercase text-foreground/50">
            <tr>
              <th className="py-2 pr-3">{t("colRow")}</th>
              <th className="py-2 pr-3">{t("colStatus")}</th>
              <th className="py-2 pr-3">{t("colName")}</th>
              <th className="py-2 pr-3">{t("colCategory")}</th>
              <th className="py-2 pr-3">{t("colSeries")}</th>
              <th className="py-2 pr-3">{t("colQty")}</th>
              <th className="py-2 pr-3">{t("colPrice")}</th>
              <th className="py-2 pr-3">{t("colChanges")}</th>
              <th className="py-2 pr-3">{t("colAction")}</th>
              <th className="py-2">{t("colIssues")}</th>
            </tr>
          </thead>
          <tbody>
            {staged.rows.map((row) => {
              const action = actions[row.rowNumber] ?? row.suggestedAction;
              return (
                <tr
                  key={row.rowNumber}
                  className={`border-b border-border-1/50 align-top ${
                    action === "undecided" ? "bg-amber-500/5" : ""
                  }`}
                >
                  <td className="py-2 pr-3 text-foreground/50">{row.rowNumber}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${MATCH_STYLES[row.match]}`}
                    >
                      {t(MATCH_KEYS[row.match])}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{row.card?.name ?? "—"}</td>
                  <td className="py-2 pr-3">{row.card?.category ?? "—"}</td>
                  <td className="py-2 pr-3">{row.card?.series ?? "—"}</td>
                  <td className="py-2 pr-3">{row.card?.quantity ?? "—"}</td>
                  <td className="py-2 pr-3">{row.card?.askingPrice ?? "—"}</td>
                  <td className="py-2 pr-3 text-xs">
                    {row.changes.length === 0 ? (
                      <span className="text-foreground/30">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {row.changes.map((change) => (
                          <li key={change.field}>
                            <span className="text-foreground/60">{change.field}:</span>{" "}
                            <span className="line-through opacity-60">{change.from}</span> →{" "}
                            <span className="font-medium">{change.to}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {row.match === "failed" ? (
                      <span className="text-foreground/40">—</span>
                    ) : (
                      <select
                        aria-label={t("stageActionLabel", { row: row.rowNumber })}
                        value={action}
                        onChange={(e) => onActionChange(row.rowNumber, e.target.value as RowAction)}
                        className={`rounded border bg-transparent px-1.5 py-1 text-xs ${
                          action === "undecided"
                            ? "border-amber-500 text-amber-700 dark:text-amber-500"
                            : "border-border-1"
                        }`}
                      >
                        {actionsFor(row).map((option) => (
                          <option key={option} value={option}>
                            {t(ACTION_KEYS[option])}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-2 text-xs text-foreground/60">{row.issues.join(" ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {staged.unmappedHeaders.length > 0 && (
        <p className="mt-3 text-xs text-foreground/50">
          {t("stageUnreadColumns", { headers: staged.unmappedHeaders.join(", ") })}
        </p>
      )}

      <div className="mt-4 rounded-md border border-border-1 bg-surface-1 p-3">
        <h3 className="text-sm font-semibold">{t("aboutHeading")}</h3>
        <p className="mt-1 text-sm">
          {t("aboutLine", {
            created: outcome.created,
            updated: outcome.updated,
            skipped: outcome.skipped,
          })}
          {outcome.flagged > 0 && (
            <span className="text-amber-700 dark:text-amber-500">
              {t("aboutFlagged", { count: outcome.flagged })}
            </span>
          )}
          .
        </p>
      </div>
    </div>
  );
}

