# Booth Cards — Convention Inventory & Sales Tracker

A booth-ready inventory, research, and sales tracker for sports card sellers, with
distinct sections for NBA and Football (soccer) — extensible to any new category
via Settings — category-based theming, offline resilience, sales reporting
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

   Optionally, for live player stats on the Fact Sheet panel (Settings → not
   required, everything else works without these):

   ```bash
   BALLDONTLIE_API_KEY='...'   # NBA season averages — https://www.balldontlie.io
   API_FOOTBALL_KEY='...'      # Football/soccer season stats — https://www.api-football.com (free tier: 100 req/day)
   ```

4. **Run the migration and seed data:**

   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

   This creates the two built-in categories (NBA, Football) and seeds a
   handful of sample cards in each, so you have data to explore immediately.

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

- **Card research / Fact Sheet panel**: live season-stat lookups (season
  averages for NBA via balldontlie, appearances/goals/assists/rating for
  Football via API-Football) are wired up behind a "Refresh Stats" button —
  results are cached on the card (`Card.liveStats`/`liveStatsFetchedAt`) and
  only re-fetched at most once an hour, since the free API tiers have tight
  daily request limits (API-Football: 100/day). **Price comps remain
  manual/cached only** — there's no live eBay pricing API wired up. Add comps
  by pasting in a price + source + optional link; the "why priced high"
  explainer and price-history sparkline are derived from whatever comps
  you've entered, not a live feed (never scrape eBay directly — it violates
  their ToS; their paid Browse API is the sanctioned path if you want this later).
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
  shows up in the category switcher and inventory forms immediately. This is
  also how you'd bring back a TCG/Pokémon-style section (or add any other
  card type) later without a code change.

## Changelog: UX/UI overhaul

A design and usability pass on top of the working v1 app — no core feature changes, all additive:

- **Visual identity**: a real type scale, a distinct display font per category
  (Oswald/NBA, Barlow Condensed/Football, plus Baloo 2/Cinzel available for
  custom categories) layered over one consistent Geist Sans body face, upgraded
  category textures (hardwood stripe, pitch stripe, holo sheen, ornate frame),
  and small hand-drawn category icons — all swappable per category via
  `Category.themeTokens` (now including `headerFont`/`iconSet`), exposed as
  dropdowns in Settings rather than raw JSON.
- **Scope**: narrowed to sports cards only (NBA + Football/soccer) — Pokémon
  and Other TCG were removed as built-in categories; add them back anytime via
  Settings → Add a Custom Category if needed.
- **Live stats**: NBA (balldontlie) and Football (API-Football) season-stat
  lookups on the Fact Sheet, cached hourly given free-tier rate limits.
- **Usability**: a unified filter chip bar (replacing separate status/sort/
  price dropdowns), empty states and loading skeletons throughout, a regrouped
  Add Card form (Identity → Pricing & Status → Photos & Notes) with real photo
  fields, undo toasts on delete/mark-sold (replacing confirm() dialogs), inline
  help tooltips, a 4-step skippable onboarding tour, and a Cmd/Ctrl+K command
  palette for jumping to any card/category/page.
- **Motion**: category-switch crossfade, a Mark Sold checkmark celebration, all
  routed through one `MotionConfig` wrapper that respects `prefers-reduced-motion`
  plus an explicit Settings override.
- **PDF reports**: a branded header band (category accent color), alternating
  row shading, cleaner spacing.
- **Language switcher**: English/Thai via a `NEXT_LOCALE` cookie (no URL
  routing change), persisted per device. Translated so far: navigation, common
  actions, Dashboard, Reports, and Settings chrome. Card/player/team/set data
  is never translated. Deeper dialogs (Fact Sheet, CSV import, onboarding copy)
  are still English-only — the message-file structure
  (`src/messages/{en,th}/*.json` by feature area) makes extending this
  straightforward. Grading/condition jargon (e.g. "PSA 10", card
  types/rarities) is intentionally left as free-text data, not translated.

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
