# Debtline — Personal Debt Tracker

React + Vite + Tailwind frontend, Supabase (Postgres) for storage. No other backend.

## Setup

**1. Create the Supabase project**
- Go to supabase.com, create a new project, wait for it to provision.
- Dashboard → SQL Editor → New query → paste the contents of `supabase/schema.sql` → Run.
  This creates the `debts` and `payments` tables, sets permissive RLS policies, and
  inserts the same sample data the demo used (comment that block out in the SQL
  file first if you want to start empty).
- Dashboard → Project Settings → API → copy the **Project URL** and the **anon public** key.

**2. Configure the app**
```
cp .env.example .env
```
Paste your URL and anon key into `.env`.

**3. Run locally**
```
npm install
npm run dev
```
Opens on `http://localhost:5173`.

**4. Deploy**
- Push this folder to a GitHub repo.
- Vercel → New Project → import the repo → it auto-detects Vite.
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in
  Vercel's project settings (Settings → Environment Variables) — the `.env` file
  itself is gitignored and won't be pushed, so this step is required, not optional.
- Deploy.

## What's real vs. what isn't

**Real:** debts and payments are stored in Postgres via Supabase. Adding a debt,
recording a payment, deleting a debt — all of it writes to the database and
survives a reload, a different browser, a different device.

**Not real / not built:**
- **No auth.** Anyone with your anon key can read and write your data. The RLS
  policies in `schema.sql` are wide open (`using (true)`) on purpose, with a
  comment explaining why and what to change if that stops being acceptable
  (i.e. if this ever becomes more than a single-person project — add Supabase
  Auth and rewrite the policies to filter by `auth.uid()`).
- **Dark mode preference doesn't persist** — resets to light on every visit.
  Would need a `user_preferences` table or a `localStorage` write (which works
  fine in a real deployed app, unlike in the Claude artifact sandbox this was
  prototyped in).
- **File/receipt upload isn't wired up.** Supabase Storage (1 GB free) can do
  this — add a bucket and a `receipt_url` column on `payments`.
- **The "Debt Reduction," "Monthly Payments," and "Cash Flow" charts on the
  Reports page are static illustrative series**, not derived from your actual
  data. A real trend needs periodic snapshots — e.g. a scheduled Supabase Edge
  Function that inserts a row into a `balance_history` table once a month.
- **No month-grid calendar** — Payment Calendar is a grouped list.
- **Payment recording is two separate writes** (update the debt, insert the
  payment), not one atomic transaction. Fine for personal use; if you care
  about atomicity, move the logic into a Postgres function and call it via
  `supabase.rpc(...)` instead of two client-side calls.

## Project structure

```
src/
  App.jsx              all UI: pages, cards, modals, sidebar
  hooks/useDebts.js     every Supabase read/write lives here
  lib/supabaseClient.js Supabase client init
  lib/debtHelpers.js    pure calculation functions (money formatting,
                         totals, snowball/avalanche simulation) — no
                         Supabase or React dependency, easy to unit test
supabase/schema.sql      run this once in the Supabase SQL editor
```

## Free tier reality check

Supabase free projects pause after a week of no API activity — you'll need to
manually resume from the dashboard, or set up a scheduled ping (e.g. a free
GitHub Action hitting a lightweight endpoint every few days) if you want to
avoid that.
