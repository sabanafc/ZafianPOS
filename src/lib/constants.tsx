import { Cigarette, Car, Bike, UtensilsCrossed, ShoppingBag, Store, QrCode, Landmark, Banknote } from 'lucide-react'

export const CHANNELS = [
  { id: 'dine_in', label: 'Dine-in', short: 'Dine', icon: UtensilsCrossed, color: '#4f46e5' },
  { id: 'takeaway', label: 'Takeaway', short: 'Bungkus', icon: ShoppingBag, color: '#0891b2' },
  { id: 'gofood', label: 'GoFood', short: 'GoFood', icon: Bike, color: '#16a34a' },
  { id: 'grabfood', label: 'GrabFood', short: 'GrabFood', icon: Car, color: '#059669' },
  { id: 'shopeefood', label: 'ShopeeFood', short: 'Shopee', icon: Store, color: '#ea580c' },
] as const

export const PAYMENTS = [
  { id: 'cash', label: 'Tunai', icon: Banknote, color: '#16a34a' },
  { id: 'qris', label: 'QRIS', icon: QrCode, color: '#dc2626' },
  { id: 'transfer', label: 'Transfer', icon: Landmark, color: '#2563eb' },
] as const

export const FINANCE_CATEGORIES = {
  expense: ['bahan_baku', 'gaji', 'sewa', 'listrik_air', 'kemasan', 'transport', 'maintenance', 'pemasaran', 'lainnya'],
  income: ['penjualan_lain', 'modal', 'lainnya'],
} as const

export const FINANCE_LABELS: Record<string, string> = {
  bahan_baku: 'Bahan Baku', gaji: 'Gaji', sewa: 'Sewa', listrik_air: 'Listrik & Air',
  kemasan: 'Kemasan', transport: 'Transport', maintenance: 'Perawatan', pemasaran: 'Pemasaran',
  lainnya: 'Lainnya', penjualan_lain: 'Penjualan Lain', modal: 'Modal',
}

// Icon kecil untuk channel online
export const channelIcon = (id: string) => {
  const c = CHANNELS.find((x) => x.id === id)
  return c ? c.icon : Cigarette
}
