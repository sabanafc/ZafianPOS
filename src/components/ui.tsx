import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Modal } from './Modal'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg' | 'xl'

const variantCls: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300 dark:disabled:bg-brand-900',
  secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800',
}
const sizeCls: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
  xl: 'h-14 px-6 text-base gap-2 rounded-2xl',
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size }

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'primary', size = 'md', className = '', children, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex select-none items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantCls[variant]} ${sizeCls[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})

interface IconBtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: Variant
  size?: Size
}
export const IconButton = forwardRef<HTMLButtonElement, IconBtnProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className = '', children, ...rest }, ref,
) {
  const box: Record<Size, string> = { sm: 'h-9 w-9 rounded-lg', md: 'h-11 w-11 rounded-xl', lg: 'h-12 w-12 rounded-xl', xl: 'h-14 w-14 rounded-2xl' }
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={`inline-flex select-none items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantCls[variant]} ${box[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-brand-600 ${className}`} size={22} aria-label="Memuat" />
}

export function Page({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4 md:px-8 md:pb-10" style={{ paddingTop: 'max(1rem, var(--sat))' }}>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
        {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900 ${className}`}>{children}</div>
}

export function Field({ label, children, hint, required }: { label: string; children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label} {required && <span className="text-red-600" aria-hidden>*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 text-slate-900 placeholder:text-slate-400 focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...rest }, ref) {
  return <input ref={ref} className={`h-11 ${inputCls} ${className}`} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className = '', children, ...rest }, ref) {
  return (
    <select ref={ref} className={`h-11 ${inputCls} ${className}`} {...rest}>
      {children}
    </select>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = '', ...rest }, ref) {
  return <textarea ref={ref} className={`min-h-[80px] py-2.5 ${inputCls} ${className}`} {...rest} />
})

/** Badge status kecil */
export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'brand' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    brand: 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}

/** Toggle switch dengan role switch WCAG */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

/* Modal utama ada di ./Modal.tsx — bottom sheet di ponsel + focus trap */

export function EmptyState({ icon, title, subtitle, action }: { icon: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800" aria-hidden>{icon}</div>
      <div>
        <p className="font-semibold">{title}</p>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Hapus', tone = 'danger' }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmLabel?: string; tone?: 'danger' | 'primary'
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Batal</Button>
          <Button variant={tone} className="flex-1" onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
    </Modal>
  )
}
