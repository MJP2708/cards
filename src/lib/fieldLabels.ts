// Category.fieldSchema labels are stored as plain strings in the DB (English,
// set by seed.ts for built-ins or typed by the user for custom categories).
// Translating them would mean localizing DB content, which is out of scope —
// instead we translate the known built-in keys (team/position/cardType) via
// the cardForm message namespace and fall back to the raw DB label for
// anything else (custom categories keep whatever language they were created in).
const KNOWN_KEYS: Record<string, string> = {
  team: "fieldTeam",
  position: "fieldPosition",
  cardType: "fieldCardType",
};

export function fieldLabelKey(fieldKey: string): string | null {
  return KNOWN_KEYS[fieldKey] ?? null;
}
