-- Debtline schema
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- DEBTS
-- One row per debt, regardless of kind. Columns that don't apply
-- to a given kind (e.g. "emi" for a credit card) are left null.
-- ---------------------------------------------------------------
create table if not exists debts (
  id                  uuid primary key default gen_random_uuid(),
  kind                text not null check (kind in ('loan', 'card', 'shark')),
  category            text not null,
  name                text not null,
  lender              text not null,

  -- loan fields
  original            numeric,
  balance             numeric,
  rate                numeric,
  emi                 numeric,
  next_due            date,
  months_remaining    integer,
  total_months        integer,
  principal_paid      numeric default 0,
  interest_paid       numeric default 0,

  -- credit card fields
  limit_amount        numeric,
  apr                 numeric,
  min_due             numeric,

  -- informal / loan shark fields
  borrower            text,
  principal_remaining numeric,
  monthly_rate        numeric,
  next_interest_due   date,

  created_at          timestamptz default now()
);

-- ---------------------------------------------------------------
-- PAYMENTS
-- One row per recorded payment, linked to a debt. Kept even if the
-- debt is later deleted is NOT the default here — cascade delete
-- keeps things simple. Change to "set null" if you want to preserve
-- payment history after a debt is removed.
-- ---------------------------------------------------------------
create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  debt_id     uuid references debts(id) on delete cascade,
  debt_name   text,
  date        date not null,
  amount      numeric not null default 0,
  principal   numeric not null default 0,
  interest    numeric not null default 0,
  late_fee    numeric default 0,
  notes       text,
  type        text, -- 'Payment' | 'Interest' | 'Principal'
  created_at  timestamptz default now()
);

create index if not exists payments_debt_id_idx on payments(debt_id);

-- ---------------------------------------------------------------
-- ROW LEVEL SECURITY
--
-- Honest note: this schema has no auth wired up. It's built for a
-- single person using their own Supabase project with the anon key
-- kept out of any public repo. The policies below allow anyone
-- holding your anon key to read/write everything.
--
-- That is fine for a personal project only you access. It is NOT
-- fine if you ever deploy this somewhere public without adding
-- Supabase Auth and rewriting these policies to filter by
-- `auth.uid()`. Don't skip that step if this stops being just-for-you.
-- ---------------------------------------------------------------

alter table debts enable row level security;
alter table payments enable row level security;

create policy "Allow all on debts" on debts
  for all using (true) with check (true);

create policy "Allow all on payments" on payments
  for all using (true) with check (true);

-- ---------------------------------------------------------------
-- SEED DATA (optional)
-- Comment this whole block out if you'd rather start empty.
-- Dates are relative to whenever you run this script.
-- ---------------------------------------------------------------

insert into debts (kind, category, name, lender, original, balance, rate, emi, next_due, months_remaining, total_months, principal_paid, interest_paid)
values
  ('loan', 'Home Loan', 'Whitefield Apartment Loan', 'HDFC Bank', 180000, 152400, 8.5, 1550, current_date + interval '6 days', 118, 180, 27600, 41200),
  ('loan', 'Car Loan', 'Hyundai Creta Loan', 'ICICI Bank', 18500, 10920, 9.2, 420, current_date + interval '2 days', 27, 48, 7580, 2340),
  ('loan', 'Personal Loan', 'Wedding Personal Loan', 'Axis Bank', 12000, 6440, 14.0, 380, current_date + interval '11 days', 18, 36, 5560, 1810),
  ('loan', 'Education Loan', 'MS Program Loan', 'SBI', 22000, 15100, 7.8, 260, current_date + interval '20 days', 62, 96, 6900, 3050);

insert into debts (kind, category, name, lender, balance, limit_amount, apr, min_due, next_due)
values
  ('card', 'Credit Card', 'Visa Signature', 'Axis Bank', 4200, 8000, 24.99, 210, current_date + interval '4 days'),
  ('card', 'Credit Card', 'Mastercard World', 'HSBC', 2800, 5000, 22.99, 140, current_date + interval '9 days');

insert into debts (kind, category, name, lender, borrower, original, principal_remaining, monthly_rate, principal_paid, interest_paid, next_interest_due)
values
  ('shark', 'Informal Loan', 'Loan Shark — Ramesh', 'Ramesh (Private)', 'Ramesh', 20000, 20000, 10, 0, 8000, current_date + interval '5 days'),
  ('shark', 'Informal Loan', 'Loan Shark — Kumar', 'Kumar (Private)', 'Kumar', 15000, 12000, 8, 3000, 5760, current_date + interval '1 day');
