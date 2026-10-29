import { ArrowLeft, Ban, Bike, ChefHat, CircleCheckBig, MessageCircle, PackageCheck, Store, Truck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Alert, Button, Field, Loading, Panel, StatusBadge, TextArea } from '../../components/admin/ui'
import { useAdminData } from '../../hooks/useAdminData'
import { formatCOP, formatDateTime } from '../../lib/format'
import { adminApi, errorMessage } from '../../services/admin'
import type { AdminOrder } from '../../types/admin'
import { STATUS_LABELS, type OrderStatus } from '../../types/order'

// Acción de cada transición. Qué botones aparecen lo decide el backend
// (allowedTransitions); aquí solo está el texto.
const ACTIONS: Partial<Record<OrderStatus, { label: string; icon: typeof ChefHat; hint?: string }>> = {
  CONFIRMADO: { label: 'Confirmar pedido', icon: CircleCheckBig, hint: 'Al confirmar se descuentan las existencias de los productos con inventario.' },
  EN_PREPARACION: { label: 'Empezar preparación', icon: ChefHat },
  LISTO: { label: 'Marcar como listo', icon: PackageCheck },
  EN_CAMINO: { label: 'Enviar (en camino)', icon: Truck },
  ENTREGADO: { label: 'Marcar como entregado', icon: CircleCheckBig },
}

export function AdminOrderDetailPage() {
  const { id = '' } = useParams()
  const order = useAdminData(() => adminApi.order(id), [id], { refreshMs: 30_000 })

  return (
    <div className="max-w-5xl">
      <Link to="/admin/pedidos" className="inline-flex items-center gap-1.5 text-sm font-semibold text-cream-300 hover:text-brand-400">
        <ArrowLeft className="size-4" aria-hidden /> Pedidos
      </Link>
      {order.status === 'error' && !order.data && (
        <div className="mt-4">
          <Alert tone="error">{order.error}</Alert>
        </div>
      )}
      {!order.data && order.status === 'loading' && <Loading />}
      {order.data && <OrderDetail order={order.data} onChange={order.setData} />}
    </div>
  )
}

function OrderDetail({ order, onChange }: { order: AdminOrder; onChange: (o: AdminOrder) => void }) {
  const [busy, setBusy] = useState<OrderStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')

  const change = async (status: OrderStatus, note?: string) => {
    setBusy(status)
    setError(null)
    try {
      onChange(await adminApi.setOrderStatus(order.id, status, note))
      setCancelling(false)
      setReason('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const forward = order.allowedTransitions.filter((s) => s !== 'CANCELADO')
  const canCancel = order.allowedTransitions.includes('CANCELADO')
  const customerWa = `https://wa.me/57${order.customerPhone}`

  return (
    <div className="mt-3 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-3xl font-black text-cream-50">{order.code}</h2>
        <StatusBadge status={order.status} />
        <span className="text-sm text-cream-300">{formatDateTime(order.createdAt)}</span>
      </div>

      {(forward.length > 0 || canCancel) && (
        <Panel title="Siguiente paso">
          {error && (
            <div className="mb-3">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {forward.map((s) => {
              const action = ACTIONS[s]
              const Icon = action?.icon ?? CircleCheckBig
              return (
                <Button key={s} variant="primary" loading={busy === s} disabled={busy !== null} onClick={() => change(s)}>
                  <Icon className="size-4" aria-hidden />
                  {action?.label ?? STATUS_LABELS[s]}
                </Button>
              )
            })}
            {canCancel && !cancelling && (
              <Button variant="danger" disabled={busy !== null} onClick={() => setCancelling(true)}>
                <Ban className="size-4" aria-hidden /> Cancelar pedido
              </Button>
            )}
          </div>
          {forward.map((s) => ACTIONS[s]?.hint && <p key={s} className="mt-2 text-xs text-cream-300">{ACTIONS[s]!.hint}</p>)}
          {cancelling && (
            <form
              className="mt-4 space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (reason.trim().length >= 3) change('CANCELADO', reason.trim())
              }}
            >
              <Field label="Motivo de la cancelación" hint={order.stockApplied ? 'Las existencias descontadas se devolverán al inventario.' : undefined}>
                <TextArea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: el cliente no respondió" autoFocus />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" variant="danger" loading={busy === 'CANCELADO'} disabled={reason.trim().length < 3}>
                  Confirmar cancelación
                </Button>
                <Button variant="ghost" onClick={() => setCancelling(false)}>
                  Volver
                </Button>
              </div>
            </form>
          )}
        </Panel>
      )}
      {order.status === 'CANCELADO' && order.cancelReason && <Alert tone="warning">Cancelado: {order.cancelReason}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Productos">
          <ul className="divide-y divide-ink-700">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="text-sm">
                  <p className="font-bold text-cream-50">
                    {item.quantity} × {item.productName}
                    {item.variantName && <span className="font-normal text-cream-300"> · {item.variantName}</span>}
                  </p>
                  {item.options.map((o) => (
                    <p key={o.name} className="text-xs text-cream-300">
                      + {o.name} ({formatCOP(o.price)})
                    </p>
                  ))}
                  {item.notes && <p className="mt-1 text-xs text-amber-200">Nota: {item.notes}</p>}
                  <p className="mt-1 text-xs text-cream-300">{formatCOP(item.unitPrice)} c/u</p>
                </div>
                <p className="shrink-0 font-semibold text-cream-50 tabular-nums">{formatCOP(item.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-ink-700 pt-4 text-sm">
            <Row label="Subtotal">{formatCOP(order.subtotal)}</Row>
            {order.fulfillment === 'DOMICILIO' && (
              <Row label={`Domicilio${order.deliveryZoneName ? ` (${order.deliveryZoneName})` : ''}`}>
                {order.deliveryFee === null ? 'Por confirmar' : formatCOP(order.deliveryFee)}
              </Row>
            )}
            <Row label="Total" strong>
              {formatCOP(order.total)}
            </Row>
          </dl>
        </Panel>

        <div className="space-y-6">
          <Panel title="Cliente">
            <dl className="space-y-2 text-sm">
              <Row label="Nombre">{order.customerName}</Row>
              <Row label="Celular">
                <a href={customerWa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-400 hover:underline">
                  <MessageCircle className="size-3.5" aria-hidden /> {order.customerPhone}
                </a>
              </Row>
              <Row label="Entrega">
                <span className="inline-flex items-center gap-1.5">
                  {order.fulfillment === 'DOMICILIO' ? <Bike className="size-4" aria-hidden /> : <Store className="size-4" aria-hidden />}
                  {order.fulfillment === 'DOMICILIO' ? 'Domicilio' : 'Recoge en el local'}
                </span>
              </Row>
              {order.deliveryAddress && <Row label="Dirección">{order.deliveryAddress}</Row>}
              {order.deliveryReference && <Row label="Referencia">{order.deliveryReference}</Row>}
              {order.notes && <Row label="Observaciones">{order.notes}</Row>}
            </dl>
          </Panel>

          <Panel title="Historial">
            <ol className="space-y-3 text-sm">
              {order.history.map((h, i) => (
                <li key={i} className="relative border-l-2 border-ink-600 pl-4">
                  <span className="absolute top-1.5 -left-[5px] size-2 rounded-full bg-brand-500" aria-hidden />
                  <p className="font-semibold text-cream-50">{STATUS_LABELS[h.toStatus]}</p>
                  <p className="text-xs text-cream-300">
                    {formatDateTime(h.createdAt)} · {h.changedBy ?? 'Tienda en línea'}
                  </p>
                  {h.note && <p className="mt-0.5 text-xs text-cream-100">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={strong ? 'font-bold text-cream-50' : 'text-cream-300'}>{label}</dt>
      <dd className={`text-right ${strong ? 'text-lg font-black text-brand-400' : 'text-cream-50'}`}>{children}</dd>
    </div>
  )
}
