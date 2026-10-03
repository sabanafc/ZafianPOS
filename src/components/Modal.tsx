import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }

/** Elemen yang bisa menerima fokus di dalam modal */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Modal di desktop/tablet, bottom sheet di ponsel.
 *  Focus trap penuh (Tab/Shift+Tab tetap di dalam), Esc menutup, scroll latar dikunci. */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const root = ref.current
    const prev = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab' || !root) return
      // daftar elemen fokus yang benar-benar terlihat
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.getClientRects().length > 0)
      if (nodes.length === 0) { e.preventDefault(); return }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement as HTMLElement | null
      const inside = !!active && root.contains(active)
      if (e.shiftKey) {
        if (!inside || active === first) { e.preventDefault(); last.focus() }
      } else if (!inside || active === last) {
        e.preventDefault(); first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    // pindahkan fokus ke elemen pertama di dalam modal
    root?.querySelector<HTMLElement>('input,select,textarea,button:not([aria-label="Tutup"])')?.focus()

    // kunci scroll latar selama modal terbuka
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      prev?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  const maxW = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl'

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Tutup dialog" tabIndex={-1} className="absolute inset-0 bg-slate-950/50 animate-overlay" onClick={onClose} />
      <div
        ref={ref}
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-card border border-line bg-surface shadow-pop animate-sheet-up sm:animate-scale-in sm:rounded-card ${maxW}`}
        style={{ paddingBottom: 'max(0px, var(--sab))' }}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            aria-label="Tutup" title="Tutup" onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-btn text-muted hover:bg-surface-2"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}
