"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useBulkAction } from "@/lib/data/cards";
import { actionWithUndo } from "@/lib/undoToast";
import { Button } from "@/components/ui/Button";

export function BulkActionsBar({
  selectedIds,
  onClear,
  onSellBundle,
}: {
  selectedIds: string[];
  onClear: () => void;
  onSellBundle: () => void;
}) {
  const t = useTranslations("inventory");
  const common = useTranslations("common");
  const bulkAction = useBulkAction();
  const [adjusting, setAdjusting] = useState(false);
  const [amount, setAmount] = useState("10");
  const [mode, setMode] = useState<"percent" | "fixed">("percent");

  if (selectedIds.length === 0) return null;

  return (
    <div className="motif-surface sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-accent bg-surface-1 px-3 py-2 text-sm">
      <span className="font-medium">{t("selected", { count: selectedIds.length })}</span>

      <Button size="sm" booth onClick={onSellBundle}>
        {selectedIds.length > 1 ? t("sellBundle") : t("sell")}
      </Button>

      {!adjusting ? (
        <Button size="sm" booth variant="secondary" onClick={() => setAdjusting(true)}>
          {t("adjustPrice")}
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <select value={mode} onChange={(e) => setMode(e.target.value as "percent" | "fixed")} className="rounded-md border border-border px-2 py-1.5">
            <option value="percent">%</option>
            <option value="fixed">THB</option>
          </select>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-20 rounded-md border border-border px-2 py-1.5"
          />
          <Button
            size="sm"
            onClick={async () => {
              await bulkAction.mutateAsync({ ids: selectedIds, action: "priceAdjust", payload: { mode, amount: Number(amount) } });
              setAdjusting(false);
            }}
          >
            {t("apply")}
          </Button>
        </div>
      )}

      <Button size="sm" booth variant="secondary" onClick={() => bulkAction.mutate({ ids: selectedIds, action: "markPacked" })}>
        {t("markPacked")}
      </Button>
      <Button size="sm" booth variant="secondary" onClick={() => bulkAction.mutate({ ids: selectedIds, action: "markUnpacked" })}>
        {t("markUnpacked")}
      </Button>

      <Button
        size="sm"
        booth
        variant="destructive"
        className="border border-[var(--danger-200)] dark:border-[color-mix(in_srgb,var(--danger-600)_45%,transparent)]"
        onClick={() => {
          const ids = selectedIds;
          actionWithUndo(t("cardsDeleted", { count: ids.length }), () => {
            bulkAction.mutate({ ids, action: "delete" });
          });
          onClear();
        }}
      >
        {common("delete")}
      </Button>

      <Button size="sm" variant="ghost" onClick={onClear} className="ml-auto">
        {t("clear")}
      </Button>
    </div>
  );
}
