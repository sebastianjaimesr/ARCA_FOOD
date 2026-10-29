import { AnimatePresence, m } from 'framer-motion'
import { AlertTriangle, ArrowLeft, Info, LoaderCircle, Pencil, RefreshCw, ShoppingBag, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { CategoryArt } from '../components/brand/CategoryArt'
import { EmptyState } from '../components/ui/EmptyState'
import { QuantityStepper } from '../components/ui/QuantityStepper'
import { useCart } from '../features/cart/cart-context'
import type { CartLine } from '../features/cart/cart-logic'
import { useCartQuote, type CartIssue } from '../features/cart/useCartQuote'
import { ProductSheet } from '../features/products/ProductSheet'
import { useProducts, useSettings } from '../hooks/useCatalog'
import { formatCOP } from '../lib/format'

export function CartPage() {
  const cart = useCart()
  const products = useProducts()
  const settings = useSettings()
  const { state, retry } = useCartQuote()
  const [editing, setEditing] = useState<CartLine | null>(null)
  const editingProduct = editing ? (products.data?.find((p) => p.id === editing.productId) ?? null) : null

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="sr-only">Tu pedido</h1>
        <EmptyState icon={ShoppingBag} title="Tu pedido está vacío">
          <p>Agrega productos desde el menú para empezar.</p>
          <Link
            to="/menu"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 font-bold text-ink-900 hover:bg-brand-400"
          >
            Ver el menú
          </Link>
        </EmptyState>
      </div>
    )
  }

  const issue = state.status === 'issue' ? state.issue : null
  const issueLineId = issue ? lineIdForIssue(cart.lines, issue) : null
  const subtotal = state.status === 'ok' ? state.quote.subtotal : cart.subtotal
  const hasZones = (settings.data?.deliveryZones.length ?? 0) > 0
  const canContinue = state.status === 'ok' && settings.data?.acceptingOrders !== false

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-16">
      <Link to="/menu" className="inline-flex items-center gap-1.5 text-sm font-semibold text-cream-300 hover:text-brand-400">
        <ArrowLeft className="size-4" aria-hidden /> Seguir agregando
      </Link>
      <h1 className="mt-3 text-3xl font-black text-cream-50">Tu pedido</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="space-y-3">
          {state.status === 'ok' && state.priceChanges.length > 0 && (
            <Notice tone="info">
              Actualizamos el precio de: <strong>{state.priceChanges.join(', ')}</strong>. El total ya refleja los precios vigentes.
            </Notice>
          )}
          {issue && issueLineId === null && <Notice tone="warning">{issue.message}</Notice>}
          {state.status === 'network-error' && (
            <Notice tone="warning">
              {state.message}{' '}
              <button onClick={retry} className="inline-flex items-center gap-1 font-semibold underline">
                <RefreshCw className="size-3.5" aria-hidden /> Reintentar
              </button>
            </Notice>
          )}

          <h2 className="sr-only">Productos</h2>
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {cart.lines.map((line) => (
                <m.li
                  key={line.lineId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
                >
                  <CartLineItem
                    line={line}
                    issue={issueLineId === line.lineId ? issue : null}
                    canEdit={Boolean(products.data?.some((p) => p.id === line.productId && p.available))}
                    onEdit={() => setEditing(line)}
                    onQuantity={(q) => cart.setQuantity(line.lineId, q)}
                    onRemove={() => cart.remove(line.lineId)}
                  />
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>

        <aside className="rounded-2xl border border-ink-700 bg-ink-800 p-5 lg:sticky lg:top-24" aria-labelledby="summary-title">
          <h2 id="summary-title" className="text-lg font-black text-cream-50">
            Resumen
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-cream-300">Subtotal ({cart.count} {cart.count === 1 ? 'producto' : 'productos'})</dt>
              <dd className="font-semibold text-cream-50">{formatCOP(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-cream-300">Domicilio</dt>
              <dd className="text-right text-cream-300">{hasZones ? 'Según tu zona' : 'Por confirmar'}</dd>
            </div>
          </dl>
          <div className="mt-4 flex items-baseline justify-between border-t border-ink-600 pt-4">
            <span className="font-bold text-cream-50">Total productos</span>
            <span className="flex items-center gap-2 text-2xl font-black text-brand-400">
              {state.status === 'loading' && <LoaderCircle className="size-4 animate-spin text-cream-300" aria-label="Actualizando" />}
              {formatCOP(subtotal)}
            </span>
          </div>
          {!hasZones && (
            <p className="mt-2 text-xs text-cream-300">
              {settings.data?.deliveryNotes ?? 'Si pides a domicilio, el restaurante te confirma el valor del envío por WhatsApp.'}
            </p>
          )}

          {settings.data?.acceptingOrders === false && (
            <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">En este momento no estamos recibiendo pedidos en línea.</p>
          )}

          {canContinue ? (
            <Link
              to="/pedido"
              className="mt-5 block w-full rounded-full bg-brand-500 px-6 py-3.5 text-center font-bold text-ink-900 transition hover:bg-brand-400 active:scale-[0.98]"
            >
              Continuar con mis datos
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="mt-5 w-full cursor-not-allowed rounded-full bg-ink-700 px-6 py-3.5 font-bold text-cream-300"
            >
              {state.status === 'loading' ? 'Verificando precios…' : 'Continuar con mis datos'}
            </button>
          )}
          {issue && <p className="mt-2 text-center text-xs text-amber-300">Corrige el producto marcado para continuar.</p>}
        </aside>
      </div>

      <ProductSheet
        product={editingProduct}
        open={editing !== null}
        onClose={() => setEditing(null)}
        submitLabel="Guardar cambios"
        initial={
          editing
            ? { variantId: editing.variantId, optionIds: editing.options.map((o) => o.id), quantity: editing.quantity, notes: editing.notes }
            : undefined
        }
        onSubmit={(product, selection) => {
          if (editing) cart.update(editing.lineId, product, selection)
          setEditing(null)
        }}
      />
    </div>
  )
}

// El backend indica la línea (posición) o el producto con problema.
function lineIdForIssue(lines: CartLine[], issue: CartIssue): string | null {
  if (issue.lineIndex !== null) return lines[issue.lineIndex]?.lineId ?? null
  if (issue.productId) return lines.find((l) => l.productId === issue.productId)?.lineId ?? null
  return null
}

type CartLineItemProps = {
  line: CartLine
  issue: CartIssue | null
  canEdit: boolean
  onEdit: () => void
  onQuantity: (q: number) => void
  onRemove: () => void
}

function CartLineItem({ line, issue, canEdit, onEdit, onQuantity, onRemove }: CartLineItemProps) {
  const lineTotal = Number(line.unitPrice) * line.quantity
  return (
    <article
      className={`flex gap-4 rounded-2xl border bg-ink-800 p-4 ${issue ? 'border-amber-400/70' : 'border-ink-700'}`}
      aria-label={line.name}
    >
      <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-ink-900">
        <CategoryArt slug={line.categorySlug} className="size-10 text-brand-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-extrabold text-cream-50 uppercase">{line.name}</h3>
            {line.variantName && <p className="text-sm text-cream-100">{line.variantName}</p>}
          </div>
          <p className="shrink-0 font-bold text-cream-50">{formatCOP(lineTotal)}</p>
        </div>

        {line.options.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 text-xs text-cream-300">
            {line.options.map((o) => (
              <li key={o.id}>
                + {o.name} <span className="text-cream-100">{formatCOP(o.price)}</span>
              </li>
            ))}
          </ul>
        )}
        {line.notes && <p className="mt-1.5 text-xs text-cream-300 italic">“{line.notes}”</p>}
        <p className="mt-1.5 text-xs text-cream-300">{formatCOP(line.unitPrice)} c/u</p>

        {issue && (
          <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-amber-300" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {issue.code === 'PRODUCT_UNAVAILABLE' ? 'Este producto ya no está disponible. Quítalo para continuar.' : issue.message}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <QuantityStepper value={line.quantity} onChange={onQuantity} label={`Cantidad de ${line.name}`} size="sm" />
          {canEdit && (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-cream-100 hover:bg-ink-700"
            >
              <Pencil className="size-3.5" aria-hidden /> Editar
            </button>
          )}
          <button
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="size-3.5" aria-hidden /> Quitar
          </button>
        </div>
      </div>
    </article>
  )
}

function Notice({ tone, children }: { tone: 'info' | 'warning'; children: React.ReactNode }) {
  const Icon = tone === 'info' ? Info : AlertTriangle
  return (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
        tone === 'info' ? 'border-sky-500/30 bg-sky-500/10 text-sky-200' : 'border-amber-400/40 bg-amber-400/10 text-amber-200'
      }`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}
