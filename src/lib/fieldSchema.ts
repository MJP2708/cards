import { z } from "zod";

// Defines one extra input on a category's Add/Edit form. `core` fields map to a
// real Card column (name, series, year, ...); `attribute` fields are stashed in
// Card.attributes as JSON so new categories never need a migration.
export const fieldDefSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(["core", "attribute"]),
  type: z.enum(["text", "number", "select", "textarea"]),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});
export type FieldDef = z.infer<typeof fieldDefSchema>;

export const fieldSchemaSchema = z.array(fieldDefSchema);
export type FieldSchema = FieldDef[];

export const themeTokensSchema = z.object({
  accent: z.string(),
  accentDark: z.string().optional(),
  secondary: z.string(),
  surface: z.string().optional(),
  motif: z.enum(["hardwood", "pitch", "holo", "frame", "none"]).default("none"),
});
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

export const NBA_FIELDS: FieldSchema = [
  { key: "team", label: "Team", kind: "attribute", type: "text", required: true },
  { key: "position", label: "Position", kind: "attribute", type: "text" },
];

export const FOOTBALL_FIELDS: FieldSchema = [
  { key: "team", label: "Team", kind: "attribute", type: "text", required: true },
  { key: "position", label: "Position", kind: "attribute", type: "text" },
  {
    key: "league",
    label: "League",
    kind: "attribute",
    type: "select",
    options: ["NFL", "Soccer"],
    required: true,
  },
];

export const POKEMON_FIELDS: FieldSchema = [
  {
    key: "language",
    label: "Language",
    kind: "attribute",
    type: "select",
    options: ["EN", "JP", "Other"],
  },
  {
    key: "pokemonCardType",
    label: "Card Type",
    kind: "attribute",
    type: "select",
    options: ["Pokemon", "Trainer", "Energy"],
  },
];

export const TCG_FIELDS: FieldSchema = [
  { key: "gameTitle", label: "Game Title", kind: "attribute", type: "text", required: true },
  { key: "tcgCardType", label: "Card Type", kind: "attribute", type: "text" },
];

// Fields every category shares beyond the base Card columns already on the model.
export const SHARED_SPORTS_FIELDS: FieldSchema = [
  { key: "cardType", label: "Card Type (base/rookie/insert/auto/relic/parallel)", kind: "core", type: "text" },
];
