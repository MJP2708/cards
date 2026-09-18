import type { StoreDb } from "@/lib/db/scoped";
import { Prisma } from "@/generated/prisma/client";
import { enrichmentAvailability } from "@/lib/import/enrich";

/**
 * Renaming a category.
 *
 * Two quite different operations share the word "rename", and only one of them
 * is risky:
 *
 *  - `displayName` is a pure label. Nothing references it, so changing it is
 *    free.
 *  - `key` is the identity. `Card.category` holds it as a denormalised string
 *    (there is no foreign key), `FilterPreset.category` stores it, saved import
 *    templates map spreadsheet values onto it, and the URL for a category *is*
 *    the key. Changing it without moving those leaves every card in the
 *    category orphaned — visible nowhere, because the list page filters on a
 *    key that no longer matches anything.
 *
 * So a key rename is a small migration, and it runs in one transaction: a
 * half-applied rename is the outcome that would actually lose inventory.
 */

/** Route segment for "every category" — a category may never claim it. */
const RESERVED_KEYS = new Set(["all", "new", "card", "api"]);

/**
 * Keys are URL path segments (`/nba`, `/tcg-mtg`), so they are restricted to
 * what reads cleanly in one: no spaces, slashes or punctuation that would need
 * escaping. Display names have no such limit and are where the pretty name goes.
 */
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export type RenameResult = {
  category: { id: string; key: string; displayName: string };
  cardsMoved: number;
  presetsMoved: number;
  templatesUpdated: number;
  /** Non-blocking consequences the user should know about, not errors. */
  warnings: string[];
};

export type RenameError = { error: string; status: number };

function isError(value: unknown): value is RenameError {
  return typeof value === "object" && value !== null && "error" in value;
}

export function validateKey(key: string): string | null {
  if (!key.trim()) return "A category key can't be empty.";
  if (key.length > 40) return "A category key must be 40 characters or fewer.";
  if (!KEY_PATTERN.test(key)) {
    return `"${key}" can't be used as a key — use letters, digits, dashes or underscores, starting with a letter or digit. The display name can be anything.`;
  }
  if (RESERVED_KEYS.has(key.toLowerCase())) {
    return `"${key}" is reserved by the app's own URLs. Pick a different key.`;
  }
  return null;
}

/**
 * Features that key off a category's *name* rather than reading a field.
 *
 * Live stats and import enrichment look up a provider by the literal category
 * key, so renaming "NBA" quietly switches enrichment off for those cards. That
 * is the user's call to make — but it must not be a surprise, so the rename
 * reports it instead of blocking.
 */
function integrationWarnings(oldKey: string, newKey: string): string[] {
  if (oldKey.toLowerCase() === newKey.toLowerCase()) return [];

  const enrichable = enrichmentAvailability().map((entry) => entry.category);
  const wasEnrichable = enrichable.some((name) => name.toLowerCase() === oldKey.toLowerCase());
  const stillEnrichable = enrichable.some((name) => name.toLowerCase() === newKey.toLowerCase());

  if (wasEnrichable && !stillEnrichable) {
    return [
      `Live player stats and import enrichment are matched by the key "${oldKey}". After this rename they will no longer run for these cards, and the data check will stop verifying player teams for them. Existing stats already fetched are kept.`,
    ];
  }
  return [];
}

export async function renameCategory(
  db: StoreDb,
  id: string,
  input: { key?: string; displayName?: string }
): Promise<RenameResult | RenameError> {
  const existing = await db.category.findFirst({ where: { id } });
  if (!existing) return { error: "Category not found.", status: 404 };

  const nextKey = input.key?.trim() ?? existing.key;
  const nextDisplayName = input.displayName?.trim() ?? existing.displayName;

  if (!nextDisplayName) return { error: "A display name can't be empty.", status: 400 };

  const keyChanged = nextKey !== existing.key;
  if (keyChanged) {
    const invalid = validateKey(nextKey);
    if (invalid) return { error: invalid, status: 400 };

    // Case-insensitively, because `getCategoryByKey` and the cards API both match
    // that way — "nba" and "NBA" would be the same category everywhere but here.
    const clash = await db.category.findFirst({
      where: { key: { equals: nextKey, mode: "insensitive" }, NOT: { id } },
    });
    if (clash) {
      return { error: `This store already has a category with the key "${clash.key}".`, status: 409 };
    }
  }

  // Saved import templates map spreadsheet values onto category keys, so they are
  // rewritten too — otherwise the next import from that source silently fails to
  // resolve its categories.
  const templates = keyChanged ? await db.importMapping.findMany() : [];
  const templateEdits = templates
    .map((template) => {
      const map = (template.categoryMap ?? {}) as Record<string, string>;
      let touched = false;
      const next: Record<string, string> = {};
      for (const [value, key] of Object.entries(map)) {
        if (key.toLowerCase() === existing.key.toLowerCase()) {
          next[value] = nextKey;
          touched = true;
        } else {
          next[value] = key;
        }
      }
      return touched ? { id: template.id, categoryMap: next } : null;
    })
    .filter((edit): edit is { id: string; categoryMap: Record<string, string> } => edit !== null);

  // One transaction: a rename that moved the category but not its cards would
  // leave the inventory invisible, which is worse than the rename not happening.
  const renameCategoryRow = db.category.update({
    where: { id },
    data: { key: nextKey, displayName: nextDisplayName },
  });

  // `Card.category` is a plain string with no foreign key, so nothing moves these
  // for us. Matched insensitively so a card written under different casing is
  // carried along rather than stranded.
  const moveCards = db.card.updateMany({
    where: { category: { equals: existing.key, mode: "insensitive" } },
    data: { category: nextKey },
  });
  const movePresets = db.filterPreset.updateMany({
    where: { category: { equals: existing.key, mode: "insensitive" } },
    data: { category: nextKey },
  });
  const moveTemplates = templateEdits.map((edit) =>
    db.importMapping.update({
      where: { id: edit.id },
      data: { categoryMap: edit.categoryMap as Prisma.InputJsonValue },
    })
  );

  if (!keyChanged) {
    await db.$transaction([renameCategoryRow]);
    return {
      category: { id, key: nextKey, displayName: nextDisplayName },
      cardsMoved: 0,
      presetsMoved: 0,
      templatesUpdated: 0,
      warnings: [],
    };
  }

  const [, cards, presets] = await db.$transaction([
    renameCategoryRow,
    moveCards,
    movePresets,
    ...moveTemplates,
  ]);

  return {
    category: { id, key: nextKey, displayName: nextDisplayName },
    cardsMoved: cards.count,
    presetsMoved: presets.count,
    templatesUpdated: templateEdits.length,
    warnings: integrationWarnings(existing.key, nextKey),
  };
}

export { isError as isRenameError };
