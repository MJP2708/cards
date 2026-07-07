# Booth Cards — Convention Inventory & Sales Tracker

A booth-ready inventory, research, and sales tracker for trading card sellers, with
distinct sections for NBA, Football, Pokémon, and Other TCG (extensible to any
new category), category-based theming, offline resilience, sales reporting
(PDF/CSV), and a live analytics dashboard.

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Prisma 7 (`prisma-client` generator, driver-adapter runtime) + Neon (serverless Postgres)
- Dexie.js (IndexedDB) for the offline cache/mutation queue
- `@react-pdf/renderer` for PDF reports, `papaparse` for CSV import/export
- `recharts` for the dashboard, `qrcode` + `@zxing/library` for QR labels/scanning
- Zustand for small UI state, TanStack Query for server-state caching

## Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Neon project** at [neon.tech](https://neon.tech) (or use an existing one).
   From the Neon dashboard, copy two connection strings:
   - The **pooled** connection string (hostname contains `-pooler`) — used by the
     app at runtime, since Vercel serverless functions open many short-lived connections.
   - The **direct** connection string (same hostname, without `-pooler`) — used
     only for migrations, since Prisma Migrate needs a session-level (non-PgBouncer) connection.

3. **Set environment variables.** Copy `.env` and fill in both values:

   ```bash
   DATABASE_URL='postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/<db>?sslmode=require&channel_binding=require'
   DIRECT_URL='postgresql://<user>:<password>@<endpoint>.<region>.aws.neon.tech/<db>?sslmode=require&channel_binding=require'
   ```

   Never commit `.env` — it's already gitignored.

4. **Run the migration and seed data:**

   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

   This creates the four built-in categories (NBA, Football, Pokémon, Other TCG)
   and seeds a handful of sample cards in each, so you have data to explore
   immediately.

5. **Start the dev server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) — it redirects to `/all`.

## Deploying to Vercel

1. `vercel link` (or import the repo from the Vercel dashboard) to create/link the Vercel project.
2. In the Vercel project's environment variables, add `DATABASE_URL` (pooled) and
   `DIRECT_URL` (direct) with the same values as your local `.env`.
3. Deploy. On first deploy (and after any schema change), run migrations against
   Neon from your machine or CI:

   ```bash
   npx prisma migrate deploy
   ```

   (`migrate deploy` applies committed migrations without prompting — it's the
   one to use in CI/production; `migrate dev` is for local schema iteration.)
4. Vercel's build step runs `npm install` then `next build`. `package.json` has
   a `postinstall` script (`prisma generate`) so the generated client is always
   regenerated from `prisma/schema.prisma` before the build — if you change the
   build command, make sure that still happens before `next build` runs.

## Feature notes & known simplifications

- **Card research / Fact Sheet panel** ships in **manual/cached mode only** —
  there's no live eBay/NBA-stats/TCGplayer API wired up yet. Add comps by
  pasting in a price + source + optional link on the card's detail page; the
  "why priced high" explainer and price-history sparkline are derived from
  whatever comps/card data you've entered, not a live feed. Wiring in real APIs
  (balldontlie/NBA stats for sports, TCGplayer API for Pokémon/TCG, eBay's
  Browse API for comps — never scrape eBay directly, it violates their ToS) is
  a natural follow-up once you have API keys; the `PriceComp` model and Fact
  Sheet UI already have a `source` field ready for a `"live"` provenance value.
- **Offline support** covers the three actions most likely to matter mid-sale
  at a booth: **browsing/searching inventory, adding a card, and marking a card
  sold**. These read/write through a Dexie (IndexedDB) mirror and a mutation
  queue — if the network call fails, the change is applied locally with a
  client-generated id and queued, then replayed in order once connectivity
  returns (via the `online` browser event and a 30s backstop poll). The header
  banner shows Live / Offline / Syncing state. Editing existing cards, bulk
  actions, CSV import, comps, and settings are **online-only** for now — the
  Dexie mirror only gets populated by a successful `/api/cards` list fetch, so
  make sure to load the app once while online (e.g. at home or hotel wifi)
  before relying on it offline at the venue.
- **Photo upload** isn't implemented — `Card.photoFront`/`photoBack` are plain
  URL text fields. Point them at any already-hosted image URL if you want
  thumbnails to show up in PDF reports.
- **Multi-currency** is reference-only: set a THB-per-USD rate in Settings and
  a small `≈ $X` hint appears next to THB prices around the app. All actual
  transactions (asking price, sales, comps) are stored and reported in THB.
- **QR labels**: each card's detail page has a "Print QR Label" link that opens
  a bare printable page (`/label/[id]`) encoding the card's `qrCode` (or its
  database id if none was set). `/scan` uses the device camera
  (`@zxing/library`, works across desktop/mobile browsers including Safari) to
  read a label and jump straight to that card, with a manual code-entry
  fallback.
- **Custom categories**: Settings → "Add a Custom Category" lets you define a
  new category's extra fields and theme colors without touching code — it
  shows up in the category switcher and inventory forms immediately.

## Project structure

- `prisma/schema.prisma` — `Card` (shared columns + a `attributes` JSON bag for
  category-specific fields), `Category` (theme tokens + field schema),
  `Sale`/`Bundle`, `PriceComp`, `FilterPreset`, `Settings`.
- `src/lib/fieldSchema.ts` — the built-in categories' extra-field definitions;
  `src/lib/categories.ts` reads `Category` rows (built-in + custom) at runtime.
- `src/app/(app)/` — the app shell (category switcher, search, offline banner,
  dark/booth mode) and all main routes (`[category]`, `reports`, `dashboard`,
  `checklist`, `scan`, `settings/categories`).
- `src/lib/offline/` — the Dexie database, sync queue, and sync manager.
- `src/lib/reports/` — sales report and dashboard stats aggregation (shared
  between the on-screen preview, PDF, and CSV export).
