"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ImportField } from "@/lib/import/fields";
import type { FieldMap, FieldSuggestion } from "@/lib/import/mapping";
import { CONFIDENT_SCORE } from "@/lib/import/mapping";

type RawRow = { rowNumber: number; cells: string[] };

const PREVIEW_ROWS = 5;

/**
 * Step 1 of the wizard: say what each column in *this* sheet means.
 *
 * The dropdowns alone are not enough to trust a mapping — "Name" and "Card Name"
 * both look right in a dropdown and one of them can still be the wrong column.
 * So the live preview underneath shows real cell values under the app's own
 * field names, which is the thing that actually catches a mis-mapping.
 */
export function MappingStep({
  fields,
  headers,
  rows,
  suggestions,
  fieldMap,
  onChange,
  appliedTemplate,
}: {
  fields: ImportField[];
  headers: string[];
  rows: RawRow[];
  suggestions: FieldSuggestion[];
  fieldMap: FieldMap;
  onChange: (next: FieldMap) => void;
  appliedTemplate: { id: string; name: string; score: number } | null;
}) {
  const t = useTranslations("import");
  const suggestionByField = useMemo(
    () => new Map(suggestions.map((s) => [s.fieldKey, s])),
    [suggestions]
  );

  const previewRows = rows.slice(0, PREVIEW_ROWS);
  const mappedFields = fields.filter((field) => fieldMap[field.key]);

  // Two fields reading the same column is occasionally deliberate and usually a
  // slip, so it is surfaced rather than blocked.
  const doubleMapped = useMemo(() => {
    const counts = new Map<string, string[]>();
    for (const field of fields) {
      const header = fieldMap[field.key];
      if (!header) continue;
      counts.set(header, [...(counts.get(header) ?? []), field.label]);
    }
    return [...counts.entries()].filter(([, labels]) => labels.length > 1);
  }, [fields, fieldMap]);

  const missingRequired = fields.filter((field) => field.required && !fieldMap[field.key]);

  function cellFor(row: RawRow, field: ImportField): string {
    const header = fieldMap[field.key];
    if (!header) return "";
    const index = headers.indexOf(header);
    return index === -1 ? "" : row.cells[index] ?? "";
  }

  return (
    <div>
      <h2 className="text-lg font-semibold">{t("mapHeading")}</h2>
      <p className="mt-1 text-sm text-foreground/60">{t("mapIntro", { count: headers.length })}</p>

      {appliedTemplate && (
        <p className="mt-3 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300">
          {t("mapTemplateApplied", {
            name: appliedTemplate.name,
            percent: Math.round(appliedTemplate.score * 100),
          })}
        </p>
      )}

      {missingRequired.length > 0 && (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {t("mapMissingRequired", { fields: missingRequired.map((f) => f.label).join(", ") })}
        </p>
      )}

      {doubleMapped.length > 0 && (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {t("mapDoubleMapped", {
            details: doubleMapped
              .map(([header, labels]) =>
                t("mapDoubleMappedItem", { header, fields: labels.join(", ") })
              )
              .join("; "),
          })}
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border-1 text-xs uppercase text-foreground/50">
            <tr>
              <th className="py-2 pr-3">{t("mapColAppField")}</th>
              <th className="py-2 pr-3">{t("mapColYourColumn")}</th>
              <th className="py-2">{t("mapColIfNotMapped")}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => {
              const suggestion = suggestionByField.get(field.key);
              const isWeakGuess =
                suggestion?.header && suggestion.score < CONFIDENT_SCORE && !fieldMap[field.key];

              return (
                <tr key={field.key} className="border-b border-border-1/50 align-top">
                  <td className="py-2 pr-3">
                    <span className="font-medium">{field.label}</span>
                    {field.required && (
                      <span className="ml-1.5 rounded bg-foreground/10 px-1 py-0.5 text-[10px] font-medium uppercase">
                        {t("mapRequired")}
                      </span>
                    )}
                    {field.kind === "attribute" && (
                      <span className="ml-1.5 text-[11px] text-foreground/40">
                        {t("mapCategoryField")}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      aria-label={t("mapColumnLabel", { field: field.label })}
                      value={fieldMap[field.key] ?? ""}
                      onChange={(e) =>
                        onChange({ ...fieldMap, [field.key]: e.target.value || null })
                      }
                      className="w-full max-w-[16rem] rounded border border-border-1 bg-transparent px-2 py-1 text-sm"
                    >
                      <option value="">{t("mapNotMapped")}</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                    {isWeakGuess && (
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-500">
                        {t("mapWeakGuess", { header: suggestion?.header ?? "" })}
                      </p>
                    )}
                  </td>
                  <td className="py-2 text-xs text-foreground/60">
                    {fieldMap[field.key] ? "—" : field.unmappedDefault ?? t("mapCannotImport")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className="mt-6 text-sm font-semibold">
        {t("mapPreviewHeading", { count: previewRows.length })}
      </h3>
      {mappedFields.length === 0 ? (
        <p className="mt-2 text-sm text-foreground/60">{t("mapNothingMapped")}</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-md border border-border-1">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-1 bg-surface-1 text-xs uppercase text-foreground/50">
              <tr>
                <th className="px-2 py-2">{t("colRow")}</th>
                {mappedFields.map((field) => (
                  <th key={field.key} className="whitespace-nowrap px-2 py-2">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={row.rowNumber} className="border-b border-border-1/50 last:border-0">
                  <td className="px-2 py-2 text-foreground/40">{row.rowNumber}</td>
                  {mappedFields.map((field) => (
                    <td key={field.key} className="whitespace-nowrap px-2 py-2">
                      {cellFor(row, field) || (
                        <span className="text-foreground/30">{t("blank")}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
