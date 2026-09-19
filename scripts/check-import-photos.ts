/**
 * Exercises the post-import reference-photo pass.
 *
 *   docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cards -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgresql://postgres:test@127.0.0.1:55432/cards \
 *   DIRECT_URL=postgresql://postgres:test@127.0.0.1:55432/cards npx prisma migrate deploy
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/check-import-photos.ts
 *
 * Run it against a throwaway database — it writes a store's worth of fixtures.
 *
 * eBay is the only image source and is currently refusing tokens pending account
 * approval, so a test that made real calls would prove nothing except that eBay
 * is down. Instead this stubs the network layer and asserts the behaviour around
 * it: that the pass terminates, that it never overwrites a seller's own photo,
 * that a card with no listing is recorded as searched rather than retried
 * forever, and that the batch walks photos -> verifying -> complete.
 */
import { prisma } from "../src/lib/prisma";
import { storeDb } from "../src/lib/db/scoped";
import { buildDefaultCategoryRows } from "../src/lib/defaultCategories";

const searched: string[] = [];

/**
 * Intercepts eBay at the network boundary rather than swapping module exports.
 *
 * An ESM namespace is sealed, so the exports cannot be redefined — but stubbing
 * `fetch` is the better test anyway: the real token flow, the real query builder
 * and the real response parsing all still run, and only the wire is fake.
 */
function stubEbayNetwork() {
  process.env.EBAY_CLIENT_ID = "test-id";
  process.env.EBAY_CLIENT_SECRET = "test-secret";
  const realFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (url.includes("/identity/v1/oauth2/token")) {
      return Response.json({ access_token: "test-token", expires_in: 7200 });
    }

    if (url.includes("/buy/browse/v1/item_summary/search")) {
      const query = decodeURIComponent(new URL(url).searchParams.get("q") ?? "");
      searched.push(query);
      // "Ghost Card" stands in for a card the marketplace has no listing for.
      if (query.includes("Ghost")) return Response.json({ itemSummaries: [] });
      return Response.json({
        itemSummaries: [
          {
            title: query,
            price: { value: "100.00", currency: "USD" },
            itemWebUrl: "https://example.test/item",
            condition: "Used",
            image: { imageUrl: `https://img.example.test/${encodeURIComponent(query)}.jpg` },
          },
        ],
      });
    }

    return realFetch(input, init);
  }) as typeof globalThis.fetch;
}

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures++;
}

function section(title: string) {
  console.log(`\n${title}\n${"─".repeat(title.length)}`);
}

async function main() {
  stubEbayNetwork();
  const { fetchPhotosNextChunk } = await import("../src/lib/import/photos");

  const store = await prisma.store.create({ data: { name: "Photo Store" } });
  await prisma.category.createMany({ data: buildDefaultCategoryRows(store.id) });
  const db = storeDb(store.id);

  const batch = await db.importBatch.create({
    data: { storeId: store.id, fileName: "photos.xlsx", rowCount: 5, importedCount: 5, status: "enriching" },
  });

  const base = {
    storeId: store.id,
    importBatchId: batch.id,
    series: "2023 Panini Prizm",
    year: 2023,
    costBasis: 100,
    askingPrice: 200,
    photoStatus: "pending",
    category: "NBA",
  };

  await db.card.createMany({
    data: [
      { ...base, lookupNumber: 1, name: "Luka Doncic" },
      { ...base, lookupNumber: 2, name: "LeBron James" },
      // Already has a photo the seller took — must never be replaced.
      { ...base, lookupNumber: 3, name: "Stephen Curry", photoFront: "https://seller.example/mine.jpg", photoIsStock: false },
      // Carries an older auto-filled photo, which may be refreshed.
      { ...base, lookupNumber: 4, name: "Anthony Edwards", photoFront: "https://img.example.test/old.jpg", photoIsStock: true },
      // No marketplace listing exists for this one.
      { ...base, lookupNumber: 5, name: "Ghost Card" },
    ],
  });

  // ── 1. The pass runs and terminates ──────────────────────────────────────
  section("1. the photo pass");

  let guard = 0;
  let result = await fetchPhotosNextChunk(db, store.id, batch.id, 2);
  while (result.remaining > 0 && guard++ < 20) {
    result = await fetchPhotosNextChunk(db, store.id, batch.id, 2);
  }
  check("terminated rather than looping forever", result.remaining === 0, `after ${guard + 1} chunks`);
  check("chunking honoured the limit", guard > 0, `${guard + 1} chunks for 5 cards at 2 per chunk`);

  const cards = await db.card.findMany({ select: { name: true, photoFront: true, photoIsStock: true, photoStatus: true } });
  const by = (name: string) => cards.find((c) => c.name === name)!;

  console.log();
  for (const card of cards) {
    console.log(`    ${(card.photoStatus ?? "—").padEnd(8)} ${card.name.padEnd(18)} ${card.photoFront ?? "(no photo)"}`);
  }

  section("   per card");

  check(
    "a card with no photo got one",
    by("Luka Doncic").photoStatus === "fetched" && by("Luka Doncic").photoFront !== null,
    by("Luka Doncic").photoFront ?? ""
  );
  check("the fetched photo is stamped as stock", by("Luka Doncic").photoIsStock === true);
  check(
    "the seller's own photo was left untouched",
    by("Stephen Curry").photoFront === "https://seller.example/mine.jpg" &&
      by("Stephen Curry").photoIsStock === false &&
      by("Stephen Curry").photoStatus === "skipped"
  );
  check(
    "an older auto-filled photo may be refreshed",
    by("Anthony Edwards").photoStatus === "fetched" &&
      by("Anthony Edwards").photoFront !== "https://img.example.test/old.jpg"
  );
  check(
    'a card with no listing is recorded as searched, not left pending',
    by("Ghost Card").photoStatus === "none" && by("Ghost Card").photoFront === null
  );
  check(
    "the seller's own card was never searched for",
    !searched.some((q) => q.includes("Stephen Curry")),
    searched.join(" | ")
  );

  // ── 2. Photos do not depend on currency config ───────────────────────────
  section("2. no exchange rate set");

  check(
    "photos still arrived without a THB/USD rate",
    (await db.card.count({ where: { importBatchId: batch.id, photoStatus: "fetched" } })) === 3
  );
  check(
    "but prices were withheld rather than written in the wrong currency",
    (await db.priceSnapshot.count()) === 0
  );
  check(
    "one eBay search per card, not two",
    searched.length === 4,
    `${searched.length} searches for 5 cards (one had its own photo)`
  );

  // ── 3. With a rate, the same search also records comps ───────────────────
  section("3. once an exchange rate exists");

  await db.settings.create({ data: { storeId: store.id, usdExchangeRate: 36.5 } });

  const batch3 = await db.importBatch.create({
    data: { storeId: store.id, fileName: "b3.xlsx", rowCount: 1, importedCount: 1, status: "enriching" },
  });
  await db.card.create({
    data: { ...base, importBatchId: batch3.id, lookupNumber: 8, name: "Kevin Durant" },
  });
  await fetchPhotosNextChunk(db, store.id, batch3.id, 5);

  const durant = await db.card.findFirst({ where: { name: "Kevin Durant" } });
  check("photo fetched", durant?.photoStatus === "fetched" && durant?.photoFront !== null);
  check(
    "and the same call recorded a price snapshot",
    (await db.priceSnapshot.count({ where: { cardId: durant!.id } })) === 1
  );
  check(
    "converted to THB rather than stored as dollars",
    (await db.priceSnapshot.findFirst({ where: { cardId: durant!.id } }))?.medianPrice === 3650,
    String((await db.priceSnapshot.findFirst({ where: { cardId: durant!.id } }))?.medianPrice)
  );

  // ── 4. The batch advances ────────────────────────────────────────────────
  section("4. phase hand-off");

  const after = await db.importBatch.findUnique({ where: { id: batch.id } });
  check("batch moved on to verification", after?.status === "verifying", after?.status ?? "");
  check("photo count recorded for the summary", after?.photoCount === 3, String(after?.photoCount));
  check("batch is not marked finished yet", after?.finishedAt === null);

  // ── 5. No credentials ────────────────────────────────────────────────────
  section("5. with eBay unavailable");

  // Clearing the credentials is what a store without an eBay app actually looks like.
  delete process.env.EBAY_CLIENT_ID;
  delete process.env.EBAY_CLIENT_SECRET;

  const batch2 = await db.importBatch.create({
    data: { storeId: store.id, fileName: "b2.xlsx", rowCount: 2, importedCount: 2, status: "enriching" },
  });
  await db.card.createMany({
    data: [
      { ...base, importBatchId: batch2.id, lookupNumber: 6, name: "Jayson Tatum" },
      { ...base, importBatchId: batch2.id, lookupNumber: 7, name: "Devin Booker" },
    ],
  });

  const before = searched.length;
  const skipRun = await fetchPhotosNextChunk(db, store.id, batch2.id, 2);
  check("resolved in one step instead of grinding through cards", skipRun.remaining === 0);
  check("no searches were attempted", searched.length === before);
  check(
    "cards are marked skipped, not failed",
    (await db.card.count({ where: { importBatchId: batch2.id, photoStatus: "skipped" } })) === 2
  );
  check("batch still advances to verification", skipRun.status === "verifying", skipRun.status);

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
