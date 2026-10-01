import { useEffect, useState } from 'react'
import { Store, Receipt, PiggyBank, Moon, Download, Database, Printer, RotateCw, Bluetooth } from 'lucide-react'
import { useSettings, useUpdateSettings } from '../hooks/useSettings'
import { useProducts, useIngredients } from '../hooks/useMaster'
import { useOrdersAll } from '../hooks/useOrders'
import { Page, Card, Input, Field, Switch, Spinner, Button } from '../components/ui'
import { fmtDateTime } from '../lib/utils'
import { downloadCSV } from '../lib/csv'
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
  return (
    <Card className="max-w-3xl p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><Moon size={16} aria-hidden /> Tampilan</h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Mode gelap</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Nyaman digunakan di lingkungan redup</p>
        </div>
        <Switch checked={settings.dark_mode} onChange={(v) => save({ dark_mode: v }, v ? 'Mode gelap aktif' : 'Mode terang aktif')} label="Mode gelap" />
      </div>
    </Card>
  )
}

function DataCard() {
  const { data: orders = [] } = useOrdersAll()
  const { data: products = [] } = useProducts()
  const { data: ingredients = [] } = useIngredients()

  const exportOrders = () => {
    downloadCSV('transaksi.csv', [
      ['No', 'Tanggal', 'Channel', 'Metode', 'Subtotal', 'Diskon', 'Pajak', 'Service', 'Total', 'HPP', 'Status'],
      ...orders.map((o) => [o.order_no, fmtDateTime(o.created_at), o.channel, o.payment_method || 'online', o.subtotal, o.discount, o.tax, o.service, o.total, o.cost_total, o.status]),
    ])
    toast.success('Transaksi diekspor')
  }
  const exportProducts = () => {
    downloadCSV('produk.csv', [
      ['Nama', 'Harga', 'Aktif'],
      ...products.map((p) => [p.name, p.price, p.is_active ? 'ya' : 'tidak']),
    ])
    toast.success('Produk diekspor')
  }
  const exportIngredients = () => {
    downloadCSV('bahan-baku.csv', [
      ['Nama', 'Satuan resep', 'Stok', 'Min', 'Harga beli', 'Satuan beli', 'Isi', 'HPP/satuan'],
      ...ingredients.map((i) => [i.name, i.unit, i.stock, i.min_stock, i.purchase_price ?? '', i.purchase_unit ?? '', i.purchase_qty ?? '', i.cost_per_unit]),
    ])
    toast.success('Bahan baku diekspor')
  }

  return (
    <Card className="max-w-3xl p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><Database size={16} aria-hidden /> Data & Backup</h2>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={exportOrders}><Download size={16} aria-hidden /> Transaksi</Button>
        <Button variant="secondary" onClick={exportProducts}><Download size={16} aria-hidden /> Produk</Button>
        <Button variant="secondary" onClick={exportIngredients}><Download size={16} aria-hidden /> Bahan Baku</Button>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Data tersimpan aman di Supabase. Ekspor CSV berkala sebagai cadangan tambahan.</p>
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
