-- =============================================================
-- Kasir POS — Migration 0002
-- Jalankan di SQL Editor Supabase (aman untuk data yang sudah ada)
-- =============================================================

-- ---------- BAHAN BAKU: satuan beli vs satuan resep ----------
alter table ingredients add column if not exists purchase_unit text;
alter table ingredients add column if not exists purchase_qty numeric(12,3) default 1;
alter table ingredients add column if not exists purchase_price numeric(14,2) default 0;
alter table ingredients add column if not exists is_active boolean not null default true;

-- Migrasi data lama: purchase_unit mengikuti unit lama, harga per satuan beli = cost_per_unit
update ingredients set purchase_unit = coalesce(purchase_unit, unit) where purchase_unit is null;
update ingredients set purchase_price = coalesce(purchase_price, cost_per_unit) where purchase_price is null or purchase_price = 0;

-- ---------- PENGATURAN: print & struk ----------
alter table settings add column if not exists auto_print boolean not null default false;
alter table settings add column if not exists print_margin_mm numeric(5,2) not null default 3;
alter table settings add column if not exists print_font_scale numeric(3,2) not null default 1.0;
alter table settings add column if not exists promo_text text default '';
alter table settings add column if not exists show_promo_on_receipt boolean not null default true;

-- ---------- FUNGSI order: kunci stok per baris agar bebas race ----------
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

  -- Validasi & KUNCI stok (for update) untuk mencegah race antar kasir
  for v_item in select * from jsonb_array_elements(p_items) loop
    for row_ok in
      select ri.qty as need, i.stock, i.name, i.id as ing_id
      from recipe_items ri join ingredients i on i.id = ri.ingredient_id
      where ri.product_id = (v_item->>'productId')::uuid
      for update of i
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
