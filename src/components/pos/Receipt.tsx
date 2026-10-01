import { useEffect, useRef, useState } from 'react'
import type { Order, Settings } from '../../types'
import { fmtID, fmtDateTime } from '../../lib/utils'
import { CHANNELS } from '../../lib/constants'
import { Button, Spinner } from '../ui'
import { printReceipt, BT_SUPPORT } from '../../lib/bluetoothPrint'
import { useBtPrinter } from '../shift/PrinterSheet'
import { toast } from '../../lib/toast'

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

/** Dialog sukses pembayaran: preview struk + tombol cetak (Bluetooth/browser).
 *  reprint=true → dipakai untuk cetak ulang dari riwayat (tanpa auto-print). */
export function ReceiptDialog({ order, settings, onClose, reprint = false }: { order: Order | null; settings?: Settings | null; onClose: () => void; reprint?: boolean }) {
  const printed = useRef(false)
  const bt = useBtPrinter()
  const [busyBt, setBusyBt] = useState(false)

  useEffect(() => {
    if (order && !reprint && !printed.current && settings?.auto_print && bt.connected) {
      printed.current = true
      doBtPrint().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, reprint, settings?.auto_print, bt.connected])

  if (!order) return null

  const ch = CHANNELS.find((c) => c.id === order.channel)

  const doBtPrint = async () => {
    if (!order) return
    setBusyBt(true)
    try {
      await printReceipt({
        businessName: settings?.business_name || 'Kasir POS',
        address: settings?.address,
        phone: settings?.phone,
        orderNo: order.order_no,
        datetime: fmtDateTime(order.created_at),
        channel: ch?.label || order.channel,
        lines: (order.items || []).map((it) => ({ name: it.name, qty: it.qty, price: it.price, total: it.line_total })),
        subtotal: order.subtotal,
        discount: order.discount,
        service: order.service,
        tax: order.tax,
        total: order.total,
        paymentLabel: order.payment_method ? order.payment_method.toUpperCase() : undefined,
        paid: order.paid_amount || undefined,
        change: order.change_amount || undefined,
        promoText: settings?.show_promo_on_receipt ? settings?.promo_text : null,
        footer: settings?.receipt_footer,
        width: settings?.paper_width || 80,
      })
      toast.success('Struk terkirim ke printer')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusyBt(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Transaksi berhasil">
      <button aria-label="Tutup" className="absolute inset-0 bg-slate-950/60 animate-overlay" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-pop animate-scale-in dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className={`font-bold ${reprint ? 'text-brand-700 dark:text-brand-300' : 'text-green-700 dark:text-green-400'}`}>
              {reprint ? 'Cetak ulang struk' : 'Transaksi berhasil'}
            </p>
            <p className="text-xs text-slate-500">{order.order_no}</p>
          </div>
          {bt.connected ? (
            <Button size="sm" onClick={doBtPrint} disabled={busyBt}>
              {busyBt ? <Spinner className="scale-75" /> : <><span aria-hidden>🖨</span> Cetak BT</>}
            </Button>
          ) : (
            <Button size="sm" onClick={() => window.print()} title={BT_SUPPORT ? 'Hubungkan printer via ikon Bluetooth di Pengaturan' : 'Cetak via browser'}>
              Cetak
            </Button>
          )}
        </div>
        <div className="flex justify-center overflow-y-auto bg-slate-100 px-4 py-6 dark:bg-slate-950">
          <div className="rounded bg-white p-3 shadow dark:bg-slate-100">
            <Receipt order={order} settings={settings} />
          </div>
        </div>
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <Button className="w-full" size="lg" onClick={onClose}>{reprint ? 'Tutup' : 'Selesai'}</Button>
        </div>
      </div>
    </div>
  )
}
