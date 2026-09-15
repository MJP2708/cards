import { prisma } from "@/lib/prisma";

/**
 * Tables owned by a Store. Anything not listed here is shared across tenants:
 *  - `Store` itself, which is the tenant record.
 *  - `EnrichmentCache`, which caches public player stats and holds no private data
 *    (sharing it is what keeps the rate-limited API-Sports quota survivable).
 */
const TENANT_MODELS = new Set([
  "Card",
  "Category",
  "Sale",
  "Bundle",
  "PriceComp",
  "FilterPreset",
  "ImportBatch",
  "ImportMapping",
  "Settings",
  "User",
]);

/** Operations whose `where` selects rows that already exist. */
const FILTERED_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

/**
 * A Prisma client pinned to one store.
 *
 * Every read is filtered to `storeId` and every write stamped with it, centrally,
 * so isolation does not depend on ~336 call sites each remembering a filter. A
 * missed filter is the failure mode that matters here — it shows up as one shop
 * seeing another's inventory, silently — so it is enforced in one place instead.
 *
 * Merging `storeId` into a unique `where` is legal because Prisma's extended
 * where-unique accepts extra non-unique filters alongside the unique field. A
 * row belonging to another store therefore reads as "not found" (P2025) rather
 * than being quietly updated or deleted.
 *
 * Use it through `requireStore()` rather than calling it directly, so the id
 * always comes from the verified session and never from user input.
 */
export function storeDb(storeId: string) {
  if (!storeId) throw new Error("storeDb requires a storeId");

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) return query(args);

          const scoped = { ...(args as Record<string, unknown>) };

          if (FILTERED_OPERATIONS.has(operation)) {
            scoped.where = { ...((scoped.where as object | undefined) ?? {}), storeId };
          }

          if (operation === "create") {
            scoped.data = { ...((scoped.data as object | undefined) ?? {}), storeId };
          }

          if (operation === "createMany" || operation === "createManyAndReturn") {
            const rows = scoped.data;
            scoped.data = Array.isArray(rows)
              ? rows.map((row) => ({ ...(row as object), storeId }))
              : { ...((rows as object | undefined) ?? {}), storeId };
          }

          // upsert filters on `where` above; its insert branch needs stamping too.
          if (operation === "upsert") {
            scoped.create = { ...((scoped.create as object | undefined) ?? {}), storeId };
          }

          return query(scoped);
        },
      },
    },
  });
}

export type StoreDb = ReturnType<typeof storeDb>;
