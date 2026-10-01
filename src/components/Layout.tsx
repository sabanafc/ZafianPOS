import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, UtensilsCrossed, Package, Wallet, Settings as SettingsIcon,
  Lock, LogIn, Coins, Printer, History,
} from 'lucide-react'
import { useActiveShift, useCloseShift } from '../hooks/useOrders'
import { useStockAlerts } from '../hooks/useStockAlerts'
import { useSettings } from '../hooks/useSettings'
import { useUiStore } from '../store/pos'
import { Button, IconButton, Spinner } from './ui'
import { toast } from '../lib/toast'
import { autoReconnect } from '../lib/bluetoothPrint'
import { ShiftSheet } from './shift/ShiftSheet'
import { CashSheet } from './shift/CashSheet'
import { PrinterSheet, useBtPrinter } from './shift/PrinterSheet'
import { TickerBar } from './TickerBar'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'POS', icon: ShoppingCart },
  { to: '/menu', label: 'Menu & Kategori', icon: UtensilsCrossed },
  { to: '/bahan', label: 'Bahan Baku', icon: Package },
  { to: '/keuangan', label: 'Keuangan', icon: Wallet },
  { to: '/pengaturan', label: 'Pengaturan', icon: SettingsIcon },
]

export function Layout({ children }: { children: React.ReactNode }) {
  useStockAlerts()
  const { settings } = useSettings()
  const { data: shift, isLoading } = useActiveShift()
  const [shiftSheet, setShiftSheet] = useState<'open' | 'close' | null>(null)
  const [cashSheet, setCashSheet] = useState<'in' | 'out' | null>(null)
  const [showPrinter, setShowPrinter] = useState(false)
  const closeShift = useCloseShift()
  const bt = useBtPrinter()
  const location = useLocation()
  const setHistoryOpen = useUiStore((s) => s.setHistoryOpen)

  /** Klik ikon printer: coba sambung ulang otomatis; gagal → buka dialog pairing */
  const handlePrinterClick = async () => {
    const res = await autoReconnect()
    if (res === 'connected') {
      toast.success('Printer tersambung kembali')
      return
    }
    if (res === 'failed') toast.error('Koneksi printer terputus — hubungkan ulang')
    setShowPrinter(true)
  }

  const handleCloseShift = (counted: number) => {
    if (!shift) return
    closeShift.mutate(
      { shiftId: shift.id, counted },
      {
        onSuccess: () => toast.success('Shift ditutup'),
        onError: (e: Error) => toast.error(e.message),
      },
    )
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* ============ SIDEBAR (tablet ≥ md) ============ */}
      <aside
        className="hidden w-20 shrink-0 flex-col items-center gap-1 border-r border-slate-200 bg-white py-4 dark:border-slate-800 dark:bg-slate-900 md:flex"
        aria-label="Navigasi utama"
      >
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900" aria-hidden>
          <ShoppingCart size={20} />
        </div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            aria-label={n.label}
            title={n.label}
            className={({ isActive }) =>
              `flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                isActive ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`
            }
          >
            <n.icon size={22} aria-hidden />
          </NavLink>
        ))}
      </aside>

      {/* ============ MAIN ============ */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ============ TOPBAR ============ */}
        <header
          className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 md:px-5"
          style={{ paddingTop: 'var(--sat)' }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white md:hidden dark:bg-white dark:text-slate-900" aria-hidden>
              <ShoppingCart size={18} />
            </div>
            <span className="truncate text-sm font-bold md:text-base">{settings?.business_name || 'Kasir POS'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {isLoading ? (
              <Spinner className="scale-75" />
            ) : (
              <>
                {shift && (
                  <span className="hidden items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-800 sm:inline-flex dark:bg-green-900/40 dark:text-green-300">
                    <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
                    Shift aktif
                  </span>
                )}
                {/* Riwayat transaksi — hanya di halaman kasir */}
                {location.pathname === '/pos' && (
                  <IconButton label="Riwayat transaksi" variant="secondary" onClick={() => setHistoryOpen(true)}>
                    <History size={18} aria-hidden />
                  </IconButton>
                )}
                {/* Printer Bluetooth: hijau = terhubung, merah = belum/terputus. Klik = auto reconnect */}
                <IconButton
                  label={bt.connected ? `Printer terhubung: ${bt.name}` : 'Printer belum terhubung — klik untuk sambung ulang'}
                  variant={bt.connected ? 'success' : 'danger'}
                  onClick={handlePrinterClick}
                >
                  <Printer size={18} aria-hidden />
                </IconButton>
                {shift && (
                  <>
                    <IconButton label="Cash In / Cash Out" variant="secondary" onClick={() => setCashSheet('in')}>
                      <Coins size={18} aria-hidden />
                    </IconButton>
                    <IconButton label="Tutup Shift" variant="secondary" onClick={() => setShiftSheet('close')}>
                      <Lock size={18} aria-hidden />
                    </IconButton>
                  </>
                )}
                {!shift && (
                  <Button size="sm" onClick={() => setShiftSheet('open')}>
                    <LogIn size={16} aria-hidden /> Buka Shift
                  </Button>
                )}
              </>
            )}
          </div>
        </header>

        <main id="main" className="min-h-0 flex-1 overflow-y-auto">{children}</main>

        {/* Running text: stok kritis + promo — in-flow, tidak menutupi keranjang */}
        <TickerBar />

        {/* ============ BOTTOM NAV (ponsel) ============ */}
        <nav
          className="flex shrink-0 items-stretch justify-around border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:hidden"
          style={{ paddingBottom: 'var(--sab)' }}
          aria-label="Navigasi utama"
        >
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              aria-label={n.label}
              className={({ isActive }) =>
                `flex min-h-[56px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 ${
                  isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              <n.icon size={22} aria-hidden />
              <span className="max-w-[64px] truncate text-[10px] font-medium">{n.label.split(' ')[0]}</span>
              <span className="sr-only">{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Sheets */}
      <ShiftSheet mode={shiftSheet === 'close' ? 'close' : 'open'} open={shiftSheet !== null} onClose={() => setShiftSheet(null)} />
      <CashSheet mode={cashSheet === 'out' ? 'out' : 'in'} open={cashSheet !== null} onClose={() => setCashSheet(null)} onSwitchMode={(m) => setCashSheet(m)} />

      {/* Dialog printer Bluetooth */}
      {showPrinter && settings && (
        <PrinterSheet open={showPrinter} onClose={() => setShowPrinter(false)} settings={settings} />
      )}
    </div>
  )
}
