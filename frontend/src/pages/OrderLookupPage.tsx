import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, Search } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router'
import { z } from 'zod'
import { OrderSummary } from '../features/orders/OrderSummary'
import { ApiError } from '../services/api'
import { lookupOrder } from '../services/orders'
import { STATUS_LABELS, type OrderLookup, type OrderStatus } from '../types/order'

const lookupSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^ARC-\d{1,10}$/, 'El código se ve así: ARC-1001'),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, ''))
    .refine((d) => /^(3\d{9}|60\d{8})$/.test(d), 'Escribe el celular con el que hiciste el pedido'),
})

const inputClass =
  'mt-1.5 w-full rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-cream-50 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none'

const STATUS_STYLE: Record<OrderStatus, string> = {
  PENDIENTE: 'bg-amber-400/15 text-amber-200',
  CONFIRMADO: 'bg-sky-400/15 text-sky-200',
  EN_PREPARACION: 'bg-sky-400/15 text-sky-200',
  LISTO: 'bg-emerald-400/15 text-emerald-200',
  EN_CAMINO: 'bg-emerald-400/15 text-emerald-200',
  ENTREGADO: 'bg-emerald-500/20 text-emerald-200',
  CANCELADO: 'bg-red-500/15 text-red-300',
}

export function OrderLookupPage() {
  const [params] = useSearchParams()
  const [result, setResult] = useState<OrderLookup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof lookupSchema>, unknown, z.output<typeof lookupSchema>>({
    resolver: zodResolver(lookupSchema),
    defaultValues: { code: params.get('codigo') ?? '' },
  })

  const onSubmit = handleSubmit(async ({ code, phone }) => {
    setError(null)
    setResult(null)
    try {
      setResult(await lookupOrder(code, phone))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos consultar el pedido')
    }
  })

  return (
    <div className="mx-auto max-w-lg px-4 pt-10 pb-16">
      <h1 className="text-3xl font-black text-cream-50">Consultar pedido</h1>
      <p className="mt-1 text-sm text-cream-300">Escribe el código de tu pedido y el celular que usaste al pedir.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4 rounded-2xl border border-ink-700 bg-ink-800 p-5">
        <label className="block text-sm font-medium text-cream-100">
          Código del pedido
          <input placeholder="ARC-1001" autoCapitalize="characters" className={inputClass} {...register('code')} />
          {errors.code && <span className="mt-1 block text-xs text-red-400">{errors.code.message}</span>}
        </label>
        <label className="block text-sm font-medium text-cream-100">
          Celular
          <input type="tel" inputMode="tel" placeholder="300 123 4567" className={inputClass} {...register('phone')} />
          {errors.phone && <span className="mt-1 block text-xs text-red-400">{errors.phone.message}</span>}
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3 font-bold text-ink-900 hover:bg-brand-400 disabled:opacity-60"
        >
          {isSubmitting ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Search className="size-5" aria-hidden />}
          Consultar
        </button>
        {error && (
          <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </form>

      {result && (
        <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-800 p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black text-cream-50">{result.code}</h2>
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${STATUS_STYLE[result.status]}`}>{STATUS_LABELS[result.status]}</span>
          </div>
          <p className="mt-1 mb-4 text-xs text-cream-300">
            {new Date(result.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
            {result.fulfillment === 'DOMICILIO' ? 'Domicilio' : 'Recoger en el local'}
          </p>
          <OrderSummary order={result} />
        </section>
      )}
    </div>
  )
}
