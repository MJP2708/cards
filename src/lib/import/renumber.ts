import type { StoreDb } from "@/lib/db/scoped";
import type { CategoryDTO } from "@/lib/categories";
import type { RawRow } from "./worksheet";
import { valueFor, type FieldMap } from "./mapping";
import { fingerprint } from "./fingerprint";
import { reserveLookupNumberAtLeast } from "@/lib/lookupNumber";

/**
 * Re-align lookup numbers to the numbers written on the cards.
 *
 * The app's own sequence and a vendor's sheet drift apart for mundane reasons —
 * the sheet skips numbers, a second import appends rows that belong in the
 * middle, someone deletes a row. Once they drift, the number printed on the
 * sleeve no longer finds the card, which is the only thing the number was for.
 *
 * So this does the opposite of an import: it changes *nothing* about a card
 * except its lookup number, and takes the sheet as the authority. Matching
 * reuses the same fingerprint the duplicate detector uses, so "the same card"
 * means exactly what it means everywhere else.
 */

export type RenumberStatus =
  /** Matched one card, and the number differs — this is the work. */
  | "renumber"
  /** Matched one card that already carries this number. */
  | "already_correct"
  /** No card in this store matches the row. */
  | "not_found"
  /** The row itself is unusable: no number, or an unreadable one. */
  | "invalid"
  /**
   * The number this row wants is held by a card that is *not* moving — because
   * nothing in the sheet mentions it, or because it was itself ambiguous. Two
   * cards cannot share a number, and picking a winner is not ours to do.
   */
  | "conflict";

export type RenumberRow = {
  rowNumber: number;
  /** The number the sheet says this card should carry. */
  lookupNumber: number | null;
  status: RenumberStatus;
  note: string;
  card: { id: string; name: string; series: string; currentNumber: number } | null;
};

export type RenumberPlan = {
  rows: RenumberRow[];
  summary: {
    total: number;
    renumber: number;
    alreadyCorrect: number;
    notFound: number;
    invalid: number;
    conflict: number;
  };
  /**
   * Cards in the store that no row claimed. They keep their current numbers,
   * which may now clash with a number the sheet assigns to a different card —
   * listed so that is visible before anything is applied.
   */
  untouched: { id: string; name: string; currentNumber: number }[];
  /**
   * Cards the file never mentions that are sitting on a number the file wants.
   * Nothing can be renumbered onto their numbers while they hold them, so either
   * they move to the end of the sequence or those rows stay conflicted.
   */
  blockers: { id: string; name: string; currentNumber: number; proposedNumber: number }[];
};

function parseSuppliedNumber(raw: string): number | null {
  const digits = raw.trim().replace(/^#/, "").trim();
  if (!/^\d+$/.test(digits)) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) && value >= 1 ? value : null;
}

export type RenumberInput = {
  headers: string[];
  rows: RawRow[];
  fieldMap: FieldMap;
  categoryMap: Record<string, string>;
  /**
   * Move cards the file doesn't mention off numbers the file needs, onto fresh
   * numbers past the end. Off by default: it renumbers cards the user did not
   * ask about, which is only reasonable once they have seen which ones.
   */
  evictBlockers?: boolean;
};

/** Works out what renumbering would do. Writes nothing. */
export async function planRenumber(
  db: StoreDb,
  categories: CategoryDTO[],
  input: RenumberInput
): Promise<RenumberPlan> {
  const { headers, rows, fieldMap, categoryMap } = input;
  const categoryByKey = new Map(categories.map((c) => [c.key.toLowerCase(), c]));

  const existing = await db.card.findMany({
    select: {
      id: true,
      category: true,
      name: true,
      series: true,
      year: true,
      cardNumber: true,
      grade: true,
      lookupNumber: true,
    },
  });

  // Fingerprint -> cards. A bucket with more than one entry is genuinely
  // ambiguous: two identical cards cannot be told apart by the sheet either.
  const byFingerprint = new Map<string, typeof existing>();
  for (const card of existing) {
    const key = fingerprint(card);
    const bucket = byFingerprint.get(key);
    if (bucket) bucket.push(card);
    else byFingerprint.set(key, [card]);
  }

  const numbersSeen = new Map<number, number>();

  /** Rows that survived parsing, with the fingerprint they resolved to. */
  type Candidate = { row: RawRow; lookupNumber: number; key: string; name: string };
  const rejected = new Map<number, RenumberRow>();
  const candidates: Candidate[] = [];

  for (const row of rows) {
    const read = (key: string) => valueFor(headers, row.cells, fieldMap, key);
    const reject = (status: RenumberStatus, note: string, lookupNumber: number | null) =>
      rejected.set(row.rowNumber, { rowNumber: row.rowNumber, lookupNumber, status, note, card: null });

    const rawNumber = read("lookupNumber");
    const lookupNumber = parseSuppliedNumber(rawNumber);
    if (lookupNumber === null) {
      reject(
        "invalid",
        rawNumber ? `Could not read "${rawNumber}" as a card number.` : "This row has no number in the mapped column.",
        null
      );
      continue;
    }

    const duplicateRow = numbersSeen.get(lookupNumber);
    if (duplicateRow !== undefined) {
      reject(
        "invalid",
        `#${lookupNumber} is also used by row ${duplicateRow} of this file. A number can only belong to one card.`,
        lookupNumber
      );
      continue;
    }
    numbersSeen.set(lookupNumber, row.rowNumber);

    const rawCategory = read("category");
    const categoryKey = categoryMap[rawCategory.toLowerCase()] ?? null;
    const category = categoryKey ? categoryByKey.get(categoryKey.toLowerCase()) : undefined;
    const name = read("name");

    if (!category || !name) {
      reject(
        "not_found",
        !name
          ? "No name on this row, so it can't be matched to a card."
          : `Category "${rawCategory}" isn't one of this store's categories.`,
        lookupNumber
      );
      continue;
    }

    candidates.push({
      row,
      lookupNumber,
      name,
      key: fingerprint({
        category: category.key,
        name,
        series: read("series") || "Unknown Set",
        year: read("year") ? Number(read("year").match(/\d{4}/)?.[0] ?? "") || null : null,
        cardNumber: read("cardNumber") || null,
        grade: read("grade") || null,
      }),
    });
  }

  // Pair rows to cards per fingerprint, rather than one row at a time.
  //
  // Several cards can share a fingerprint — the same card, same set, same grade,
  // listed twice. They are indistinguishable in every field this app records, so
  // there is no wrong way to pair them with the sheet's rows: handing them out in
  // file order is well-defined. Refusing instead would be safe but useless, since
  // one unmovable card blocks every later row that wanted its number.
  const rowsByKey = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const bucket = rowsByKey.get(candidate.key);
    if (bucket) bucket.push(candidate);
    else rowsByKey.set(candidate.key, [candidate]);
  }

  const matched = new Map<number, RenumberRow>();
  for (const [key, group] of rowsByKey) {
    // Deterministic on both sides so a re-run produces the same pairing.
    const cards = [...(byFingerprint.get(key) ?? [])].sort((a, b) => a.lookupNumber - b.lookupNumber);
    const ordered = [...group].sort((a, b) => a.row.rowNumber - b.row.rowNumber);
    const shared = cards.length > 1;

    ordered.forEach((candidate, index) => {
      const match = cards[index];
      if (!match) {
        matched.set(candidate.row.rowNumber, {
          rowNumber: candidate.row.rowNumber,
          lookupNumber: candidate.lookupNumber,
          status: "not_found",
          note: cards.length === 0
            ? `No card in this store matches "${candidate.name}". Its details may differ from the sheet.`
            : `The sheet lists "${candidate.name}" ${ordered.length} times but this store has ${cards.length}.`,
          card: null,
        });
        return;
      }

      const card = {
        id: match.id,
        name: match.name,
        series: match.series,
        currentNumber: match.lookupNumber,
      };
      const caveat = shared
        ? ` One of ${cards.length} identical cards — paired in file order, so check these if they differ in price.`
        : "";

      matched.set(candidate.row.rowNumber, {
        rowNumber: candidate.row.rowNumber,
        lookupNumber: candidate.lookupNumber,
        status: match.lookupNumber === candidate.lookupNumber ? "already_correct" : "renumber",
        note:
          (match.lookupNumber === candidate.lookupNumber
            ? `Already #${candidate.lookupNumber}.`
            : `#${match.lookupNumber} → #${candidate.lookupNumber}`) + caveat,
        card,
      });
    });
  }

  const planned: RenumberRow[] = rows.map(
    (row) =>
      matched.get(row.rowNumber) ??
      rejected.get(row.rowNumber) ?? {
        rowNumber: row.rowNumber,
        lookupNumber: null,
        status: "invalid" as const,
        note: "This row could not be read.",
        card: null,
      }
  );

  // A target number is only free if whoever currently holds it is moving too.
  // Cards that stay put — untouched, ambiguous, or already correct — still own
  // their numbers, and a row aiming at one of those cannot be applied. Parking
  // the movers on temporary numbers does not rescue this: the blocker never
  // vacates.
  //
  // This has to settle rather than being decided in one pass, because blocking
  // cascades: once a row is downgraded to a conflict its card stops moving too,
  // which can block whatever was waiting on *its* old number. Iterating until
  // nothing changes is the only way to get a set that actually applies. It
  // terminates because each pass can only turn renumbers into conflicts.
  const holderByNumber = new Map(existing.map((card) => [card.lookupNumber, card]));

  // Before deciding conflicts, optionally clear the blockers out of the way.
  // A card the file never mentions, parked on a number the file needs, is the
  // usual reason a whole run of rows cannot be applied — and its current number
  // is arbitrary anyway, so moving it to the end costs nothing real.
  const wantedNumbers = new Set(
    planned.filter((r) => r.status === "renumber" && r.lookupNumber !== null).map((r) => r.lookupNumber!)
  );
  const claimedIds = new Set(planned.filter((r) => r.card).map((r) => r.card!.id));

  const highestInPlay = Math.max(
    0,
    ...existing.map((c) => c.lookupNumber),
    ...[...wantedNumbers]
  );
  let nextFree = highestInPlay + 1;

  const blockers = existing
    .filter((card) => !claimedIds.has(card.id) && wantedNumbers.has(card.lookupNumber))
    .map((card) => ({
      id: card.id,
      name: card.name,
      currentNumber: card.lookupNumber,
      proposedNumber: nextFree++,
    }));

  const evicting = input.evictBlockers === true;
  const evictedIds = new Set(evicting ? blockers.map((b) => b.id) : []);

  let resolved: RenumberRow[] = planned;
  for (;;) {
    const moving = new Set([
      ...resolved.filter((r) => r.status === "renumber" && r.card).map((r) => r.card!.id),
      // An evicted blocker vacates its number too, so it counts as moving.
      ...evictedIds,
    ]);
    let changed = false;

    resolved = resolved.map((row) => {
      if (row.status !== "renumber" || row.lookupNumber === null) return row;
      const holder = holderByNumber.get(row.lookupNumber);
      if (!holder || moving.has(holder.id)) return row;
      changed = true;
      return {
        ...row,
        status: "conflict" as const,
        note: `#${row.lookupNumber} is held by "${holder.name}", which this file doesn't move. Free that number first, or add a row for it.`,
      };
    });

    if (!changed) break;
  }

  const stillClaimed = new Set(
    resolved.filter((r) => r.card && r.status !== "conflict").map((r) => r.card!.id)
  );
  const untouched = existing
    .filter((card) => !stillClaimed.has(card.id))
    .map((card) => ({ id: card.id, name: card.name, currentNumber: card.lookupNumber }));

  return {
    rows: resolved,
    summary: {
      total: resolved.length,
      renumber: resolved.filter((r) => r.status === "renumber").length,
      alreadyCorrect: resolved.filter((r) => r.status === "already_correct").length,
      notFound: resolved.filter((r) => r.status === "not_found").length,
      invalid: resolved.filter((r) => r.status === "invalid").length,
      conflict: resolved.filter((r) => r.status === "conflict").length,
    },
    untouched,
    blockers,
  };
}

export type RenumberResult = { renumbered: number; evicted: number; highestNumber: number };

/**
 * Applies a plan.
 *
 * Done in two passes inside one transaction. Swapping two cards' numbers, or
 * shifting a run of them down by one, transiently needs a number another card
 * still holds — a one-pass update would trip the `[storeId, lookupNumber]`
 * unique index halfway through and leave the numbering half-rewritten. So every
 * affected card is first parked on a negative number, which nothing else can
 * collide with, and only then given its final one.
 */
export async function applyRenumber(
  db: StoreDb,
  storeId: string,
  assignments: { cardId: string; lookupNumber: number }[],
  evictions: { cardId: string; lookupNumber: number }[] = []
): Promise<RenumberResult> {
  const all = [...evictions, ...assignments];
  if (all.length === 0) return { renumbered: 0, evicted: 0, highestNumber: 0 };

  await db.$transaction([
    ...all.map((assignment, index) =>
      db.card.update({
        where: { id: assignment.cardId },
        data: { lookupNumber: -(index + 1) },
      })
    ),
    ...all.map((assignment) =>
      db.card.update({
        where: { id: assignment.cardId },
        data: { lookupNumber: assignment.lookupNumber },
      })
    ),
  ]);

  // Keep the allocator ahead of whatever the sheet just assigned, so the next
  // card added by hand does not land on a number now in use.
  const highestNumber = Math.max(...all.map((a) => a.lookupNumber));
  await reserveLookupNumberAtLeast(db, storeId, highestNumber);

  return { renumbered: assignments.length, evicted: evictions.length, highestNumber };
}
