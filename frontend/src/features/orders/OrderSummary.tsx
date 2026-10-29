import { formatCOP } from '../../lib/format'
import type { OrderLookup } from '../../types/order'

// Resumen de un pedido ya registrado (precios del backend).
export function OrderSummary({ order }: { order: OrderLookup }) {
  const deliveryPending = order.fulfillment === 'DOMICILIO' && order.deliveryFee === null
  return (
    <div>
      <ul className="space-y-3 border-b border-ink-600 pb-4 text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span className="text-cream-100">
              <span className="font-semibold">
                {item.quantity} × {item.productName}
              </span>
              {item.variantName && <span className="text-cream-300"> · {item.variantName}</span>}
              {item.options.map((o) => (
                <span key={o.name} className="block text-xs text-cream-300">
                  + {o.name} ({formatCOP(o.price)})
                </span>
              ))}
              {item.notes && <span className="block text-xs text-cream-300 italic">“{item.notes}”</span>}
            </span>
            <span className="shrink-0 font-semibold text-cream-50">{formatCOP(item.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-cream-300">Subtotal</dt>
          <dd className="text-cream-50">{formatCOP(order.subtotal)}</dd>
        </div>
        {order.fulfillment === 'DOMICILIO' && (
          <div className="flex justify-between">
            <dt className="text-cream-300">Domicilio</dt>
            <dd className="text-cream-50">{deliveryPending ? 'Por confirmar' : formatCOP(order.deliveryFee!)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-ink-600 pt-3 text-base">
          <dt className="font-bold text-cream-50">Total</dt>
          <dd className="font-black text-brand-400">
            {formatCOP(order.total)}
            {deliveryPending && <span className="text-xs font-semibold text-cream-300"> + domicilio</span>}
          </dd>
        </div>
      </dl>
    </div>
  )
}
