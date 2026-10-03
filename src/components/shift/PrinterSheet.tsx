import { useState, useEffect } from 'react'
import { Bluetooth, BluetoothConnected, BluetoothOff, Loader2, RefreshCw, AlertTriangle, Info } from 'lucide-react'
import { Modal } from '../Modal'
import { Button } from '../ui'
import { BT_SUPPORT, autoReconnect, connectPrinter, disconnectPrinter, printTestPage, subscribeBt, type BtState } from '../../lib/bluetoothPrint'
import type { Settings } from '../../types'
import { toast } from '../../lib/toast'

/** Hook status printer BT */
export function useBtPrinter() {
  const [s, setS] = useState<BtState>({ connected: false, name: null })
  useEffect(() => {
    const unsub = subscribeBt(setS)
    return () => { unsub() }
  }, [])
  return s
}

export function PrinterSheet({ open, onClose, settings }: { open: boolean; onClose: () => void; settings: Settings }) {
  const bt = useBtPrinter()
  const [busy, setBusy] = useState<'connect' | 'test' | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // saat dialog dibuka & belum terhubung → coba sambung ulang otomatis (tanpa pairing)
  useEffect(() => {
    if (!open || bt.connected) return
    let cancelled = false
    autoReconnect().then((res) => {
      if (cancelled) return
      if (res === 'connected') toast.success('Printer tersambung kembali')
      else if (res === 'failed') setErr('Koneksi printer terputus — tekan Hubungkan untuk pairing ulang')
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleConnect = async () => {
    setErr(null)
    setBusy('connect')
    const res = await connectPrinter()
    setBusy(null)
    if (res.ok) toast.success(`Terhubung ke ${res.name}`)
    else setErr(res.error || 'Gagal terhubung')
  }

  const handleTest = async () => {
    setErr(null)
    setBusy('test')
    try {
      await printTestPage({ businessName: settings.business_name, width: settings.paper_width })
      toast.success('Halaman uji terkirim ke printer')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const handleDisconnect = async () => {
    await disconnectPrinter()
    toast.info('Printer diputus')
  }

  return (
    <Modal open={open} onClose={onClose} title="Printer Bluetooth" size="sm">
      <div className="space-y-4">
        {/* Status */}
        <div className={`flex items-center gap-3 rounded-2xl p-4 ${bt.connected ? 'bg-green-50 dark:bg-green-900/20' : 'bg-surface-2 dark:bg-surface-2'}`}>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bt.connected ? 'bg-green-600 text-white' : 'bg-line text-ink'}`} aria-hidden>
            {bt.connected ? <BluetoothConnected size={20} /> : <BluetoothOff size={20} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{bt.connected ? bt.name : 'Belum terhubung'}</p>
            <p className="text-xs text-muted">
              {bt.connected ? 'Siap mencetak struk via Bluetooth' : 'Hubungkan printer thermal ESC/POS (BLE)'}
            </p>
          </div>
        </div>

        {!BT_SUPPORT && (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" role="alert">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Browser ini tidak mendukung Web Bluetooth. Gunakan <strong>Chrome di Android</strong> (tablet/ponsel Anda), atau Chrome/Edge di desktop.
              Di iOS/Safari fitur ini belum tersedia — cetak via dialog print browser.
            </span>
          </div>
        )}

        {err && (
          <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300" role="alert">{err}</p>
        )}

        {/* Aksi */}
        <div className="space-y-2">
          {!bt.connected ? (
            <Button size="lg" className="w-full" onClick={handleConnect} disabled={!BT_SUPPORT || busy !== null}>
              {busy === 'connect' ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Bluetooth size={18} aria-hidden />}
              Hubungkan / Pairing Printer
            </Button>
          ) : (
            <>
              <Button size="lg" className="w-full" onClick={handleTest} disabled={busy !== null}>
                {busy === 'test' ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <RefreshCw size={18} aria-hidden />}
                Kirim Halaman Uji (hemat kertas)
              </Button>
              <Button variant="secondary" className="w-full" onClick={handleDisconnect}>
                <BluetoothOff size={18} aria-hidden /> Putuskan Printer
              </Button>
            </>
          )}
        </div>

        {/* Tips */}
        <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3.5 text-xs text-muted dark:bg-surface-2">
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Tips pairing:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>Nyalakan printer & pastikan mode Bluetooth aktif (lampu berkedip)</li>
              <li>Printer lama mode klasik (SPP): pasangkan dulu di Pengaturan Bluetooth Android</li>
              <li>Jangan pilih printer di dialog pairing Android saat akan cetak via app</li>
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  )
}
