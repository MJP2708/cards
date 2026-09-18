"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Check, X, AlertTriangle } from "lucide-react";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { useCategories, useRenameCategory, type RenameCategoryResult } from "@/hooks/useCategories";
import { InlineError } from "@/components/ui/InlineError";

/**
 * The existing-categories list, with renaming in place.
 *
 * Key and display name are edited as two separate inputs rather than one "name",
 * because they are not the same thing and the difference has consequences: the
 * display name is a label, while the key is the URL and the value stored on
 * every card. Collapsing them into one field would hide a data migration behind
 * what looks like a typo fix.
 */
export function CategoryRenameList() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const router = useRouter();
  const { data: categories } = useCategories();
  const rename = useRenameCategory();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState("");
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RenameCategoryResult | null>(null);

  function startEditing(category: { id: string; key: string; displayName: string }) {
    setEditingId(category.id);
    setDraftKey(category.key);
    setDraftName(category.displayName);
    setError(null);
    setResult(null);
  }

  function cancel() {
    setEditingId(null);
    setError(null);
  }

  async function save(id: string) {
    setError(null);
    try {
      const outcome = await rename.mutateAsync({ id, key: draftKey, displayName: draftName });
      setResult(outcome);
      setEditingId(null);
      // The category tabs and the themed header are server-rendered, so a plain
      // cache invalidation leaves them showing the old name until navigation.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("renameFailed"));
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-border-1 p-4">
      <h2 className="text-sm font-semibold text-foreground/70">{t("existingCategories")}</h2>
      <p className="text-xs text-foreground/50">{t("renameHint")}</p>

      {error && <InlineError message={error} />}

      {result && (
        <div className="space-y-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          <p>
            {t("renamedTo", { name: result.category.displayName, key: result.category.key })}{" "}
            {result.cardsMoved > 0 && t("renameMovedCards", { count: result.cardsMoved })}
            {result.presetsMoved > 0 && ` ${t("renameMovedPresets", { count: result.presetsMoved })}`}
            {result.templatesUpdated > 0 && ` ${t("renameMovedTemplates", { count: result.templatesUpdated })}`}
          </p>
        </div>
      )}

      {result?.warnings.map((warning) => (
        <p
          key={warning}
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{warning}</span>
        </p>
      ))}

      <ul className="space-y-2">
        {categories?.map((category) => {
          const isEditing = editingId === category.id;
          return (
            <li key={category.id} className="rounded-md border border-border-1 p-2.5">
              {isEditing ? (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs">
                      {t("displayName")}
                      <input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        className="rounded-md border border-border-1 px-2 py-1.5 text-sm"
                      />
                      <span className="text-[11px] text-foreground/50">{t("displayNameHint")}</span>
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      {t("categoryKey")}
                      <input
                        value={draftKey}
                        onChange={(e) => setDraftKey(e.target.value)}
                        className="rounded-md border border-border-1 px-2 py-1.5 font-mono text-sm"
                      />
                      <span className="text-[11px] text-foreground/50">
                        {t("categoryKeyHint", { url: `/${(draftKey || category.key).toLowerCase()}` })}
                      </span>
                    </label>
                  </div>

                  {draftKey.trim().toLowerCase() !== category.key.toLowerCase() && (
                    <p className="flex items-start gap-2 rounded-md bg-surface-1 px-2 py-1.5 text-[11px] text-foreground/70">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>{t("keyChangeWarning")}</span>
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => save(category.id)}
                      disabled={rename.isPending || !draftName.trim() || !draftKey.trim()}
                      className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-dark disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      {rename.isPending ? t("renaming") : common("save")}
                    </button>
                    <button
                      onClick={cancel}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border-1 px-3 py-1.5 text-xs hover:bg-surface-1"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                      {common("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryIcon
                    iconSet={category.themeTokens.iconSet}
                    className="h-4 w-4 shrink-0"
                    style={{ color: category.themeTokens.accent }}
                  />
                  <span className="font-medium">{category.displayName}</span>
                  <code className="rounded bg-surface-1 px-1.5 py-0.5 font-mono text-xs text-foreground/60">
                    /{category.key.toLowerCase()}
                  </code>
                  {category.isBuiltIn && (
                    <span className="text-[11px] text-foreground/40">{t("builtInLabel")}</span>
                  )}
                  <button
                    onClick={() => startEditing(category)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border-1 px-2.5 py-1.5 text-xs hover:bg-surface-1"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    {t("rename")}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
