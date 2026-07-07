-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "liveStats" JSONB,
ADD COLUMN     "liveStatsFetchedAt" TIMESTAMP(3);
