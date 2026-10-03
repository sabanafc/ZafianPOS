-- =============================================================
-- Kasir POS — Migration 0010
-- Preset tema UI (warna & gaya antarmuka) di Pengaturan
-- Jalankan di SQL Editor Supabase (aman untuk data yang sudah ada)
-- =============================================================

-- id preset: indigo-modern | claude | stripe | neubrutalism | claymorphism | soft-ui
-- (lihat src/lib/themes.ts)
alter table settings add column if not exists ui_theme text not null default 'indigo-modern';
