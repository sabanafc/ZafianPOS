import { useState } from 'react'
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
  onClose: () => void
  onDone: (payment: PaymentMethod, paid: number) => void
}

export function PaymentModal({ open, total, isOnlineRecording = false, onClose, onDone }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [paid, setPaid] = useState('')
  const change = Math.max(0, (Number(paid) || 0) - total)
  const enough = (Number(paid) || 0) >= total

  const press = (k: string) => {
    if (k === 'C') return setPaid('')
    if (k === '⌫') return setPaid((p) => p.slice(0, -1))
    setPaid((p) => {
      // ganti nilai jika masih nol supaya "0" tidak menempel di depan
      const base = p === '0' ? '' : p
      const next = (base + k).replace(/^0+(?=\d)/, '')
      return next.slice(0, 9)
    })
  }

  const submit = () => {
    if (method !== 'cash') return onDone(method, total)
    if (!enough) return
    onDone('cash', Number(paid))
  }

  const quickSet = (v: number) => setPaid(String(v))

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
                onClick={() => { setMethod(id); if (id !== 'cash') setPaid('') }}
                className={`flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 text-sm font-bold transition-colors ${
                  method === id
                    ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400'
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
            <div className="rounded-2xl bg-slate-100 p-4 text-center dark:bg-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Uang diterima</p>
              <p className="text-3xl font-bold tabular-nums" aria-live="polite">{paid ? fmtID(Number(paid)) : 'Rp 0'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total: <strong className="tabular-nums">{fmtID(total)}</strong></p>
              <p className={`mt-1 text-sm font-semibold ${enough ? 'text-green-700 dark:text-green-400' : 'text-slate-400'}`}>
                Kembalian: {fmtID(change)}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-1.5" aria-label="Nominal cepat">
              {QUICK.map((v) => (
                <button
                  key={v}
                  onClick={() => quickSet(v)}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
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
                  className="flex h-14 items-center justify-center rounded-xl bg-white text-xl font-bold text-slate-800 shadow-card ring-1 ring-slate-200 transition-transform active:scale-95 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
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
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Total: <strong className="tabular-nums">{fmtID(total)}</strong></p>
            </div>
          )
        )}

        {isOnlineRecording && (
          <div className="rounded-2xl bg-slate-100 p-4 text-center dark:bg-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total pesanan</p>
            <p className="text-3xl font-bold tabular-nums">{fmtID(total)}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" size="lg" onClick={onClose}>Batal</Button>
          <Button
            className="flex-[2]" size="lg" variant={isOnlineRecording ? 'success' : 'primary'}
            onClick={submit}
            disabled={!isOnlineRecording && method === 'cash' && (!enough || paid === '')}
            aria-label={`Konfirmasi ${fmtID(total)}`}
          >
            <Check size={18} aria-hidden />
            {isOnlineRecording ? 'Catat Pesanan' : `Selesai — ${fmtID(total)}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
