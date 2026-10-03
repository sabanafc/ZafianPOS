-- =============================================================
-- Kasir POS — Migration 0011
-- Warna aksen kustom untuk tema UI (ui_theme = 'custom')
-- Jalankan di SQL Editor Supabase (aman untuk data yang sudah ada)
-- =============================================================

-- Format #rrggbb. Palet 50–900 diturunkan di sisi klien (src/lib/accent.ts)
-- dengan jaminan kontras WCAG AA.
alter table settings add column if not exists ui_accent text;
