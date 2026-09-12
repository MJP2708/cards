/**
 * Reports whether this machine can actually reach the database, and over which
 * address family.
 *
 *   npx tsx --env-file=.env scripts/db-connect-check.ts
 *
 * Exists because a P1001 from the Prisma CLI does not distinguish "database is
 * down" from "your resolver handed us an AAAA record with no working route" —
 * which is a real failure mode on this network. Run with
 * `NODE_OPTIONS=--dns-result-order=ipv4first` to confirm an IPv6 path is the cause.
 */
import { Client } from "pg";
import { lookup } from "node:dns/promises";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Neither DIRECT_URL nor DATABASE_URL is set.");
    process.exit(1);
  }
  const host = new URL(url).hostname;

  const addresses = await lookup(host, { all: true });
  console.log(`resolver order for ${host}:`);
  for (const entry of addresses) console.log(`  IPv${entry.family}  ${entry.address}`);

  const client = new Client({ connectionString: url });
  const startedAt = Date.now();
  await client.connect();
  // @ts-expect-error -- remoteFamily is on the underlying socket, not pg's types.
  const family = client.connection?.stream?.remoteFamily ?? "unknown";
  // @ts-expect-error -- same.
  const address = client.connection?.stream?.remoteAddress ?? "unknown";
  const { rows } = await client.query("select current_database() as db");
  console.log(`\nconnected to ${rows[0].db} in ${Date.now() - startedAt}ms`);
  console.log(`  socket: ${family} ${address}`);

  // Row counts for the tables that matter when checking the install is clean.
  const tables = ["User", "Card", "Sale", "Bundle", "PriceComp", "ImportBatch", "EnrichmentCache", "Settings"];
  console.log("\nrow counts:");
  for (const table of tables) {
    try {
      const result = await client.query(`select count(*)::int as n from "${table}"`);
      console.log(`  ${table.padEnd(16)} ${result.rows[0].n}`);
    } catch {
      console.log(`  ${table.padEnd(16)} (no such table)`);
    }
  }

  const pending = await client.query(
    "select migration_name from _prisma_migrations order by started_at desc limit 1"
  );
  console.log(`\nlatest applied migration: ${pending.rows[0]?.migration_name ?? "none"}`);
  await client.end();
}

main().catch((error) => {
  console.error(`\nconnection failed: ${error.message}`);
  process.exit(1);
});
