-- =============================================================
-- Kasir POS — Migration 0003
-- Opsi notifikasi stok menipis per bahan baku
-- Jalankan di SQL Editor Supabase (aman untuk data yang sudah ada)
-- =============================================================

alter table ingredients add column if not exists low_stock_alert boolean not null default true;

-- Data lama: notifikasi aktif agar perilaku terlihat segera
-- (kolom baru langsung default true, tidak perlu update)
