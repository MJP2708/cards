"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, AlertTriangle } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { STATUS_VALUES, useStatusLabel } from "@/lib/statusLabels";
import { InlineError } from "@/components/ui/InlineError";
import type { MassDeletePlan, MassDeleteResult } from "@/lib/cards/massDelete";

const CONFIRM_PHRASE = "DELETE";

/**
 * Clearing inventory in bulk.
 *
 * Three deliberate pieces of friction, because this is the one action in the app
 * with no undo: you preview first and cannot skip it, the confirm phrase has to
 * be typed, and the preview is re-fetched whenever the filter changes so the
 * number you confirm against is always the number you are about to act on.
 */
export function MassDeletePanel() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const statusLabel = useStatusLabel();
  const { data: categories } = useCategories();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("");
  const [resetNumbering, setResetNumbering] = useState(false);
  const [plan, setPlan] = useState<MassDeletePlan | null>(null);
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<MassDeleteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(apply: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cards/mass-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category === "all" ? undefined : category,
          status: status || undefined,
          apply,
          confirm: apply ? confirm : undefined,
          resetNumbering,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : t("massDeleteFailed"));
      setPlan(data.plan);
      if (apply && data.applied) {
        setResult(data.applied);
        setConfirm("");
        queryClient.invalidateQueries({ queryKey: ["cards"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("massDeleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  // Any change to what would be deleted invalidates the number already shown.
  function changeFilter(next: () => void) {
    next();
    setPlan(null);
    setResult(null);
    setConfirm("");
  }

  return (
    <section className="space-y-3 rounded-lg border border-red-300 p-4 dark:border-red-900">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        {t("massDeleteTitle")}
      </h2>
      <p className="text-xs text-foreground/60">{t("massDeleteHelp")}</p>

      {error && <InlineError message={error} />}

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex flex-col gap-1 text-xs">
          {t("massDeleteCategory")}
          <select
            value={category}
            onChange={(e) => changeFilter(() => setCategory(e.target.value))}
            className="rounded-md border border-border-1 px-2 py-1.5 text-sm"
          >
            <option value="all">{common("allCategories")}</option>
            {categories?.map((c) => (
              <option key={c.key} value={c.key}>
                {c.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          {t("massDeleteStatus")}
          <select
            value={status}
            onChange={(e) => changeFilter(() => setStatus(e.target.value))}
            className="rounded-md border border-border-1 px-2 py-1.5 text-sm"
          >
            <option value="">{t("massDeleteAnyStatus")}</option>
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        onClick={() => call(false)}
        disabled={busy}
        className="rounded-md border border-border-1 px-3 py-2 text-sm hover:bg-surface-1 disabled:opacity-50"
      >
        {busy && !plan ? t("massDeleteChecking") : t("massDeletePreview")}
      </button>

      {plan && (
        <div className="space-y-2 rounded-md border border-border-1 bg-surface-1 p-3 text-sm">
          <p className="font-medium">{t("massDeleteWillRemove", { count: plan.deletable })}</p>

          {plan.sample.length > 0 && (
            <ul className="space-y-0.5 text-xs text-foreground/60">
              {plan.sample.map((card) => (
                <li key={card.lookupNumber}>
                  #{card.lookupNumber} {card.name} — {card.series}
                </li>
              ))}
              {plan.deletable > plan.sample.length && (
                <li>{t("massDeleteAndMore", { count: plan.deletable - plan.sample.length })}</li>
              )}
            </ul>
          )}

          {(plan.priceComps > 0 || plan.priceSnapshots > 0) && (
            <p className="text-xs text-foreground/60">
              {t("massDeleteAlsoRemoves", { comps: plan.priceComps, snapshots: plan.priceSnapshots })}
            </p>
          )}

          {plan.blocked.length > 0 && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              {t("massDeleteBlocked", {
                count: plan.blocked.length,
                examples: plan.blocked.slice(0, 4).map((c) => `#${c.lookupNumber} ${c.name}`).join(", "),
              })}
            </p>
          )}

          {plan.deletable === 0 ? (
            <p className="text-xs text-foreground/60">{t("massDeleteNothing")}</p>
          ) : (
            <>
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={resetNumbering}
                  onChange={(e) => setResetNumbering(e.target.checked)}
                  className="mt-0.5"
                />
                <span>{t("massDeleteResetNumbering")}</span>
              </label>

              <label className="flex flex-col gap-1 text-xs">
                {t("massDeleteTypeConfirm", { phrase: CONFIRM_PHRASE })}
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  className="w-40 rounded-md border border-border-1 px-2 py-1.5 font-mono text-sm"
                />
              </label>

              <button
                onClick={() => call(true)}
                disabled={busy || confirm !== CONFIRM_PHRASE}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                {busy ? t("massDeleteDeleting") : t("massDeleteConfirmButton", { count: plan.deletable })}
              </button>
            </>
          )}
        </div>
      )}

      {result && (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {t("massDeleteDone", { count: result.deleted })}{" "}
          {result.blocked > 0 && t("massDeleteKept", { count: result.blocked })}{" "}
          {t("massDeleteNextNumber", { number: result.nextLookupNumber })}
        </p>
      )}
    </section>
  );
}
