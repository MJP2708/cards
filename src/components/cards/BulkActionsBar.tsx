"use client";

import { useState } from "react";
import { useBulkAction } from "@/lib/data/cards";
import { actionWithUndo } from "@/lib/undoToast";

export function BulkActionsBar({
  selectedIds,
  onClear,
  onSellBundle,
}: {
  selectedIds: string[];
  onClear: () => void;
  onSellBundle: () => void;
}) {
  const bulkAction = useBulkAction();
  const [adjusting, setAdjusting] = useState(false);
  const [amount, setAmount] = useState("10");
  const [mode, setMode] = useState<"percent" | "fixed">("percent");

  if (selectedIds.length === 0) return null;

  return (
    <div className="motif-surface sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-accent bg-surface-1 px-3 py-2 text-sm">
      <span className="font-medium">{selectedIds.length} selected</span>

      <button
        onClick={onSellBundle}
        className="booth-target rounded-md bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-dark"
      >
        Sell {selectedIds.length > 1 ? "as Bundle" : ""}
      </button>

      {!adjusting ? (
        <button
          onClick={() => setAdjusting(true)}
          className="booth-target rounded-md border border-border-1 px-3 py-1.5 hover:bg-background"
        >
          Adjust price
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <select value={mode} onChange={(e) => setMode(e.target.value as "percent" | "fixed")} className="rounded-md border border-border-1 px-2 py-1.5">
            <option value="percent">%</option>
            <option value="fixed">THB</option>
          </select>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-20 rounded-md border border-border-1 px-2 py-1.5"
          />
          <button
            onClick={async () => {
              await bulkAction.mutateAsync({ ids: selectedIds, action: "priceAdjust", payload: { mode, amount: Number(amount) } });
              setAdjusting(false);
            }}
            className="rounded-md bg-accent px-2 py-1.5 text-white"
          >
            Apply
          </button>
        </div>
      )}

      <button
        onClick={() => bulkAction.mutate({ ids: selectedIds, action: "markPacked" })}
        className="booth-target rounded-md border border-border-1 px-3 py-1.5 hover:bg-background"
      >
        Mark packed
      </button>
      <button
        onClick={() => bulkAction.mutate({ ids: selectedIds, action: "markUnpacked" })}
        className="booth-target rounded-md border border-border-1 px-3 py-1.5 hover:bg-background"
      >
        Mark unpacked
      </button>

      <button
        onClick={() => {
          const ids = selectedIds;
          actionWithUndo(`${ids.length} card${ids.length === 1 ? "" : "s"} deleted`, () => {
            bulkAction.mutate({ ids, action: "delete" });
          });
          onClear();
        }}
        className="booth-target rounded-md border border-red-300 px-3 py-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
      >
        Delete
      </button>

      <button onClick={onClear} className="ml-auto rounded-md px-3 py-1.5 hover:bg-background">
        Clear
      </button>
    </div>
  );
}
