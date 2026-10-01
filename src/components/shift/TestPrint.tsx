import { useState } from 'react'
import { Printer, Settings2 } from 'lucide-react'
import { Button, Spinner } from '../ui'
import type { Settings } from '../../types'
import { fmtID } from '../../lib/utils'

/** Test print hemat kertas: struk mini ~60mm tinggi untuk cek printer & kalibrasi */
export function TestPrint({ settings }: { settings: Settings }) {
  const [printing, setPrinting] = useState(false)

  const doPrint = () => {
    setPrinting(true)
    // beri waktu React merender area print sebelum memanggil window.print
    setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 150)
  }

  const width = settings?.paper_width || 80
  const fontScale = settings?.print_font_scale || 1

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold"><Printer size={15} aria-hidden /> Tes printer</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Cetak struk mini (hemat kertas) untuk cek koneksi & kalibrasi</p>
        </div>
        <Button variant="secondary" onClick={doPrint} disabled={printing}>
          {printing ? <Spinner className="scale-75" /> : <Printer size={16} aria-hidden />} Test Print
        </Button>
      </div>

      {/* Area print hanya muncul saat mencetak */}
      {printing && (
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
                <tr><td>Artikel uji</td><td className="text-right">{fmtID(12345)}</td></tr>
                <tr><td>ABCDEFIGHIJKLMNOP 1234567890</td><td className="text-right">{fmtID(67890)}</td></tr>
              </tbody>
            </table>
            <hr />
            <table>
              <tbody>
                <tr><td className="font-bold">TOTAL</td><td className="text-right font-bold">{fmtID(80235)}</td></tr>
                <tr><td>Margin</td><td className="text-right">{settings.print_margin_mm}mm · kertas {width}mm</td></tr>
              </tbody>
            </table>
            <hr />
            <p className="text-center">Jika teks terpotong/bergeser,<br/>atur margin di Pengaturan.</p>
          </div>
        </div>
      )}
    </div>
  )
}
