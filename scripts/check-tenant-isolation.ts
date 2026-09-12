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

  const mk = (storeId: string, name: string) =>
    prisma.card.create({
      data: { storeId, category: "NBA", name, series: "Prizm", costBasis: 1, askingPrice: 2 },
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
    data: { category: "NBA", name: "Auto-stamped", series: "S", costBasis: 1, askingPrice: 2 },
  });
  check("create stamps the caller's storeId", created.storeId === alpha.id);

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
