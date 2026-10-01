import { useMemo, useState } from 'react'
import { Trash2, ShoppingCart as CartIcon, Loader2, LogIn } from 'lucide-react'
import { usePosStore, useUiStore } from '../store/pos'
import { useProducts, useCategories } from '../hooks/useMaster'
import { useSettings } from '../hooks/useSettings'
import { useActiveShift, useCreateOrder, useOrderHistory, useVoidOrder } from '../hooks/useOrders'
import { supabase } from '../lib/supabase'
import { ProductGrid } from '../components/pos/ProductGrid'
import { ChannelPicker } from '../components/pos/ChannelPicker'
import { CartList } from '../components/pos/CartList'
import { PaymentModal } from '../components/pos/PaymentModal'
import { ReceiptDialog } from '../components/pos/Receipt'
import { ShiftSheet } from '../components/shift/ShiftSheet'
import { Modal } from '../components/Modal'
import { Button, IconButton, Badge, EmptyState } from '../components/ui'
import { fmtID, fmtTime } from '../lib/utils'
import { calcTotals } from '../lib/posCalc'
import { CHANNELS } from '../lib/constants'
import { isOnlineChannel, type Order, type PaymentMethod, type Product } from '../types'
import { toast } from '../lib/toast'

export default function PosPage() {
  const { settings } = useSettings()
  const { data: products = [], isLoading: pLoading } = useProducts()
  const { data: categories = [] } = useCategories()
  const { data: shift } = useActiveShift()
  const createOrder = useCreateOrder()
  const { data: history = [] } = useOrderHistory(20)
  const voidOrder = useVoidOrder()
  const historyOpen = useUiStore((s) => s.historyOpen)
  const setHistoryOpen = useUiStore((s) => s.setHistoryOpen)

  const {
    channel, lines, discount, note, held,
    setChannel, add, setQty, remove, clear, setDiscount,
    holdOrder, resumeHold, deleteHold,
  } = usePosStore()

  const [cat, setCat] = useState('all')
  const [payOpen, setPayOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [shiftGate, setShiftGate] = useState(false)
  const [lastOrder, setLastOrder] = useState<Order | null>(null)

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const totals = calcTotals(subtotal, discount, settings)
  const activeProducts = useMemo(() => products.filter((p) => p.is_active), [products])
  const online = isOnlineChannel(channel)
  const ch = CHANNELS.find((c) => c.id === channel)!

  const pick = (p: Product) => {
    if (!shift) { setShiftGate(true); return }
    add({ id: p.id, name: p.name, price: p.price, image_url: p.image_url })
  }

  const submitPayment = async (payment: PaymentMethod, paid: number) => {
    createOrder.mutate(
      {
        channel, discount, payment, paid,
        note: note || null,
        shiftId: shift?.id || null,
        items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
      },
      {
        onSuccess: async (orderId: string) => {
          setPayOpen(false)
          clear()
          toast.success(online ? 'Pesanan online tercatat' : 'Transaksi tersimpan')
          const { data } = await supabase.from('orders').select('*, items:order_items(*)').eq('id', orderId).single()
          if (data && !online) setLastOrder(data as unknown as Order)
        },
        onError: (e: Error) => toast.error(e.message),
      },
    )
  }

  const doHold = () => {
    const id = holdOrder()
    if (id) {
      toast.info('Pesanan ditahan — lanjutkan dari daftar "Ditahan"')
      setCartOpen(false)
    }
  }

  const doClear = () => {
    clear()
    toast.info('Keranjang dikosongkan')
  }

  if (!shift) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" aria-hidden>
          <LogIn size={28} />
        </div>
        <div>
          <h1 className="text-lg font-bold">Shift belum dibuka</h1>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            Buka shift dengan modal awal (float) untuk mulai menerima pesanan. Semua transaksi tercatat ke shift berjalan.
          </p>
        </div>
        <Button size="lg" onClick={() => setShiftGate(true)}>
          <LogIn size={18} aria-hidden /> Buka Shift
        </Button>
        <ShiftSheet open={shiftGate} mode="open" onClose={() => setShiftGate(false)} />
      </div>
    )
  }

  const actionLabel = online ? 'Catat Pesanan' : 'Bayar'

  return (
    <div className="flex h-full flex-col">
      {/* Baris channel pesanan — full width */}
      <div className="px-4 pt-3 md:px-6 md:pt-4" style={{ paddingTop: 'max(0.75rem, var(--sat))' }}>
        <ChannelPicker value={channel} onChange={setChannel} />
      </div>

      {/* Konten: grid + keranjang (keranjang hanya tampil di layar lebar) */}
      <div className="flex min-h-0 flex-1 gap-4 p-4 md:p-6">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {pLoading ? (
            <div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin text-brand-600" size={28} aria-label="Memuat menu" /></div>
          ) : activeProducts.length === 0 ? (
            <EmptyState icon={<CartIcon size={24} />} title="Belum ada menu" subtitle="Tambahkan menu di halaman Menu & Kategori" />
          ) : (
            <ProductGrid
              products={activeProducts}
              categories={categories}
              activeCat={cat}
              onCat={setCat}
              onPick={pick}
            />
          )}
        </div>

        {/* Panel keranjang — hanya layar lebar (tablet landscape/desktop) */}
        <aside className="hidden w-[320px] shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-3 xl:w-[370px] lg:flex dark:border-slate-800 dark:bg-slate-900" aria-label="Keranjang">
          <CartList
            lines={lines} discount={discount} settings={settings} held={held} online={online}
            onQty={setQty} onRemove={remove} onDiscount={setDiscount}
            onHold={doHold} onClear={doClear} onResumeHold={resumeHold} onDeleteHold={deleteHold}
          />
          <Button size="lg" className="mt-3 w-full" disabled={lines.length === 0 || createOrder.isPending} onClick={() => setPayOpen(true)}>
            {actionLabel} · {fmtID(totals.total)}
          </Button>
        </aside>
      </div>

      {/* Bottom bar keranjang (ponsel & tablet portrait) */}
      {lines.length > 0 && (
        <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95">
          <Button size="lg" className="w-full" onClick={() => setCartOpen(true)}>
            <CartIcon size={18} aria-hidden />
            {lines.reduce((s, l) => s + l.qty, 0)} item · {fmtID(totals.total)}
          </Button>
        </div>
      )}

      {/* Sheet keranjang (ponsel & tablet portrait) */}
      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title={`Keranjang · ${ch.short}`}>
        <div className="flex min-h-[50dvh] flex-col">
          <CartList
            lines={lines} discount={discount} settings={settings} held={held} online={online}
            onQty={setQty} onRemove={remove} onDiscount={setDiscount}
            onHold={doHold} onClear={doClear}
            onResumeHold={(id) => { resumeHold(id); setCartOpen(false) }}
            onDeleteHold={deleteHold}
          />
          <Button size="lg" className="mt-4 w-full" disabled={lines.length === 0} onClick={() => { setCartOpen(false); setPayOpen(true) }}>
            {actionLabel} · {fmtID(totals.total)}
          </Button>
        </div>
      </Modal>

      <PaymentModal
        open={payOpen} total={totals.total} isOnlineRecording={online}
        onClose={() => setPayOpen(false)} onDone={submitPayment}
      />
      <ReceiptDialog order={lastOrder} settings={settings} onClose={() => setLastOrder(null)} />

      {/* Riwayat + void — dibuka dari ikon riwayat di topbar */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Riwayat Transaksi" size="lg">
        {history.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Belum ada transaksi.</p>
        ) : (
          <ul className="space-y-2" aria-label="Riwayat transaksi">
            {history.map((o) => (
              <li key={o.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-bold">
                      {o.order_no}
                      {o.status === 'void' && <Badge tone="red">Void</Badge>}
                      {isOnlineChannel(o.channel) && <Badge tone="brand">{CHANNELS.find((c) => c.id === o.channel)?.short}</Badge>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {fmtTime(o.created_at)} · {CHANNELS.find((c) => c.id === o.channel)?.label} · {o.items?.length || 0} item
                      {o.payment_method ? ` · ${o.payment_method}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold tabular-nums">{fmtID(o.total)}</span>
                    {o.status === 'paid' && (
                      <IconButton
                        label={`Void ${o.order_no}`} size="sm" variant="ghost" className="text-red-500"
                        onClick={() => {
                          if (confirm(`Void transaksi ${o.order_no}?`)) {
                            voidOrder.mutate(o.id, { onSuccess: () => toast.success('Transaksi di-void') })
                          }
                        }}
                      >
                        <Trash2 size={15} aria-hidden />
                      </IconButton>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}
