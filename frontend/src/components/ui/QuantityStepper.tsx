import { Minus, Plus } from 'lucide-react'
import { MAX_QUANTITY } from '../../features/cart/cart-logic'

type QuantityStepperProps = {
  value: number
  onChange: (value: number) => void
  label: string
  size?: 'sm' | 'md'
}

export function QuantityStepper({ value, onChange, label, size = 'md' }: QuantityStepperProps) {
  const button =
    size === 'sm'
      ? 'grid size-8 place-items-center rounded-full transition disabled:opacity-30'
      : 'grid size-10 place-items-center rounded-full transition disabled:opacity-30'
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1 rounded-full border border-ink-600 bg-ink-800 p-1">
      <button
        type="button"
        className={`${button} hover:bg-ink-700`}
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Quitar uno"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <span className={`min-w-8 text-center font-bold tabular-nums ${size === 'sm' ? 'text-sm' : ''}`} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={`${button} hover:bg-ink-700`}
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_QUANTITY}
        aria-label="Agregar uno"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}
