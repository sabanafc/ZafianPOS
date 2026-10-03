import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from './Modal'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg' | 'xl'

/**
 * Semua komponen di sini memakai token tema (`surface`, `line`, `ink`, `muted`,
 * `rounded-card`/`btn`/`field`, `shadow-card`) sehingga preset tema UI di
 * Pengaturan langsung mengubah tampilannya.
 */
const variantCls: Record<Variant, string> = {
  primary: 'border-transparent bg-brand-600 text-white shadow-btn hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300 dark:disabled:bg-brand-900',
  secondary: 'border-line bg-surface-2 text-ink hover:opacity-90 active:opacity-80',
  ghost: 'border-transparent text-muted hover:bg-surface-2 active:opacity-80',
  danger: 'border-transparent bg-red-600 text-white shadow-btn hover:bg-red-700 active:bg-red-800',
  success: 'border-transparent bg-green-600 text-white shadow-btn hover:bg-green-700 active:bg-green-800',
}
const sizeCls: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-btn',
  md: 'h-11 px-4 text-sm gap-2 rounded-btn',
  lg: 'h-12 px-5 text-base gap-2 rounded-btn',
  xl: 'h-14 px-6 text-base gap-2 rounded-card',
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size }

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'primary', size = 'md', className = '', children, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex select-none items-center justify-center border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantCls[variant]} ${sizeCls[size]} ${className}`}
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
  const box: Record<Size, string> = { sm: 'h-9 w-9 rounded-btn', md: 'h-11 w-11 rounded-btn', lg: 'h-12 w-12 rounded-btn', xl: 'h-14 w-14 rounded-card' }
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={`inline-flex select-none items-center justify-center border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantCls[variant]} ${box[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})

export interface SegmentedOption<T extends string | number> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

/**
 * Kontrol pilihan tersegmen (tab atau radio) — satu gaya untuk seluruh aplikasi.
 * - `kind="tabs"`  → role tablist/tab
 * - `kind="radio"` → role radiogroup/radio
 * - `full`   : tombol membagi rata lebar wadah
 * - `scroll` : wadah melebar penuh & bisa digeser horizontal (banyak pilihan)
 */
export function Segmented<T extends string | number>({
  value, onChange, options, label, kind = 'tabs', full = false, scroll = false, size = 'md', className = '',
}: {
  value: T
  onChange: (v: T) => void
  options: Array<SegmentedOption<T>>
  label?: string
  kind?: 'tabs' | 'radio'
  full?: boolean
  scroll?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const layout = full || scroll ? 'flex w-full' : 'inline-flex'
  const sizeCls = size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-10 px-3.5 text-sm'
  return (
    <div
      role={kind === 'tabs' ? 'tablist' : 'radiogroup'}
      aria-label={label}
      className={`${layout} gap-1 rounded-btn border border-line bg-surface-2 p-1 ${scroll ? 'no-scrollbar overflow-x-auto' : ''} ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)} type="button"
            role={kind === 'tabs' ? 'tab' : 'radio'}
            {...(kind === 'tabs' ? { 'aria-selected': active } : { 'aria-checked': active })}
            onClick={() => onChange(o.value)}
            className={`flex shrink-0 items-center justify-center gap-1.5 rounded-btn font-semibold transition-colors ${sizeCls} ${full ? 'flex-1' : ''} ${
              active ? 'bg-brand-600 text-white shadow-btn' : 'text-muted hover:text-ink'
            }`}
          >
            {o.icon}{o.label}
          </button>
        )
      })}
    </div>
  )
}

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
  return <div className={`rounded-card border border-line bg-surface shadow-card ${className}`}>{children}</div>
}

/**
 * Grid daftar kartu (1 → 2 → 3 kolom). Selalu dipakai bersama <GridCard>
 * supaya kartu dalam satu baris sama tinggi.
 */
export function CardGrid({ children, label, className = '' }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <ul aria-label={label} className={`grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 ${className}`}>
      {children}
    </ul>
  )
}

/**
 * Item di dalam <CardGrid>. Pembungkusnya meregangkan kartu setinggi barisnya,
 * jadi kartu satu baris tetap sejajar walau isinya beda panjang (mis. satu
 * kartu punya baris info tambahan).
 *
 * - `column` (default): isi menumpuk vertikal — beri `mt-auto` pada baris aksi
 *   agar menempel ke dasar kartu dan sejajar dengan kartu di sebelahnya.
 * - `column={false}`: kartu horizontal (mis. thumbnail + isi), mis. menu produk.
 */
export function GridCard({ children, column = true, className = '', cardClassName = '' }: { children: ReactNode; column?: boolean; className?: string; cardClassName?: string }) {
  return (
    <li className={`flex min-w-0 ${className}`}>
      <Card className={`w-full ${column ? 'flex flex-col' : ''} ${cardClassName}`}>{children}</Card>
    </li>
  )
}

export function Field({ label, children, hint, required }: { label: string; children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        {label} {required && <span className="text-red-600" aria-hidden>*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-field border border-line bg-surface px-3.5 text-ink placeholder:text-muted focus:border-brand-500'

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
    slate: 'bg-surface-2 text-muted',
    green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    brand: 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
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
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${checked ? 'border-transparent bg-brand-600' : 'border-line bg-surface-2'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

/* Modal utama ada di ./Modal.tsx — bottom sheet di ponsel + focus trap */

export function EmptyState({ icon, title, subtitle, action }: { icon: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-card bg-surface-2 text-muted" aria-hidden>{icon}</div>
      <div>
        <p className="font-semibold">{title}</p>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
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
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  )
}
