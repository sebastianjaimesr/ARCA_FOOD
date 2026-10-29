import { AlertTriangle, CheckCircle2, LoaderCircle, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { STATUS_LABELS, type OrderStatus } from '../../types/order'

// Piezas visuales compartidas por las pantallas del panel administrativo.

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-black text-cream-50">{title}</h2>
        {description && <p className="mt-1 text-sm text-cream-300">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({ title, actions, children, className = '' }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-ink-700 bg-ink-900 ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-ink-700 px-5 py-3.5">
          {title && <h3 className="text-sm font-bold text-cream-50">{title}</h3>}
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function StatTile({ label, value, hint, icon: Icon }: { label: string; value: ReactNode; hint?: string; icon?: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-cream-300 uppercase">
        {Icon && <Icon className="size-4 text-brand-500" aria-hidden />}
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-cream-50 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-cream-300">{hint}</p>}
    </div>
  )
}

const STATUS_CLASS: Record<OrderStatus, string> = {
  PENDIENTE: 'bg-amber-400/15 text-amber-200 ring-amber-400/30',
  CONFIRMADO: 'bg-sky-400/15 text-sky-200 ring-sky-400/30',
  EN_PREPARACION: 'bg-violet-400/15 text-violet-200 ring-violet-400/30',
  LISTO: 'bg-teal-400/15 text-teal-200 ring-teal-400/30',
  EN_CAMINO: 'bg-blue-400/15 text-blue-200 ring-blue-400/30',
  ENTREGADO: 'bg-emerald-400/15 text-emerald-200 ring-emerald-400/30',
  CANCELADO: 'bg-red-500/15 text-red-300 ring-red-400/30',
}

// El estado siempre lleva texto: nunca se comunica solo con color.
export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ring-1 ${STATUS_CLASS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean }

const BUTTON_VARIANT = {
  primary: 'bg-brand-500 text-ink-900 hover:bg-brand-400',
  secondary: 'border border-ink-600 bg-ink-800 text-cream-50 hover:border-brand-500',
  danger: 'border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20',
  ghost: 'text-cream-100 hover:bg-ink-700',
}

export function Button({ variant = 'secondary', loading, children, className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANT[variant]} ${className}`}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

const fieldClass =
  'mt-1 w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-cream-50 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none aria-[invalid=true]:border-red-400'

type FieldWrapProps = { label: string; error?: string; hint?: string; children: ReactNode; className?: string }

export function Field({ label, error, hint, children, className = '' }: FieldWrapProps) {
  return (
    <label className={`block text-sm font-medium text-cream-100 ${className}`}>
      {label}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-cream-300">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-red-400">
          {error}
        </span>
      )}
    </label>
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className = '', ...props },
  ref,
) {
  return <input ref={ref} className={`${fieldClass} ${className}`} {...props} />
})

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className = '', ...props },
  ref,
) {
  return <textarea ref={ref} className={`${fieldClass} resize-y ${className}`} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = '', ...props },
  ref,
) {
  return <select ref={ref} className={`${fieldClass} ${className}`} {...props} />
})

type ToggleProps = { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; disabled?: boolean }

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <label className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span>
        <span className="block text-sm font-medium text-cream-50">{label}</span>
        {description && <span className="block text-xs text-cream-300">{description}</span>}
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="block h-6 w-11 rounded-full bg-ink-600 transition peer-checked:bg-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300" />
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-cream-50 transition peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

export function Alert({ tone, children }: { tone: 'error' | 'success' | 'warning'; children: ReactNode }) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle
  const cls = {
    error: 'border-red-500/40 bg-red-500/10 text-red-200',
    success: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
    warning: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${cls}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-cream-300">
      <LoaderCircle className="size-5 animate-spin text-brand-500" aria-hidden />
      {label}
    </div>
  )
}

export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-ink-600 px-6 py-10 text-center">
      <Icon className="size-8 text-ink-400" aria-hidden />
      <p className="mt-3 font-semibold text-cream-100">{title}</p>
      {children && <div className="mt-1 text-sm text-cream-300">{children}</div>}
    </div>
  )
}
