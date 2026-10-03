import { useSyncExternalStore, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'info'
interface ToastItem { id: number; kind: ToastKind; msg: string }

let items: ToastItem[] = []
let listeners: Array<() => void> = []
let nextId = 1

function emit() { listeners.forEach((l) => l()) }

export function toast(kind: ToastKind, msg: string) {
  const id = nextId++
  items = [...items, { id, kind, msg }]
  emit()
  setTimeout(() => {
    items = items.filter((t) => t.id !== id)
    emit()
  }, 3500)
}

toast.success = (m: string) => toast('success', m)
toast.error = (m: string) => toast('error', m)
toast.info = (m: string) => toast('info', m)

export function Toasts() {
  const list = useSyncExternalStore(
    (cb) => { listeners.push(cb); return () => { listeners = listeners.filter((l) => l !== cb) } },
    () => items,
  )
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[100] flex flex-col items-center gap-2 px-3" style={{ paddingTop: 'var(--sat)' }} role="status" aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink shadow-pop animate-fade-up"
        >
          {t.kind === 'success' && <CheckCircle2 size={18} className="shrink-0 text-green-600" aria-hidden />}
          {t.kind === 'error' && <AlertTriangle size={18} className="shrink-0 text-red-600" aria-hidden />}
          {t.kind === 'info' && <Info size={18} className="shrink-0 text-brand-600" aria-hidden />}
          <span className="min-w-0 flex-1">{t.msg}</span>
        </div>
      ))}
    </div>
  )
}
