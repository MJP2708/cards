"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { CategoryValueSuggestion } from "@/lib/import/mapping";

/**
 * Step 2 of the wizard: the same matching problem, one level down.
 *
 * Mapping a column called "Sport" to `category` says nothing about what the words
 * inside it mean — a seller writes "Basketball" where this store's category is
 * "NBA". Each distinct value gets its own decision, and a value with no match is
 * shown as needing a category created rather than being dropped or guessed at.
 */
export function CategoryStep({
  values,
  categories,
  categoryMap,
  onChange,
}: {
  values: CategoryValueSuggestion[];
  categories: { key: string; displayName: string }[];
  categoryMap: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const t = useTranslations("import");
  const unresolved = values.filter((v) => !categoryMap[v.value.toLowerCase()]);
  const affectedRows = unresolved.reduce((sum, v) => sum + v.rowCount, 0);

  return (
    <div>
      <h2 className="text-lg font-semibold">{t("catHeading")}</h2>
      <p className="mt-1 text-sm text-foreground/60">{t("catIntro", { count: values.length })}</p>

      {values.length === 0 && (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {t("catNoColumn")}
        </p>
      )}

      {unresolved.length > 0 && (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {t("catUnresolved", { values: unresolved.length, rows: affectedRows })}{" "}
          {t("catCreatePrefix")}{" "}
          <Link href="/settings/categories" className="underline">
            {t("catCreateLink")}
          </Link>
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="border-b border-border-1 text-xs uppercase text-foreground/50">
            <tr>
              <th className="py-2 pr-3">{t("catColValue")}</th>
              <th className="py-2 pr-3">{t("catColRows")}</th>
              <th className="py-2 pr-3">{t("catColStoreCategory")}</th>
              <th className="py-2">{t("catColMatch")}</th>
            </tr>
          </thead>
          <tbody>
            {values.map((value) => {
              const key = value.value.toLowerCase();
              const chosen = categoryMap[key] ?? "";
              return (
                <tr key={key} className="border-b border-border-1/50">
                  <td className="py-2 pr-3 font-medium">{value.value}</td>
                  <td className="py-2 pr-3 text-foreground/50">{value.rowCount}</td>
                  <td className="py-2 pr-3">
                    <select
                      aria-label={t("catSelectLabel", { value: value.value })}
                      value={chosen}
                      onChange={(e) => {
                        const next = { ...categoryMap };
                        if (e.target.value) next[key] = e.target.value;
                        else delete next[key];
                        onChange(next);
                      }}
                      className="w-full max-w-[14rem] rounded border border-border-1 bg-transparent px-2 py-1 text-sm"
                    >
                      <option value="">{t("catNeedsNew")}</option>
                      {categories.map((category) => (
                        <option key={category.key} value={category.key}>
                          {category.displayName}
                          {category.displayName === category.key ? "" : ` (${category.key})`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 text-xs text-foreground/60">
                    {value.categoryKey && chosen === value.categoryKey
                      ? value.score >= 0.999
                        ? t("catMatchExact")
                        : t("catMatchSuggested", { percent: Math.round(value.score * 100) })
                      : chosen
                        ? t("catMatchChosen")
                        : t("catMatchNone")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
