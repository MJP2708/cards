-- Store-assigned quick-reference numbers.
--
-- Deliberately staged rather than a single `ADD COLUMN ... NOT NULL`: the Card
-- table already holds live inventory, so the column arrives nullable, every
-- existing row is numbered, and only then is the constraint applied. Prisma runs
-- this file in one transaction, so a failure at any step leaves the schema
-- exactly as it was.

-- 1. The per-store allocator. A monotonic counter, not MAX()+1 — see the schema
--    comment on Store.nextLookupNumber for why numbers must never be recycled.
ALTER TABLE "Store" ADD COLUMN "nextLookupNumber" INTEGER NOT NULL DEFAULT 1;

-- 2. The column, nullable for now so the backfill has somewhere to write.
ALTER TABLE "Card" ADD COLUMN "lookupNumber" INTEGER;

-- 3. Number existing stock in the order it was added, per store, starting at 1.
--    dateAdded first so the numbering matches the order the seller actually
--    entered things; createdAt and id break ties deterministically.
WITH numbered AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY "storeId"
            ORDER BY "dateAdded", "createdAt", id
        ) AS seq
    FROM "Card"
)
UPDATE "Card" AS c
SET "lookupNumber" = n.seq
FROM numbered AS n
WHERE c.id = n.id;

-- 4. Point each store's counter past whatever the backfill used, so the next
--    card added continues the sequence instead of colliding with it.
UPDATE "Store" AS s
SET "nextLookupNumber" = COALESCE(
    (SELECT MAX(c."lookupNumber") FROM "Card" AS c WHERE c."storeId" = s.id),
    0
) + 1;

-- 5. Now that every row has a value, enforce it.
ALTER TABLE "Card" ALTER COLUMN "lookupNumber" SET NOT NULL;
CREATE UNIQUE INDEX "Card_storeId_lookupNumber_key" ON "Card"("storeId", "lookupNumber");
