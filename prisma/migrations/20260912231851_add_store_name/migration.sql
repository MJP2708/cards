-- AlterTable
-- Existing installs already have a Settings row (or none at all, in which case
-- the app's upsert creates one). The DEFAULT means neither case can end up with
-- a NULL or blank store name: they keep rendering "Booth Cards" exactly as
-- before until an owner sets a real name at sign-up.
ALTER TABLE "Settings" ADD COLUMN "storeName" TEXT NOT NULL DEFAULT 'Booth Cards';
