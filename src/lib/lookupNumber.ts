import type { StoreDb } from "@/lib/db/scoped";

/**
 * Allocating quick-reference numbers.
 *
 * ## Why a counter and not MAX(lookupNumber) + 1
 * Numbers must never be reused. If the highest-numbered card is sold and
 * deleted, MAX+1 hands its number to the next card added, and "card 47" now
 * means two different cards across the store's history — the exact confusion at
 * the table this feature exists to remove. A monotonic counter on Store cannot
 * do that. Gaps in the sequence are the expected, correct consequence.
 *
 * ## Why this is safe with two people adding cards at once
 * Allocation is a single `UPDATE ... SET n = n + k RETURNING n`. Postgres takes
 * a row lock on that Store row for the duration, so concurrent allocators
 * serialise behind each other and each gets a distinct block. Read-then-write
 * in application code would not: both readers would see the same value and the
 * loser would hit the unique constraint mid-sale.
 */

/**
 * Reserves `count` consecutive numbers and returns them.
 *
 * One statement regardless of how many are asked for, so a 500-row import takes
 * one lock rather than 500.
 */
export async function allocateLookupNumbers(
  db: StoreDb,
  storeId: string,
  count: number
): Promise<number[]> {
  if (count <= 0) return [];

  // `increment` compiles to `SET "nextLookupNumber" = "nextLookupNumber" + $1`
  // and returns the row after the update, so the block handed out is the half-open
  // range [next - count, next).
  const store = await db.store.update({
    where: { id: storeId },
    data: { nextLookupNumber: { increment: count } },
    select: { nextLookupNumber: true },
  });

  const end = store.nextLookupNumber;
  return Array.from({ length: count }, (_, index) => end - count + index);
}

/** Reserves exactly one number — the manual "add a card" path. */
export async function allocateLookupNumber(db: StoreDb, storeId: string): Promise<number> {
  const [number] = await allocateLookupNumbers(db, storeId, 1);
  return number;
}

/**
 * Moves the counter past a number that was supplied rather than allocated.
 *
 * An import may carry its own numbers from a vendor's existing paper scheme. If
 * a sheet brings in #1..#200 while the counter still sits at 1, the next card
 * added by hand would collide with #1. Raising the counter to just past the
 * highest imported number keeps auto-assignment and manual numbering in one
 * sequence.
 *
 * Never lowers the counter — that would hand out a number already in use.
 */
export async function reserveLookupNumberAtLeast(
  db: StoreDb,
  storeId: string,
  highestUsed: number
): Promise<void> {
  if (!Number.isFinite(highestUsed) || highestUsed < 1) return;

  const store = await db.store.findFirst({
    where: { id: storeId },
    select: { nextLookupNumber: true },
  });
  if (!store || store.nextLookupNumber > highestUsed) return;

  await db.store.update({
    where: { id: storeId },
    data: { nextLookupNumber: highestUsed + 1 },
  });
}

/** Parses what someone typed into the lookup box: "47", "#47", " 47 ". */
export function parseLookupNumber(input: string): number | null {
  const digits = input.trim().replace(/^#/, "").trim();
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits);
  if (!Number.isSafeInteger(value) || value < 1) return null;
  return value;
}
