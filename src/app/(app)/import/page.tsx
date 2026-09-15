"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { InlineError } from "@/components/ui/InlineError";
import { MappingStep } from "@/components/import/MappingStep";
import { CategoryStep } from "@/components/import/CategoryStep";
import { StagingStep } from "@/components/import/StagingStep";
import type { ImportField } from "@/lib/import/fields";
import type { CategoryValueSuggestion, FieldMap, FieldSuggestion } from "@/lib/import/mapping";
import type { MatchStatus, RowAction, StagedImport } from "@/lib/import/stage";

type RawRow = { rowNumber: number; cells: string[] };

type Parsed = {
  fileName: string;
  sheetName: string | null;
  headers: string[];
  rows: RawRow[];
  headerSignature: string;
  fields: ImportField[];
  suggestions: FieldSuggestion[];
  fieldMap: FieldMap;
  appliedTemplate: { id: string; name: string; score: number } | null;
  templates: { id: string; name: string; score: number }[];
  categories: { key: string; displayName: string }[];
  enrichment: { category: string; envVar: string; configured: boolean }[];
};

type Progress = { pending: number; enriched: number; review: number; total: number };

type Batch = {
  id: string;
  fileName: string;
  createdAt: string;
  rowCount: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  enrichedCount: number;
  status: string;
};

/**
 * Four steps: upload -> map columns -> map category values -> review -> commit.
 *
 * The parsed rows live in this component, not on the server, so nothing exists
 * anywhere until the final confirm — and changing a mapping re-previews without
 * re-uploading the file.
 */
type Step = "upload" | "map" | "categories" | "stage" | "done";

export default function ImportPage() {
  const t = useTranslations("import");
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [fieldMap, setFieldMap] = useState<FieldMap>({});
  const [categoryValues, setCategoryValues] = useState<CategoryValueSuggestion[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [staged, setStaged] = useState<StagedImport | null>(null);
  const [actions, setActions] = useState<Record<number, RowAction>>({});

  const [saveTemplate, setSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const [result, setResult] = useState<{
    created: number;
    updated: number;
    merged: number;
    skipped: number;
  } | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [reviewCards, setReviewCards] = useState<
    { id: string; name: string; category: string; reviewReason: string | null }[]
  >([]);
  const fileInput = useRef<HTMLInputElement>(null);

  // Import history is server state, so it is fetched the way the rest of the app
  // fetches server state rather than through an effect that writes local state.
  const queryClient = useQueryClient();
  const { data: history = [] } = useQuery<Batch[]>({
    queryKey: ["importBatches"],
    queryFn: async () => {
      const res = await fetch("/api/import");
      if (!res.ok) throw new Error("Failed to load import history");
      return res.json();
    },
  });
  const refreshHistory = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["importBatches"] });
  }, [queryClient]);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/import/parse", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("errRead"));
      setParsed(data);
      setFieldMap(data.fieldMap);
      setTemplateName(data.appliedTemplate?.name ?? file.name.replace(/\.[^.]+$/, ""));
      setSaveTemplate(!data.appliedTemplate);
      setStep("map");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errRead"));
    } finally {
      setBusy(false);
    }
  }

  async function goToCategories() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import/resolve-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers: parsed.headers,
          rows: parsed.rows,
          categoryHeader: fieldMap.category ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : t("errCategoryColumn"));
      setCategoryValues(data.values);

      // Seed from the saved template first, then from this run's suggestions, so a
      // template's deliberate choice is never overwritten by a fresh guess.
      const seeded: Record<string, string> = {};
      for (const value of data.values as CategoryValueSuggestion[]) {
        const key = value.value.toLowerCase();
        if (categoryMap[key]) seeded[key] = categoryMap[key];
        else if (value.categoryKey) seeded[key] = value.categoryKey;
      }
      setCategoryMap(seeded);
      setStep("categories");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errCategoryColumn"));
    } finally {
      setBusy(false);
    }
  }

  async function goToStaging() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers: parsed.headers,
          rows: parsed.rows,
          fieldMap,
          categoryMap,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : t("errStage"));
      setStaged(data);
      const defaults: Record<number, RowAction> = {};
      for (const row of (data as StagedImport).rows) defaults[row.rowNumber] = row.suggestedAction;
      setActions(defaults);
      setStep("stage");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errStage"));
    } finally {
      setBusy(false);
    }
  }

  function applyBulk(status: MatchStatus, action: RowAction) {
    if (!staged) return;
    setActions((prev) => {
      const next = { ...prev };
      for (const row of staged.rows) {
        if (row.match !== status || row.match === "failed") continue;
        // "Update"/"merge" need something to update; a row with no match can only
        // ever be added or skipped, so a sweeping choice degrades rather than
        // silently producing an action the commit endpoint would drop.
        if ((action === "update" || action === "merge") && !row.existing) next[row.rowNumber] = "new";
        else next[row.rowNumber] = action;
      }
      return next;
    });
  }

  async function commit() {
    if (!parsed || !staged) return;
    setBusy(true);
    setError(null);
    try {
      const rows = staged.rows
        .filter((row) => row.card !== null)
        .map((row) => {
          const action = actions[row.rowNumber] ?? row.suggestedAction;
          return {
            card: row.card,
            // An unresolved "needs review" row is a skip, not a guess.
            action: action === "undecided" ? ("skip" as const) : action,
            existingId: row.existing?.id ?? null,
            needsReview: row.issues.length > 0 || row.match === "possible",
            reviewReason: row.issues.join("; ") || null,
          };
        });

      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: parsed.fileName,
          rows,
          saveTemplate:
            saveTemplate && templateName.trim()
              ? {
                  name: templateName.trim(),
                  headerSignature: parsed.headerSignature,
                  fieldMap,
                  categoryMap,
                }
              : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : t("errImport"));
      setResult({
        created: data.created,
        updated: data.updated,
        merged: data.merged,
        skipped: data.skipped,
      });
      setBatchId(data.batch.id);
      setStep("done");
      refreshHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errImport"));
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
    setStep("upload");
    setParsed(null);
    setFieldMap({});
    setCategoryValues([]);
    setCategoryMap({});
    setStaged(null);
    setActions({});
    setResult(null);
    setBatchId(null);
    setProgress(null);
    setReviewCards([]);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
    refreshHistory();
  }

  const missingRequired = parsed
    ? parsed.fields.filter((field) => field.required && !fieldMap[field.key])
    : [];

  const committable = staged
    ? staged.rows.some((row) => {
        const action = actions[row.rowNumber] ?? row.suggestedAction;
        return action === "new" || action === "update" || action === "merge";
      })
    : false;

  const STEP_LABELS: [Step, string][] = [
    ["upload", t("stepUpload")],
    ["map", t("stepColumns")],
    ["categories", t("stepCategories")],
    ["stage", t("stepReview")],
    ["done", t("stepDone")],
  ];
  const stepIndex = STEP_LABELS.findIndex(([key]) => key === step);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-sm text-foreground/60">{t("subtitle")}</p>

      <ol className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-xs">
        {STEP_LABELS.map(([key, label], index) => (
          <li
            key={key}
            className={
              index === stepIndex
                ? "font-semibold text-foreground"
                : index < stepIndex
                  ? "text-foreground/50"
                  : "text-foreground/30"
            }
          >
            {index + 1}. {label}
            {index < STEP_LABELS.length - 1 && <span className="ml-2 text-foreground/20">→</span>}
          </li>
        ))}
      </ol>

      {error && <InlineError message={error} className="mt-4" />}

      {step === "upload" && (
        <div className="mt-4">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="block w-full text-sm"
          />
          {busy && <p className="mt-3 text-sm text-foreground/60">{t("parsing")}</p>}

          {history.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold">{t("historyHeading")}</h2>
              <p className="mt-0.5 text-xs text-foreground/50">{t("historySubtitle")}</p>
              <div className="mt-2 overflow-x-auto rounded-md border border-border-1">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="border-b border-border-1 bg-surface-1 text-xs uppercase text-foreground/50">
                    <tr>
                      <th className="px-2 py-2">{t("histFile")}</th>
                      <th className="px-2 py-2">{t("histWhen")}</th>
                      <th className="px-2 py-2">{t("histNew")}</th>
                      <th className="px-2 py-2">{t("histUpdated")}</th>
                      <th className="px-2 py-2">{t("histSkipped")}</th>
                      <th className="px-2 py-2">{t("histStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((batch) => (
                      <tr key={batch.id} className="border-b border-border-1/50 last:border-0">
                        <td className="px-2 py-2">{batch.fileName}</td>
                        <td className="px-2 py-2 text-foreground/60">
                          {new Date(batch.createdAt).toLocaleString()}
                        </td>
                        <td className="px-2 py-2">{batch.importedCount}</td>
                        <td className="px-2 py-2">{batch.updatedCount}</td>
                        <td className="px-2 py-2">{batch.skippedCount}</td>
                        <td className="px-2 py-2 text-foreground/60">{batch.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {step === "map" && parsed && (
        <div className="mt-4">
          <p className="mb-3 text-sm text-foreground/60">
            {parsed.sheetName
              ? t("fileMetaWithSheet", {
                  fileName: parsed.fileName,
                  sheetName: parsed.sheetName,
                  rows: parsed.rows.length,
                })
              : t("fileMetaNoSheet", { fileName: parsed.fileName, rows: parsed.rows.length })}
          </p>
          <MappingStep
            fields={parsed.fields}
            headers={parsed.headers}
            rows={parsed.rows}
            suggestions={parsed.suggestions}
            fieldMap={fieldMap}
            onChange={setFieldMap}
            appliedTemplate={parsed.appliedTemplate}
          />
          <div className="mt-5 flex gap-2">
            <button
              onClick={goToCategories}
              disabled={busy || missingRequired.length > 0}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {busy ? t("working") : t("nextCategories")}
            </button>
            <button onClick={reset} className="rounded-md border border-border-1 px-4 py-2 text-sm">
              {t("startOver")}
            </button>
          </div>
        </div>
      )}

      {step === "categories" && parsed && (
        <div className="mt-4">
          <CategoryStep
            values={categoryValues}
            categories={parsed.categories}
            categoryMap={categoryMap}
            onChange={setCategoryMap}
          />
          <div className="mt-5 flex gap-2">
            <button
              onClick={goToStaging}
              disabled={busy}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {busy ? t("checkingInventory") : t("nextReview")}
            </button>
            <button
              onClick={() => setStep("map")}
              className="rounded-md border border-border-1 px-4 py-2 text-sm"
            >
              {t("backToColumns")}
            </button>
          </div>
        </div>
      )}

      {step === "stage" && staged && parsed && (
        <div className="mt-4">
          <StagingStep
            staged={staged}
            actions={actions}
            onActionChange={(rowNumber, action) =>
              setActions((prev) => ({ ...prev, [rowNumber]: action }))
            }
            onBulkChange={applyBulk}
          />

          {parsed.enrichment
            .filter((e) => !e.configured)
            .map((e) => (
              <p key={e.category} className="mt-2 text-xs text-amber-700 dark:text-amber-500">
                {t("enrichmentOff", { category: e.category, envVar: e.envVar })}
              </p>
            ))}

          <label className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={saveTemplate}
              onChange={(e) => setSaveTemplate(e.target.checked)}
            />
            {t("saveTemplateLabel")}
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              disabled={!saveTemplate}
              placeholder={t("saveTemplatePlaceholder")}
              className="rounded border border-border-1 bg-transparent px-2 py-1 text-sm disabled:opacity-50"
            />
          </label>

          <div className="mt-4 flex gap-2">
            <button
              onClick={commit}
              disabled={busy || !committable}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {busy ? t("committing") : t("confirmImport")}
            </button>
            <button
              onClick={() => setStep("categories")}
              className="rounded-md border border-border-1 px-4 py-2 text-sm"
            >
              {t("back")}
            </button>
            <button onClick={reset} className="rounded-md border border-border-1 px-4 py-2 text-sm">
              {t("startOver")}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="mt-4 rounded-md border border-border-1 p-4">
          <h2 className="text-lg font-semibold">{t("resultHeading")}</h2>
          <p className="mt-1 text-sm">
            {t("resultLine", {
              created: result.created,
              updated: result.updated,
              merged: result.merged,
              skipped: result.skipped,
            })}
          </p>
          {progress && progress.pending > 0 && (
            <p className="mt-2 text-sm text-foreground/60">
              {t("enrichingProgress", {
                done: progress.total - progress.pending,
                total: progress.total,
              })}
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
                {t("reviewHeading", { count: reviewCards.length })}
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                {reviewCards.map((card) => (
                  <li key={card.id} className="flex flex-wrap items-baseline gap-2">
                    <Link
                      href={`/${encodeURIComponent(card.category)}/card/${card.id}`}
                      className="font-medium underline"
                    >
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
