import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ArrowLeft, Bike, LoaderCircle, Send, Store } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, Navigate } from 'react-router'
import { STATIC_MODE } from '../config/mode'
import { useCart } from '../features/cart/cart-context'
import { toQuoteItems } from '../features/cart/cart-logic'
import { useCartQuote } from '../features/cart/useCartQuote'
import { checkoutSchema, type CheckoutInput, type CheckoutValues } from '../features/orders/checkout-schema'
import { idempotencyKeyFor, resetIdempotencyKey } from '../features/orders/idempotency'
import { saveLastOrder } from '../features/orders/last-order'
import { useSettings } from '../hooks/useCatalog'
import { formatCOP } from '../lib/format'
import { ApiError } from '../services/api'
import { createOrder, type CreateOrderBody } from '../services/orders'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-cream-50 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none aria-[invalid=true]:border-red-400'

const toCents = (v: string) => Math.round(Number(v) * 100)

export function CheckoutPage() {
  const cart = useCart()
  const settings = useSettings()
  const { state: quoteState, retry: requote } = useCartQuote()
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Pedido ya creado: evita que, al vaciarse el carrito, la página redirija al
  // carrito antes de que termine la navegación a la confirmación.
  const [placedCode, setPlacedCode] = useState<string | null>(null)

  const s = settings.data
  const zones = s?.deliveryZones ?? []
  const fulfillmentOptions = [
    ...(s?.deliveryEnabled ? (['DOMICILIO'] as const) : []),
    ...(s?.pickupEnabled ? (['RECOGIDA'] as const) : []),
  ]

  const schema = useMemo(() => checkoutSchema({ requireZone: zones.length > 0 }), [zones.length])
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutInput, unknown, CheckoutValues>({
    resolver: zodResolver(schema),
    defaultValues: { fulfillment: fulfillmentOptions.length === 1 ? fulfillmentOptions[0] : undefined },
  })
  const fulfillment = useWatch({ control, name: 'fulfillment' })
  const zoneId = useWatch({ control, name: 'deliveryZoneId' })
  const zone = zones.find((z) => z.id === zoneId) ?? null

  if (placedCode) return <Navigate to={`/pedido/${placedCode}`} replace />
  // Sin productos no hay pedido que confirmar (por ejemplo, al volver atrás tras crear uno).
  if (cart.lines.length === 0 && !isSubmitting) return <Navigate to="/carrito" replace />

  const quote = quoteState.status === 'ok' ? quoteState.quote : null
  const subtotal = quote?.subtotal ?? cart.subtotal
  const deliveryFee = fulfillment === 'DOMICILIO' && zone ? zone.fee : null
  const total = ((toCents(subtotal) + (deliveryFee ? toCents(deliveryFee) : 0)) / 100).toFixed(2)
  const deliveryPending = fulfillment === 'DOMICILIO' && zones.length === 0

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    const body: CreateOrderBody = {
      fulfillment: values.fulfillment,
      deliveryZoneId: values.fulfillment === 'DOMICILIO' ? (values.deliveryZoneId ?? null) : null,
      customerName: values.customerName,
      customerPhone: values.customerPhone,
      deliveryAddress: values.fulfillment === 'DOMICILIO' ? values.deliveryAddress || null : null,
      deliveryReference: values.fulfillment === 'DOMICILIO' ? values.deliveryReference || null : null,
      notes: values.notes || null,
      items: toQuoteItems(cart.lines),
      ...(quote ? { expectedTotal: total } : {}),
    }
    try {
      const { order } = await createOrder(body, idempotencyKeyFor(body))
      saveLastOrder(order)
      resetIdempotencyKey()
      setPlacedCode(order.code)
      cart.clear()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PRICE_CHANGED') {
        requote()
        setSubmitError('Los precios o la disponibilidad cambiaron mientras pedías. Revisa el total actualizado y vuelve a enviar.')
      } else if (err instanceof ApiError && err.status === 0) {
        setSubmitError('No pudimos conectar con el servidor. Revisa tu conexión y vuelve a intentar: tu pedido no se duplicará.')
      } else if (err instanceof ApiError && err.status === 409 && err.code !== 'STORE_CLOSED') {
        requote()
        setSubmitError(`${err.message}. Revisa tu pedido en el carrito.`)
      } else {
        setSubmitError(err instanceof Error ? err.message : 'No pudimos registrar tu pedido')
      }
    }
  })

  const blocked = quoteState.status === 'issue' || s?.acceptingOrders === false || fulfillmentOptions.length === 0

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-16">
      <Link to="/carrito" className="inline-flex items-center gap-1.5 text-sm font-semibold text-cream-300 hover:text-brand-400">
        <ArrowLeft className="size-4" aria-hidden /> Volver al carrito
      </Link>
      <h1 className="mt-3 text-3xl font-black text-cream-50">Datos del pedido</h1>
      <p className="mt-1 text-sm text-cream-300">Solo lo necesario para preparar y entregar tu pedido.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">
          <fieldset className="rounded-2xl border border-ink-700 bg-ink-800 p-5">
            <legend className="px-1 text-sm font-bold text-cream-50">¿Cómo lo quieres recibir?</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {fulfillmentOptions.map((option) => {
                const Icon = option === 'DOMICILIO' ? Bike : Store
                return (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-ink-600 bg-ink-900 p-4 transition has-[:checked]:border-brand-500 has-[:checked]:bg-brand-500/10"
                  >
                    <input type="radio" value={option} {...register('fulfillment')} className="size-4 accent-brand-500" />
                    <Icon className="size-5 text-brand-500" aria-hidden />
                    <span>
                      <span className="block font-bold text-cream-50">{option === 'DOMICILIO' ? 'Domicilio' : 'Recoger en el local'}</span>
                      <span className="block text-xs text-cream-300">
                        {option === 'DOMICILIO'
                          ? zones.length > 0
                            ? 'Valor según tu zona'
                            : 'Valor del envío por confirmar'
                          : s?.address ?? 'En nuestro local'}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
            {fulfillmentOptions.length === 0 && s && (
              <p className="mt-2 text-sm text-red-300">En este momento no hay modalidades de entrega disponibles.</p>
            )}
            <FieldError message={errors.fulfillment?.message} />
          </fieldset>

          <fieldset className="space-y-4 rounded-2xl border border-ink-700 bg-ink-800 p-5">
            <legend className="px-1 text-sm font-bold text-cream-50">Tus datos</legend>
            <label className="block text-sm font-medium text-cream-100">
              Nombre
              <input autoComplete="name" className={inputClass} aria-invalid={!!errors.customerName} {...register('customerName')} />
              <FieldError message={errors.customerName?.message} />
            </label>
            <label className="block text-sm font-medium text-cream-100">
              Celular (WhatsApp)
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="300 123 4567"
                className={inputClass}
                aria-invalid={!!errors.customerPhone}
                {...register('customerPhone')}
              />
              <FieldError message={errors.customerPhone?.message} />
            </label>
          </fieldset>

          {fulfillment === 'DOMICILIO' && (
            <fieldset className="space-y-4 rounded-2xl border border-ink-700 bg-ink-800 p-5">
              <legend className="px-1 text-sm font-bold text-cream-50">Dirección de entrega</legend>
              {zones.length > 0 && (
                <label className="block text-sm font-medium text-cream-100">
                  Barrio o zona
                  <select className={inputClass} aria-invalid={!!errors.deliveryZoneId} defaultValue="" {...register('deliveryZoneId')}>
                    <option value="" disabled>
                      Elige tu zona
                    </option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} · {formatCOP(z.fee)}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.deliveryZoneId?.message} />
                  <span className="mt-1 block text-xs text-cream-300">¿No aparece tu zona? Por ahora no tenemos cobertura allí.</span>
                </label>
              )}
              <label className="block text-sm font-medium text-cream-100">
                Dirección
                <input
                  autoComplete="street-address"
                  placeholder="Ej.: Cra 27 #45-10, apto 301"
                  className={inputClass}
                  aria-invalid={!!errors.deliveryAddress}
                  {...register('deliveryAddress')}
                />
                <FieldError message={errors.deliveryAddress?.message} />
              </label>
              <label className="block text-sm font-medium text-cream-100">
                Referencia <span className="font-normal text-cream-300">(opcional)</span>
                <input placeholder="Ej.: edificio azul, frente al parque" className={inputClass} {...register('deliveryReference')} />
                <FieldError message={errors.deliveryReference?.message} />
              </label>
            </fieldset>
          )}

          <label className="block rounded-2xl border border-ink-700 bg-ink-800 p-5 text-sm font-bold text-cream-50">
            Observaciones del pedido <span className="font-normal text-cream-300">(opcional)</span>
            <textarea
              rows={2}
              placeholder="Ej.: salsas aparte, timbre dañado"
              className={`${inputClass} resize-none font-normal`}
              {...register('notes')}
            />
            <FieldError message={errors.notes?.message} />
          </label>
        </div>

        <aside className="rounded-2xl border border-ink-700 bg-ink-800 p-5 lg:sticky lg:top-24" aria-labelledby="checkout-summary">
          <h2 id="checkout-summary" className="text-lg font-black text-cream-50">
            Tu pedido
          </h2>
          <ul className="mt-3 space-y-2 border-b border-ink-600 pb-4 text-sm">
            {cart.lines.map((line) => (
              <li key={line.lineId} className="flex justify-between gap-3">
                <span className="text-cream-100">
                  {line.quantity} × {line.name}
                  {line.variantName && <span className="text-cream-300"> · {line.variantName}</span>}
                  {line.options.length > 0 && (
                    <span className="block text-xs text-cream-300">+ {line.options.map((o) => o.name).join(', ')}</span>
                  )}
                </span>
                <span className="shrink-0 font-semibold text-cream-50">{formatCOP(Number(line.unitPrice) * line.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-cream-300">Subtotal</dt>
              <dd className="font-semibold text-cream-50">{formatCOP(subtotal)}</dd>
            </div>
            {fulfillment === 'DOMICILIO' && (
              <div className="flex justify-between gap-3">
                <dt className="text-cream-300">Domicilio</dt>
                <dd className="text-right text-cream-50">{deliveryFee ? formatCOP(deliveryFee) : zones.length > 0 ? 'Elige tu zona' : 'Por confirmar'}</dd>
              </div>
            )}
          </dl>
          <div className="mt-4 flex items-baseline justify-between border-t border-ink-600 pt-4">
            <span className="font-bold text-cream-50">Total</span>
            <span className="text-2xl font-black text-brand-400">
              {formatCOP(total)}
              {deliveryPending && <span className="block text-right text-xs font-semibold text-cream-300">+ domicilio</span>}
            </span>
          </div>

          {submitError && (
            <p role="alert" className="mt-4 flex gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {submitError}
            </p>
          )}
          {quoteState.status === 'issue' && (
            <p className="mt-4 rounded-lg bg-amber-400/10 p-3 text-sm text-amber-200">
              {quoteState.issue.message}.{' '}
              <Link to="/carrito" className="font-semibold underline">
                Revisar carrito
              </Link>
            </p>
          )}
          {s?.acceptingOrders === false && (
            <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">En este momento no estamos recibiendo pedidos en línea.</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || blocked}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-4 font-bold text-ink-900 transition hover:bg-brand-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-cream-300"
          >
            {isSubmitting ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
            {isSubmitting ? (STATIC_MODE ? 'Preparando pedido…' : 'Registrando pedido…') : STATIC_MODE ? 'Continuar a WhatsApp' : 'Confirmar pedido'}
          </button>
          <p className="mt-3 text-center text-xs text-cream-300">
            En el siguiente paso envías el resumen por WhatsApp. El restaurante confirma tu pedido por ese medio.
          </p>
        </aside>
      </form>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <span role="alert" className="mt-1 block text-xs font-medium text-red-400">
      {message}
    </span>
  )
}
