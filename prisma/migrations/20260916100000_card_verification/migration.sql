-- Post-commit correctness audit. Nullable: every existing card starts as
-- "not yet checked" rather than being silently claimed as verified.
ALTER TABLE "Card" ADD COLUMN "verificationStatus" TEXT;
ALTER TABLE "Card" ADD COLUMN "verificationNotes" TEXT;
ALTER TABLE "Card" ADD COLUMN "verifiedAt" TIMESTAMP(3);

CREATE INDEX "Card_storeId_verificationStatus_idx" ON "Card"("storeId", "verificationStatus");

ALTER TABLE "ImportBatch" ADD COLUMN "verifiedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ImportBatch" ADD COLUMN "flaggedCount" INTEGER NOT NULL DEFAULT 0;
