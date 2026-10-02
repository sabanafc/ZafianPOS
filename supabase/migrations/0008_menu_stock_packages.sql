-- =============================================================
-- Kasir POS — Migration 0008
-- Stok menu manual + paket menu (HPP terkoneksi antar menu)
-- Jalankan di SQL Editor Supabase (aman untuk data yang sudah ada)
-- =============================================================

-- ---------- STOK MENU (manual, terpisah dari stok bahan) ----------
alter table products add column if not exists stock numeric(12,3) not null default 0;
alter table products add column if not exists min_stock numeric(12,3) not null default 0;
-- track_stock default false: menu lama tidak otomatis diblokir saat stok 0
alter table products add column if not exists track_stock boolean not null default false;

-- ---------- PAKET MENU ----------
-- Paket = produk yang isinya gabungan beberapa menu lain
alter table products add column if not exists is_package boolean not null default false;

create table if not exists package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references products(id) on delete cascade,
  component_id uuid not null references products(id) on delete cascade,
  qty numeric(12,3) not null default 1,
  unique(package_id, component_id)
);

-- Bahan efektif paket: hasil gabungan resep komponen, boleh disesuaikan manual.
-- Satu bahan boleh muncul beberapa baris (source berbeda) bila ingin dihitung
-- terpisah; HPP paket = jumlah seluruh baris qty x cost_per_unit.
create table if not exists package_ingredients (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references products(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  qty numeric(12,3) not null default 0,
  source text,
  note text
);

create index if not exists idx_package_items_pkg on package_items(package_id);
create index if not exists idx_package_ingredients_pkg on package_ingredients(package_id);

alter table package_items enable row level security;
alter table package_ingredients enable row level security;
drop policy if exists "public_all" on package_items;
create policy "public_all" on package_items for all using (true) with check (true);
drop policy if exists "public_all" on package_ingredients;
create policy "public_all" on package_ingredients for all using (true) with check (true);

-- ---------- FUNGSI order: stok menu manual + paket ----------
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
  v_qty numeric;
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

  -- Validasi & KUNCI stok bahan (resep biasa atau bahan efektif paket)
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from products where id = (v_item->>'productId')::uuid;
    if v_prod.id is null then continue; end if;
    v_qty := (v_item->>'qty')::numeric;

    -- kunci baris bahan agar bebas race antar kasir
    perform 1 from ingredients i
    where i.id in (
      select ri.ingredient_id from recipe_items ri
        where ri.product_id = v_prod.id and not v_prod.is_package
      union
      select pi.ingredient_id from package_ingredients pi
        where pi.package_id = v_prod.id and v_prod.is_package
    )
    for update;

    for row_ok in
      select src.ingredient_id, src.need, i.name, i.stock
      from (
        select ri.ingredient_id, sum(ri.qty) as need
        from recipe_items ri
        where ri.product_id = v_prod.id and not v_prod.is_package
        group by ri.ingredient_id
        union all
        select pi.ingredient_id, sum(pi.qty) as need
        from package_ingredients pi
        where pi.package_id = v_prod.id and v_prod.is_package
        group by pi.ingredient_id
      ) src
      join ingredients i on i.id = src.ingredient_id
    loop
      if row_ok.stock < row_ok.need * v_qty then
        raise exception 'Stok tidak cukup untuk %', row_ok.name using errcode = 'P0001';
      end if;
    end loop;

    -- validasi & kunci stok menu (bila dilacak)
    if v_prod.track_stock then
      select * into v_prod from products where id = v_prod.id for update;
      if v_prod.stock < v_qty then
        raise exception 'Stok menu % tidak cukup', v_prod.name using errcode = 'P0001';
      end if;
    end if;
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
    v_qty := (v_item->>'qty')::numeric;

    -- HPP: resep biasa atau bahan efektif paket
    select coalesce(sum(src.qty * i.cost_per_unit), 0) into v_cog
    from (
      select ri.ingredient_id, ri.qty from recipe_items ri
        where ri.product_id = v_prod.id and not v_prod.is_package
      union all
      select pi.ingredient_id, pi.qty from package_ingredients pi
        where pi.package_id = v_prod.id and v_prod.is_package
    ) src
    join ingredients i on i.id = src.ingredient_id;

    insert into order_items (order_id, product_id, name, price, qty, cost_of_goods, line_total)
    values (v_order_id, v_prod.id, v_prod.name, v_prod.price, v_qty, v_cog, v_prod.price * v_qty);

    v_subtotal := v_subtotal + v_prod.price * v_qty;
    v_cost := v_cost + v_cog * v_qty;

    -- deduksi stok bahan (gabung baris bahan yang sama)
    for rec in
      select src.ingredient_id, sum(src.qty) * v_qty as use_qty
      from (
        select ri.ingredient_id, ri.qty from recipe_items ri
          where ri.product_id = v_prod.id and not v_prod.is_package
        union all
        select pi.ingredient_id, pi.qty from package_ingredients pi
          where pi.package_id = v_prod.id and v_prod.is_package
      ) src
      group by src.ingredient_id
    loop
      update ingredients set stock = stock - rec.use_qty where id = rec.ingredient_id;
      insert into stock_movements (ingredient_id, order_id, type, qty, stock_after)
      select rec.ingredient_id, v_order_id, 'usage', -rec.use_qty, stock from ingredients where id = rec.ingredient_id;
    end loop;

    -- deduksi stok menu (bila dilacak)
    if v_prod.track_stock then
      update products set stock = stock - v_qty where id = v_prod.id;
    end if;
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
