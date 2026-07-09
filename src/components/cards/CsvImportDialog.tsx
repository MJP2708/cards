"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CategoryDTO } from "@/lib/categories";
import { csvTemplateFor, parseCsvForCategory } from "@/lib/csv";
import { useImportCards } from "@/lib/data/cards";

export function CsvImportDialog({ category, onClose }: { category: CategoryDTO; onClose: () => void }) {
  const t = useTranslations("dialogs");
  const importCards = useImportCards();
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);

  function downloadTemplate() {
    const csv = csvTemplateFor(category);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${category.key}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setErrors([]);
    setResult(null);
    const text = await file.text();
    const { rows, errors: parseErrors } = parseCsvForCategory(text, category);
    if (parseErrors.length > 0) {
      setErrors(parseErrors);
      return;
    }
    try {
      const res = await importCards.mutateAsync({ category: category.key, rows });
      setResult(t("importedCount", { count: res.count }));
    } catch (e) {
      setErrors([e instanceof Error ? e.message : t("importFailed")]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border-1 bg-background p-5 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold">{t("bulkImportTitle", { category: category.displayName })}</h2>
        <p className="mb-3 text-sm text-foreground/60">{t("csvHelp")}</p>
        <button onClick={downloadTemplate} className="mb-4 rounded-md border border-border-1 px-3 py-1.5 text-sm hover:bg-surface-1">
          {t("downloadTemplate")}
        </button>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="mb-3 block w-full text-sm"
        />
        {errors.length > 0 && (
          <div className="mb-3 max-h-32 overflow-y-auto rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}
        {result && <p className="mb-3 text-sm text-emerald-600">{result}</p>}
        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm hover:bg-surface-1">
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
