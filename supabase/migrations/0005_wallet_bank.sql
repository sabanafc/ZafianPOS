-- =============================================================
-- 0005 — Wallet & Rekening Bank
-- Jalankan di SQL Editor Supabase setelah 0001-0004.
-- =============================================================

-- Ledger pencatatan: 'wallet' (dompet setoran owner) atau 'bank' (rekening)
alter table finance_entries add column if not exists account text not null default 'wallet';
alter table finance_entries add column if not exists bank_account_id uuid;

-- Rekening bank penampungan dana
create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- mis. BCA Operasional
  bank_name text,                     -- mis. BCA
  account_no text,
  opening_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Mutasi bank; source='wallet' berarti dana berasal dari wallet (setoran owner)
create table if not exists bank_txns (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references bank_accounts(id) on delete cascade,
  type text not null check (type in ('in','out')),
  source text,                        -- 'wallet' = setor dari wallet
  amount numeric(14,2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

alter table bank_accounts enable row level security;
alter table bank_txns enable row level security;
drop policy if exists "public_all" on bank_accounts;
create policy "public_all" on bank_accounts for all using (true) with check (true);
drop policy if exists "public_all" on bank_txns;
create policy "public_all" on bank_txns for all using (true) with check (true);
