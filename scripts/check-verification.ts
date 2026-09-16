/**
 * Imports the real demo workbook, then a copy with deliberate faults planted in
 * it, and asserts that the verification pass catches each fault and leaves the
 * clean rows alone.
 *
 *   docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cards -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/cards \
 *   DIRECT_URL=postgresql://postgres:test@127.0.0.1:55432/cards npx prisma migrate deploy
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/check-verification.ts
 *
 * Run it against a throwaway database — it writes two stores' worth of fixtures.
 *
 * Deliberately makes no API-Sports or eBay calls. The factual team-for-season
 * check reads the snapshot enrichment stores on the card, so this seeds that
 * snapshot directly: the check's logic is then tested deterministically instead
 * of depending on a rate-limited free tier that may or may not cover a season.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { storeDb } from "../src/lib/db/scoped";
import { buildDefaultCategoryRows } from "../src/lib/defaultCategories";
import { getCategories } from "../src/lib/categories";
import { parseWorksheet } from "../src/lib/import/worksheet";
import { buildFieldCatalog } from "../src/lib/import/fields";
import {
  distinctColumnValues,
  suggestCategoryValues,
  suggestMapping,
  suggestionsToFieldMap,
  type FieldMap,
} from "../src/lib/import/mapping";
import { stageRows } from "../src/lib/import/stage";
import { commitImport } from "../src/lib/import/commit";
import { verifyCards, verifyOneCard, buildContext, verifyCard } from "../src/lib/verification/verify";
import { cacheKey } from "../src/lib/import/enrich";
import type { VerifiableCard } from "../src/lib/verification/checks";

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures++;
}

function section(title: string) {
  console.log(`\n${title}\n${"─".repeat(title.length)}`);
}

const FIXTURES = path.join(import.meta.dirname, "fixtures");

async function makeStore(name: string) {
  const store = await prisma.store.create({ data: { name } });
  await prisma.category.createMany({ data: buildDefaultCategoryRows(store.id) });
  return store;
}

/** Runs the confirmed-mapping import pipeline end to end and commits it. */
async function importSheet(db: ReturnType<typeof storeDb>, storeId: string, fileName: string) {
  const buffer = await readFile(path.join(FIXTURES, fileName));
  const parsed = await parseWorksheet({
    name: fileName,
    buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  });

  const categories = await getCategories(db);
  const fields = buildFieldCatalog(categories);
  const fieldMap: FieldMap = suggestionsToFieldMap(suggestMapping(parsed.headers, fields));

  const values = distinctColumnValues(parsed.headers, parsed.rows, fieldMap.category ?? null);
  const categoryMap: Record<string, string> = {};
  for (const suggestion of suggestCategoryValues(values, categories)) {
    if (suggestion.categoryKey) categoryMap[suggestion.value.toLowerCase()] = suggestion.categoryKey;
  }

  const staged = await stageRows(db, categories, {
    headers: parsed.headers,
    rows: parsed.rows,
    fieldMap,
    categoryMap,
  });

  // Everything imports as a separate line: this run is about verification, not
  // dedup, and the planted duplicate must actually land in inventory to be found.
  const result = await commitImport(db, storeId, {
    fileName,
    rows: staged.rows
      .filter((row) => row.card !== null)
      .map((row) => ({ card: row.card!, action: "new" as const, existingId: null })),
  });

  return { parsed, fieldMap, staged, result };
}

function notesFor(cards: { name: string; verificationNotes: string | null }[], name: string): string {
  return cards.find((card) => card.name === name)?.verificationNotes ?? "";
}

function statusFor(
  cards: { name: string; verificationStatus: string | null }[],
  name: string
): string | null {
  return cards.find((card) => card.name === name)?.verificationStatus ?? null;
}

async function main() {
  const storeA = await makeStore("Verification Test Store");
  const storeB = await makeStore("Other Store");
  const dbA = storeDb(storeA.id);
  const dbB = storeDb(storeB.id);

  // ── 1. The clean workbook ────────────────────────────────────────────────
  section("1. demo_card_inventory_nba_football.xlsx (unmodified) into an empty store");

  const clean = await importSheet(dbA, storeA.id, "demo_card_inventory_nba_football.xlsx");
  check("imported all 9 demo rows", clean.result.created === 9, JSON.stringify(clean.result));

  const beforeVerify = await dbA.card.count({ where: { verificationStatus: null } });
  check("cards start unverified rather than assumed good", beforeVerify === 9);

  const cleanRun = await verifyCards(
    dbA,
    (await dbA.card.findMany({ select: { id: true } })).map((c) => c.id)
  );
  check("verification checked every card", cleanRun.checked === 9, JSON.stringify(cleanRun));

  const cleanCards = await dbA.card.findMany({
    select: { name: true, verificationStatus: true, verificationNotes: true, verifiedAt: true },
  });

  check(
    "every clean row passed",
    cleanRun.flagged === 0 && cleanRun.verified === 9,
    cleanCards
      .filter((c) => c.verificationStatus !== "VERIFIED")
      .map((c) => `${c.name}: ${c.verificationNotes}`)
      .join(" | ") || "none flagged"
  );
  check("verifiedAt was stamped", cleanCards.every((c) => c.verifiedAt !== null));
  check(
    'a "Verified" card still says what went unchecked',
    notesFor(cleanCards, "LeBron James").includes("Not checked:"),
    notesFor(cleanCards, "LeBron James")
  );
  check(
    "eBay being unavailable is stated, not hidden",
    notesFor(cleanCards, "LeBron James").toLowerCase().includes("pending account approval"),
    notesFor(cleanCards, "LeBron James")
  );

  // ── 2. The same workbook with faults planted ─────────────────────────────
  section("2. demo_card_inventory_corrupted.xlsx into a clean store");

  const bad = await importSheet(dbB, storeB.id, "demo_card_inventory_corrupted.xlsx");
  check("imported all 10 rows (9 + the planted duplicate)", bad.result.created === 10, JSON.stringify(bad.result));

  const badIds = (await dbB.card.findMany({ select: { id: true } })).map((c) => c.id);
  const badRun = await verifyCards(dbB, badIds);
  const badCards = await dbB.card.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      series: true,
      year: true,
      grade: true,
      attributes: true,
      costBasis: true,
      askingPrice: true,
      verificationStatus: true,
      verificationNotes: true,
    },
  });

  console.log(`\n  verdicts (${badRun.verified} verified, ${badRun.flagged} flagged):`);
  for (const card of badCards) {
    console.log(`    ${(card.verificationStatus ?? "—").padEnd(17)} ${card.name}`);
    if (card.verificationStatus !== "VERIFIED") console.log(`      ${card.verificationNotes}`);
  }

  section("   each planted fault");

  check(
    "football card with an NBA team -> LIKELY_INCORRECT",
    statusFor(badCards, "Lionel Messi") === "LIKELY_INCORRECT" &&
      notesFor(badCards, "Lionel Messi").includes("basketball team"),
    notesFor(badCards, "Lionel Messi")
  );
  check(
    "asking price an order of magnitude under cost -> LIKELY_INCORRECT, quantified",
    statusFor(badCards, "Victor Wembanyama") === "LIKELY_INCORRECT" &&
      notesFor(badCards, "Victor Wembanyama").includes("48x below cost") &&
      notesFor(badCards, "Victor Wembanyama").includes("mistyped price"),
    notesFor(badCards, "Victor Wembanyama")
  );
  check(
    "year in the future -> LIKELY_INCORRECT",
    statusFor(badCards, "Anthony Edwards") === "LIKELY_INCORRECT" &&
      notesFor(badCards, "Anthony Edwards").includes("2031"),
    notesFor(badCards, "Anthony Edwards")
  );
  check(
    "grade score out of range -> flagged",
    statusFor(badCards, "Stephen Curry") !== "VERIFIED" &&
      notesFor(badCards, "Stephen Curry").includes("PSA 47"),
    notesFor(badCards, "Stephen Curry")
  );
  check(
    "set-name year contradicting the year column -> flagged",
    statusFor(badCards, "Kylian Mbappe") !== "VERIFIED" &&
      notesFor(badCards, "Kylian Mbappe").includes("2019"),
    notesFor(badCards, "Kylian Mbappe")
  );
  check(
    "below-cost price -> NEEDS_REVIEW, not treated as a typo",
    statusFor(badCards, "Erling Haaland") === "NEEDS_REVIEW" &&
      notesFor(badCards, "Erling Haaland").includes("intentional markdown"),
    notesFor(badCards, "Erling Haaland")
  );

  const lebrons = badCards.filter((c) => c.name === "LeBron James");
  check("the duplicated row landed as two cards", lebrons.length === 2);
  check(
    "both duplicates are flagged, citing each other",
    lebrons.every(
      (c) => c.verificationStatus !== "VERIFIED" && (c.verificationNotes ?? "").includes("identical details")
    ),
    lebrons[0]?.verificationNotes ?? ""
  );

  check(
    "untouched rows in the same file still pass",
    statusFor(badCards, "Luka Doncic") === "VERIFIED",
    notesFor(badCards, "Luka Doncic")
  );

  // ── 3. Never auto-corrects ───────────────────────────────────────────────
  section("3. flagging only — no field was rewritten");

  const messi = badCards.find((c) => c.name === "Lionel Messi")!;
  check(
    "the wrong team was left exactly as imported",
    (messi.attributes as Record<string, unknown>).team === "Lakers",
    `team is still "${(messi.attributes as Record<string, unknown>).team}"`
  );
  const wemby = badCards.find((c) => c.name === "Victor Wembanyama")!;
  check("the suspicious price was left alone", wemby.askingPrice === 250 && wemby.costBasis === 12000);
  check("the future year was left alone", badCards.find((c) => c.name === "Anthony Edwards")!.year === 2031);
  check("the malformed grade was left alone", badCards.find((c) => c.name === "Stephen Curry")!.grade === "PSA 47");
  check(
    "the contradictory set name was left alone",
    badCards.find((c) => c.name === "Kylian Mbappe")!.series === "2019 Panini Prizm"
  );

  // ── 4. The factual team-for-season check ─────────────────────────────────
  section("4. player-was-on-that-team check, against the enrichment snapshot");

  const edwards = badCards.find((c) => c.name === "Anthony Edwards")!;
  const context = await buildContext(dbB, [edwards.id]);

  const base: VerifiableCard = {
    id: edwards.id,
    category: "NBA",
    name: "Anthony Edwards",
    series: "Panini Select",
    year: 2023,
    cardNumber: "12",
    grade: "BGS 9.5",
    attributes: { team: "Timberwolves" },
    costBasis: 1800,
    askingPrice: 3200,
    liveStats: null,
  };

  // With no snapshot on file the answer is "couldn't confirm" — never "verified".
  const noStats = verifyCard(base, { ...context, statsConfigured: true });
  check(
    "no stats on file -> couldn't confirm, not Verified",
    noStats.status === "NEEDS_REVIEW" && noStats.notes.includes("Couldn't confirm"),
    noStats.notes
  );

  const snapshot = (team: string, season: string) => ({
    provider: "api-nba" as const,
    playerName: "Anthony Edwards",
    team,
    position: "SG",
    season,
    summary: [],
    fetchedAt: new Date().toISOString(),
  });

  const agreeing = verifyCard(
    { ...base, liveStats: snapshot("Minnesota Timberwolves", "2023") },
    { ...context, statsConfigured: true }
  );
  check("provider agrees on the team -> passes", agreeing.status === "VERIFIED", agreeing.notes);

  const disagreeing = verifyCard(
    { ...base, attributes: { team: "Miami Heat" }, liveStats: snapshot("Minnesota Timberwolves", "2023") },
    { ...context, statsConfigured: true }
  );
  check(
    "provider disagrees -> flagged as team may be incorrect",
    disagreeing.status === "NEEDS_REVIEW" && disagreeing.notes.includes("team may be incorrect"),
    disagreeing.notes
  );

  const wrongSeason = verifyCard(
    { ...base, liveStats: snapshot("Minnesota Timberwolves", "2019") },
    { ...context, statsConfigured: true }
  );
  check(
    "snapshot from another season -> couldn't confirm, not a false accusation",
    wrongSeason.status === "NEEDS_REVIEW" && wrongSeason.notes.includes("2019 season, not 2023"),
    wrongSeason.notes
  );

  // A plan/quota failure says nothing about the card, so it must not flag it;
  // a provider that genuinely has no such player is a real signal. These two
  // arrive at the card identically (no snapshot) and must not be conflated.
  const planLimited = verifyCard(
    { ...base, enrichmentStatus: "failed" },
    { ...context, statsConfigured: true }
  );
  check(
    "plan/quota failure -> skipped, card not blamed for it",
    planLimited.status === "VERIFIED" && planLimited.notes.includes("didn't complete"),
    planLimited.notes
  );

  const missKey = cacheKey(base.category, base.name, base.series);
  const genuinelyMissing = verifyCard(
    { ...base, enrichmentStatus: "failed" },
    { ...context, statsConfigured: true, genuineMisses: new Set([missKey]) }
  );
  check(
    "provider genuinely has no such player -> couldn't confirm, name questioned",
    genuinelyMissing.status === "NEEDS_REVIEW" &&
      genuinelyMissing.notes.includes("no record of"),
    genuinelyMissing.notes
  );

  const noKey = verifyCard(base, { ...context, statsConfigured: false });
  check(
    "stats switched off install-wide -> skipped, does not flag every card",
    noKey.status === "VERIFIED" && noKey.notes.includes("switched off"),
    noKey.notes
  );

  // ── 5. Re-verify ─────────────────────────────────────────────────────────
  section("5. re-verify picks up a fix");

  await dbB.card.update({ where: { id: messi.id }, data: { attributes: { team: "Inter Miami" } } });
  const reverified = await verifyOneCard(dbB, messi.id);
  check(
    "correcting the team clears the flag on re-verify",
    reverified?.status === "VERIFIED",
    reverified?.notes ?? ""
  );

  // ── 6. Tenancy ───────────────────────────────────────────────────────────
  section("6. scoping");

  const storeACards = await dbA.card.findMany({ select: { name: true } });
  check("store A still holds only its own 9 cards", storeACards.length === 9);
  check(
    "store A's LeBron was never flagged by store B's duplicate",
    statusFor(
      await dbA.card.findMany({ select: { name: true, verificationStatus: true } }),
      "LeBron James"
    ) === "VERIFIED"
  );

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
