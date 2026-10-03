-- =============================================================
-- Kasir POS — Migration 0012
-- Pembelian bahan baku (nota multi-bahan) + asumsi pemakaian harian
-- Jalankan di SQL Editor Supabase (aman untuk data yang sudah ada)
-- =============================================================

-- ---------- ASUMSI PEMAKAIAN (untuk rekomendasi tahap awal) ----------
-- Dipakai sebagai cadangan saat data penjualan belum cukup.
-- Satuan mengikuti satuan resep bahan (kolom unit).
alter table ingredients add column if not exists assumed_daily_usage numeric(12,3) not null default 0;

-- ---------- NOTA PEMBELIAN ----------
create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  supplier text,
  note text,
  total numeric(14,2) not null default 0,
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  -- qty dalam satuan resep bahan; unit_cost = harga per satuan resep
  qty numeric(12,3) not null default 0,
  unit_cost numeric(14,4) not null default 0,
  line_total numeric(14,2) not null default 0,
  -- snapshot cara beli (kemasan) agar riwayat tetap terbaca walau master berubah
  purchase_unit text,
  purchase_qty numeric(12,3),
  purchase_price numeric(14,2)
);

create index if not exists idx_purchases_date on purchases(purchased_at desc);
create index if not exists idx_purchase_items_purchase on purchase_items(purchase_id);
create index if not exists idx_purchase_items_ingredient on purchase_items(ingredient_id);

alter table purchases enable row level security;
alter table purchase_items enable row level security;
drop policy if exists "public_all" on purchases;
create policy "public_all" on purchases for all using (true) with check (true);
drop policy if exists "public_all" on purchase_items;
create policy "public_all" on purchase_items for all using (true) with check (true);

-- ---------- FUNGSI: catat pembelian (atomik) ----------
-- p_items: [ { ingredient_id, qty, unit_cost, purchase_unit?, purchase_qty?, purchase_price? } ]
-- qty & unit_cost dalam satuan resep. Stok bertambah, HPP diperbarui
-- dengan rata-rata tertimbang, dan riwayat stok tercatat sebagai 'purchase'.
create or replace function create_purchase(p_supplier text, p_note text, p_items jsonb)
returns uuid
language plpgsql
as $$
declare
  v_purchase_id uuid;
  v_item jsonb;
  v_ing ingredients;
  v_qty numeric;
  v_unit_cost numeric;
  v_line numeric;
  v_total numeric := 0;
  v_new_stock numeric;
  v_new_cost numeric;
begin
  insert into purchases (supplier, note, total) values (p_supplier, p_note, 0)
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'qty')::numeric, 0);
    if v_qty <= 0 then continue; end if;

    select * into v_ing from ingredients where id = (v_item->>'ingredient_id')::uuid for update;
    if v_ing.id is null then continue; end if;

    v_unit_cost := coalesce((v_item->>'unit_cost')::numeric, v_ing.cost_per_unit, 0);
    v_line := round(v_qty * v_unit_cost, 2);

    insert into purchase_items (
      purchase_id, ingredient_id, qty, unit_cost, line_total,
      purchase_unit, purchase_qty, purchase_price
    ) values (
      v_purchase_id, v_ing.id, v_qty, v_unit_cost, v_line,
      v_item->>'purchase_unit', (v_item->>'purchase_qty')::numeric, (v_item->>'purchase_price')::numeric
    );

    v_new_stock := v_ing.stock + v_qty;
    -- rata-rata tertimbang HPP: (nilai stok lama + nilai beli baru) / stok baru
    v_new_cost := case
      when v_new_stock > 0 then round(((v_ing.stock * v_ing.cost_per_unit) + (v_qty * v_unit_cost)) / v_new_stock, 2)
      else v_ing.cost_per_unit
    end;

    update ingredients
    set stock = v_new_stock,
        cost_per_unit = v_new_cost
    where id = v_ing.id;

    insert into stock_movements (ingredient_id, type, qty, stock_after, note)
    values (v_ing.id, 'purchase', v_qty, v_new_stock, coalesce(p_note, 'Pembelian bahan'));

    v_total := v_total + v_line;
  end loop;

  update purchases set total = v_total where id = v_purchase_id;
  return v_purchase_id;
end $$;
