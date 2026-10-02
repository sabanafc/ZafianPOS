import { useMemo, useState } from 'react'
import { Plus, Trash2, Download, TrendingUp, TrendingDown, Pencil, HandCoins, Vault, ArrowDownToLine, ArrowUpFromLine, Banknote, Landmark, Send, Eye, EyeOff, Lock } from 'lucide-react'
import { useOrders, useFinanceEntries, useSaveFinanceEntry, useDeleteFinanceEntry, useActiveShift, useShiftSummary, useShiftSettlements, useWallet, useWalletMutations, useWalletWithdraw, useBankAccounts, useBankBalances, useBankTxns, useBankTxn, useSaveBankAccount, useDeleteBankAccount, useDepositToBank, useBalanceDeltas, buildBalanceSeries } from '../hooks/useOrders'
import { Page, Card, Button, IconButton, Input, Select, Field, Spinner } from '../components/ui'
import { useSettings } from '../hooks/useSettings'
import { PeriodPicker, type Period } from '../components/PeriodPicker'
import { Sparkline } from '../components/Sparkline'
import { Modal } from '../components/Modal'
import { fmtID, fmtIDShort, fmtDate, fmtDateTime, todayISO, daysAgoISO, dayStartISO, dayEndISO } from '../lib/utils'
import { FINANCE_CATEGORIES, FINANCE_LABELS } from '../lib/constants'
import { downloadCSV } from '../lib/csv'
import { isOnlineChannel, type FinanceEntry } from '../types'
import { toast } from '../lib/toast'
import { FINANCE_UNLOCK_KEY, hasFinanceGuard } from '../lib/security'

/** Jenis mutasi pada feed realtime: deposit/income/expense/transfer dari wallet, bank-in/out dari bank */
type FeedKind = 'deposit' | 'income' | 'expense' | 'transfer' | 'bank-in' | 'bank-out'

interface FeedItem {
  id: string
  kind: FeedKind
  account: 'wallet' | 'bank'
  accountName?: string
  title: string
  amount: number
  date: string
  entryId?: string // id finance_entries asli (bisa diedit/dihapus)
}

const FEED_STYLE: Record<FeedKind, { Icon: typeof HandCoins; bg: string; sign: '+' | '−' }> = {
  deposit: { Icon: HandCoins, bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', sign: '+' },
  income: { Icon: ArrowDownToLine, bg: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', sign: '+' },
  expense: { Icon: ArrowUpFromLine, bg: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300', sign: '−' },
  transfer: { Icon: Send, bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', sign: '−' },
  'bank-in': { Icon: ArrowDownToLine, bg: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', sign: '+' },
  'bank-out': { Icon: ArrowUpFromLine, bg: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300', sign: '−' },
}

export default function FinancePage() {
  const [period, setPeriod] = useState<Period>(30)
  const today = todayISO()
  // rentang tanggal khusus (custom)
  const [customFrom, setCustomFrom] = useState(() => daysAgoISO(6))
  const [customTo, setCustomTo] = useState(() => todayISO())
  const applyCustom = (a: string, b: string) => { setCustomFrom(a); setCustomTo(b); setPeriod('custom') }

  // Rentang periode — chip cepat + kalender custom (komponen bersama dengan dashboard)
  const { from, to, label } = useMemo(() => {
    if (period === 'today') return { from: today, to: today, label: 'Hari ini' }
    if (period === 'yesterday') { const y = daysAgoISO(1); return { from: y, to: y, label: 'Kemarin' } }
    if (period === 'custom') {
      const a = customFrom || today
      const b = customTo || today
      return { from: a <= b ? a : b, to: a <= b ? b : a, label: 'Custom' }
    }
    const n = period as number
    return { from: daysAgoISO(n - 1), to: today, label: `${n} hari` }
  }, [period, today, customFrom, customTo])

  const { data: orders = [] } = useOrders({ from: dayStartISO(from), to: dayEndISO(to) })
  const { data: entries = [] } = useFinanceEntries({ from, to })
  const { data: shift } = useActiveShift()
  // Kunci halaman hanya bermakna bila ada PIN/Autentikator — tanpa kredensial
  // FinanceGate selalu terbuka, jadi tombol Kunci menjelaskan keadaannya.
  const { settings, loading: settingsLoading } = useSettings()
  const hasGuard = hasFinanceGuard(settings)
  const [lockInfoOpen, setLockInfoOpen] = useState(false)
  const { data: shiftSum } = useShiftSummary(shift?.id)
  const { data: settlements = [] } = useShiftSettlements({ from: dayStartISO(from), to: dayEndISO(to) })
  const { data: wallet } = useWallet()
  const { data: bankData } = useBankBalances()
  const withdraw = useWalletWithdraw()
  const deposit = useDepositToBank()
  const [walletModal, setWalletModal] = useState<'withdraw' | 'deposit' | 'bank' | null>(null)
  // kartu Saldo: sembunyikan angka & lihat per simpanan (wallet/bank)
  const [hideSaldo, setHideSaldo] = useState(() => localStorage.getItem('hideSaldo') === '1')
  const [saldoView, setSaldoView] = useState<'all' | 'wallet' | 'bank'>('all')
  const toggleHideSaldo = () => {
    setHideSaldo((v) => { localStorage.setItem('hideSaldo', v ? '0' : '1'); return !v })
  }
  const saveEntry = useSaveFinanceEntry()
  const delEntry = useDeleteFinanceEntry()
  const [entryModal, setEntryModal] = useState<Partial<FinanceEntry> | null>(null)

  // Feed mutasi realtime: gabungan mutasi wallet + transaksi bank (polling 10 detik di masing-masing hook)
  const [feedFilter, setFeedFilter] = useState<'all' | 'wallet' | 'bank'>('all')
  const { data: walletMuts = [], isLoading: feedLoading } = useWalletMutations()
  const { data: bankTxns = [] } = useBankTxns()
  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = walletMuts.map((m) => ({
      id: m.id,
      kind: m.kind,
      account: m.account,
      accountName: m.accountName,
      title: m.label,
      amount: m.amount,
      date: m.date,
      entryId: m.id.startsWith('fin-') ? m.id.slice(4) : undefined,
    }))
    for (const t of bankTxns) {
      if (t.source === 'wallet') continue // sudah tampil sebagai transfer dari sisi wallet
      items.push({
        id: `btx-${t.id}`,
        kind: t.type === 'in' ? 'bank-in' : 'bank-out',
        account: 'bank',
        accountName: t.accountName,
        title: t.note || (t.type === 'in' ? 'Dana masuk' : 'Dana keluar'),
        amount: t.amount,
        date: t.created_at,
      })
    }
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    return items.slice(0, 80)
  }, [walletMuts, bankTxns])
  const feedShown = feedFilter === 'all' ? feedItems : feedItems.filter((f) => f.account === feedFilter)

  // Kas di drawer shift aktif: penjualan tunai + modal awal + cash in − cash out
  const drawerCash = shift
    ? (shiftSum?.cashSales || 0) + (shiftSum?.cashIn || 0) - (shiftSum?.cashOut || 0) + (shift.opening_float || 0)
    : null
  const ownerWithdraw = drawerCash !== null ? Math.max(0, drawerCash - (shift!.opening_float || 0)) : null
  const totalDeposits = settlements.reduce((s, x) => s + x.deposit, 0)
  const totalDiff = settlements.reduce((s, x) => s + ((x.shift.counted_cash || 0) - (x.shift.expected_cash || 0)), 0)

  // Saldo gabungan: wallet (setoran owner) + semua rekening bank
  const bankTotal = bankData ? bankData.accounts.filter((a) => a.is_active).reduce((s, a) => s + (bankData.balances.get(a.id) || 0), 0) : 0
  const saldoAll = (wallet?.balance || 0) + bankTotal
  const saldoShown = saldoView === 'all' ? saldoAll : saldoView === 'wallet' ? (wallet?.balance || 0) : bankTotal
  const saldoText = hideSaldo ? 'Rp ••••••' : fmtID(saldoShown)

  // Tren saldo 30 hari: deret mundur dari saldo sekarang + perubahan net per hari
  const { data: saldoDeltas } = useBalanceDeltas(30)
  const saldoSeries = useMemo(() => buildBalanceSeries(saldoDeltas || {}, saldoAll, 30), [saldoDeltas, saldoAll])
  const saldoDelta = saldoAll - (saldoSeries[0]?.balance ?? saldoAll)

  // Ringkasan untuk ekspor CSV
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
        <div className="flex items-center gap-2">
          <IconButton
            label={hasGuard ? 'Kunci akses keuangan' : 'Aktifkan kunci halaman keuangan'}
            variant="secondary"
            disabled={settingsLoading}
            title={hasGuard ? 'Kunci kembali halaman keuangan' : 'Belum ada PIN/Autentikator — aktifkan dulu'}
            onClick={() => {
              if (!hasGuard) { setLockInfoOpen(true); return }
              sessionStorage.removeItem(FINANCE_UNLOCK_KEY)
              toast.info('Halaman keuangan dikunci')
              location.hash = '#/pos'
            }}>
            <Lock size={18} aria-hidden />
          </IconButton>
          <IconButton label="Ekspor CSV" variant="secondary" onClick={exportCSV}><Download size={18} aria-hidden /></IconButton>
          <Button onClick={() => setEntryModal({ type: 'expense', entry_date: todayISO(), category: 'lainnya' })}><Plus size={17} aria-hidden /> Catat</Button>
          {/* kalender periode — paling pinggir kanan, posisi sama dengan dashboard */}
          <PeriodPicker
            period={period} onPeriod={setPeriod}
            customFrom={customFrom} customTo={customTo} onCustom={applyCustom}
          />
        </div>
      }
    >
      <div className="space-y-4">
        {/* Kartu Saldo — gabungan wallet + bank, bisa disembunyikan & dilihat per simpanan */}
        {wallet && (
          <Card className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-5 text-white shadow-pop">
            {/* header: label + sembunyikan di kiri, pilih simpanan di kanan */}
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-100/90">
                Saldo
                <button onClick={toggleHideSaldo} aria-label={hideSaldo ? 'Tampilkan saldo' : 'Sembunyikan saldo'} className="rounded-md p-0.5 text-brand-100/90 hover:bg-white/15">
                  {hideSaldo ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
                </button>
              </p>
              <div className="flex rounded-lg bg-white/15 p-0.5 text-[10px] font-bold" role="radiogroup" aria-label="Lihat saldo per simpanan">
                {([
                  ['all', 'Semua'],
                  ['wallet', 'Wallet'],
                  ['bank', 'Bank'],
                ] as Array<['all' | 'wallet' | 'bank', string]>).map(([v, lbl]) => (
                  <button key={v} role="radio" aria-checked={saldoView === v} onClick={() => setSaldoView(v)}
                    className={`rounded-md px-2 py-0.5 ${saldoView === v ? 'bg-white text-brand-800' : 'text-brand-100'}`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-3xl font-extrabold tabular-nums">{saldoText}</p>
            <p className="mt-1 text-xs text-brand-100/80">
              {saldoView === 'all' && <>Wallet {hideSaldo ? '•••' : fmtIDShort(wallet.balance)} · Bank {hideSaldo ? '•••' : fmtIDShort(bankTotal)}</>}
              {saldoView === 'wallet' && 'Dompet setoran owner (setoran shift + masuk lain − pengeluaran)'}
              {saldoView === 'bank' && `${bankData?.accounts.filter((a) => a.is_active).length || 0} rekening bank aktif`}
            </p>

            {/* sparkline tren saldo 30 hari */}
            <div className="mt-3 flex items-end gap-3">
              <Sparkline points={saldoSeries.map((p) => p.balance)} fillId="spark-saldo" className="h-9 min-w-0 flex-1" />
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-100/70">30 hari</p>
                <p className={`text-xs font-bold tabular-nums ${saldoDelta >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
                  {saldoDelta >= 0 ? '+' : '−'}{fmtID(Math.abs(saldoDelta))}
                </p>
              </div>
            </div>

            {/* statistik singkat — jarak konsisten dengan pemisah tipis */}
            <div className="mt-4 border-t border-white/15 pt-3">
              <div className="flex gap-10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-brand-100/80">Total disetor</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums">{hideSaldo ? '•••' : fmtID(wallet.deposits)}</p>
                  <p className="text-[10px] text-brand-100/70">{wallet.shiftCount} shift</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-brand-100/80">Beban ops.</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums">{hideSaldo ? '•••' : fmtID(wallet.expense)}</p>
                  <p className="text-[10px] text-brand-100/70">catatan keuangan</p>
                </div>
              </div>
            </div>

            {/* menu cepat — icon only agar rapi & konsisten */}
            <div className="mt-4 grid grid-cols-4 gap-2 sm:inline-grid">
              <button
                onClick={() => setEntryModal({ type: 'expense', entry_date: todayISO(), category: 'lainnya' })}
                title="Catat beban / pemasukan" aria-label="Beban operasional"
                className="flex h-11 w-full items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 sm:w-11"
              >
                <TrendingDown size={17} aria-hidden />
              </button>
              <button
                onClick={() => setWalletModal('deposit')}
                disabled={wallet.balance <= 0}
                title="Setor dana wallet ke rekening bank" aria-label="Setor ke bank"
                className="flex h-11 w-full items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 disabled:opacity-40 sm:w-11"
              >
                <Send size={17} aria-hidden />
              </button>
              <button
                onClick={() => setWalletModal('withdraw')}
                disabled={wallet.balance <= 0}
                title="Tarik dana wallet" aria-label="Tarik dana"
                className="flex h-11 w-full items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 disabled:opacity-40 sm:w-11"
              >
                <Banknote size={17} aria-hidden />
              </button>
              <button
                onClick={() => setWalletModal('bank')}
                title="Kelola rekening bank" aria-label="Kelola bank"
                className="flex h-11 w-full items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 sm:w-11"
              >
                <Landmark size={17} aria-hidden />
              </button>
            </div>
            <Vault size={72} className="pointer-events-none absolute -right-3 -top-3 opacity-10" aria-hidden />
          </Card>
        )}

        {/* Label periode aktif */}
        <p className="text-xs text-slate-400">
          {period === 'custom' ? `Periode ${fmtDate(from)} – ${fmtDate(to)}` : <>Periode {label} · {fmtDate(from)} – {fmtDate(to)}</>}
        </p>

        {/* Kas drawer shift aktif — uang yang ditarik untuk owner */}
        {drawerCash !== null && (
          <Card className="flex flex-col gap-3 border-amber-200 bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" aria-hidden>
                <HandCoins size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Kas di drawer shift aktif: {fmtID(drawerCash)}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Uang yang ditarik & diserahkan ke owner = kas drawer − modal awal ({fmtID(shift!.opening_float)})
                </p>
              </div>
            </div>
            <div className="hidden sm:block sm:min-w-0 sm:flex-1" aria-hidden />
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Ditarik untuk owner</p>
              <p className="text-xl font-extrabold tabular-nums text-amber-800 dark:text-amber-200">{fmtID(ownerWithdraw!)}</p>
            </div>
          </Card>
        )}

        {/* Riwayat setoran per shift + feed mutasi realtime */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Rekap setoran per shift (shift ditutup pada periode ini) */}
          <Card className="min-w-0 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-bold"><HandCoins size={15} className="text-amber-500" aria-hidden /> Setoran per shift</h2>
              {settlements.length > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total disetor <strong className="tabular-nums">{fmtID(totalDeposits)}</strong>
                  {totalDiff !== 0 && (
                    <span className={totalDiff > 0 ? ' text-green-700 dark:text-green-400' : ' text-red-600'}> · selisih {totalDiff > 0 ? '+' : ''}{fmtID(totalDiff)}</span>
                  )}
                </p>
              )}
            </div>
            {settlements.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">Belum ada shift yang ditutup pada periode ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="pb-1.5 font-semibold">Ditutup</th>
                      <th className="pb-1.5 text-right font-semibold">Omzet tunai</th>
                      <th className="pb-1.5 text-right font-semibold">Disetor</th>
                      <th className="pb-1.5 text-right font-semibold">Selisih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map(({ shift: s, cashSales, deposit }) => {
                      const diff = (s.counted_cash || 0) - (s.expected_cash || 0)
                      return (
                        <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="py-1.5">{fmtDateTime(s.closed_at!)}</td>
                          <td className="py-1.5 text-right tabular-nums">{fmtID(cashSales)}</td>
                          <td className="py-1.5 text-right font-semibold tabular-nums text-amber-700 dark:text-amber-300">{fmtID(deposit)}</td>
                          <td className={`py-1.5 text-right font-semibold tabular-nums ${diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>
                            {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${fmtID(diff)}`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Feed mutasi realtime — gabungan wallet & bank */}
          <Card className="flex min-w-0 flex-col p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                Mutasi terkini
                <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700 dark:bg-green-900/40 dark:text-green-300" title="Diperbarui otomatis setiap 10 detik">
                  <span className="relative flex h-1.5 w-1.5" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                  </span>
                  Live
                </span>
              </h2>
              <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800" role="radiogroup" aria-label="Filter mutasi">
                {([
                  ['all', 'Semua'],
                  ['wallet', 'Wallet'],
                  ['bank', 'Bank'],
                ] as Array<['all' | 'wallet' | 'bank', string]>).map(([v, lbl]) => (
                  <button key={v} role="radio" aria-checked={feedFilter === v} onClick={() => setFeedFilter(v)}
                    className={`h-7 rounded-md px-2.5 text-xs font-bold ${feedFilter === v ? 'bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-white' : 'text-slate-500'}`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {feedLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : feedShown.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">Belum ada mutasi.</p>
            ) : (
              <ul className="-mx-4 max-h-[520px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800" aria-label="Daftar mutasi terkini">
                {feedShown.map((item) => {
                  const { Icon, bg, sign } = FEED_STYLE[item.kind]
                  const accLabel = item.account === 'bank' ? item.accountName || 'Bank' : 'Wallet'
                  const entry = item.entryId ? entries.find((e) => e.id === item.entryId) : undefined
                  return (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${bg}`} aria-hidden><Icon size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{accLabel} · {item.date.includes('T') ? fmtDateTime(item.date) : fmtDate(item.date)}</p>
                      </div>
                      <span className={`shrink-0 text-sm font-bold tabular-nums ${sign === '+' ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>
                        {sign}{fmtID(item.amount)}
                      </span>
                      {entry && (
                        <span className="flex shrink-0 gap-0.5">
                          <IconButton label="Ubah catatan" size="sm" variant="ghost" onClick={() => setEntryModal(entry)}><Pencil size={13} aria-hidden /></IconButton>
                          <IconButton
                            label="Hapus catatan" size="sm" variant="ghost" className="text-red-500"
                            onClick={() => { if (confirm('Hapus catatan ini?')) delEntry.mutate(entry.id, { onSuccess: () => toast.success('Catatan dihapus') }) }}
                          >
                            <Trash2 size={13} aria-hidden />
                          </IconButton>
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <EntryModal
        entry={entryModal} onClose={() => setEntryModal(null)}
        onSave={(e) => saveEntry.mutate(e as any, { onSuccess: () => { toast.success('Catatan disimpan'); setEntryModal(null) }, onError: (er: Error) => toast.error(er.message) })}
      />

      {walletModal === 'withdraw' && wallet && (
        <WithdrawModal
          balance={wallet.balance}
          onClose={() => setWalletModal(null)}
          onWithdraw={(amount, note) => withdraw.mutate({ amount, note }, {
            onSuccess: () => { toast.success(`Dana ditarik ${fmtID(amount)}`); setWalletModal(null) },
            onError: (e: Error) => toast.error(e.message),
          })}
        />
      )}
      {walletModal === 'deposit' && wallet && <DepositModal balance={wallet.balance} onClose={() => setWalletModal(null)} onDeposit={(accountId, amount, note) => deposit.mutate({ accountId, amount, note }, { onSuccess: () => { toast.success(`Rp ${amount.toLocaleString('id-ID')} tersimpan ke bank`); setWalletModal(null) }, onError: (e: Error) => toast.error(e.message) })} />}
      {walletModal === 'bank' && <BankModal onClose={() => setWalletModal(null)} />}

      {/* Belum ada PIN/Autentikator: jelaskan kenapa tombol Kunci belum berefek */}
      <Modal
        open={lockInfoOpen}
        onClose={() => setLockInfoOpen(false)}
        title="Kunci belum aktif"
        size="sm"
        footer={<Button className="w-full" onClick={() => setLockInfoOpen(false)}>Mengerti</Button>}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Halaman keuangan belum dikunci karena belum ada PIN atau kode Google Authenticator.
          Atur salah satunya di <strong>Pengaturan → Keamanan</strong>, lalu tombol Kunci akan berfungsi.
        </p>
      </Modal>
    </Page>
  )
}

/** Modal setor dana wallet ke rekening bank */
function DepositModal({ balance, onClose, onDeposit }: { balance: number; onClose: () => void; onDeposit: (accountId: string, amount: number, note: string | null) => void }) {
  const { data: accounts = [] } = useBankAccounts()
  const [accountId, setAccountId] = useState(accounts[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const amt = Number(amount) || 0
  const target = accountId || accounts[0]?.id || ''
  const valid = amt > 0 && amt <= balance && !!target
  return (
    <Modal open onClose={onClose} title="Setor Dana ke Bank" size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
          <Button className="flex-[2]" disabled={!valid} onClick={() => onDeposit(target, amt, note.trim() || null)}>Setor</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
          Saldo wallet: <strong className="tabular-nums">{fmtID(balance)}</strong> — dana pindah dari wallet ke rekening bank, tidak dihitung sebagai pengeluaran usaha.
        </p>
        <Field label="Rekening tujuan" required>
          {accounts.length === 0 ? (
            <p className="text-xs text-red-600">Belum ada rekening bank — tambahkan lewat tombol Bank di kartu wallet.</p>
          ) : (
            <Select value={target} onChange={(e) => setAccountId(e.target.value)} aria-label="Rekening tujuan">
              {accounts.filter((a) => a.is_active).map((a) => <option key={a.id} value={a.id}>{a.name}{a.account_no ? ` · ${a.account_no}` : ''}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Nominal (Rp)" required>
          <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="0" className="h-14 text-2xl font-bold" />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {[100000, 250000, 500000, balance].map((v, i) => (
            <button key={i} type="button" onClick={() => setAmount(String(Math.min(v, balance)))}
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
              {i === 3 ? 'Semua' : `${v / 1000}rb`}
            </button>
          ))}
        </div>
        <Field label="Catatan" hint="opsional"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. setoran harian" /></Field>
        {amount !== '' && amt > balance && <p className="text-xs font-semibold text-red-600" role="alert">Nominal melebihi saldo wallet.</p>}
      </div>
    </Modal>
  )
}

/** Modal kelola rekening bank: daftar saldo, tambah/hapus, mutasi manual, riwayat */
function BankModal({ onClose }: { onClose: () => void }) {
  const { data: bankData } = useBankBalances()
  const { data: txns = [] } = useBankTxns()
  const saveAcc = useSaveBankAccount()
  const delAcc = useDeleteBankAccount()
  const txn = useBankTxn()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', bank_name: '', account_no: '', opening_balance: '' })
  const [txnForm, setTxnForm] = useState<{ accountId: string; type: 'in' | 'out'; amount: string; note: string } | null>(null)

  return (
    <Modal open onClose={onClose} title="Rekening Bank" size="md">
      <div className="space-y-4">
        <div className="space-y-2">
          {(bankData?.accounts || []).length === 0 && <p className="py-4 text-center text-sm text-slate-500">Belum ada rekening bank.</p>}
          {(bankData?.accounts || []).map((a) => (
            <div key={a.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" aria-hidden><Landmark size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{a.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{a.bank_name || ''}{a.account_no ? ` · ${a.account_no}` : ''}</p>
                </div>
                <span className="text-base font-bold tabular-nums">{fmtID(bankData?.balances.get(a.id) || 0)}</span>
                <IconButton label={`Hapus ${a.name}`} size="sm" variant="ghost" className="text-red-500"
                  onClick={() => { if (confirm(`Hapus rekening ${a.name}? Mutasinya ikut terhapus.`)) delAcc.mutate(a.id) }}>
                  <Trash2 size={14} aria-hidden />
                </IconButton>
              </div>
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => setTxnForm({ accountId: a.id, type: 'in', amount: '', note: '' })}><ArrowDownToLine size={14} aria-hidden /> Dana masuk</Button>
                <Button size="sm" variant="secondary" onClick={() => setTxnForm({ accountId: a.id, type: 'out', amount: '', note: '' })}><ArrowUpFromLine size={14} aria-hidden /> Dana keluar</Button>
              </div>
              {txnForm && txnForm.accountId === a.id && (
                <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                  <Input inputMode="numeric" value={txnForm.amount} onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value.replace(/\D/g, '') })} placeholder="Nominal (Rp)" aria-label="Nominal mutasi" />
                  <div className="flex gap-1.5">
                    <Input value={txnForm.note} onChange={(e) => setTxnForm({ ...txnForm, note: e.target.value })} placeholder="Catatan (opsional)" className="flex-1" />
                    <Button size="sm" disabled={!txnForm.amount}
                      onClick={() => txn.mutate({ accountId: txnForm.accountId, type: txnForm.type, amount: Number(txnForm.amount) || 0, note: txnForm.note.trim() || null }, { onSuccess: () => { toast.success('Mutasi bank tercatat'); setTxnForm(null) }, onError: (e: Error) => toast.error(e.message) })}>
                      Simpan
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {adding ? (
          <div className="space-y-2 rounded-2xl border border-brand-200 bg-brand-50/50 p-3 dark:border-brand-900/50 dark:bg-brand-900/10">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama rekening, mis. BCA Operasional" aria-label="Nama rekening" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Bank (BCA/Mandiri)" aria-label="Nama bank" />
              <Input value={form.account_no} onChange={(e) => setForm({ ...form, account_no: e.target.value })} placeholder="No. rekening" aria-label="Nomor rekening" />
            </div>
            <Input inputMode="numeric" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value.replace(/\D/g, '') })} placeholder="Saldo awal (Rp, 0 jika baru)" aria-label="Saldo awal" />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => { setAdding(false); setForm({ name: '', bank_name: '', account_no: '', opening_balance: '' }) }}>Batal</Button>
              <Button className="flex-[2]" disabled={!form.name.trim()}
                onClick={() => saveAcc.mutate({ name: form.name.trim(), bank_name: form.bank_name.trim() || null, account_no: form.account_no.trim() || null, opening_balance: Number(form.opening_balance) || 0 }, {
                  onSuccess: () => { toast.success('Rekening ditambahkan'); setAdding(false); setForm({ name: '', bank_name: '', account_no: '', opening_balance: '' }) },
                  onError: (e: Error) => toast.error(e.message),
                })}>
                Tambah
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setAdding(true)}><Plus size={16} aria-hidden /> Tambah Rekening</Button>
        )}

        {txns.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Mutasi terbaru</h3>
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {txns.map((t) => (
                <li key={t.id} className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                  <span aria-hidden>{t.type === 'in' ? <ArrowDownToLine size={15} className="text-green-600" /> : <ArrowUpFromLine size={15} className="text-red-600" />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.accountName}{t.source === 'wallet' ? ' · dari wallet' : ''}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{fmtDateTime(t.created_at)}{t.note ? ` · ${t.note}` : ''}</p>
                  </div>
                  <span className={`shrink-0 font-bold tabular-nums ${t.type === 'in' ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>{t.type === 'in' ? '+' : '−'}{fmtID(t.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Modal tarik dana dari wallet — otomatis tercatat sebagai pengeluaran */
function WithdrawModal({ balance, onClose, onWithdraw }: { balance: number; onClose: () => void; onWithdraw: (amount: number, note: string | null) => void }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const amt = Number(amount) || 0
  const valid = amt > 0 && amt <= balance
  return (
    <Modal open onClose={onClose} title="Tarik Dana Wallet" size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
          <Button className="flex-[2]" disabled={!valid} onClick={() => onWithdraw(amt, note.trim() || null)}>Tarik</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
          Saldo wallet: <strong className="tabular-nums">{fmtID(balance)}</strong> — dana yang ditarik otomatis tercatat sebagai pengeluaran.
        </p>
        <Field label="Nominal tarik (Rp)" required>
          <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="0" className="h-14 text-2xl font-bold" />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {[50000, 100000, 250000, balance].map((v, i) => (
            <button key={i} type="button" onClick={() => setAmount(String(Math.min(v, balance)))}
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
              {i === 3 ? 'Semua' : `${v / 1000}rb`}
            </button>
          ))}
        </div>
        <Field label="Catatan" hint="opsional"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. disetor ke rekening" /></Field>
        {amount !== '' && !valid && <p className="text-xs font-semibold text-red-600" role="alert">Nominal melebihi saldo wallet.</p>}
      </div>
    </Modal>
  )
}

function EntryModal({ entry, onClose, onSave }: { entry: Partial<FinanceEntry> | null; onClose: () => void; onSave: (e: Partial<FinanceEntry> & { type: 'income' | 'expense'; category: string; amount: number; entry_date: string }) => void }) {
  const [type, setType] = useState<'income' | 'expense'>(entry?.type || 'expense')
  const [category, setCategory] = useState(entry?.category || 'lainnya')
  const [amount, setAmount] = useState(entry?.amount ? String(entry.amount) : '')
  const [note, setNote] = useState(entry?.note || '')
  const [date, setDate] = useState(entry?.entry_date || todayISO())
  // catat ke dompet wallet atau rekening bank
  const [account, setAccount] = useState<'wallet' | 'bank'>(entry?.account ?? 'wallet')
  const { data: bankAccounts = [] } = useBankAccounts()
  const [bankId, setBankId] = useState('')
  const activeBank = bankId || bankAccounts[0]?.id || ''

  if (!entry) return null

  const cats = FINANCE_CATEGORIES[type]

  return (
    <Modal open onClose={onClose} title={entry.id ? 'Ubah Catatan' : 'Catat Keuangan'} size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
          <Button
            className="flex-[2]"
            disabled={!amount || (account === 'bank' && !activeBank)}
            onClick={() => onSave({ id: entry.id, type, category, amount: Number(amount) || 0, note: note || null, entry_date: date, account, bank_account_id: account === 'bank' ? activeBank : null })}
          >
            Simpan
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Pilih akun pencatatan */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Catat ke akun</span>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800" role="radiogroup" aria-label="Akun pencatatan">
            {([
              ['wallet', 'Dompet Wallet'],
              ['bank', 'Rekening Bank'],
            ] as Array<['wallet' | 'bank', string]>).map(([v, lbl]) => (
              <button key={v} role="radio" aria-checked={account === v} onClick={() => setAccount(v)}
                className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-bold ${account === v ? 'bg-white text-slate-900 shadow dark:bg-slate-900 dark:text-white' : 'text-slate-500'}`}>
                {v === 'wallet' ? <Vault size={15} aria-hidden /> : <Landmark size={15} aria-hidden />}{lbl}
              </button>
            ))}
          </div>
          {account === 'bank' && (
            bankAccounts.length === 0 ? (
              <p className="mt-2 text-xs text-red-600">Belum ada rekening bank — tambahkan dulu lewat tombol Bank di kartu wallet.</p>
            ) : (
              <div className="mt-2">
                <Select value={activeBank} onChange={(e) => setBankId(e.target.value)} aria-label="Pilih rekening bank">
                  {bankAccounts.filter((a) => a.is_active).map((a) => <option key={a.id} value={a.id}>{a.name}{a.account_no ? ` · ${a.account_no}` : ''}</option>)}
                </Select>
              </div>
            )
          )}
        </div>
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
