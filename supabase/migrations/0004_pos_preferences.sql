-- Pengaturan tampilan kasir & periode produk terlaris
alter table settings
  add column if not exists menu_columns int not null default 0,      -- 0 = otomatis, 3/4/5 = tetap
  add column if not exists bestseller_days int not null default 30;  -- 7/30/90, 0 = semua waktu
