/**
 * Proves that the store-scoped client cannot cross tenant boundaries.
 *
 *   docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=cardstest -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy
 *   DATABASE_URL=... DIRECT_URL=... npx tsx scripts/check-tenant-isolation.ts
 *
 * Run it against a throwaway database — it writes two stores' worth of fixtures.
 * A missing `where` clause is silent in production and shows up as one shop
 * seeing another's inventory, so this asserts the boundary directly.
 */
import { prisma } from "../src/lib/prisma";
import { storeDb } from "../src/lib/db/scoped";

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures++;
}

async function main() {
  if (!/localhost|127\.0\.0\.1/.test(process.env.DIRECT_URL ?? "")) {
    console.error("Refusing to run: point DIRECT_URL at a local throwaway database.");
    process.exit(1);
  }

  // Fixtures: two unrelated shops.
  const alpha = await prisma.store.create({ data: { name: "Alpha Cards" } });
  const beta = await prisma.store.create({ data: { name: "Beta Cards" } });

  // Each store numbers its own stock from 1, which is itself part of the
  // isolation contract: the unique index is [storeId, lookupNumber], not global.
  const mk = (storeId: string, name: string, lookupNumber = 1) =>
    prisma.card.create({
      data: { storeId, lookupNumber, category: "NBA", name, series: "Prizm", costBasis: 1, askingPrice: 2 },
    });

  const alphaCard = await mk(alpha.id, "Alpha LeBron");
  const betaCard = await mk(beta.id, "Beta Curry");
  await prisma.category.create({
    data: { storeId: beta.id, key: "NBA", displayName: "NBA", fieldSchema: [], themeTokens: {} },
  });

  const a = storeDb(alpha.id);

  console.log("\nreads");
  const seen = await a.card.findMany();
  check("findMany returns only Alpha's cards", seen.length === 1 && seen[0].id === alphaCard.id,
    `saw ${seen.length}: ${seen.map((c) => c.name).join(", ")}`);
  check("count excludes Beta", (await a.card.count()) === 1);
  check("findUnique on Beta's card id returns null", (await a.card.findUnique({ where: { id: betaCard.id } })) === null);
  check("findFirst cannot reach Beta's card", (await a.card.findFirst({ where: { id: betaCard.id } })) === null);

  console.log("\nwrites");
  let updateBlocked = false;
  try {
    await a.card.update({ where: { id: betaCard.id }, data: { name: "HIJACKED" } });
  } catch {
    updateBlocked = true;
  }
  check("update on Beta's card is rejected", updateBlocked);

  let deleteBlocked = false;
  try {
    await a.card.delete({ where: { id: betaCard.id } });
  } catch {
    deleteBlocked = true;
  }
  check("delete on Beta's card is rejected", deleteBlocked);

  const bulk = await a.card.updateMany({ data: { packed: true } });
  check("updateMany touches only Alpha", bulk.count === 1, `updated ${bulk.count}`);
  const betaAfter = await prisma.card.findUnique({ where: { id: betaCard.id } });
  check("Beta's card is untouched", betaAfter?.name === "Beta Curry" && betaAfter?.packed === false);

  console.log("\nstamping");
  // storeId is deliberately omitted here — the whole point is that the extension
  // supplies it. The types still require it, so the call is asserted through.
  const createUnchecked = a.card.create as unknown as (
    args: unknown
  ) => Promise<{ storeId: string }>;
  const created = await createUnchecked({
    data: { category: "NBA", lookupNumber: 2, name: "Auto-stamped", series: "S", costBasis: 1, askingPrice: 2 },
  });
  check("create stamps the caller's storeId", created.storeId === alpha.id);

  console.log("\ninteractive transactions");
  // The sales and bundle routes do their work inside $transaction(async (tx) => ...).
  // If the scoping extension did not apply to `tx`, those callbacks would silently
  // operate across tenants, so assert it directly rather than assuming.
  const txSeen = await a.$transaction(async (tx) => tx.card.findMany());
  check(
    "tx client is scoped inside $transaction",
    txSeen.every((c) => c.storeId === alpha.id) && !txSeen.some((c) => c.id === betaCard.id),
    `saw ${txSeen.length}`
  );
  const txBeta = await a.$transaction(async (tx) => tx.card.findUnique({ where: { id: betaCard.id } }));
  check("tx cannot read Beta's card by id", txBeta === null);

  console.log("\nshared tables");
  await prisma.enrichmentCache.create({ data: { key: "nba|x|y", provider: "nba", hit: true } });
  check("EnrichmentCache stays shared (not scoped away)", (await a.enrichmentCache.count()) === 1);

  console.log("\ncategories");
  check("Alpha sees none of Beta's categories", (await a.category.count()) === 0);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
