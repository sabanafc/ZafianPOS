import { useState } from 'react'
import { Printer, Bluetooth, Loader2, Usb } from 'lucide-react'
import { Button, Spinner } from '../ui'
import type { Settings } from '../../types'
import { printTestPage, BT_SUPPORT } from '../../lib/bluetoothPrint'
import { useBtPrinter } from './PrinterSheet'
import { toast } from '../../lib/toast'

/** Panel uji printer: Bluetooth (ESC/POS) atau dialog print browser */
export function TestPrint({ settings }: { settings: Settings }) {
  const bt = useBtPrinter()
  const [busyBt, setBusyBt] = useState(false)
  const [busyBrowser, setBusyBrowser] = useState(false)

  const doBtTest = async () => {
    setBusyBt(true)
    try {
      await printTestPage({ businessName: settings.business_name, width: settings.paper_width })
      toast.success('Halaman uji terkirim ke printer Bluetooth')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusyBt(false)
    }
  }

  const doBrowserTest = () => {
    setBusyBrowser(true)
    setTimeout(() => {
      window.print()
      setBusyBrowser(false)
    }, 150)
  }

  const width = settings?.paper_width || 80
  const fontScale = settings?.print_font_scale || 1

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-line p-4">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-bold"><Printer size={15} aria-hidden /> Tes printer</p>
        <p className="text-xs text-muted">Cek koneksi & kalibrasi dengan struk mini (hemat kertas)</p>
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={doBtTest} disabled={!bt.connected || busyBt} title={bt.connected ? 'Cetak via Bluetooth' : 'Hubungkan printer dulu'}>
          {busyBt ? <Spinner className="text-white" /> : <Bluetooth size={16} aria-hidden />}
          {bt.connected ? `Test via ${bt.name}` : 'Test via Bluetooth (belum terhubung)'}
        </Button>
        <Button variant="secondary" onClick={doBrowserTest} disabled={busyBrowser}>
          {busyBrowser ? <Spinner /> : <Usb size={16} aria-hidden />}
          Test via Dialog Print Browser
        </Button>
      </div>

      {!BT_SUPPORT && (
        <p className="text-[11px] text-muted">Web Bluetooth tidak tersedia di browser ini — cetak via dialog print browser.</p>
      )}

      {/* Area print hanya muncul saat mencetak via browser */}
      {busyBrowser && (
        <div className="fixed left-0 top-0 z-[200] bg-white p-2" aria-hidden>
          <div className={`print-area receipt ${width === 80 ? 'paper-80' : ''}`} style={{ fontSize: `${11 * fontScale}px` }}>
            <div className="text-center">
              <p className="font-bold" style={{ fontSize: `${14 * fontScale}px` }}>{settings.business_name}</p>
              <p>*** TEST PRINT ***</p>
              <p>{new Date().toLocaleString('id-ID')}</p>
            </div>
            <hr />
            <table>
              <tbody>
                <tr><td>Artikel uji</td><td className="text-right">Rp 12.345</td></tr>
                <tr><td>ABCDEfigh1234567890</td><td className="text-right">Rp 67.890</td></tr>
              </tbody>
            </table>
            <hr />
            <table>
              <tbody>
                <tr><td className="font-bold">TOTAL</td><td className="text-right font-bold">Rp 80.235</td></tr>
                <tr><td>Margin</td><td className="text-right">{settings.print_margin_mm}mm · kertas {width}mm</td></tr>
              </tbody>
            </table>
            <hr />
            <p className="text-center">Jika teks terpotong/bergeser,<br />atur margin di Pengaturan.</p>
          </div>
        </div>
      )}
    </div>
  )
}
