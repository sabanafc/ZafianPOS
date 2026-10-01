import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }

/** Modal di desktop/tablet, bottom sheet di ponsel. Focus trap + Esc. */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.activeElement as HTMLElement | null
    // pindahkan fokus ke elemen pertama di dalam modal
    const focusable = ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not([aria-label="Tutup"])')
    focusable?.focus()
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [open, onClose])

  if (!open) return null
  const maxW = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl'

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Tutup dialog" className="absolute inset-0 bg-slate-950/50 animate-overlay" onClick={onClose} />
      <div
        ref={ref}
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-white shadow-pop animate-sheet-up sm:animate-scale-in sm:rounded-3xl dark:bg-slate-900 ${maxW}`}
        style={{ paddingBottom: 'max(0px, var(--sab))' }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            aria-label="Tutup" title="Tutup" onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">{footer}</div>}
      </div>
    </div>
  )
}
