-- =============================================================
-- Kasir POS — Skema awal (jalankan sekali di SQL Editor Supabase)
-- =============================================================

-- ---------- TABEL ----------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  name text not null,
  price numeric(12,2) not null default 0,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'pcs',
  stock numeric(12,3) not null default 0,
  min_stock numeric(12,3) not null default 0,
  cost_per_unit numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists recipe_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  qty numeric(12,3) not null default 0,
  unique(product_id, ingredient_id)
);

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  opening_float numeric(14,2) not null default 0,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  expected_cash numeric(14,2),
  counted_cash numeric(14,2),
  cash_diff numeric(14,2),
  status text not null default 'open' check (status in ('open','closed'))
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null,
  shift_id uuid references shifts(id) on delete set null,
  channel text not null default 'dine_in' check (channel in ('dine_in','takeaway','gofood','grabfood','shopeefood')),
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  service numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  cost_total numeric(14,2) not null default 0,
  payment_method text check (payment_method in ('cash','qris','transfer')),
  paid_amount numeric(14,2),
  change_amount numeric(14,2),
  status text not null default 'paid' check (status in ('paid','void')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,
  price numeric(12,2) not null default 0,
  qty numeric(12,3) not null default 1,
  cost_of_goods numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0
);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  type text not null check (type in ('purchase','usage','adjustment','waste')),
  qty numeric(12,3) not null default 0,
  stock_after numeric(12,3) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists cash_movements (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts(id) on delete cascade,
  type text not null check (type in ('in','out')),
  amount numeric(14,2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists finance_entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income','expense')),
  category text not null default 'lainnya',
  amount numeric(14,2) not null default 0,
  note text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id integer primary key default 1 check (id = 1),
  business_name text not null default 'Bisnis Saya',
  address text default '',
  phone text default '',
  tax_percent numeric(5,2) not null default 0,
  service_percent numeric(5,2) not null default 0,
  receipt_footer text default 'Terima kasih telah berkunjung!',
  paper_width integer not null default 80,
  default_float numeric(14,2) not null default 350000,
  dark_mode boolean not null default false
);

-- ---------- INDEX ----------
create index if not exists idx_products_category on products(category_id);
create index if not exists idx_orders_created on orders(created_at desc);
create index if not exists idx_orders_shift on orders(shift_id);
create index if not exists idx_order_items_order on order_items(order_id);
create index if not exists idx_stock_moves_ing on stock_movements(ingredient_id, created_at desc);
create index if not exists idx_cash_moves_shift on cash_movements(shift_id);
create index if not exists idx_recipe_product on recipe_items(product_id);

-- ---------- RLS (permisif: app single-user tanpa auth) ----------
alter table categories enable row level security;
alter table products enable row level security;
alter table ingredients enable row level security;
alter table recipe_items enable row level security;
alter table shifts enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table stock_movements enable row level security;
alter table cash_movements enable row level security;
alter table finance_entries enable row level security;
alter table settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categories','products','ingredients','recipe_items','shifts','orders','order_items','stock_movements','cash_movements','finance_entries','settings'] loop
    execute format('drop policy if exists "public_all" on %I', t);
    execute format('create policy "public_all" on %I for all using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- FUNGSI: buat order + deduksi stok otomatis (BOM) ----------
create or replace function create_order(p_channel text, p_items jsonb, p_discount numeric, p_payment text, p_paid numeric, p_note text, p_shift uuid)
returns uuid
language plpgsql
as $$
declare
  v_order_id uuid;
  v_order_no text;
  v_settings settings;
  v_subtotal numeric := 0;
  v_cost numeric := 0;
  v_tax numeric := 0;
  v_service numeric := 0;
  v_total numeric := 0;
  v_change numeric := 0;
  v_item jsonb;
  v_prod products;
  v_cog numeric;
  v_is_online boolean;
  row_ok record;
  rec record;
begin
  select * into v_settings from settings where id = 1;
  if not found then
    insert into settings (id) values (1) returning * into v_settings;
  end if;

  v_is_online := p_channel in ('gofood','grabfood','shopeefood');

  -- validasi stok bahan baku cukup (per item x qty)
  for v_item in select * from jsonb_array_elements(p_items) loop
    for row_ok in
      select ri.qty as need, i.stock, i.name
      from recipe_items ri join ingredients i on i.id = ri.ingredient_id
      where ri.product_id = (v_item->>'productId')::uuid
    loop
      if row_ok.stock < row_ok.need * (v_item->>'qty')::numeric then
        raise exception 'Stok tidak cukup untuk %', row_ok.name using errcode = 'P0001';
      end if;
    end loop;
  end loop;

  insert into orders (order_no, shift_id, channel, payment_method, paid_amount, note)
  values ('TEMP', p_shift, p_channel, case when v_is_online then null else p_payment end,
          case when v_is_online then null else p_paid end, p_note)
  returning id into v_order_id;

  v_order_no := to_char(now(),'YYMMDD') || '-' || lpad((select count(*)::text from orders where created_at::date = current_date), 4, '0');
  update orders set order_no = v_order_no where id = v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from products where id = (v_item->>'productId')::uuid;
    if v_prod.id is null then continue; end if;

    select coalesce(sum(ri.qty * i.cost_per_unit), 0) into v_cog
    from recipe_items ri join ingredients i on i.id = ri.ingredient_id
    where ri.product_id = v_prod.id;

    insert into order_items (order_id, product_id, name, price, qty, cost_of_goods, line_total)
    values (v_order_id, v_prod.id, v_prod.name, v_prod.price, (v_item->>'qty')::numeric, v_cog, v_prod.price * (v_item->>'qty')::numeric);

    v_subtotal := v_subtotal + v_prod.price * (v_item->>'qty')::numeric;
    v_cost := v_cost + v_cog * (v_item->>'qty')::numeric;

    -- deduksi stok via BOM + catat movement
    for rec in
      select ri.ingredient_id, ri.qty * (v_item->>'qty')::numeric as use_qty
      from recipe_items ri where ri.product_id = v_prod.id
    loop
      update ingredients set stock = stock - rec.use_qty where id = rec.ingredient_id;
      insert into stock_movements (ingredient_id, order_id, type, qty, stock_after)
      select rec.ingredient_id, v_order_id, 'usage', -rec.use_qty, stock from ingredients where id = rec.ingredient_id;
    end loop;
  end loop;

  v_service := round(v_subtotal * coalesce(v_settings.service_percent,0) / 100);
  v_tax := round((v_subtotal - p_discount + v_service) * coalesce(v_settings.tax_percent,0) / 100);
  v_total := v_subtotal - p_discount + v_service + v_tax;

  if not v_is_online and p_payment = 'cash' and p_paid is not null then
    v_change := p_paid - v_total;
  end if;

  update orders set
    subtotal = v_subtotal, discount = p_discount, tax = v_tax, service = v_service,
    total = v_total, cost_total = v_cost, change_amount = v_change
  where id = v_order_id;

  return v_order_id;
end $$;

-- ---------- FUNGSI: tutup shift ----------
create or replace function close_shift(p_shift uuid, p_counted numeric)
returns numeric
language plpgsql
as $$
declare
  v_row shifts;
  v_expected numeric;
begin
  select * into v_row from shifts where id = p_shift and status = 'open';
  if v_row.id is null then
    raise exception 'Shift tidak ditemukan atau sudah ditutup';
  end if;

  select v_row.opening_float
    + coalesce(sum(o.total),0)
    + coalesce((select sum(amount) from cash_movements cm where cm.shift_id = p_shift and cm.type='in'),0)
    - coalesce((select sum(amount) from cash_movements cm where cm.shift_id = p_shift and cm.type='out'),0)
  into v_expected
  from orders o
  where o.shift_id = p_shift and o.status = 'paid' and o.payment_method = 'cash';

  update shifts set
    closed_at = now(), status = 'closed',
    expected_cash = v_expected, counted_cash = p_counted, cash_diff = p_counted - v_expected
  where id = p_shift;

  return v_expected;
end $$;

-- ---------- STORAGE: bucket foto menu ----------
insert into storage.buckets (id, name, public) values ('product-images','product-images', true)
on conflict (id) do nothing;

drop policy if exists "public bucket access" on storage.objects;
create policy "public bucket access" on storage.objects
for all using (bucket_id = 'product-images') with check (bucket_id = 'product-images');

-- ---------- SEED ----------
insert into settings (id) values (1) on conflict (id) do nothing;

insert into categories (name, sort_order) values
  ('Kopi', 1), ('Non-Kopi', 2), ('Makanan', 3)
on conflict do nothing;

insert into ingredients (name, unit, stock, min_stock, cost_per_unit) values
  ('Biji Kopi', 'gr', 5000, 500, 120),
  ('Susu UHT', 'ml', 20000, 2000, 18),
  ('Gula Cair', 'ml', 10000, 1000, 8),
  ('Es Batu', 'pcs', 300, 50, 100),
  ('Roti Bakar', 'pcs', 50, 10, 4000),
  ('Keju', 'gr', 3000, 300, 220)
on conflict do nothing;

insert into products (category_id, name, price) 
select c.id, v.name, v.price from (values
  ('Kopi','Es Kopi Susu', 18000::numeric),
  ('Kopi','Americano', 15000::numeric),
  ('Non-Kopi','Matcha Latte', 22000::numeric),
  ('Makanan','Roti Bakar Keju', 20000::numeric)
) as v(cat, name, price)
join categories c on c.name = v.cat
on conflict do nothing;

insert into recipe_items (product_id, ingredient_id, qty)
select p.id, i.id, v.qty from (values
  ('Es Kopi Susu','Biji Kopi', 15::numeric),
  ('Es Kopi Susu','Susu UHT', 150::numeric),
  ('Es Kopi Susu','Gula Cair', 20::numeric),
  ('Es Kopi Susu','Es Batu', 3::numeric),
  ('Americano','Biji Kopi', 15::numeric),
  ('Americano','Es Batu', 3::numeric),
  ('Matcha Latte','Susu UHT', 200::numeric),
  ('Matcha Latte','Gula Cair', 15::numeric),
  ('Roti Bakar Keju','Roti Bakar', 1::numeric),
  ('Roti Bakar Keju','Keju', 60::numeric)
) as v(pname, iname, qty)
join products p on p.name = v.pname
join ingredients i on i.name = v.iname
on conflict do nothing;
