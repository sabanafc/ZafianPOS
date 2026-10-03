-- =============================================================
-- Kasir POS — Migration 0013
-- Target penjualan harian per menu/paket
-- Jalankan di SQL Editor Supabase (aman untuk data yang sudah ada)
-- =============================================================

-- Target porsi terjual per hari. Dipakai untuk menghitung kebutuhan bahan
-- dan rekomendasi pembelian tanpa menunggu data penjualan.
-- 0 = tidak ada target (pemakaian dihitung dari penjualan/asumsi bahan).
alter table products add column if not exists daily_target numeric(12,3) not null default 0;
