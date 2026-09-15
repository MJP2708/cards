-- Append-only price history, plus provenance for auto-fetched card images.
-- Additive only: every column has a default and the new table is empty, so
-- this applies to a populated database without a backfill.


-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "photoIsStock" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "medianPrice" DOUBLE PRECISION NOT NULL,
    "minPrice" DOUBLE PRECISION NOT NULL,
    "maxPrice" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceSnapshot_cardId_capturedAt_idx" ON "PriceSnapshot"("cardId", "capturedAt");

-- CreateIndex
CREATE INDEX "PriceSnapshot_storeId_idx" ON "PriceSnapshot"("storeId");

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

