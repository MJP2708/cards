import type { CategoryDTO } from "@/lib/categories";

/**
 * One field the importer can fill from a spreadsheet column.
 *
 * `aliases` are the spellings we have actually seen sellers use; they are the
 * seed for fuzzy matching, not an exhaustive list — anything close to one of
 * them still matches (see `./fuzzy`).
 */
export type ImportField = {
  key: string;
  label: string;
  /** Only name and category are hard requirements; everything else defaults. */
  required: boolean;
  kind: "core" | "attribute";
  aliases: string[];
  /** Shown in the mapping UI under "Not mapped", so the fallback is never a surprise. */
  unmappedDefault: string | null;
};

/**
 * Deliberately conservative where two fields compete for the same word:
 * "game" stays on team only (a Pokémon sheet's "Game" column names the title,
 * not the app category) and "description" stays on name, so the greedy
 * assignment in `./mapping` never has to break a tie that has a wrong answer.
 */
export const CORE_IMPORT_FIELDS: ImportField[] = [
  {
    key: "category",
    label: "Category",
    required: true,
    kind: "core",
    aliases: ["category", "sport", "product line", "department", "section", "league"],
    unmappedDefault: null,
  },
  {
    key: "name",
    label: "Name / Title",
    required: true,
    kind: "core",
    aliases: ["name", "card name", "player", "player name", "title", "item", "athlete", "character", "description"],
    unmappedDefault: null,
  },
  {
    key: "series",
    label: "Series / Set",
    required: false,
    kind: "core",
    aliases: ["series", "set", "series set", "set name", "expansion", "product", "release", "brand"],
    unmappedDefault: 'Defaults to "Unknown Set" and flags the row',
  },
  {
    key: "year",
    label: "Year",
    required: false,
    kind: "core",
    aliases: ["year", "season", "release year", "yr"],
    unmappedDefault: "Left blank",
  },
  {
    key: "lookupNumber",
    label: "Lookup # (store reference)",
    required: false,
    kind: "core",
    /**
     * Deliberately does NOT claim "card #", "card number" or "number". In a card
     * shop's spreadsheet those overwhelmingly mean the number the manufacturer
     * printed on the card, which is `cardNumber` — a different field entirely.
     * Quietly taking them would write a vendor's shelf numbering into the
     * printed-number column and corrupt both. A sheet that really does use
     * "Card #" for its own numbering is re-pointed on the mapping screen, which
     * is exactly what that screen is for.
     */
    aliases: [
      "lookup",
      "lookup no",
      "lookup number",
      "ref",
      "ref no",
      "reference",
      "reference number",
      "tag",
      "tag number",
      "booth number",
      "table number",
      "display number",
    ],
    unmappedDefault: "Assigned automatically, continuing this store's sequence",
  },
  {
    key: "cardNumber",
    label: "Card Number",
    required: false,
    kind: "core",
    aliases: ["card number", "number", "card no", "no", "num", "serial", "card #"],
    unmappedDefault: "Left blank",
  },
  {
    key: "cardType",
    label: "Card Type",
    required: false,
    kind: "core",
    aliases: ["card type", "type", "subset", "variation", "parallel", "finish"],
    unmappedDefault: "Left blank",
  },
  {
    key: "rarity",
    label: "Rarity",
    required: false,
    kind: "core",
    aliases: ["rarity", "print run", "numbering", "numbered", "scarcity"],
    unmappedDefault: "Left blank",
  },
  {
    key: "grade",
    label: "Grade / Condition",
    required: false,
    kind: "core",
    aliases: ["grade", "graded", "condition", "cond", "psa", "bgs", "slab"],
    unmappedDefault: "Left blank (treated as ungraded)",
  },
  {
    key: "costBasis",
    label: "Cost Basis",
    required: false,
    kind: "core",
    aliases: ["cost basis", "cost", "purchase price", "paid", "buy price", "cost price", "acquisition cost"],
    unmappedDefault: "Defaults to 0 and flags the row as cost-unset",
  },
  {
    key: "askingPrice",
    label: "Asking Price",
    required: false,
    kind: "core",
    aliases: ["asking price", "asking", "price", "list price", "listed price", "sale price", "sell price", "retail"],
    unmappedDefault: "Defaults to 0 and flags the row as price-unset",
  },
  {
    key: "quantity",
    label: "Quantity",
    required: false,
    kind: "core",
    aliases: ["quantity", "qty", "count", "stock", "on hand", "units", "amount"],
    unmappedDefault: "Defaults to 1",
  },
  {
    key: "status",
    label: "Status",
    required: false,
    kind: "core",
    aliases: ["status", "availability", "state", "sold"],
    unmappedDefault: 'Defaults to "In Stock"',
  },
  {
    key: "qrCode",
    label: "QR / SKU code",
    required: false,
    kind: "core",
    aliases: [
      "qr code",
      "sku",
      "label",
      "barcode",
      "code",
      "inventory id",
      // "Stock No" is an identifier; a bare "Stock" is a quantity. Both spellings
      // are listed on their own field so the two never trade places.
      "stock no",
      "stock number",
      "item no",
    ],
    unmappedDefault: "Left blank",
  },
  {
    key: "buyerNote",
    label: "Notes",
    required: false,
    kind: "core",
    aliases: ["notes", "note", "buyer note", "comments", "remarks", "memo"],
    unmappedDefault: "Left blank",
  },
];

/** Aliases for attribute fields that categories commonly define. */
const ATTRIBUTE_ALIASES: Record<string, string[]> = {
  team: ["team", "club", "franchise", "game", "team game"],
  position: ["position", "pos", "role"],
};

/**
 * Core fields plus every attribute field defined by this store's categories.
 *
 * Built from the categories rather than hard-coded so a store that adds a custom
 * category with a new attribute can map a column to it without a code change.
 */
export function buildFieldCatalog(categories: CategoryDTO[]): ImportField[] {
  const seen = new Set(CORE_IMPORT_FIELDS.map((f) => f.key));
  const attributes: ImportField[] = [];

  for (const category of categories) {
    for (const field of category.fieldSchema) {
      if (field.kind !== "attribute" || seen.has(field.key)) continue;
      seen.add(field.key);
      attributes.push({
        key: field.key,
        label: field.label,
        required: false,
        kind: "attribute",
        aliases: [field.key, field.label, ...(ATTRIBUTE_ALIASES[field.key] ?? [])],
        unmappedDefault: field.required ? "Left blank — flags the row for review" : "Left blank",
      });
    }
  }

  return [...CORE_IMPORT_FIELDS, ...attributes];
}

/**
 * Category *values* rarely match category *keys*: a seller writes "Basketball"
 * where this app calls it "NBA". Fuzzy string matching cannot bridge that —
 * the two share no characters — so these expand a raw value into the names its
 * matching category is likely to be called, which are then fuzzy-matched
 * against whatever categories the store actually has.
 */
export const CATEGORY_VALUE_SYNONYMS: Record<string, string[]> = {
  basketball: ["NBA", "Basketball"],
  nba: ["NBA", "Basketball"],
  hoops: ["NBA", "Basketball"],
  soccer: ["Football", "Soccer"],
  futbol: ["Football", "Soccer"],
  football: ["Football", "Soccer", "NFL"],
  americanfootball: ["NFL", "Football"],
  nfl: ["NFL", "Football"],
  baseball: ["MLB", "Baseball"],
  mlb: ["MLB", "Baseball"],
  hockey: ["NHL", "Hockey"],
  nhl: ["NHL", "Hockey"],
  pokemon: ["Pokemon", "Pokémon", "TCG-Pokemon"],
  pkmn: ["Pokemon", "TCG-Pokemon"],
  magic: ["TCG-MTG", "MTG", "Magic"],
  mtg: ["TCG-MTG", "MTG", "Magic"],
  magicthegathering: ["TCG-MTG", "MTG", "Magic"],
  onepiece: ["TCG-OnePiece", "One Piece"],
  yugioh: ["TCG-YuGiOh", "Yu-Gi-Oh"],
  tcg: ["TCG-MTG", "TCG-OnePiece"],
};
