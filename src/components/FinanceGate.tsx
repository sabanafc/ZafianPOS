import { useEffect, useState } from 'react'
import { Lock, ShieldCheck, Delete } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import { pinHash, verifyTotp } from '../lib/security'
import { Spinner } from './ui'
import { isConfigured } from '../lib/supabase'
import { toast } from '../lib/toast'

/** Kunci otomatis halaman keuangan bila tidak ada aktivitas selama 5 menit */
const FINANCE_IDLE_MS = 5 * 60_000

/**
 * Gerbang akses halaman Keuangan: minta PIN dan/atau kode Google
 * Authenticator (TOTP) sebelum konten dirender. Status buka disimpan
 * per sesi (hilang saat tab ditutup) — dibuka ulang tiap masuk aplikasi.
 */
export function FinanceGate({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings()
  const key = 'finance-unlocked'

  const hasPin = isConfigured && !!settings?.finance_pin
  const hasTotp = isConfigured && !!settings?.totp_secret
  const [sessionOpen, setSessionOpen] = useState(() => sessionStorage.getItem(key) === '1')
  const unlocked = !hasPin && !hasTotp ? true : sessionOpen

  // Kunci otomatis saat idle: reset timer tiap ada interaksi (sentuhan, klik, keyboard, scroll)
  useEffect(() => {
    if (!sessionOpen || (!hasPin && !hasTotp)) return
    const lock = () => {
      sessionStorage.removeItem(key)
      setSessionOpen(false)
      toast.info('Halaman keuangan dikunci otomatis karena tidak ada aktivitas 5 menit')
    }
    let timer = window.setTimeout(lock, FINANCE_IDLE_MS)
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(lock, FINANCE_IDLE_MS) }
    const evts: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    evts.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => { window.clearTimeout(timer); evts.forEach((e) => window.removeEventListener(e, reset)) }
  }, [sessionOpen, hasPin, hasTotp])

  // fase verifikasi: 'pin' dulu (bila ada), lalu 'totp' — tiap fase layak input sendiri
  const [stage, setStage] = useState<'pin' | 'totp'>(hasPin ? 'pin' : 'totp')
  const [pin, setPin] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (unlocked) return <>{children}</>

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      if (stage === 'pin' && hasPin) {
        const h = await pinHash(pin)
        if (h !== settings!.finance_pin) {
          setError('PIN salah')
          setBusy(false)
          return
        }
        if (hasTotp) {
          // lanjut ke fase kode autentikator
          setPin('')
          setStage('totp')
          setBusy(false)
          return
        }
      } else if (hasTotp) {
        const ok = await verifyTotp(settings!.totp_secret!, code)
        if (!ok) {
          setError('Kode Google Authenticator salah')
          setBusy(false)
          return
        }
      }
      sessionStorage.setItem(key, '1')
      setSessionOpen(true)
      setPin('')
      setCode('')
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  const pressNum = (d: string) => {
    setError('')
    if (stage === 'pin') setPin((p) => (p + d).slice(0, 8))
    else setCode((c) => (c + d).slice(0, 6))
  }
  const pressDel = () => (stage === 'pin' ? setPin((p) => p.slice(0, -1)) : setCode((c) => c.slice(0, -1)))
  const shown = stage === 'pin' ? pin : code
  const ready = stage === 'pin' ? pin.length >= 4 : code.length === 6

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" aria-hidden>
        {stage === 'pin' ? <Lock size={26} /> : <ShieldCheck size={26} />}
      </div>
      <div className="text-center">
        <h1 className="text-lg font-bold">{stage === 'pin' ? 'Masukkan PIN Keuangan' : 'Kode Google Authenticator'}</h1>
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {stage === 'pin'
            ? 'Halaman keuangan dilindungi PIN. Ketik PIN untuk membuka.'
            : 'Buka aplikasi Google Authenticator dan ketik kode 6 digit saat ini.'}
        </p>
      </div>

      <div className="flex gap-2" aria-live="polite">
        {Array.from({ length: stage === 'pin' ? 8 : 6 }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full ${i < shown.length ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`}
          />
        ))}
      </div>
      {error && <p className="text-sm font-semibold text-red-600" role="alert">{error}</p>}
      {busy && <Spinner />}

      <div className="grid w-full max-w-[280px] grid-cols-3 gap-2" aria-label={stage === 'pin' ? 'Numpad PIN' : 'Numpad kode'}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
          <button
            key={k}
            onClick={() => {
              if (busy) return
              if (k === 'C') { setError(''); stage === 'pin' ? setPin('') : setCode(''); return }
              if (k === '⌫') return pressDel()
              pressNum(k)
            }}
            className="flex h-14 items-center justify-center rounded-xl bg-white text-xl font-bold text-slate-800 shadow-card ring-1 ring-slate-200 transition-transform active:scale-95 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
            aria-label={k === '⌫' ? 'Hapus satu digit' : k === 'C' ? 'Hapus semua' : `Angka ${k}`}
          >
            {k === '⌫' ? <Delete size={20} aria-hidden /> : k}
          </button>
        ))}
      </div>

      {ready && (
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-xl bg-brand-600 px-8 py-3 text-sm font-bold text-white shadow transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          Buka Keuangan
        </button>
      )}
    </div>
  )
}
