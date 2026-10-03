import { useEffect, useRef, useState } from 'react'
import { Banknote, QrCode, Landmark, Delete, Check } from 'lucide-react'
import { Modal } from '../Modal'
import { Button } from '../ui'
import { fmtID } from '../../lib/utils'
import type { PaymentMethod } from '../../types'

const QUICK = [5000, 10000, 20000, 50000, 100000]

interface Props {
  open: boolean
  total: number
  isOnlineRecording?: boolean
  /** true saat order sedang dikirim — memblokir tombol selesai agar tidak dobel */
  busy?: boolean
  onClose: () => void
  onDone: (payment: PaymentMethod, paid: number) => void
}

export function PaymentModal({ open, total, isOnlineRecording = false, busy = false, onClose, onDone }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [paid, setPaid] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const presetRef = useRef(false)
  const change = Math.max(0, (Number(paid) || 0) - total)
  const enough = (Number(paid) || 0) >= total
  const processing = submitting || busy

  // Reset penuh setiap modal dibuka — sisa nilai/metode dari transaksi sebelumnya tidak terbawa
  useEffect(() => {
    if (open) {
      presetRef.current = false
      setPaid('')
      setMethod('cash')
      setSubmitting(false)
    }
  }, [open])

  // mutasi selesai (berhasil/gagal) → lepas status memproses agar bisa diulang bila gagal
  useEffect(() => { if (open && !busy) setSubmitting(false) }, [open, busy])

  const press = (k: string) => {
    if (k === 'C') { presetRef.current = false; return setPaid('') }
    if (k === '⌫') { presetRef.current = false; return setPaid((p) => p.slice(0, -1)) }
    // ketikan setelah tombol nominal cepat MENGANTI nilainya, bukan menempel
    // ("1" setelah 100.000 → 1, bukan 100.001). Flag dibaca di luar updater
    // agar tetap benar walau StrictMode memanggil updater 2x.
    const replace = presetRef.current
    presetRef.current = false
    setPaid((p) => {
      const base = replace ? '' : p === '0' ? '' : p
      return (base + k).slice(0, 9)
    })
  }

  const submit = () => {
    if (processing) return // cegah dobel payment
    // Pesanan online (GoFood/GrabFood/ShopeeFood): hanya dicatat, tanpa pembayaran
    if (isOnlineRecording) { setSubmitting(true); return onDone('cash', total) }
    if (method !== 'cash') { setSubmitting(true); return onDone(method, total) }
    if (!enough) return
    setSubmitting(true)
    onDone('cash', Number(paid))
  }

  const quickSet = (v: number) => { presetRef.current = true; setPaid(String(v)) }

  return (
    <Modal open={open} onClose={onClose} title={isOnlineRecording ? 'Catat Pesanan Online' : 'Pembayaran'} size="md">
      <div className="space-y-4">
        {isOnlineRecording && (
          <p className="rounded-xl bg-brand-50 px-3 py-2 text-center text-xs font-medium text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
            Pembayaran ditangani platform (GoFood/GrabFood/ShopeeFood) — pesanan hanya dicatat.
          </p>
        )}

        {!isOnlineRecording && (
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Metode pembayaran">
            {([['cash', Banknote, 'Tunai'], ['qris', QrCode, 'QRIS'], ['transfer', Landmark, 'Transfer']] as const).map(([id, Icon, label]) => (
              <button
                key={id}
                role="radio"
                aria-checked={method === id}
                onClick={() => { presetRef.current = false; setMethod(id); if (id !== 'cash') setPaid('') }}
                className={`flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 text-sm font-bold transition-colors ${
                  method === id
                    ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'border-line text-muted hover:bg-surface-2 dark:border-line dark:text-muted'
                }`}
              >
                <Icon size={22} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        )}

        {method === 'cash' && !isOnlineRecording ? (
          <>
            <div className="rounded-2xl bg-surface-2 p-4 text-center dark:bg-surface-2">
              <p className="text-xs font-medium text-muted">Uang diterima</p>
              <p className="text-3xl font-bold tabular-nums" aria-live="polite">{paid ? fmtID(Number(paid)) : 'Rp 0'}</p>
              <p className="text-xs text-muted">Total: <strong className="tabular-nums">{fmtID(total)}</strong></p>
              <p className={`mt-1 text-sm font-semibold ${enough ? 'text-green-700 dark:text-green-400' : 'text-muted'}`}>
                Kembalian: {fmtID(change)}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-1.5" aria-label="Nominal cepat">
              {QUICK.map((v) => (
                <button
                  key={v}
                  onClick={() => quickSet(v)}
                  className="rounded-lg bg-surface-2 px-3 py-2 text-xs font-bold text-ink hover:brightness-95 dark:bg-surface-2"
                >
                  {v >= 1000 ? `${v / 1000}rb` : v}
                </button>
              ))}
              <button
                onClick={() => quickSet(total)}
                className="rounded-lg bg-brand-100 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-200 dark:bg-brand-900/40 dark:text-brand-300"
              >
                Pas
              </button>
            </div>

            <div className="mx-auto grid w-full max-w-[280px] grid-cols-3 gap-2" aria-label="Numpad pembayaran">
              {['1','2','3','4','5','6','7','8','9','C','0','⌫'].map((k) => (
                <button
                  key={k}
                  onClick={() => press(k)}
                  className="flex h-14 items-center justify-center rounded-xl bg-surface text-xl font-bold text-ink shadow-card ring-1 ring-line transition-transform active:scale-95 dark:bg-surface-2"
                  aria-label={k === '⌫' ? 'Hapus satu digit' : k === 'C' ? 'Hapus semua' : `Angka ${k}`}
                >
                  {k === '⌫' ? <Delete size={20} aria-hidden /> : k}
                </button>
              ))}
            </div>
          </>
        ) : (
          !isOnlineRecording && (
            <div className="rounded-2xl bg-brand-50 p-6 text-center dark:bg-brand-900/20">
              {method === 'qris' ? <QrCode size={40} className="mx-auto text-brand-600" aria-hidden /> : <Landmark size={40} className="mx-auto text-brand-600" aria-hidden />}
              <p className="mt-3 text-sm font-semibold">Minta pelanggan scan QRIS / transfer ke rekening bisnis.</p>
              <p className="mt-1 text-sm text-muted">Total: <strong className="tabular-nums">{fmtID(total)}</strong></p>
            </div>
          )
        )}

        {isOnlineRecording && (
          <div className="rounded-2xl bg-surface-2 p-4 text-center dark:bg-surface-2">
            <p className="text-xs font-medium text-muted">Total pesanan</p>
            <p className="text-3xl font-bold tabular-nums">{fmtID(total)}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" size="lg" onClick={onClose} disabled={processing}>Batal</Button>
          <Button
            className="flex-[2]" size="lg" variant={isOnlineRecording ? 'success' : 'primary'}
            onClick={submit}
            disabled={processing || (!isOnlineRecording && method === 'cash' && (!enough || paid === ''))}
            aria-label={`Konfirmasi ${fmtID(total)}`}
          >
            {processing ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-label="Memproses" /> : <Check size={18} aria-hidden />}
            {isOnlineRecording ? 'Catat Pesanan' : `Selesai — ${fmtID(total)}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
