-- =============================================================
-- 0006 — Keamanan akses halaman Keuangan (PIN / Google Authenticator)
-- Jalankan di SQL Editor Supabase setelah 0001-0005.
-- =============================================================

-- PIN disimpan sebagai hash SHA-256 (hex), null = tidak terkunci
alter table settings add column if not exists finance_pin text;
-- Secret base32 untuk Google Authenticator (TOTP), null = nonaktif
alter table settings add column if not exists totp_secret text;
