import { create } from 'zustand'
import type { Channel } from '../types'

/** UI state kecil yang dibagi antara topbar (Layout) dan halaman POS */
interface UiState {
  historyOpen: boolean
  setHistoryOpen: (v: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  historyOpen: false,
  setHistoryOpen: (v) => set({ historyOpen: v }),
}))

export interface CartLine { productId: string; name: string; price: number; qty: number; image_url: string | null }

export interface HeldOrder {
  id: string
  channel: Channel
  lines: CartLine[]
  discount: number
  note: string
  heldAt: number
}

interface PosState {
  channel: Channel
  lines: CartLine[]
  discount: number
  note: string
  held: HeldOrder[]
  activeHoldId: string | null
  setChannel: (c: Channel) => void
  add: (p: { id: string; name: string; price: number; image_url: string | null }) => void
  setQty: (productId: string, qty: number) => void
  remove: (productId: string) => void
  clear: () => void
  setDiscount: (d: number) => void
  setNote: (n: string) => void
  holdOrder: () => string | null
  resumeHold: (id: string) => void
  deleteHold: (id: string) => void
  replaceHeld: (list: HeldOrder[]) => void
}

const LS_KEY = 'pos-held-orders'

const loadHeld = (): HeldOrder[] => {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as HeldOrder[]) : []
  } catch {
    return []
  }
}

const saveHeld = (list: HeldOrder[]) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 10)))
  } catch { /* storage penuh — abaikan */ }
}

export const usePosStore = create<PosState>((set, get) => ({
  channel: 'dine_in',
  lines: [],
  discount: 0,
  note: '',
  held: loadHeld(),
  activeHoldId: null,

  setChannel: (channel) => set({ channel }),

  add: (p) =>
    set((s) => {
      const existing = s.lines.find((l) => l.productId === p.id)
      if (existing) {
        return { lines: s.lines.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l)) }
      }
      return { lines: [...s.lines, { productId: p.id, name: p.name, price: p.price, qty: 1, image_url: p.image_url }] }
    }),

  setQty: (productId, qty) =>
    set((s) => ({
      lines: qty <= 0 ? s.lines.filter((l) => l.productId !== productId) : s.lines.map((l) => (l.productId === productId ? { ...l, qty } : l)),
    })),

  remove: (productId) => set((s) => ({ lines: s.lines.filter((l) => l.productId !== productId) })),

  clear: () => set({ lines: [], discount: 0, note: '', activeHoldId: null }),

  setDiscount: (discount) => set({ discount: Math.max(0, discount) }),

  setNote: (note) => set({ note }),

  holdOrder: () => {
    const s = get()
    if (s.lines.length === 0) return null
    const id = `hold-${Date.now()}`
    const entry: HeldOrder = { id, channel: s.channel, lines: s.lines, discount: s.discount, note: s.note, heldAt: Date.now() }
    const held = [entry, ...s.held].slice(0, 10)
    saveHeld(held)
    set({ held, lines: [], discount: 0, note: '', activeHoldId: null })
    return id
  },

  resumeHold: (id) => {
    const s = get()
    const target = s.held.find((h) => h.id === id)
    if (!target) return
    // jika keranjang aktif berisi item, tahan dulu secara otomatis
    let held = s.held
    if (s.lines.length > 0) {
      const autoId = `hold-${Date.now()}`
      held = [{ id: autoId, channel: s.channel, lines: s.lines, discount: s.discount, note: s.note, heldAt: Date.now() }, ...s.held.filter((h) => h.id !== id)].slice(0, 10)
    } else {
      held = s.held.filter((h) => h.id !== id)
    }
    saveHeld(held)
    set({ held, lines: target.lines, discount: target.discount, note: target.note, channel: target.channel, activeHoldId: id })
  },

  deleteHold: (id) => {
    const held = get().held.filter((h) => h.id !== id)
    saveHeld(held)
    set({ held })
  },

  replaceHeld: (list) => {
    saveHeld(list)
    set({ held: list })
  },
}))
