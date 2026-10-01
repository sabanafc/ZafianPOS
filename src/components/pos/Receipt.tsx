import { useEffect, useRef } from 'react'
import type { Order, Settings } from '../../types'
import { fmtID, fmtDateTime } from '../../lib/utils'
import { CHANNELS } from '../../lib/constants'
import { Button } from '../ui'

export function Receipt({ order, settings, items }: { order: Order; settings?: Settings | null; items?: Order['items'] }) {
  const width = settings?.paper_width || 80
  const fontScale = settings?.print_font_scale || 1
  const biz = settings?.business_name || 'Kasir POS'
  const ch = CHANNELS.find((c) => c.id === order.channel)

  const lines = items || order.items || []

  return (
    <div className={`print-area receipt ${width === 80 ? 'paper-80' : ''}`} style={{ fontSize: `${11 * fontScale}px` }}>
      <div className="text-center">
        <p className="text-base font-bold">{biz}</p>
        {settings?.address && <p>{settings.address}</p>}
        {settings?.phone && <p>Telp {settings.phone}</p>}
      </div>
      <hr />
      <table>
        <tbody>
          <tr><td>No.</td><td className="text-right">{order.order_no}</td></tr>
          <tr><td>Tanggal</td><td className="text-right">{fmtDateTime(order.created_at)}</td></tr>
          <tr><td>Tipe</td><td className="text-right">{ch?.label || order.channel}</td></tr>
        </tbody>
      </table>
      <hr />
      <table>
        <tbody>
          {lines.map((it) => (
            <tr key={it.id || it.name}>
              <td colSpan={2}>
                {it.name}
                <table>
                  <tbody>
                    <tr>
                      <td>{it.qty} x {fmtID(it.price)}</td>
                      <td className="text-right">{fmtID(it.line_total)}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr />
      <table>
        <tbody>
          <tr><td>Subtotal</td><td className="text-right">{fmtID(order.subtotal)}</td></tr>
          {order.discount > 0 && <tr><td>Diskon</td><td className="text-right">-{fmtID(order.discount)}</td></tr>}
          {order.service > 0 && <tr><td>Service {settings?.service_percent}%</td><td className="text-right">{fmtID(order.service)}</td></tr>}
          {order.tax > 0 && <tr><td>Pajak {settings?.tax_percent}%</td><td className="text-right">{fmtID(order.tax)}</td></tr>}
          <tr><td className="text-base font-bold">TOTAL</td><td className="text-right text-base font-bold">{fmtID(order.total)}</td></tr>
          {order.payment_method && <tr><td>Bayar ({order.payment_method})</td><td className="text-right">{fmtID(order.paid_amount || 0)}</td></tr>}
          {order.change_amount && order.change_amount > 0 && <tr><td>Kembali</td><td className="text-right">{fmtID(order.change_amount)}</td></tr>}
        </tbody>
      </table>
      <hr />
      {settings?.show_promo_on_receipt && settings?.promo_text && (
        <>
          <hr />
          <p className="text-center font-bold">{settings.promo_text}</p>
        </>
      )}
      <hr />
      <p className="text-center">{settings?.receipt_footer || 'Terima kasih!'}</p>
    </div>
  )
}

/** Dialog sukses pembayaran: preview struk + tombol cetak/ selesai */
export function ReceiptDialog({ order, settings, onClose }: { order: Order | null; settings?: Settings | null; onClose: () => void }) {
  const printed = useRef(false)

  useEffect(() => {
    if (order && !printed.current) {
      printed.current = true
      if (settings?.auto_print) {
        setTimeout(() => window.print(), 350)
      }
    }
  }, [order, settings?.auto_print])

  if (!order) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Transaksi berhasil">
      <button aria-label="Tutup" className="absolute inset-0 bg-slate-950/60 animate-overlay" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-pop animate-scale-in dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="font-bold text-green-700 dark:text-green-400">Transaksi berhasil</p>
            <p className="text-xs text-slate-500">{order.order_no}</p>
          </div>
          <Button size="sm" onClick={() => window.print()}>
            Cetak
          </Button>
        </div>
        <div className="flex justify-center overflow-y-auto bg-slate-100 px-4 py-6 dark:bg-slate-950">
          <div className="rounded bg-white p-3 shadow dark:bg-slate-100">
            <Receipt order={order} settings={settings} />
          </div>
        </div>
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <Button className="w-full" size="lg" onClick={onClose}>Selesai</Button>
        </div>
      </div>
    </div>
  )
}
