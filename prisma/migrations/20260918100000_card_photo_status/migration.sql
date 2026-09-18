-- Post-import reference-photo pass. Nullable: existing cards read as "never
-- attempted" rather than being claimed as already searched.
ALTER TABLE "Card" ADD COLUMN "photoStatus" TEXT;

-- Lets the chunked pass find its next slice without scanning the whole table.
CREATE INDEX "Card_importBatchId_photoStatus_idx" ON "Card"("importBatchId", "photoStatus");

ALTER TABLE "ImportBatch" ADD COLUMN "photoCount" INTEGER NOT NULL DEFAULT 0;
