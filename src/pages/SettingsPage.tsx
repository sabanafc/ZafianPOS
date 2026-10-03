import { useEffect, useState, useRef } from 'react'
import { Store, Receipt, PiggyBank, Moon, LayoutGrid, CalendarDays, Download, Upload, Database, Printer, RotateCw, Bluetooth, FileDown, ShieldCheck, Palette, Check } from 'lucide-react'
import { UI_THEMES, DEFAULT_THEME_ID, CUSTOM_THEME_ID } from '../lib/themes'
import { useSettings, useUpdateSettings } from '../hooks/useSettings'
import { pinHash, generateTotpSecret, totpNow, otpauthUrl, verifyTotp } from '../lib/security'
import { useProducts, useIngredients, useCategories, useAllRecipes, useImportProducts, useImportIngredients, useImportRecipes } from '../hooks/useMaster'
import { useOrdersAll } from '../hooks/useOrders'
import { Page, Card, Input, Field, Switch, Spinner, Button, Badge, ConfirmDialog, Segmented } from '../components/ui'
import { Modal } from '../components/Modal'
import { fmtDateTime, num } from '../lib/utils'
import { parseCSV } from '../lib/csv'
import { downloadXLSX, parseXLSX } from '../lib/xlsx'
import { toast } from '../lib/toast'
import { isConfigured } from '../lib/supabase'
import { TestPrint } from '../components/shift/TestPrint'
import { PrinterSheet } from '../components/shift/PrinterSheet'
import type { Settings } from '../types'

type Tab = 'bisnis' | 'struk' | 'shift' | 'tampilan' | 'data' | 'keamanan'

// tab struk butuh state dialog printer
let openPrinterDialog: (() => void) | null = null

const TABS: Array<{ id: Tab; label: string; icon: typeof Store }> = [
  { id: 'bisnis', label: 'Bisnis', icon: Store },
  { id: 'struk', label: 'Struk & Print', icon: Printer },
  { id: 'shift', label: 'Shift', icon: PiggyBank },
  { id: 'tampilan', label: 'Tampilan', icon: Moon },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'keamanan', label: 'Keamanan', icon: ShieldCheck },
]

export default function SettingsPage() {
  const { settings, loading } = useSettings()
  const update = useUpdateSettings()
  const [tab, setTab] = useState<Tab>('bisnis')
  const [printerOpen, setPrinterOpen] = useState(false)
  openPrinterDialog = () => setPrinterOpen(true)

  if (!isConfigured) return <NotConfigured />
  if (loading || !settings) return <div className="flex justify-center py-20"><Spinner /></div>

  const save = (patch: Parameters<typeof update.mutate>[0], msg: string) =>
    update.mutate(patch, { onSuccess: () => toast.success(msg), onError: (e: Error) => toast.error(e.message) })

  return (
    <Page title="Pengaturan">
      {/* Sub-menu tab */}
      <Segmented
        className="mb-4"
        value={tab} onChange={setTab} label="Bagian pengaturan" scroll
        options={TABS.map((t) => ({ value: t.id, label: t.label, icon: <t.icon size={15} aria-hidden /> }))}
      />

      {tab === 'bisnis' && <BusinessTab settings={settings} save={save} />}
      {tab === 'struk' && <ReceiptTab settings={settings} save={save} onOpenPrinter={() => setPrinterOpen(true)} />}
      {tab === 'shift' && <ShiftTab settings={settings} save={save} />}
      {tab === 'tampilan' && <DisplayTab settings={settings} save={save} />}
      {tab === 'data' && <DataCard />}
      {tab === 'keamanan' && <SecurityTab settings={settings} save={save} />}

      {printerOpen && settings && (
        <PrinterSheet open={printerOpen} onClose={() => setPrinterOpen(false)} settings={settings} />
      )}
    </Page>
  )
}type Saver = (patch: Partial<Settings>, msg: string) => void


function BusinessTab({ settings, save }: { settings: Settings; save: Saver }) {
  const [name, setName] = useState(settings.business_name || '')
  const [address, setAddress] = useState(settings.address || '')
  const [phone, setPhone] = useState(settings.phone || '')
  const [tax, setTax] = useState(String(settings.tax_percent))
  const [service, setService] = useState(String(settings.service_percent))

  return (
    <div className="grid max-w-3xl gap-4">
      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><Store size={16} aria-hidden /> Profil Bisnis</h2>
        <div className="space-y-3">
          <Field label="Nama bisnis"><Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== settings.business_name && save({ business_name: name }, 'Nama disimpan')} /></Field>
          <Field label="Alamat" hint="Tampil di struk"><Input value={address} onChange={(e) => setAddress(e.target.value)} onBlur={() => save({ address }, 'Alamat disimpan')} /></Field>
          <Field label="Telepon" hint="Tampil di struk"><Input value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => save({ phone }, 'Telepon disimpan')} /></Field>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-bold">Pajak & Service Charge</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pajak (%)" hint="0 = tanpa pajak">
            <Input inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value.replace(/[^0-9.]/g, ''))} onBlur={() => save({ tax_percent: Number(tax) || 0 }, 'Pajak disimpan')} />
          </Field>
          <Field label="Service (%)" hint="0 = tanpa service">
            <Input inputMode="decimal" value={service} onChange={(e) => setService(e.target.value.replace(/[^0-9.]/g, ''))} onBlur={() => save({ service_percent: Number(service) || 0 }, 'Service disimpan')} />
          </Field>
        </div>
      </Card>
    </div>
  )
}

function ReceiptTab({ settings, save, onOpenPrinter }: { settings: Settings; save: Saver; onOpenPrinter: () => void }) {
  const [footer, setFooter] = useState(settings.receipt_footer || '')
  const [promo, setPromo] = useState(settings.promo_text || '')
  const [margin, setMargin] = useState(String(settings.print_margin_mm ?? 3))
  const [fontScale, setFontScale] = useState(String(settings.print_font_scale ?? 1))
  const [paper, setPaper] = useState(settings.paper_width || 80)
  // QR struk (maks 2): state lokal agar tidak kehilangan ketikan saat save
  const [qrs, setQrs] = useState<Array<{ label: string; url: string }>>(() => {
    const arr = (settings.receipt_qrs || []).slice(0, 2).map((q) => ({ label: q.label || '', url: q.url || '' }))
    while (arr.length < 2) arr.push({ label: '', url: '' })
    return arr
  })
  const saveQrs = (next: Array<{ label: string; url: string }>) => {
    setQrs(next)
    save({ receipt_qrs: next.map((q) => ({ label: q.label.trim(), url: q.url.trim() })).filter((q) => q.url) }, 'QR struk disimpan')
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><Printer size={16} aria-hidden /> Printer</h2>
        <div className="space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Lebar kertas</span>
            <Segmented
              kind="radio" full value={paper} label="Lebar kertas struk"
              onChange={(w) => { setPaper(w); save({ paper_width: w }, 'Lebar kertas disimpan') }}
              options={[58, 80].map((w) => ({ value: w, label: `${w} mm` }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Margin kertas (mm)" hint="Kalibrasi geser tepi">
              <Input inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value.replace(/[^0-9.]/g, ''))} onBlur={() => save({ print_margin_mm: Number(margin) || 0 }, 'Margin disimpan')} />
            </Field>
            <Field label="Skala font" hint="0.8–1.4 (perbesar teks struk)">
              <Input inputMode="decimal" value={fontScale} onChange={(e) => setFontScale(e.target.value.replace(/[^0-9.]/g, ''))} onBlur={() => save({ print_font_scale: Math.min(1.4, Math.max(0.8, Number(fontScale) || 1)) }, 'Skala font disimpan')} />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
            <div>
              <p className="text-sm font-semibold">Cetak otomatis setelah transaksi</p>
              <p className="text-xs text-muted">Struk langsung tercetak saat pembayaran selesai</p>
            </div>
            <Switch checked={settings.auto_print} onChange={(v) => save({ auto_print: v }, v ? 'Cetak otomatis aktif' : 'Cetak otomatis mati')} label="Cetak otomatis" />
          </div>
          <TestPrint settings={settings} />
          <Button variant="secondary" className="w-full" onClick={onOpenPrinter}>
            <Bluetooth size={16} aria-hidden /> Hubungkan / Kelola Printer Bluetooth
          </Button>
          <p className="text-xs text-muted">Printer thermal ESC/POS via Web Bluetooth (Chrome Android/desktop). Auto print mencetak langsung ke printer BT yang terhubung.</p>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><Receipt size={16} aria-hidden /> Isi Struk</h2>
        <div className="space-y-3">
          <Field label="Teks footer">
            <Input value={footer} onChange={(e) => setFooter(e.target.value)} onBlur={() => save({ receipt_footer: footer }, 'Footer disimpan')} />
          </Field>
          <Field label="Teks promo / pengumuman" hint="Tampil di struk bila diaktifkan">
            <Input value={promo} onChange={(e) => setPromo(e.target.value)} onBlur={() => save({ promo_text: promo }, 'Promo disimpan')} placeholder="mis. Follow IG @kopi.kami untuk promo!" />
          </Field>
          <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
            <p className="text-sm font-semibold">Tampilkan promo di struk</p>
            <Switch checked={settings.show_promo_on_receipt} onChange={(v) => save({ show_promo_on_receipt: v }, v ? 'Promo tampil di struk' : 'Promo disembunyikan')} label="Tampilkan promo di struk" />
          </div>

          {/* QR di struk (maks 2): link feedback, sosmed, dll */}
          <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
            <div className="min-w-0 pr-3">
              <p className="text-sm font-semibold">Tampilkan QR di struk</p>
              <p className="text-xs text-muted">Maks. 2 QR — link feedback, sosmed, menu online</p>
            </div>
            <Switch checked={!!settings.show_qr_on_receipt} onChange={(v) => save({ show_qr_on_receipt: v }, v ? 'QR tampil di struk' : 'QR disembunyikan')} label="Tampilkan QR di struk" />
          </div>
          {settings.show_qr_on_receipt && (
            <div className="space-y-3 rounded-xl border border-line p-3 dark:border-line">
              {qrs.map((q, i) => (
                <div key={i} className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-100 text-[11px] font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" aria-hidden>{i + 1}</span>
                    <span className="text-xs font-semibold text-muted">QR {i + 1}</span>
                  </div>
                  <Input
                    value={q.label} onChange={(e) => setQrs(qrs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    onBlur={() => saveQrs(qrs)} placeholder="Label, mis. Feedback / Instagram"
                    aria-label={`Label QR ${i + 1}`}
                  />
                  <Input
                    value={q.url} onChange={(e) => setQrs(qrs.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                    onBlur={() => saveQrs(qrs)} placeholder="https://... — dibiarkan kosong = tidak dipakai"
                    aria-label={`URL QR ${i + 1}`}
                  />
                </div>
              ))}
              <p className="text-xs text-muted">QR tercetak di bawah teks footer struk via printer Bluetooth.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function ShiftTab({ settings, save }: { settings: Settings; save: Saver }) {
  const [float, setFloat] = useState(String(settings.default_float))
  return (
    <Card className="max-w-3xl p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><PiggyBank size={16} aria-hidden /> Shift</h2>
      <Field label="Modal awal default (float, Rp)" hint="Terisi otomatis saat buka shift">
        <Input inputMode="numeric" value={float} onChange={(e) => setFloat(e.target.value.replace(/\D/g, ''))} onBlur={() => save({ default_float: Number(float) || 0 }, 'Float default disimpan')} />
      </Field>
    </Card>
  )
}

function DisplayTab({ settings, save }: { settings: Settings; save: Saver }) {
  const cols = settings.menu_columns ?? 0
  const days = settings.bestseller_days ?? 30
  const activeTheme = settings.ui_theme || DEFAULT_THEME_ID
  const accent = settings.ui_accent || '#4f46e5'
  const [accentDraft, setAccentDraft] = useState(accent)
  useEffect(() => { setAccentDraft(accent) }, [accent])
  return (
    <div className="grid max-w-3xl gap-4">
      {/* Gaya tampilan — preset tema UI */}
      <Card className="p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold"><Palette size={16} aria-hidden /> Gaya tampilan</h2>
        <p className="mb-4 text-xs text-muted">Pilih warna &amp; bentuk antarmuka. Langsung tersimpan dan berlaku untuk semua perangkat.</p>
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Gaya tampilan">
          {UI_THEMES.map((t) => {
            const active = activeTheme === t.id
            const sw = t.swatch
            return (
              <button
                key={t.id} type="button" role="radio" aria-checked={active}
                onClick={() => save({ ui_theme: t.id }, `Tema ${t.name} diterapkan`)}
                className={`rounded-card border-2 p-3 text-left transition-colors ${active ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'border-line hover:border-brand-300'}`}
              >
                <div className="mb-2 flex items-center gap-1.5" aria-hidden>
                  <span className="h-7 w-7 rounded-md" style={{ background: sw.brand }} />
                  <span className="h-7 w-7 rounded-md border border-black/10" style={{ background: sw.surface }} />
                  <span className="h-7 w-7 rounded-md border border-black/10" style={{ background: sw.canvas }} />
                  <span className="ml-auto text-sm font-black" style={{ color: sw.brand }}>Aa</span>
                </div>
                <p className="flex items-center gap-1.5 text-sm font-bold">{t.name}{active && <Check size={14} className="text-brand-600" aria-hidden />}</p>
                <p className="mt-0.5 text-xs text-muted">{t.desc}</p>
              </button>
            )
          })}
        </div>

        {/* Tema kustom dari satu warna aksen */}
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Warna aksen kustom</p>
              <p className="mt-0.5 text-xs text-muted">Palet 50–900 diturunkan otomatis dari satu warna, dengan kontras teks yang dijaga (AA).</p>
            </div>
            {activeTheme === CUSTOM_THEME_ID && <Badge tone="brand">Aktif</Badge>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="color" value={accentDraft} onChange={(e) => setAccentDraft(e.target.value)}
              aria-label="Pilih warna aksen" className="h-11 w-16 cursor-pointer rounded-btn border border-line bg-surface p-1"
            />
            <Input value={accentDraft} onChange={(e) => setAccentDraft(e.target.value)} aria-label="Kode warna aksen" className="w-32 font-mono" />
            <Button
              size="sm"
              onClick={() => {
                const v = accentDraft.trim()
                if (!/^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v)) { toast.error('Kode warna tidak valid — contoh: #1d4ed8'); return }
                save({ ui_theme: CUSTOM_THEME_ID, ui_accent: v }, 'Tema kustom diterapkan')
              }}
            >
              Terapkan
            </Button>
            <div className="flex flex-wrap gap-1.5">
              {['#4f46e5', '#0d9488', '#e11d48', '#c2410c', '#0284c7', '#7c3aed'].map((c) => (
                <button
                  key={c} type="button" aria-label={`Aksen ${c}`} title={c}
                  onClick={() => { setAccentDraft(c); save({ ui_theme: CUSTOM_THEME_ID, ui_accent: c }, 'Tema kustom diterapkan') }}
                  className="h-8 w-8 rounded-full border border-line shadow-card" style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><Moon size={16} aria-hidden /> Tampilan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Mode gelap</p>
            <p className="text-xs text-muted">Nyaman digunakan di lingkungan redup</p>
          </div>
          <Switch checked={settings.dark_mode} onChange={(v) => save({ dark_mode: v }, v ? 'Mode gelap aktif' : 'Mode terang aktif')} label="Mode gelap" />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><LayoutGrid size={16} aria-hidden /> Halaman Kasir</h2>
        <div className="space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Jumlah kolom grid menu</span>
            <Segmented
              kind="radio" full value={cols} label="Jumlah kolom grid menu"
              onChange={(v) => save({ menu_columns: v }, v === 0 ? 'Grid menu otomatis' : `Grid menu ${v} kolom`)}
              options={([[0, 'Otomatis'], [3, '3 kolom'], [4, '4 kolom'], [5, '5 kolom']] as Array<[number, string]>).map(([v, label]) => ({ value: v, label }))}
            />
            <p className="mt-1.5 text-xs text-muted">"Otomatis" menyesuaikan lebar layar (3–5 kolom).</p>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Periode menu terlaris</span>
            <Segmented
              kind="radio" full value={days} label="Periode menu terlaris"
              onChange={(v) => save({ bestseller_days: v }, v === 0 ? 'Terlaris dihitung dari semua waktu' : `Terlaris dihitung ${v} hari terakhir`)}
              options={([[7, '7 hari'], [30, '30 hari'], [90, '90 hari'], [0, 'Semua']] as Array<[number, string]>).map(([v, label]) => ({ value: v, label, icon: <CalendarDays size={14} aria-hidden /> }))}
            />
            <p className="mt-1.5 text-xs text-muted">Menu terlaris di halaman kasir dihitung dari penjualan pada periode ini.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function DataCard() {
  const { data: orders = [] } = useOrdersAll()
  const { data: products = [] } = useProducts()
  const { data: ingredients = [] } = useIngredients()
  const { data: categories = [] } = useCategories()
  const { data: recipes = [] } = useAllRecipes()
  const importProducts = useImportProducts()
  const importIngredients = useImportIngredients()
  const importRecipes = useImportRecipes()
  const fileRef = useRef<HTMLInputElement>(null)
  const kindRef = useRef<'products' | 'ingredients' | 'recipes'>('products')
  const [preview, setPreview] = useState<{ kind: 'products' | 'ingredients' | 'recipes'; name: string; rows: string[][] } | null>(null)

  const exportOrders = () => {
    downloadXLSX('transaksi.xlsx', [
      ['No', 'Tanggal', 'Channel', 'Metode', 'Subtotal', 'Diskon', 'Pajak', 'Service', 'Total', 'HPP', 'Status'],
      ...orders.map((o) => [o.order_no, fmtDateTime(o.created_at), o.channel, o.payment_method || 'online', o.subtotal, o.discount, o.tax, o.service, o.total, o.cost_total, o.status]),
    ])
    toast.success('Transaksi diekspor')
  }
  const exportProducts = () => {
    downloadXLSX('produk.xlsx', [
      ['Nama', 'Harga', 'Kategori', 'Aktif'],
      ...products.map((p) => [p.name, p.price, categories.find((c) => c.id === p.category_id)?.name ?? '', p.is_active ? 'ya' : 'tidak']),
    ])
    toast.success('Produk diekspor')
  }
  const exportIngredients = () => {
    downloadXLSX('bahan-baku.xlsx', [
      ['Nama', 'Satuan resep', 'Stok', 'Min', 'Harga beli', 'Satuan beli', 'Isi', 'HPP/satuan'],
      ...ingredients.map((i) => [i.name, i.unit, i.stock, i.min_stock, i.purchase_price ?? '', i.purchase_unit ?? '', i.purchase_qty ?? '', i.cost_per_unit]),
    ])
    toast.success('Bahan baku diekspor')
  }
  const exportRecipes = () => {
    downloadXLSX('resep.xlsx', [
      ['Menu', 'Bahan', 'Jumlah'],
      ...recipes
        .map((r) => [products.find((p) => p.id === r.product_id)?.name ?? '', r.ingredient?.name ?? '', r.qty])
        .filter((r) => r[0] && r[1]),
    ])
    toast.success('Resep diekspor')
  }

  // ---------- Import CSV ----------
  const openImport = (kind: 'products' | 'ingredients' | 'recipes') => {
    kindRef.current = kind
    fileRef.current?.click()
  }
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const isXlsx = /\.xlsx$/i.test(f.name)
      const parsed = isXlsx ? parseXLSX(await f.arrayBuffer()) : parseCSV(await f.text())
      if (parsed.length < 2) { toast.error('File kosong atau tidak berisi data'); return }
      setPreview({ kind: kindRef.current, name: f.name, rows: parsed })
    } catch {
      toast.error('Gagal membaca file — gunakan format .xlsx atau .csv')
    }
  }

  const mapProductRow = (r: string[]) => ({
    name: (r[0] || '').trim(),
    price: num(r[1] || ''),
    category: (r[2] || '').trim() || null,
    is_active: !/^(tidak|no|false|0)$/i.test((r[3] || '').trim()),
  })
  const mapIngredientRow = (r: string[]) => ({
    name: (r[0] || '').trim(),
    unit: (r[1] || '').trim() || 'pcs',
    stock: num(r[2] || ''),
    min_stock: num(r[3] || ''),
    purchase_price: num(r[4] || ''),
    purchase_unit: (r[5] || '').trim(),
    purchase_qty: num(r[6] || '') || 1,
    cost_per_unit: num(r[7] || ''),
  })
  const mapRecipeRow = (r: string[]) => ({
    product: (r[0] || '').trim(),
    ingredient: (r[1] || '').trim(),
    qty: num(r[2] || ''),
  })

  const prodRows = preview?.kind === 'products' ? preview.rows.slice(1).map(mapProductRow) : []
  const ingRows = preview?.kind === 'ingredients' ? preview.rows.slice(1).map(mapIngredientRow) : []
  const recRows = preview?.kind === 'recipes' ? preview.rows.slice(1).map(mapRecipeRow) : []
  const validProd = prodRows.filter((r) => r.name && r.price > 0)
  const validIng = ingRows.filter((r) => r.name && r.unit)
  const validRec = recRows.filter((r) => r.product && r.ingredient && r.qty > 0)
  const totalRows = prodRows.length + ingRows.length + recRows.length
  const validCount = validProd.length + validIng.length + validRec.length
  const header = preview?.rows[0] || []
  const skippedReason = preview?.kind === 'products'
    ? 'nama kosong atau harga nol'
    : preview?.kind === 'recipes'
      ? 'nama menu/bahan kosong atau jumlah nol'
      : 'nama kosong'

  const doImport = () => {
    if (!preview) return
    const done = (res: { inserted: number; updated: number }) => {
      toast.success(`Import selesai: ${res.inserted} baru, ${res.updated} diperbarui`)
      setPreview(null)
    }
    const fail = (e: Error) => toast.error(`Import gagal: ${e.message}`)
    if (preview.kind === 'products') importProducts.mutate(validProd, { onSuccess: done, onError: fail })
    else if (preview.kind === 'ingredients') importIngredients.mutate(validIng, { onSuccess: done, onError: fail })
    else
      importRecipes.mutate(validRec, {
        onSuccess: (res) => {
          toast.success(`Resep diimport: ${res.updated} menu, ${res.inserted} baris bahan`)
          if (res.missing.length) {
            toast.info(`Dilewati (tidak dikenal): ${res.missing.slice(0, 3).join(', ')}${res.missing.length > 3 ? ` +${res.missing.length - 3} lainnya` : ''}`)
          }
          setPreview(null)
        },
        onError: fail,
      })
  }

  const tplProducts = () =>
    downloadXLSX('template-produk.xlsx', [['Nama', 'Harga', 'Kategori', 'Aktif'], ['Es Kopi Susu', '18000', 'Minuman', 'ya']])
  const tplIngredients = () =>
    downloadXLSX('template-bahan.xlsx', [['Nama', 'Satuan resep', 'Stok', 'Min', 'Harga beli', 'Satuan beli', 'Isi', 'HPP/satuan'], ['Susu UHT', 'ml', '5000', '500', '25000', 'pack', '1000', '']])
  const tplRecipes = () =>
    downloadXLSX('template-resep.xlsx', [
      ['Menu', 'Bahan', 'Jumlah'],
      ['Es Kopi Susu', 'Susu UHT', '150'],
      ['Es Kopi Susu', 'Gula Cair', '20'],
      ['Es Kopi Susu', 'Es Batu', '100'],
    ])
  const pendingImport = importProducts.isPending || importIngredients.isPending || importRecipes.isPending

  return (
    <Card className="max-w-3xl p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><Database size={16} aria-hidden /> Data & Backup</h2>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={exportOrders}><Download size={16} aria-hidden /> Transaksi</Button>
        <Button variant="secondary" onClick={exportProducts}><Download size={16} aria-hidden /> Produk</Button>
        <Button variant="secondary" onClick={exportIngredients}><Download size={16} aria-hidden /> Bahan Baku</Button>
        <Button variant="secondary" onClick={exportRecipes}><Download size={16} aria-hidden /> Resep</Button>
      </div>
      <p className="mt-3 text-xs text-muted">Data tersimpan aman di Supabase. Ekspor CSV berkala sebagai cadangan tambahan.</p>

      <div className="mt-4 border-t border-line pt-4 dark:border-line">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Upload size={15} aria-hidden /> Import CSV</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => openImport('products')} disabled={pendingImport}><Upload size={16} aria-hidden /> Produk</Button>
          <Button variant="secondary" onClick={() => openImport('ingredients')} disabled={pendingImport}><Upload size={16} aria-hidden /> Bahan Baku</Button>
          <Button variant="secondary" onClick={() => openImport('recipes')} disabled={pendingImport}><Upload size={16} aria-hidden /> Resep</Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1"><FileDown size={13} aria-hidden /> Template:</span>
          <button className="font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400" onClick={tplProducts}>produk</button>
          <button className="font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400" onClick={tplIngredients}>bahan baku</button>
          <button className="font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400" onClick={tplRecipes}>resep</button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Bisa file Excel (.xlsx) atau CSV — delimiter koma atau titik-koma. Nama yang sama akan memperbarui data yang sudah ada (aman diulang). Import resep mengganti seluruh bahan pada menu yang ada di file (satuan jumlah mengikuti satuan resep bahan).
        </p>
      </div>

      <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={onFile} aria-hidden />

      {/* Pratinjau sebelum import */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.kind === 'products' ? 'Import Produk' : preview?.kind === 'recipes' ? 'Import Resep' : 'Import Bahan Baku'}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setPreview(null)}>Batal</Button>
            <Button className="flex-[2]" onClick={doImport} disabled={!validCount || pendingImport}>
              Import {validCount} baris
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {preview?.name} — {totalRows} baris data, {validCount} siap diimport.
          </p>
          {preview?.kind === 'recipes' && (
            <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
              Import resep mengganti seluruh bahan pada menu yang tercantum di CSV. Menu atau bahan yang tidak dikenal dilewati.
            </p>
          )}
          <div className="max-h-64 overflow-auto rounded-xl border border-line dark:border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted">
                <tr>{header.map((h, i) => <th key={i} className="whitespace-nowrap px-2.5 py-2 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview?.rows.slice(1, 8).map((r, idx) => (
                  <tr key={idx} className="border-t border-line">
                    {r.map((c, i) => <td key={i} className="whitespace-nowrap px-2.5 py-1.5 tabular-nums">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalRows > 7 && <p className="text-xs text-muted">… {totalRows - 7} baris lainnya</p>}
          {totalRows - validCount > 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" role="alert">
              {totalRows - validCount} baris dilewati ({skippedReason}).
            </p>
          )}
        </div>
      </Modal>
    </Card>
  )
}

/** Tab keamanan: PIN & Google Authenticator untuk halaman Keuangan */
function SecurityTab({ settings, save }: { settings: Settings; save: Saver }) {
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [busy, setBusy] = useState(false)
  // setup TOTP
  const [setupSecret, setSetupSecret] = useState<string | null>(null)
  const [setupCode, setSetupCode] = useState('')
  const [liveCode, setLiveCode] = useState('')
  const [confirmSec, setConfirmSec] = useState<null | 'pin' | 'totp'>(null)

  const savePin = async () => {
    if (pin1.length < 4) { toast.error('PIN minimal 4 angka'); return }
    if (pin1 !== pin2) { toast.error('PIN tidak sama'); return }
    setBusy(true)
    const h = await pinHash(pin1)
    // pilih salah satu: aktifkan PIN mematikan TOTP
    save({ finance_pin: h, totp_secret: null }, 'PIN keuangan disimpan — Google Authenticator dimatikan')
    setBusy(false)
    setPin1(''); setPin2('')
  }

  const beginTotp = () => {
    const s = generateTotpSecret()
    setSetupSecret(s)
    setSetupCode('')
  }
  // tampilkan kode live untuk konfirmasi pemindaian
  useEffect(() => {
    if (!setupSecret) return
    let stop = false
    const tick = async () => {
      const c = await totpNow(setupSecret)
      if (!stop) setLiveCode(c)
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => { stop = true; clearInterval(iv) }
  }, [setupSecret])

  const confirmTotp = async () => {
    if (!setupSecret) return
    setBusy(true)
    const ok = await verifyTotp(setupSecret, setupCode)
    setBusy(false)
    if (!ok) { toast.error('Kode belum cocok — coba lagi'); return }
    // pilih salah satu: aktifkan TOTP mematikan PIN
    save({ finance_pin: null, totp_secret: setupSecret }, 'Google Authenticator aktif — PIN dimatikan')
    setSetupSecret(null)
  }

  const hasPin = !!settings.finance_pin
  const hasTotp = !!settings.totp_secret

  return (
    <div className="grid max-w-3xl gap-4">
      <Card className="p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} aria-hidden /> Akses Halaman Keuangan</h2>
        <p className="mb-4 text-xs text-muted">Halaman Keuangan akan meminta PIN atau kode Google Authenticator setiap kali aplikasi dibuka. Pilih salah satu metode — mengaktifkan yang baru otomatis mematikan yang lama.</p>

        <div className="space-y-4">
          <div className="rounded-xl border border-line p-4 dark:border-line">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">PIN Keuangan</p>
                <p className="text-xs text-muted">{hasPin ? 'Aktif — PIN diminta saat membuka keuangan' : 'Belum diatur'}</p>
              </div>
              {hasPin && <Badge tone="green">Aktif</Badge>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Input inputMode="numeric" value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="PIN baru" aria-label="PIN baru" />
              <Input inputMode="numeric" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Ulangi PIN" aria-label="Ulangi PIN" />
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={busy || !pin1} onClick={savePin}>{hasPin ? 'Ganti PIN' : 'Aktifkan PIN'}</Button>
              {hasPin && (
                <Button size="sm" variant="ghost" className="text-red-500"
                  onClick={() => setConfirmSec('pin')}>
                  Matikan
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-line p-4 dark:border-line">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Google Authenticator (TOTP)</p>
                <p className="text-xs text-muted">{hasTotp ? 'Aktif — kode 6 digit diminta setelah PIN' : 'Belum diatur'}</p>
              </div>
              {hasTotp && <Badge tone="green">Aktif</Badge>}
            </div>

            {!setupSecret && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={beginTotp}>{hasTotp ? 'Ganti Perangkat' : 'Aktifkan'}</Button>
                {hasTotp && (
                  <Button size="sm" variant="ghost" className="text-red-500"
                    onClick={() => setConfirmSec('totp')}>
                    Matikan
                  </Button>
                )}
              </div>
            )}

            {setupSecret && (
              <div className="mt-3 space-y-2.5">
                <p className="text-xs text-muted">1. Di Google Authenticator pilih <strong>+ → Masukkan kode penyiapan</strong>, lalu isi:</p>
                <code className="block break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm tracking-wider" aria-label="Secret TOTP">{setupSecret}</code>
                <p className="text-xs text-muted">atau buka tautan: <a className="break-all font-semibold text-brand-600 underline dark:text-brand-400" href={otpauthUrl(setupSecret, 'Kasir POS', 'Zafian POS')} target="_blank" rel="noreferrer">{otpauthUrl(setupSecret, 'Kasir POS', 'Zafian POS')}</a></p>
                <p className="text-xs text-muted">2. Ketik kode 6 digit yang tampil di aplikasi (saat ini: <strong className="font-mono tabular-nums">{liveCode}</strong>):</p>
                <div className="flex gap-2">
                  <Input inputMode="numeric" value={setupCode} onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" aria-label="Kode autentikator" className="max-w-[9rem] font-mono tracking-widest" />
                  <Button size="sm" disabled={setupCode.length !== 6 || busy} onClick={confirmTotp}>Verifikasi & Aktifkan</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSetupSecret(null)}>Batal</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmSec !== null} onClose={() => setConfirmSec(null)}
        title={confirmSec === 'totp' ? 'Matikan Google Authenticator?' : 'Matikan PIN?'}
        message={confirmSec === 'totp'
          ? 'Kode autentikator tidak lagi diminta saat membuka halaman keuangan.'
          : 'Halaman keuangan akan terbuka tanpa PIN (kecuali Google Authenticator aktif).'}
        confirmLabel="Matikan"
        onConfirm={() => {
          if (confirmSec === 'totp') save({ finance_pin: settings.finance_pin ?? null, totp_secret: null }, 'Google Authenticator dimatikan')
          else save({ finance_pin: null, totp_secret: settings.totp_secret ?? null }, 'PIN dimatikan')
        }}
      />
    </div>
  )
}

function NotConfigured() {
  return (
    <Page title="Pengaturan">
      <Card className="p-6">
        <p className="flex items-center gap-2 font-semibold"><RotateCw size={16} aria-hidden /> Hubungkan database Supabase</p>
        <p className="mt-1 text-sm text-muted">
          Isi <code className="rounded bg-surface-2 px-1.5 py-0.5">VITE_SUPABASE_URL</code> dan{' '}
          <code className="rounded bg-surface-2 px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code> di file <code>.env</code>, lalu jalankan migration{' '}
          <code className="rounded bg-surface-2 px-1.5 py-0.5">supabase/migrations/0001_init.sql</code> dan <code>0002_upgrade.sql</code>.
        </p>
      </Card>
    </Page>
  )
}
