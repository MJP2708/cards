"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { InlineError } from "@/components/ui/InlineError";

type StagedRow = {
  rowNumber: number;
  status: "ready" | "review" | "failed";
  issues: string[];
  card: Record<string, unknown> | null;
  duplicateOf: { id: string; name: string; series: string; quantity: number } | null;
};

type Staged = {
  fileName: string;
  rows: StagedRow[];
  unmappedHeaders: string[];
  sheetName: string | null;
  summary: { total: number; ready: number; review: number; failed: number; duplicates: number };
  enrichment: { category: string; envVar: string; configured: boolean }[];
};

type RowAction = "new" | "merge" | "skip";

type Progress = { pending: number; enriched: number; review: number; total: number };

const STATUS_STYLES: Record<StagedRow["status"], string> = {
  ready: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  review: "bg-amber-500/10 text-amber-700 dark:text-amber-500",
  failed: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export default function ImportPage() {
  const t = useTranslations("import");
  const [staged, setStaged] = useState<Staged | null>(null);
  const [actions, setActions] = useState<Record<number, RowAction>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<{ created: number; merged: number; skipped: number } | null>(null);
  const [reviewCards, setReviewCards] = useState<
    { id: string; name: string; category: string; reviewReason: string | null }[]
  >([]);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setStaged(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/import/stage", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not read that file.");
      setStaged(data);
      // Duplicates default to merge so a re-import tops up quantity instead of doubling inventory.
      const defaults: Record<number, RowAction> = {};
      for (const row of data.rows as StagedRow[]) {
        if (row.status === "failed") defaults[row.rowNumber] = "skip";
        else defaults[row.rowNumber] = row.duplicateOf ? "merge" : "new";
      }
      setActions(defaults);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  const importable = staged?.rows.filter((r) => r.status !== "failed" && actions[r.rowNumber] !== "skip") ?? [];

  async function commit() {
    if (!staged) return;
    setBusy(true);
    setError(null);
    try {
      const rows = importable.map((row) => ({
        card: row.card,
        action: actions[row.rowNumber] ?? "new",
        duplicateOfId: row.duplicateOf?.id ?? null,
        needsReview: row.status === "review",
        reviewReason: row.issues.join("; ") || null,
      }));
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: staged.fileName, rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Import failed.");
      setResult({ created: data.created, merged: data.merged, skipped: data.skipped });
      setBatchId(data.batch.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  // Drive enrichment in chunks and poll progress. Chunked rather than one long call so
  // a big import can't be cut off by a serverless timeout part-way through.
  const pump = useCallback(async (id: string) => {
    const status = await fetch(`/api/import/${id}`).then((r) => r.json());
    setProgress(status.progress);
    if (status.batch.status === "complete") {
      const cards = await fetch("/api/cards").then((r) => r.json());
      setReviewCards(
        cards
          .filter((c: { importBatchId?: string; needsReview?: boolean }) => c.importBatchId === id && c.needsReview)
          .map((c: { id: string; name: string; category: string; reviewReason: string | null }) => ({
            id: c.id,
            name: c.name,
            category: c.category,
            reviewReason: c.reviewReason,
          }))
      );
      return true;
    }
    await fetch(`/api/import/${id}/enrich`, { method: "POST" });
    return false;
  }, []);

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 200 && !cancelled; i++) {
        const done = await pump(batchId);
        if (done) break;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batchId, pump]);

  function reset() {
    setStaged(null);
    setResult(null);
    setBatchId(null);
    setProgress(null);
    setReviewCards([]);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-1 mb-5 text-sm text-foreground/60">{t("subtitle")}</p>

      {!staged && !result && (
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="block w-full text-sm"
        />
      )}
      {busy && !staged && <p className="mt-3 text-sm text-foreground/60">{t("parsing")}</p>}
      {error && <InlineError message={error} className="mt-3" />}

      {staged && !result && (
        <>
          <div className="mt-4 rounded-md border border-border-1 p-3 text-sm">
            <p className="font-medium">
              {t("summaryHeading", {
                total: staged.summary.total,
                ready: staged.summary.ready,
                review: staged.summary.review,
                failed: staged.summary.failed,
              })}
            </p>
            {staged.sheetName && (
              <p className="mt-1 text-foreground/60">
                {t("sheetLabel")}: {staged.sheetName}
              </p>
            )}
            {staged.summary.duplicates > 0 && (
              <p className="mt-1 text-foreground/60">{t("duplicatesFound", { count: staged.summary.duplicates })}</p>
            )}
            {staged.unmappedHeaders.length > 0 && (
              <p className="mt-1 text-foreground/60">
                {t("unmappedHeaders", { headers: staged.unmappedHeaders.join(", ") })}
              </p>
            )}
            {staged.enrichment
              .filter((e) => !e.configured)
              .map((e) => (
                <p key={e.category} className="mt-1 text-amber-700 dark:text-amber-500">
                  {t("enrichmentOff", { category: e.category, envVar: e.envVar })}
                </p>
              ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-border-1 text-xs uppercase text-foreground/50">
                <tr>
                  <th className="py-2 pr-3">{t("colRow")}</th>
                  <th className="py-2 pr-3">{t("colStatus")}</th>
                  <th className="py-2 pr-3">{t("colName")}</th>
                  <th className="py-2 pr-3">{t("colCategory")}</th>
                  <th className="py-2 pr-3">{t("colSeries")}</th>
                  <th className="py-2 pr-3">{t("colPrice")}</th>
                  <th className="py-2 pr-3">{t("colAction")}</th>
                  <th className="py-2">{t("colIssues")}</th>
                </tr>
              </thead>
              <tbody>
                {staged.rows.map((row) => (
                  <tr key={row.rowNumber} className="border-b border-border-1/50 align-top">
                    <td className="py-2 pr-3 text-foreground/50">{row.rowNumber}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}>
                        {t(row.status === "ready" ? "statusReady" : row.status === "review" ? "statusReview" : "statusFailed")}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{(row.card?.name as string) ?? "—"}</td>
                    <td className="py-2 pr-3">{(row.card?.category as string) ?? "—"}</td>
                    <td className="py-2 pr-3">{(row.card?.series as string) ?? "—"}</td>
                    <td className="py-2 pr-3">{(row.card?.askingPrice as number) ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {row.status === "failed" ? (
                        <span className="text-foreground/40">—</span>
                      ) : (
                        <select
                          value={actions[row.rowNumber] ?? "new"}
                          onChange={(e) =>
                            setActions((prev) => ({ ...prev, [row.rowNumber]: e.target.value as RowAction }))
                          }
                          className="rounded border border-border-1 bg-transparent px-1.5 py-1 text-xs"
                        >
                          <option value="new">{t("actionNew")}</option>
                          {row.duplicateOf && <option value="merge">{t("actionMerge")}</option>}
                          <option value="skip">{t("actionSkip")}</option>
                        </select>
                      )}
                    </td>
                    <td className="py-2 text-xs text-foreground/60">{row.issues.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {staged.summary.failed > 0 && <p className="mt-3 text-xs text-foreground/50">{t("failedNote")}</p>}

          <div className="mt-4 flex gap-2">
            <button
              onClick={commit}
              disabled={busy || importable.length === 0}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {busy ? t("committing") : t("commit", { count: importable.length })}
            </button>
            <button onClick={reset} className="rounded-md border border-border-1 px-4 py-2 text-sm">
              {t("startOver")}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="mt-4 rounded-md border border-border-1 p-4">
          <h2 className="text-lg font-semibold">{t("resultHeading")}</h2>
          <p className="mt-1 text-sm">
            {t("resultLine", { created: result.created, merged: result.merged, skipped: result.skipped })}
          </p>
          {progress && progress.pending > 0 && (
            <p className="mt-2 text-sm text-foreground/60">
              {t("enrichingProgress", { done: progress.total - progress.pending, total: progress.total })}
            </p>
          )}
          {progress && progress.pending === 0 && (
            <p className="mt-2 text-sm text-foreground/60">
              {t("enrichmentDone")} {t("resultEnriched", { enriched: progress.enriched })}
            </p>
          )}

          {reviewCards.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold">
                {t("reviewHeading")} — {t("resultReview", { count: reviewCards.length })}
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                {reviewCards.map((card) => (
                  <li key={card.id} className="flex flex-wrap items-baseline gap-2">
                    <Link href={`/${encodeURIComponent(card.category)}/card/${card.id}`} className="font-medium underline">
                      {card.name}
                    </Link>
                    <span className="text-xs text-foreground/60">{card.reviewReason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={reset} className="mt-4 rounded-md border border-border-1 px-4 py-2 text-sm">
            {t("startOver")}
          </button>
        </div>
      )}
    </div>
  );
}
