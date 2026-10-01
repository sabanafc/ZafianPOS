# Kasir POS — Setup

## 1. Buat proyek Supabase
1. Daftar/masuk di [supabase.com](https://supabase.com) → **New project**.
2. Setelah proyek aktif, buka **Project Settings → API**. Salin **Project URL** dan **anon public key**.

## 2. Jalankan skema database
Buka **SQL Editor** di dashboard Supabase, tempel seluruh isi file `supabase/migrations/0001_init.sql`, lalu **Run**.
Script ini membuat:
- Semua tabel: kategori, produk, bahan baku, BOM/resep, transaksi, shift, kas, keuangan, pengaturan
- Fungsi transaksional: membuat order + **pengurangan stok otomatis via BOM**, buka/tutup shift dengan validasi
- RLS permisif (app single-user tanpa login)
- Bucket Storage `product-images` (foto menu)
- Data contoh (kategori, produk, bahan baku, resep, pengaturan)

## 3. Konfigurasi env
```bash
cp .env.example .env
```
Isi `.env`:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

## 4. Jalankan
```bash
npm install
npm run dev
```
Aplikasi terbuka di `http://localhost:5173`. Buka di tablet/ponsel melalui IP lokal (mis. `http://192.168.1.x:5173`) atau deploy.

## 5. Install sebagai aplikasi (Android)
Buka situs di Chrome → menu ⋮ → **Tambahkan ke layar utama**. Aplikasi berjalan fullscreen seperti native.

## Deploy
- **Vercel/Netlify**: build command `npm run build`, output `dist`, set env `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
- Untuk akses dari beberapa perangkat, gunakan domain deploy yang sama di semua tablet.

## Catatan
- **Foto menu**: diupload ke Supabase Storage bucket `product-images` (dibuat otomatis oleh migration).
- **Struk**: dicetak via dialog print browser (58/80mm sesuai Pengaturan).
- **Backup**: Pengaturan → Data → ekspor CSV.
