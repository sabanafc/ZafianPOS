import { useMemo, useState } from 'react'
import { Plus, Trash2, Download, TrendingUp, TrendingDown, Wallet, Pencil, HandCoins } from 'lucide-react'
import { useOrders, useFinanceEntries, useSaveFinanceEntry, useDeleteFinanceEntry, useActiveShift, useShiftSummary } from '../hooks/useOrders'
import { Page, Card, Button, IconButton, Input, Select, Field, Badge, EmptyState, Spinner } from '../components/ui'
import { Modal } from '../components/Modal'
import { fmtID, fmtDate, todayISO, daysAgoISO, dayStartISO, dayEndISO } from '../lib/utils'
import { FINANCE_CATEGORIES, FINANCE_LABELS, PAYMENTS, CHANNELS } from '../lib/constants'
import { downloadCSV } from '../lib/csv'
import { isOnlineChannel, type FinanceEntry } from '../types'
import { toast } from '../lib/toast'

type Period = 'today' | 'yesterday' | 7 | 30

export default function FinancePage() {
  const [period, setPeriod] = useState<Period>(30)
  const today = todayISO()

  // Rentang periode — pilihan sama dengan dashboard
  const { from, to, label } = useMemo(() => {
    if (period === 'today') return { from: today, to: today, label: 'Hari ini' }
    if (period === 'yesterday') { const y = daysAgoISO(1); return { from: y, to: y, label: 'Kemarin' } }
    const n = period as number
    return { from: daysAgoISO(n - 1), to: today, label: `${n} hari` }
  }, [period, today])

  const { data: orders = [], isLoading } = useOrders({ from: dayStartISO(from), to: dayEndISO(to) })
  const { data: entries = [] } = useFinanceEntries({ from, to })
  const { data: shift } = useActiveShift()
  const { data: shiftSum } = useShiftSummary(shift?.id)
  const saveEntry = useSaveFinanceEntry()
  const delEntry = useDeleteFinanceEntry()
  const [entryModal, setEntryModal] = useState<Partial<FinanceEntry> | null>(null)

  // Kas di drawer shift aktif: penjualan tunai + modal awal + cash in − cash out
  const drawerCash = shift
    ? (shiftSum?.cashSales || 0) + (shiftSum?.cashIn || 0) - (shiftSum?.cashOut || 0) + (shift.opening_float || 0)
    : null
  const ownerWithdraw = drawerCash !== null ? Math.max(0, drawerCash - (shift!.opening_float || 0)) : null

  const paid = useMemo(() => orders.filter((o) => o.status === 'paid'), [orders])
  const revenue = paid.reduce((s, o) => s + o.total, 0)
  const cogs = paid.reduce((s, o) => s + o.cost_total, 0)
  const cashRevenue = paid.filter((o) => o.payment_method === 'cash').reduce((s, o) => s + o.total, 0)
  const qrisRevenue = paid.filter((o) => o.payment_method === 'qris').reduce((s, o) => s + o.total, 0)
  const transferRevenue = paid.filter((o) => o.payment_method === 'transfer').reduce((s, o) => s + o.total, 0)
  const onlineRevenue = paid.filter((o) => isOnlineChannel(o.channel)).reduce((s, o) => s + o.total, 0)
  const expenses = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const otherIncome = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const netProfit = revenue - cogs - expenses + otherIncome

  const exportCSV = () => {
    const rows: Array<Array<string | number>> = [
      ['Laporan Keuangan', `${from} s/d ${to}`],
      [],
      ['Ringkasan'],
      ['Omzet penjualan', revenue],
      ['HPP bahan', cogs],
      ['Pemasukan lain', otherIncome],
      ['Pengeluaran', expenses],
      ['Laba bersih', netProfit],
      [],
      ['Per metode bayar'],
      ['Tunai', cashRevenue],
      ['QRIS', qrisRevenue],
      ['Transfer', transferRevenue],
      ['Pesanan online', onlineRevenue],
      [],
      ['Tanggal', 'Jenis', 'Kategori', 'Nominal', 'Catatan'],
      ...entries.map((e) => [e.entry_date, e.type === 'income' ? 'Masuk' : 'Keluar', FINANCE_LABELS[e.category] || e.category, e.amount, e.note || '']),
    ]
    downloadCSV(`keuangan-${from}-${to}.csv`, rows)
    toast.success('CSV diunduh')
  }

  return (
    <Page
      title="Keuangan"
      actions={
        <div className="flex gap-2">
          <IconButton label="Ekspor CSV" variant="secondary" onClick={exportCSV}><Download size={18} aria-hidden /></IconButton>
          <Button onClick={() => setEntryModal({ type: 'expense', entry_date: todayISO(), category: 'lainnya' })}><Plus size={17} aria-hidden /> Catat</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Filter periode cepat (sama dengan dashboard) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="radiogroup" aria-label="Periode laporan keuangan">
            {([
              ['today', 'Hari ini'],
              ['yesterday', 'Kemarin'],
              [7, '7 hari'],
              [30, '30 hari'],
            ] as Array<[Period, string]>).map(([p, lbl]) => (
              <button
                key={String(p)} role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}
                className={`h-9 rounded-lg px-3 text-sm font-semibold ${period === p ? 'bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-white' : 'text-slate-500'}`}
              >
                {lbl}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400">Periode {label} · {fmtDate(from)} – {fmtDate(to)}</span>
        </div>

        {/* Kas drawer shift aktif — uang yang ditarik untuk owner */}
        {drawerCash !== null && (
          <Card className="flex flex-wrap items-center gap-4 border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" aria-hidden>
              <HandCoins size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Kas di drawer shift aktif: {fmtID(drawerCash)}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Uang yang ditarik & diserahkan ke owner = kas drawer − modal awal ({fmtID(shift!.opening_float)})
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Ditarik untuk owner</p>
              <p className="text-xl font-extrabold tabular-nums text-amber-800 dark:text-amber-200">{fmtID(ownerWithdraw!)}</p>
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <>
            {/* Laba rugi */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <SumCard icon={<Wallet size={17} aria-hidden />} label="Omzet" value={revenue} tone="brand" />
              <SumCard icon={<TrendingDown size={17} aria-hidden />} label="HPP bahan" value={cogs} tone="slate" />
              <SumCard icon={<TrendingDown size={17} aria-hidden />} label="Pengeluaran" value={expenses} tone="red" />
              <SumCard icon={<TrendingUp size={17} aria-hidden />} label="Masuk lain" value={otherIncome} tone="green" />
              <SumCard icon={<TrendingUp size={17} aria-hidden />} label="Laba bersih" value={netProfit} tone={netProfit >= 0 ? 'green' : 'red'} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Per metode */}
              <Card className="p-4">
                <h2 className="mb-3 text-sm font-bold">Omzet per metode bayar</h2>
                <ul className="space-y-2.5">
                  {PAYMENTS.map((p) => {
                    const val = p.id === 'cash' ? cashRevenue : p.id === 'qris' ? qrisRevenue : transferRevenue
                    const pct = revenue ? Math.round((val / revenue) * 100) : 0
                    return (
                      <li key={p.id}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 font-semibold"><p.icon size={15} style={{ color: p.color }} aria-hidden /> {p.label}</span>
                          <span className="tabular-nums">{fmtID(val)} <span className="text-xs text-slate-400">{pct}%</span></span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }} />
                        </div>
                      </li>
                    )
                  })}
                  <li className="flex items-center justify-between border-t border-dashed pt-2.5 text-sm">
                    <span className="font-semibold">Pesanan online (GoFood/Grab/Shopee)</span>
                    <span className="font-bold tabular-nums">{fmtID(onlineRevenue)}</span>
                  </li>
                </ul>
              </Card>

              {/* Entri keuangan */}
              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold">Catatan pemasukan & pengeluaran</h2>
                  <Badge tone="slate">{entries.length}</Badge>
                </div>
                {entries.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">Belum ada catatan pada periode ini.</p>
                ) : (
                  <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                    {entries.map((e) => (
                      <li key={e.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{FINANCE_LABELS[e.category] || e.category}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{fmtDate(e.entry_date)}{e.note ? ` · ${e.note}` : ''}</p>
                        </div>
                        <span className={`shrink-0 font-bold tabular-nums ${e.type === 'income' ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>
                          {e.type === 'income' ? '+' : '−'}{fmtID(e.amount)}
                        </span>
                        <IconButton label="Ubah catatan" size="sm" variant="ghost" onClick={() => setEntryModal(e)}><Pencil size={13} aria-hidden /></IconButton>
                        <IconButton
                          label="Hapus catatan" size="sm" variant="ghost" className="text-red-500"
                          onClick={() => { if (confirm('Hapus catatan ini?')) delEntry.mutate(e.id, { onSuccess: () => toast.success('Catatan dihapus') }) }}
                        >
                          <Trash2 size={13} aria-hidden />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </div>

      <EntryModal
        entry={entryModal} onClose={() => setEntryModal(null)}
        onSave={(e) => saveEntry.mutate(e as any, { onSuccess: () => { toast.success('Catatan disimpan'); setEntryModal(null) }, onError: (er: Error) => toast.error(er.message) })}
      />
    </Page>
  )
}

function SumCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'brand' | 'green' | 'red' | 'slate' }) {
  const tones = {
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }
  return (
    <Card className="p-4">
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`} aria-hidden>{icon}</div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums md:text-xl">{fmtID(value)}</p>
    </Card>
  )
}

function EntryModal({ entry, onClose, onSave }: { entry: Partial<FinanceEntry> | null; onClose: () => void; onSave: (e: Partial<FinanceEntry> & { type: 'income' | 'expense'; category: string; amount: number; entry_date: string }) => void }) {
  const [type, setType] = useState<'income' | 'expense'>(entry?.type || 'expense')
  const [category, setCategory] = useState(entry?.category || 'lainnya')
  const [amount, setAmount] = useState(entry?.amount ? String(entry.amount) : '')
  const [note, setNote] = useState(entry?.note || '')
  const [date, setDate] = useState(entry?.entry_date || todayISO())

  if (!entry) return null

  const cats = FINANCE_CATEGORIES[type]

  return (
    <Modal open onClose={onClose} title={entry.id ? 'Ubah Catatan' : 'Catat Keuangan'} size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
          <Button className="flex-[2]" onClick={() => onSave({ id: entry.id, type, category, amount: Number(amount) || 0, note: note || null, entry_date: date })} disabled={!amount}>
            Simpan
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800" role="radiogroup" aria-label="Jenis catatan">
          {(['expense', 'income'] as const).map((t) => (
            <button key={t} role="radio" aria-checked={type === t} onClick={() => { setType(t); setCategory(FINANCE_CATEGORIES[t][0]) }}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-bold ${type === t ? 'bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-white' : 'text-slate-500'}`}>
              {t === 'expense' ? <TrendingDown size={15} aria-hidden /> : <TrendingUp size={15} aria-hidden />}
              {t === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
            </button>
          ))}
        </div>
        <Field label="Kategori">
          <Select value={cats.includes(category as never) ? category : cats[0]} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => <option key={c} value={c}>{FINANCE_LABELS[c] || c}</option>)}
          </Select>
        </Field>
        <Field label="Nominal (Rp)" required>
          <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="0" className="h-14 text-2xl font-bold" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Catatan"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsional" /></Field>
        </div>
      </div>
    </Modal>
  )
}
