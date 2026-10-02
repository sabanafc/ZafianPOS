-- =============================================================
-- 0007 — QR code di struk (maks 2): link feedback, sosmed, dll
-- Jalankan di SQL Editor Supabase setelah 0001-0006.
-- =============================================================

-- Saklar tampilkan QR di struk
alter table settings add column if not exists show_qr_on_receipt boolean not null default false;
-- Daftar QR (jsonb array of {label, url}), maks 2 dipakai aplikasi
alter table settings add column if not exists receipt_qrs jsonb not null default '[]'::jsonb;
