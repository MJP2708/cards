-- Multi-tenancy: every row of inventory, sales and config now belongs to a Store.
--
-- The generated diff wanted `ADD COLUMN "storeId" TEXT NOT NULL` on tables that
-- already hold rows, which Postgres rejects outright. Each table therefore gets a
-- nullable column, a backfill onto one adopting store, and only then NOT NULL.

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- Everything that exists today belongs to one store. It inherits the name the
-- owner already set in Settings.storeName, so nothing visibly changes for them.
INSERT INTO "Store" ("id", "name", "createdAt", "updatedAt")
SELECT
    'sto_legacyadopted0000000000',
    COALESCE(NULLIF(TRIM((SELECT "storeName" FROM "Settings" LIMIT 1)), ''), 'Booth Cards'),
    now(),
    now();

-- AlterTable: add nullable, adopt, enforce.
ALTER TABLE "Card" ADD COLUMN "storeId" TEXT;
UPDATE "Card" SET "storeId" = 'sto_legacyadopted0000000000' WHERE "storeId" IS NULL;
ALTER TABLE "Card" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "Category" ADD COLUMN "storeId" TEXT;
UPDATE "Category" SET "storeId" = 'sto_legacyadopted0000000000' WHERE "storeId" IS NULL;
ALTER TABLE "Category" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "Sale" ADD COLUMN "storeId" TEXT;
UPDATE "Sale" SET "storeId" = 'sto_legacyadopted0000000000' WHERE "storeId" IS NULL;
ALTER TABLE "Sale" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "Bundle" ADD COLUMN "storeId" TEXT;
UPDATE "Bundle" SET "storeId" = 'sto_legacyadopted0000000000' WHERE "storeId" IS NULL;
ALTER TABLE "Bundle" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "PriceComp" ADD COLUMN "storeId" TEXT;
UPDATE "PriceComp" SET "storeId" = 'sto_legacyadopted0000000000' WHERE "storeId" IS NULL;
ALTER TABLE "PriceComp" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "FilterPreset" ADD COLUMN "storeId" TEXT;
UPDATE "FilterPreset" SET "storeId" = 'sto_legacyadopted0000000000' WHERE "storeId" IS NULL;
ALTER TABLE "FilterPreset" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "ImportBatch" ADD COLUMN "storeId" TEXT;
UPDATE "ImportBatch" SET "storeId" = 'sto_legacyadopted0000000000' WHERE "storeId" IS NULL;
ALTER TABLE "ImportBatch" ALTER COLUMN "storeId" SET NOT NULL;

ALTER TABLE "User" ADD COLUMN "storeId" TEXT;
UPDATE "User" SET "storeId" = 'sto_legacyadopted0000000000' WHERE "storeId" IS NULL;
ALTER TABLE "User" ALTER COLUMN "storeId" SET NOT NULL;

-- Settings loses storeName (it moved to Store.name, read above before dropping)
-- and stops being a hard-coded singleton now that stores share the database.
ALTER TABLE "Settings" ADD COLUMN "storeId" TEXT;
UPDATE "Settings" SET "storeId" = 'sto_legacyadopted0000000000' WHERE "storeId" IS NULL;
ALTER TABLE "Settings" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "Settings" DROP COLUMN "storeName";
ALTER TABLE "Settings" ALTER COLUMN "id" DROP DEFAULT;

-- Roles are now scoped to a store: the old install-wide ADMIN becomes the
-- store's OWNER, and STAFF become MEMBERs of that same store.
UPDATE "User" SET "role" = 'OWNER' WHERE "role" = 'ADMIN';
UPDATE "User" SET "role" = 'MEMBER' WHERE "role" = 'STAFF';
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'MEMBER';

-- DropIndex
DROP INDEX "Card_qrCode_key";
DROP INDEX "Card_category_status_idx";
DROP INDEX "Card_name_idx";
DROP INDEX "Category_key_key";
DROP INDEX "Sale_timestamp_idx";
DROP INDEX "ImportBatch_createdAt_idx";
DROP INDEX "User_role_idx";

-- CreateIndex
CREATE INDEX "Card_storeId_category_status_idx" ON "Card"("storeId", "category", "status");
CREATE INDEX "Card_storeId_name_idx" ON "Card"("storeId", "name");
CREATE UNIQUE INDEX "Card_storeId_qrCode_key" ON "Card"("storeId", "qrCode");
CREATE INDEX "Category_storeId_idx" ON "Category"("storeId");
CREATE UNIQUE INDEX "Category_storeId_key_key" ON "Category"("storeId", "key");
CREATE INDEX "Sale_storeId_timestamp_idx" ON "Sale"("storeId", "timestamp");
CREATE INDEX "Bundle_storeId_idx" ON "Bundle"("storeId");
CREATE INDEX "PriceComp_storeId_idx" ON "PriceComp"("storeId");
CREATE INDEX "FilterPreset_storeId_idx" ON "FilterPreset"("storeId");
CREATE UNIQUE INDEX "Settings_storeId_key" ON "Settings"("storeId");
CREATE INDEX "ImportBatch_storeId_createdAt_idx" ON "ImportBatch"("storeId", "createdAt");
CREATE INDEX "User_storeId_role_idx" ON "User"("storeId", "role");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceComp" ADD CONSTRAINT "PriceComp_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FilterPreset" ADD CONSTRAINT "FilterPreset_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
