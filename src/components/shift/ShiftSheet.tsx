import { useState, useEffect } from 'react'
import { Lock, LogIn, TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine, Banknote, HandCoins, Calculator, Printer } from 'lucide-react'
import { Modal } from '../Modal'
import { Button, Input, Field, Spinner } from '../ui'
import { useActiveShift, useShiftSummary, useOpenShift, useShiftCash, useCloseShift } from '../../hooks/useOrders'
import { useSettings } from '../../hooks/useSettings'
import { fmtID, fmtTime, fmtDateTime } from '../../lib/utils'
import { toast } from '../../lib/toast'
import { printShiftClose } from '../../lib/bluetoothPrint'

// Pecahan uang Rupiah, dari lembar terbesar ke koin terkecil
const DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100]
const SMALL_COINS = [500, 200, 100]

export function ShiftSheet({ open, mode, onClose }: { open: boolean; mode: 'open' | 'close'; onClose: () => void }) {
  const { settings } = useSettings()
  const { data: shift } = useActiveShift()
  const { data: sum } = useShiftSummary(shift?.id)
  const { data: cash } = useShiftCash(shift?.id)
  const openShift = useOpenShift()
  const closeShift = useCloseShift()

  const [float, setFloat] = useState('350000')
  const [counted, setCounted] = useState('')
  // jumlah lembar/koin per pecahan untuk menghitung kas fisik
  const [denoms, setDenoms] = useState<Record<number, string>>({})
  // sembunyikan koin kecil bila usaha tidak menyimpan koin (pilihan diingat)
  const [hideCoins, setHideCoins] = useState(() => localStorage.getItem('hideSmallCoins') === '1')
  const toggleHideCoins = (v: boolean) => {
    setHideCoins(v)
    localStorage.setItem('hideSmallCoins', v ? '1' : '0')
  }
  const visibleDenoms = DENOMS.filter((d) => !hideCoins || !SMALL_COINS.includes(d))
  const denomTotal = DENOMS.reduce((s, d) => s + (Number(denoms[d]) || 0) * d, 0)
  const setDenom = (d: number, v: string) => setDenoms((prev) => ({ ...prev, [d]: v }))
  // tombol +/- menambah/mengurangi jumlah lembar/koin satu satuan
  const stepDenom = (d: number, delta: number) =>
    setDenoms((prev) => ({ ...prev, [d]: String(Math.max(0, (Number(prev[d]) || 0) + delta)) }))

  // total pecahan otomatis mengisi kolom "Kas fisik dihitung"
  useEffect(() => {
    if (denomTotal > 0) setCounted(String(denomTotal))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denomTotal])

  useEffect(() => {
    if (open && mode === 'open' && settings?.default_float) setFloat(String(settings.default_float))
  }, [open, mode, settings?.default_float])

  const expected = (sum?.cashSales || 0) + (sum?.cashIn || 0) - (sum?.cashOut || 0) + (shift?.opening_float || 0)
  // uang yang ditarik dari drawer & diserahkan ke owner = kas di drawer − modal awal
  const withdraw = Math.max(0, expected - (shift?.opening_float || 0))

  const handleOpen = () => {
    const v = Number(float) || 0
    openShift.mutate(v, {
      onSuccess: () => { toast.success('Shift dibuka'); onClose() },
      onError: (e: Error) => toast.error(e.message),
    })
  }

  const doPrintShiftClose = async (exp: number) => {
    if (!shift) return
    try {
      await printShiftClose({
        businessName: settings?.business_name || 'Kasir POS',
        shiftNo: shift.id.slice(0, 8).toUpperCase(),
        openedAt: fmtDateTime(shift.opened_at),
        closedAt: fmtDateTime(new Date().toISOString()),
        openingFloat: shift.opening_float || 0,
        cashSales: sum?.cashSales || 0,
        cashIn: sum?.cashIn || 0,
        cashOut: sum?.cashOut || 0,
        expected: exp,
        counted: Number(counted) || 0,
        diff: (Number(counted) || 0) - exp,
        ownerDeposit: Math.max(0, exp - (shift.opening_float || 0)),
        width: settings?.paper_width || 80,
      })
      toast.success('Struk tutup shift terkirim ke printer')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleClose = () => {
    if (!shift) return
    const v = Number(counted) || 0
    closeShift.mutate(
      { shiftId: shift.id, counted: v },
      {
        onSuccess: (expectedCash: unknown) => {
          toast.success('Shift ditutup')
          const exp = Number(expectedCash)
          const diff = v - exp
          if (Math.abs(diff) >= 1) toast.info(`Selisih kas: ${diff > 0 ? '+' : ''}${fmtID(diff)}`)
          onClose()
        },
        onError: (e: Error) => toast.error(e.message),
      },
    )
  }

  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} title={mode === 'open' ? 'Buka Shift' : 'Tutup Shift'} size={mode === 'open' ? 'sm' : 'lg'}>
      {mode === 'open' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4 dark:bg-brand-900/20">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white" aria-hidden><LogIn size={20} /></div>
            <div>
              <p className="text-sm font-semibold">Mulai shift baru</p>
              <p className="text-xs text-muted">Tentukan modal awal kas drawer</p>
            </div>
          </div>
          <Field label="Modal awal (float)" required>
            <Input
              inputMode="numeric" pattern="[0-9]*" value={float}
              onChange={(e) => setFloat(e.target.value.replace(/\D/g, ''))}
              placeholder="350000"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[50000, 100000, 350000, 500000].map((v) => (
                <button
                  key={v} type="button" onClick={() => setFloat(String(v))}
                  className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-ink hover:brightness-95 dark:bg-surface-2"
                >
                  {v / 1000}rb
                </button>
              ))}
            </div>
          </Field>
          <Button size="lg" className="w-full" onClick={handleOpen} disabled={openShift.isPending}>
            {openShift.isPending ? <Spinner className="text-white" /> : <LogIn size={18} aria-hidden />} Buka Shift
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {!shift ? (
            <p className="text-sm text-muted">Tidak ada shift aktif.</p>
          ) : (
            <>
              {/* Dua kolom di layar lebar: ringkasan kiri, hitung kas kanan */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
              <div className="rounded-2xl border border-line p-4 dark:border-line">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Ringkasan kas</p>
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-1.5 text-muted"><Banknote size={15} aria-hidden /> Modal awal</dt>
                    <dd className="font-semibold tabular-nums">{fmtID(shift.opening_float)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-1.5 text-muted"><TrendingUp size={15} className="text-green-600" aria-hidden /> Penjualan tunai</dt>
                    <dd className="font-semibold tabular-nums">{fmtID(sum?.cashSales || 0)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-1.5 text-muted"><ArrowDownToLine size={15} className="text-brand-600" aria-hidden /> Cash masuk</dt>
                    <dd className="font-semibold tabular-nums">{fmtID(sum?.cashIn || 0)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="flex items-center gap-1.5 text-muted"><ArrowUpFromLine size={15} className="text-red-600" aria-hidden /> Cash keluar</dt>
                    <dd className="font-semibold tabular-nums">{fmtID(sum?.cashOut || 0)}</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-dashed pt-2 text-base">
                    <dt className="font-bold">Kas di drawer (estimasi)</dt>
                    <dd className="font-bold tabular-nums text-brand-700 dark:text-brand-300">{fmtID(expected)}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] leading-snug text-muted dark:text-muted">
                  = Penjualan tunai {fmtID(sum?.cashSales || 0)} + Modal awal {fmtID(shift.opening_float)}
                  {(sum?.cashIn || 0) > 0 || (sum?.cashOut || 0) > 0
                    ? ` + Cash in ${fmtID(sum?.cashIn || 0)} − Cash out ${fmtID(sum?.cashOut || 0)}`
                    : ''}
                </p>
              </div>

              {/* Uang yang ditarik dari drawer untuk owner */}
              <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-900/20">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  <HandCoins size={14} aria-hidden /> Ditarik & diserahkan ke owner
                </p>
                <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-amber-800 dark:text-amber-200">{fmtID(withdraw)}</p>
                <p className="mt-1.5 text-xs leading-snug text-amber-700/80 dark:text-amber-200/70">
                  Kas di drawer dikurangi modal awal ({fmtID(shift.opening_float)}) — jumlah ini yang ditarik dan diserahkan ke owner.
                  Modal awal tetap dibiarkan di drawer untuk shift berikutnya.
                </p>
              </div>

              {cash && cash.length > 0 && (
                <div className="max-h-32 space-y-1.5 overflow-y-auto" aria-label="Riwayat cash in/out">
                  {cash.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-xs dark:bg-surface-2/60">
                      <span className="flex items-center gap-1.5 font-medium">
                        {c.type === 'in' ? <ArrowDownToLine size={13} className="text-brand-600" aria-hidden /> : <ArrowUpFromLine size={13} className="text-red-600" aria-hidden />}
                        {c.type === 'in' ? 'Masuk' : 'Keluar'} {c.note ? `· ${c.note}` : ''}
                      </span>
                      <span className={`font-bold tabular-nums ${c.type === 'in' ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>{c.type === 'in' ? '+' : '−'}{fmtID(c.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
                </div>

                {/* Kanan: tabel hitung kas per pecahan (tombol +/−) & kas fisik */}
                <div className="space-y-4">
                  <div className="rounded-2xl border border-line dark:border-line">
                    <p className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-bold dark:border-line">
                      <Calculator size={16} className="text-brand-600" aria-hidden /> Hitung kas per pecahan
                      {denomTotal > 0 && <span className="ml-auto text-xs font-semibold tabular-nums text-brand-700 dark:text-brand-300">{fmtID(denomTotal)}</span>}
                    </p>
                    <div className="space-y-2 px-4 py-3">
                      <p className="text-xs text-muted">Ketik jumlah lembar/koin atau pakai tombol +/− — total otomatis mengisi kolom "Kas fisik dihitung".</p>
                      <div className="space-y-1.5">
                      {visibleDenoms.map((d) => (
                        <div key={d} className="grid grid-cols-[2.75rem_2.25rem_minmax(0,1fr)_2.25rem_4.25rem] items-center gap-1.5">
                          <span className="text-xs font-semibold text-muted" aria-hidden>{d >= 1000 ? `${d / 1000}rb` : d}</span>
                          <button
                            type="button" onClick={() => stepDenom(d, -1)}
                            aria-label={`Kurangi pecahan ${d}`}
                            className="flex h-9 items-center justify-center rounded-lg bg-surface-2 text-lg font-bold leading-none text-muted hover:brightness-95"
                          >−</button>
                          <Input
                            inputMode="numeric" pattern="[0-9]*" value={denoms[d] ?? ''}
                            onChange={(e) => setDenom(d, e.target.value.replace(/\D/g, ''))}
                            placeholder="0" aria-label={`Jumlah pecahan ${d}`}
                            className="h-9 w-full min-w-0 px-1 text-center text-sm"
                          />
                          <button
                            type="button" onClick={() => stepDenom(d, 1)}
                            aria-label={`Tambah pecahan ${d}`}
                            className="flex h-9 items-center justify-center rounded-lg bg-surface-2 text-lg font-bold leading-none text-muted hover:brightness-95"
                          >+</button>
                          <span className="truncate text-right text-[11px] tabular-nums text-muted" aria-hidden>{fmtID((Number(denoms[d]) || 0) * d)}</span>
                        </div>
                      ))}
                      </div>
                  <label className="flex w-fit cursor-pointer items-center gap-2 text-xs font-medium text-muted">
                    <input
                      type="checkbox" checked={hideCoins} onChange={(e) => toggleHideCoins(e.target.checked)}
                      className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
                    />
                    Sembunyikan koin kecil (500/200/100)
                  </label>
                      <div className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2 text-sm dark:bg-brand-900/20">
                        <span className="font-semibold">Total kas dihitung</span>
                        <span className="font-bold tabular-nums text-brand-700 dark:text-brand-300">{fmtID(denomTotal)}</span>
                      </div>
                    </div>
                  </div>

                  <Field label="Kas fisik dihitung" required hint={`Estimasi: ${fmtID(expected)}`}>
                <Input
                  inputMode="numeric" pattern="[0-9]*" value={counted}
                  onChange={(e) => setCounted(e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                />
                {counted !== '' && (
                  <p className="mt-2 text-sm font-semibold" aria-live="polite">
                    Selisih: <span className={(Number(counted) - expected) >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'}>
                      {(Number(counted) - expected) > 0 ? '+' : ''}{fmtID(Number(counted) - expected)}
                    </span>
                  </p>
                )}
                </Field>
              </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="secondary" size="lg" className="shrink-0" onClick={() => doPrintShiftClose(expected)} disabled={counted === ''} title="Cetak struk tutup shift via Bluetooth">
                  <Printer size={18} aria-hidden />
                </Button>
                <Button size="lg" variant="success" className="flex-1" onClick={handleClose} disabled={closeShift.isPending || counted === ''}>
                  {closeShift.isPending ? <Spinner className="text-white" /> : <Lock size={18} aria-hidden />} Tutup Shift
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
