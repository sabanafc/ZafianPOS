import { useEffect, useState, useRef } from 'react'
import { Store, Receipt, PiggyBank, Moon, LayoutGrid, CalendarDays, Download, Upload, Database, Printer, RotateCw, Bluetooth, FileDown } from 'lucide-react'
import { useSettings, useUpdateSettings } from '../hooks/useSettings'
import { useProducts, useIngredients, useCategories, useAllRecipes, useImportProducts, useImportIngredients, useImportRecipes } from '../hooks/useMaster'
import { useOrdersAll } from '../hooks/useOrders'
import { Page, Card, Input, Field, Switch, Spinner, Button } from '../components/ui'
import { Modal } from '../components/Modal'
import { fmtDateTime, num } from '../lib/utils'
import { parseCSV } from '../lib/csv'
import { downloadXLSX, parseXLSX } from '../lib/xlsx'
import { toast } from '../lib/toast'
import { isConfigured } from '../lib/supabase'
import { TestPrint } from '../components/shift/TestPrint'
import { PrinterSheet } from '../components/shift/PrinterSheet'
import type { Settings } from '../types'

type Tab = 'bisnis' | 'struk' | 'shift' | 'tampilan' | 'data'

// tab struk butuh state dialog printer
let openPrinterDialog: (() => void) | null = null

const TABS: Array<{ id: Tab; label: string; icon: typeof Store }> = [
  { id: 'bisnis', label: 'Bisnis', icon: Store },
  { id: 'struk', label: 'Struk & Print', icon: Printer },
  { id: 'shift', label: 'Shift', icon: PiggyBank },
  { id: 'tampilan', label: 'Tampilan', icon: Moon },
  { id: 'data', label: 'Data', icon: Database },
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
      <div className="mb-4 flex gap-1.5 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label="Bagian pengaturan">
        {TABS.map((t) => (
          <button
            key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            <t.icon size={15} aria-hidden /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'bisnis' && <BusinessTab settings={settings} save={save} />}
      {tab === 'struk' && <ReceiptTab settings={settings} save={save} onOpenPrinter={() => setPrinterOpen(true)} />}
      {tab === 'shift' && <ShiftTab settings={settings} save={save} />}
      {tab === 'tampilan' && <DisplayTab settings={settings} save={save} />}
      {tab === 'data' && <DataCard />}

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

  return (
    <div className="grid max-w-3xl gap-4">
      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><Printer size={16} aria-hidden /> Printer</h2>
        <div className="space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Lebar kertas</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Lebar kertas struk">
              {[58, 80].map((w) => (
                <button
                  key={w} role="radio" aria-checked={paper === w}
                  onClick={() => { setPaper(w); save({ paper_width: w }, 'Lebar kertas disimpan') }}
                  className={`h-11 flex-1 rounded-xl border-2 text-sm font-bold ${paper === w ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}
                >
                  {w} mm
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Margin kertas (mm)" hint="Kalibrasi geser tepi">
              <Input inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value.replace(/[^0-9.]/g, ''))} onBlur={() => save({ print_margin_mm: Number(margin) || 0 }, 'Margin disimpan')} />
            </Field>
            <Field label="Skala font" hint="0.8–1.4 (perbesar teks struk)">
              <Input inputMode="decimal" value={fontScale} onChange={(e) => setFontScale(e.target.value.replace(/[^0-9.]/g, ''))} onBlur={() => save({ print_font_scale: Math.min(1.4, Math.max(0.8, Number(fontScale) || 1)) }, 'Skala font disimpan')} />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <div>
              <p className="text-sm font-semibold">Cetak otomatis setelah transaksi</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Struk langsung tercetak saat pembayaran selesai</p>
            </div>
            <Switch checked={settings.auto_print} onChange={(v) => save({ auto_print: v }, v ? 'Cetak otomatis aktif' : 'Cetak otomatis mati')} label="Cetak otomatis" />
          </div>
          <TestPrint settings={settings} />
          <Button variant="secondary" className="w-full" onClick={onOpenPrinter}>
            <Bluetooth size={16} aria-hidden /> Hubungkan / Kelola Printer Bluetooth
          </Button>
          <p className="text-xs text-slate-500 dark:text-slate-400">Printer thermal ESC/POS via Web Bluetooth (Chrome Android/desktop). Auto print mencetak langsung ke printer BT yang terhubung.</p>
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
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-sm font-semibold">Tampilkan promo di struk</p>
            <Switch checked={settings.show_promo_on_receipt} onChange={(v) => save({ show_promo_on_receipt: v }, v ? 'Promo tampil di struk' : 'Promo disembunyikan')} label="Tampilkan promo di struk" />
          </div>
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
  return (
    <div className="grid max-w-3xl gap-4">
      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><Moon size={16} aria-hidden /> Tampilan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Mode gelap</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Nyaman digunakan di lingkungan redup</p>
          </div>
          <Switch checked={settings.dark_mode} onChange={(v) => save({ dark_mode: v }, v ? 'Mode gelap aktif' : 'Mode terang aktif')} label="Mode gelap" />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><LayoutGrid size={16} aria-hidden /> Halaman Kasir</h2>
        <div className="space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Jumlah kolom grid menu</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Jumlah kolom grid menu">
              {([
                [0, 'Otomatis'],
                [3, '3 kolom'],
                [4, '4 kolom'],
                [5, '5 kolom'],
              ] as Array<[number, string]>).map(([v, label]) => (
                <button
                  key={v} role="radio" aria-checked={cols === v}
                  onClick={() => save({ menu_columns: v }, v === 0 ? 'Grid menu otomatis' : `Grid menu ${v} kolom`)}
                  className={`h-11 flex-1 rounded-xl border-2 text-sm font-bold ${cols === v ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">"Otomatis" menyesuaikan lebar layar (3–5 kolom).</p>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Periode menu terlaris</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Periode menu terlaris">
              {([
                [7, '7 hari'],
                [30, '30 hari'],
                [90, '90 hari'],
                [0, 'Semua'],
              ] as Array<[number, string]>).map(([v, label]) => (
                <button
                  key={v} role="radio" aria-checked={days === v}
                  onClick={() => save({ bestseller_days: v }, v === 0 ? 'Terlaris dihitung dari semua waktu' : `Terlaris dihitung ${v} hari terakhir`)}
                  className={`h-11 flex-1 rounded-xl border-2 text-sm font-bold ${days === v ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}
                >
                  <CalendarDays size={14} className="mr-1 inline" aria-hidden />{label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Menu terlaris di halaman kasir dihitung dari penjualan pada periode ini.</p>
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
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Data tersimpan aman di Supabase. Ekspor CSV berkala sebagai cadangan tambahan.</p>

      <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Upload size={15} aria-hidden /> Import CSV</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => openImport('products')} disabled={pendingImport}><Upload size={16} aria-hidden /> Produk</Button>
          <Button variant="secondary" onClick={() => openImport('ingredients')} disabled={pendingImport}><Upload size={16} aria-hidden /> Bahan Baku</Button>
          <Button variant="secondary" onClick={() => openImport('recipes')} disabled={pendingImport}><Upload size={16} aria-hidden /> Resep</Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1"><FileDown size={13} aria-hidden /> Template:</span>
          <button className="font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400" onClick={tplProducts}>produk</button>
          <button className="font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400" onClick={tplIngredients}>bahan baku</button>
          <button className="font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400" onClick={tplRecipes}>resep</button>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
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
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {preview?.name} — {totalRows} baris data, {validCount} siap diimport.
          </p>
          {preview?.kind === 'recipes' && (
            <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
              Import resep mengganti seluruh bahan pada menu yang tercantum di CSV. Menu atau bahan yang tidak dikenal dilewati.
            </p>
          )}
          <div className="max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>{header.map((h, i) => <th key={i} className="whitespace-nowrap px-2.5 py-2 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview?.rows.slice(1, 8).map((r, idx) => (
                  <tr key={idx} className="border-t border-slate-100 dark:border-slate-800">
                    {r.map((c, i) => <td key={i} className="whitespace-nowrap px-2.5 py-1.5 tabular-nums">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalRows > 7 && <p className="text-xs text-slate-400">… {totalRows - 7} baris lainnya</p>}
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

function NotConfigured() {
  return (
    <Page title="Pengaturan">
      <Card className="p-6">
        <p className="flex items-center gap-2 font-semibold"><RotateCw size={16} aria-hidden /> Hubungkan database Supabase</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Isi <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">VITE_SUPABASE_URL</code> dan{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">VITE_SUPABASE_ANON_KEY</code> di file <code>.env</code>, lalu jalankan migration{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">supabase/migrations/0001_init.sql</code> dan <code>0002_upgrade.sql</code>.
        </p>
      </Card>
    </Page>
  )
}
