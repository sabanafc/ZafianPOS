# Audit UI/UX — Kasir POS (Zafian POS)

Tanggal: 3 Oktober 2026 · Cakupan: seluruh halaman & komponen (`src/**`)

## Ringkasan

Fondasi UI sudah kuat: satu set komponen bersama (`components/ui.tsx`), token
warna terpusat di `tailwind.config.js`, mode gelap kelas `dark`, safe-area iOS,
animasi yang menghormati `prefers-reduced-motion`, dan focus ring WCAG. Layout
menangani tiga bentuk dengan baik (sidebar ikon di tablet, bottom nav di ponsel,
panel keranjang tersembunyi di bawah `lg` digantikan bottom sheet).

Skor kasar per area:

| Area | Nilai | Catatan |
|---|---|---|
| Konsistensi visual | Baik | 3 pola "segmented control" berbeda; sisa dialog `confirm()` bawaan |
| Aksesibilitas | Cukup | Ring & label bagus; modal belum trap Tab; beberapa teks di bawah AA |
| Responsif | Baik | 1 label nav terpotong; sidebar ikon tanpa label di sentuh |
| Kesiapan tema | Kurang | Warna brand di-*hardcode* di beberapa tempat |
| UX alur | Baik | Alur shift/kasir jelas; 1 bug HTML (button bersarang) |

---

## Temuan

### Bug & risiko (prioritas tinggi)

- **H1 — `<button>` bersarang di riwayat transaksi.** ✅ *Diperbaiki 3 Okt 2026.* [PosPage.tsx](../src/pages/PosPage.tsx)
  membungkus baris riwayat dengan `<button>` lalu menaruh `IconButton` (yang juga
  `<button>`) di dalamnya. HTML tidak valid; perilaku klik & pembaca layar bisa
  kacau. Ubah baris menjadi `<div role="button">`/`<li>` dengan tombol terpisah.
- **H2 — Modal belum mengunci fokus.** ✅ *Diperbaiki 3 Okt 2026* (focus trap
  dua arah + kunci scroll latar). [Modal.tsx](../src/components/Modal.tsx)

### Konsistensi

- **C1 — Dialog `confirm()` bawaan di 5 tempat** sementara sudah ada
  `ConfirmDialog` yang bertema: [FinancePage.tsx:423](../src/pages/FinancePage.tsx#L423),
  [FinancePage.tsx:548](../src/pages/FinancePage.tsx#L548),
  [PosPage.tsx:239](../src/pages/PosPage.tsx#L239),
  [SettingsPage.tsx:586](../src/pages/SettingsPage.tsx#L586),
  [SettingsPage.tsx:607](../src/pages/SettingsPage.tsx#L607). Dialog bawaan
  blocking, tidak mengikuti tema, dan terlihat seperti alert browser di ponsel.
- **C2 — Tiga pola segmented control**: tab Menu (`rounded-xl bg-slate-100`),
  tab Pengaturan (`bg-slate-900` aktif), dan radiogroup lebar (`border-2` +
  `bg-brand-50`). Satukan jadi satu komponen `Segmented`.
- **C3 — Pola tombol aksi kartu** memakai `IconButton` di Menu/Bahan, tapi
  tombol teks di Finance/Menu lain. Ini masih wajar, cukup didokumentasikan.

### Kesiapan tema (prasyarat fitur tema) — ✅ *Selesai 3 Okt 2026*

Fitur pemilih tema sudah ada di Pengaturan → Tampilan (6 preset: Indigo Modern,
Claude, Stripe, Neubrutalism, Claymorphism, Soft UI Evolution). Kolom
`settings.ui_theme` ditambahkan lewat [0010_ui_theme.sql](../supabase/migrations/0010_ui_theme.sql). Temuan T1–T3 di bawah sudah ditangani.

- **T1 — Warna brand di-*hardcode*** di `tailwind.config.js` (`brand-50..900` =
  indigo). Belum bisa diubah saat runtime.
- **T2 — Aksen tersebar di luar Tailwind**: focus ring `#4f46e5`
  ([index.css](../src/index.css)), splash + `theme-color #0f172a`
  ([index.html](../index.html)), `bg-slate-900` TickerBar, warna `dine_in`
  `#4f46e5` di [constants.tsx](../src/lib/constants.tsx), fallback grafik
  `#6366f1` di [DashboardPage.tsx](../src/pages/DashboardPage.tsx). Semua perlu
  mengikuti variabel tema.
- **T3 — Inter dideklarasikan tapi tidak dimuat.** `fontFamily.sans` memuat
  `Inter`, tetapi `index.html` tidak memuat font-nya → aplikasi sebenarnya
  memakai `system-ui`. Pilih: muat Inter (preload) atau ubah ke `system-ui`.

### Aksesibilitas

- **A1 — `user-scalable=no`** di `viewport` mematikan zoom (masalah penglihatan
  rendah). Trade-off sengaja untuk kasir; minimal sediakan penyesuaian ukuran
  teks di Pengaturan.
- **A2 — Kontras label kecil.** Label kolom `text-[11px] uppercase text-slate-400`
  (mis. header tabel resep/paket) ≈ 2,9:1 pada putih — di bawah AA. Naikkan ke
  `text-slate-500` (≈ 4,6:1).
- **A3 — `user-select:none` global** memblokir salin nomor struk/telepon.
  Kecualikan area teks struk & kode order.
- **A4 — `focus-visible` memaksa `border-radius: 8px`** pada semua elemen,
  termasuk `Switch` (rounded-full) — sudut ring terlihat aneh. Batasi radius
  hanya pada elemen persegi.

### Responsif

- **R1 — Label bottom nav terpotong** ("Pengaturar"). Ganti ke nama pendek
  eksplisit (mis. "Setelan") daripada memotong `label.split(' ')[0]`.
- **R2 — Sidebar ikon 80px tanpa label** di tablet sentuh: atribut `title`
  tidak muncul saat disentuh. Pertimbangkan label singkat atau perluas saat
  fokus/hover.
- **R3 — Ticker bar selalu tampil 32px** di atas bottom nav; saat di halaman POS
  mengurangi tinggi efektif. Pertimbangkan sembunyikan di POS atau saat keranjang
  terisi.

---

## Rekomendasi tema

Prinsip: **preset terkurasi, bukan pemilih warna bebas.** Dasbor kasir dipakai
cepat di bawah cahaya terang/bervariasi; warna aksen yang dipilih acak mudah
jatuh di bawah kontras AA dan merusak makna status (hijau = uang masuk, merah =
habis/void). Sediakan 4–5 preset yang sudah diuji kontras, plus opsi "kustom"
yang menurunkan 50–900 dari satu hue dasar secara otomatis.

### Preset yang disarankan

1. **Indigo Modern** (bawaan saat ini) — netral, profesional, kontras aman.
   Cocok sebagai default untuk semua jenis usaha.
2. **Emerald Segar** — hijau (`#059669`). Kesan higienis/segar, cocok F&B;
   bahasa warna "hijau = terjual" jadi konsisten dengan badge laba.
   Risiko: mudah tertukar dengan badge sukses — pakai emerald yang lebih tua
   untuk aksen (`600+`) dan simpan `green` terang khusus status.
3. **Tangerine Hangat** — oranye/amber (`#ea580c`). Menggugah selera, khas
   brand kuliner; paling terbaca di area sangat terang (outdoor/food court).
   Risiko: bertabrakan dengan badge "stok kritis" (amber) — pisahkan dengan
   menggeser peringatan ke merah.
4. **Slate Kontras (Padat)** — monokrom slate + satu aksen tunggal, sudut lebih
   tegas, density padat. Untuk tablet kasir sibuk: lebih banyak item per layar,
   distraksi warna minimal. Ini *style* paling berbeda, bukan sekadar warna.
5. **Midnight (Gelap) ** — varian gelap pekat (latar `#020617`) untuk shift
   malam / minim cahaya. Bisa dikombinasikan dengan aksen mana pun.

### Sumbu tema

Rekomendasi: satu pengaturan `ui_theme` yang **membundel** beberapa sumbu,
supaya hasilnya selalu koheren:

| Sumbu | Nilai |
|---|---|
| Aksen | indigo / emerald / tangerine / slate (+ kustom) |
| Bentuk sudut | lembut (20px, kini) / tegas (10px) |
| Kepadatan | nyaman (kini) / padat |
| Bayangan | lembut (kini) / rata (flat) |
| Font | Inter / sistem |

### Mekanisme implementasi (ringkas)

1. Ubah palet di `tailwind.config.js` menjadi variabel CSS:
   `brand: { 600: 'rgb(var(--brand-600) / <alpha-value>)', ... }`.
2. Definisikan preset di `src/lib/themes.ts` sebagai triplet RGB
   (`--brand-50..900`, `--ring`, `--radius`, `--shadow`), terapkan lewat
   atribut `data-theme` pada `<html>` di `useThemeEffect`.
3. Pindahkan aksen hardcode (T2) ke variabel: focus ring, splash/`theme-color`,
   warna `dine_in`, fallback grafik, TickerBar.
4. Tambah kolom `settings.ui_theme` (text) + kontrol pemilih preset di tab
   **Tampilan** dengan pratinjau mini.

Semua preset wajib lolos cek kontras AA sebelum dipakai.

---

## Urutan perbaikan yang disarankan

1. H1 (button bersarang) & H2 (focus trap) — perbaikan nyata, kecil.
2. C1 (ganti `confirm`) — seragamkan ke `ConfirmDialog`.
3. T1–T3 (token tema + font) — prasyarat fitur tema.
4. A2 (kontras label), R1 (label nav) — cepat.
5. Fitur pemilih tema + preset.
