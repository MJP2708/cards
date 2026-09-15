-- Import history gains a breakdown: a row that matched an existing card and changed
-- its quantity/price is neither "imported" nor "nothing happened", and the old
-- schema could only record the first.
ALTER TABLE "ImportBatch" ADD COLUMN "updatedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ImportBatch" ADD COLUMN "skippedCount" INTEGER NOT NULL DEFAULT 0;

-- Saved column mappings, per store. Keyed for lookup by headerSignature so a
-- second upload from the same source can be recognised without scanning JSON.
CREATE TABLE "ImportMapping" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headerSignature" TEXT NOT NULL,
    "fieldMap" JSONB NOT NULL,
    "categoryMap" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportMapping_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportMapping_storeId_lastUsedAt_idx" ON "ImportMapping"("storeId", "lastUsedAt");
CREATE UNIQUE INDEX "ImportMapping_storeId_name_key" ON "ImportMapping"("storeId", "name");

ALTER TABLE "ImportMapping" ADD CONSTRAINT "ImportMapping_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
