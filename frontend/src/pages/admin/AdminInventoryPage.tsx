import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, History, Scale } from 'lucide-react'
import { useState } from 'react'
import { Alert, Button, Empty, Field, Loading, PageHeader, Panel, Select, TextInput } from '../../components/admin/ui'
import { useIsAdmin } from '../../features/auth/useIsAdmin'
import { formatDateTime } from '../../lib/format'
import { useAdminData } from '../../hooks/useAdminData'
import { adminApi, errorMessage } from '../../services/admin'
import type { InventoryItem, MovementType } from '../../types/admin'

const MOVEMENT_LABELS: Record<MovementType, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  AJUSTE: 'Ajuste',
  PEDIDO: 'Pedido confirmado',
  REVERSION_PEDIDO: 'Pedido cancelado',
}

export function AdminInventoryPage() {
  const isAdmin = useIsAdmin()
  const inventory = useAdminData(() => adminApi.inventory(), [])
  const [historyFor, setHistoryFor] = useState<string>('')
  const movements = useAdminData(() => adminApi.movements(historyFor || undefined), [historyFor])
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const afterMovement = (text: string) => {
    setNotice({ tone: 'success', text })
    inventory.reload()
    movements.reload()
  }

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title="Inventario"
        description="Existencias por producto terminado. Se descuentan al CONFIRMAR un pedido y se devuelven si se cancela."
      />
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Existencias">
          {inventory.status === 'error' && <Alert tone="error">{inventory.error}</Alert>}
          {!inventory.data && inventory.status === 'loading' && <Loading />}
          {inventory.data && inventory.data.length === 0 && (
            <Empty icon={Boxes} title="Ningún producto controla inventario todavía">
              {isAdmin ? 'Actívalo abajo o desde la ficha del producto (por ejemplo, para las bebidas).' : 'Un administrador puede activarlo por producto.'}
            </Empty>
          )}
          {inventory.data && inventory.data.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs tracking-wide text-cream-300 uppercase">
                <tr>
                  <th className="pb-2 font-semibold">Producto</th>
                  <th className="pb-2 text-right font-semibold">Actual</th>
                  <th className="pb-2 text-right font-semibold">Mínimo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {inventory.data.map((item) => (
                  <tr key={item.productId} className={item.isActive ? '' : 'opacity-60'}>
                    <td className="py-2.5">
                      <button type="button" onClick={() => setHistoryFor(item.productId)} className="text-left text-cream-50 hover:text-brand-400">
                        {item.productName}
                      </button>
                      <span className="block text-xs text-cream-300">{item.categoryName}</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {item.lowStock ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-300">
                          <AlertTriangle className="size-3.5" aria-hidden />
                          {item.stockQuantity}
                          <span className="sr-only">(stock bajo)</span>
                        </span>
                      ) : (
                        <span className="font-bold text-cream-50">{item.stockQuantity}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-cream-300 tabular-nums">{item.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <div className="space-y-6">
          {inventory.data && inventory.data.length > 0 && (
            <MovementForm items={inventory.data} onDone={afterMovement} onError={(text) => setNotice({ tone: 'error', text })} />
          )}
          {isAdmin && <EnableTracking onEnabled={(name) => afterMovement(`Inventario activado para ${name}. Registra una entrada con las existencias contadas.`)} />}
        </div>
      </div>

      <Panel
        title="Historial de movimientos"
        actions={
          <Select value={historyFor} onChange={(e) => setHistoryFor(e.target.value)} aria-label="Filtrar historial por producto" className="mt-0 w-auto py-1.5 text-xs">
            <option value="">Todos los productos</option>
            {inventory.data?.map((i) => (
              <option key={i.productId} value={i.productId}>
                {i.productName}
              </option>
            ))}
          </Select>
        }
      >
        {!movements.data && movements.status === 'loading' && <Loading />}
        {movements.data && movements.data.length === 0 && <Empty icon={History} title="Sin movimientos registrados" />}
        {movements.data && movements.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs tracking-wide text-cream-300 uppercase">
                <tr>
                  <th className="pb-2 font-semibold">Fecha</th>
                  <th className="pb-2 font-semibold">Producto</th>
                  <th className="pb-2 font-semibold">Tipo</th>
                  <th className="pb-2 text-right font-semibold">Cambio</th>
                  <th className="pb-2 text-right font-semibold">Queda</th>
                  <th className="pb-2 pl-4 font-semibold">Motivo · Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {movements.data.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 text-xs whitespace-nowrap text-cream-300">{formatDateTime(m.createdAt)}</td>
                    <td className="py-2 text-cream-100">{m.productName}</td>
                    <td className="py-2 text-cream-100">{MOVEMENT_LABELS[m.type]}</td>
                    <td className={`py-2 text-right font-semibold tabular-nums ${m.quantityChange < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                      {m.quantityChange > 0 ? '+' : ''}
                      {m.quantityChange}
                    </td>
                    <td className="py-2 text-right text-cream-50 tabular-nums">{m.quantityAfter}</td>
                    <td className="py-2 pl-4 text-xs text-cream-300">
                      {m.reason}
                      {m.orderCode && ` (${m.orderCode})`} · {m.createdBy ?? 'Sistema'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

const TYPES = [
  { value: 'ENTRADA', label: 'Entrada', icon: ArrowDownToLine, help: 'Suma unidades (compra, reposición).' },
  { value: 'SALIDA', label: 'Salida', icon: ArrowUpFromLine, help: 'Resta unidades (daño, consumo interno, merma).' },
  { value: 'AJUSTE', label: 'Ajuste', icon: Scale, help: 'Fija la cantidad exacta contada físicamente.' },
] as const

function MovementForm({ items, onDone, onError }: { items: InventoryItem[]; onDone: (text: string) => void; onError: (text: string) => void }) {
  const [productId, setProductId] = useState(items[0]?.productId ?? '')
  const [type, setType] = useState<(typeof TYPES)[number]['value']>('ENTRADA')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const product = items.find((i) => i.productId === productId)
  const qty = Number(quantity)
  const validQty = Number.isInteger(qty) && (type === 'AJUSTE' ? qty >= 0 : qty > 0) && quantity !== ''
  const preview = product && validQty ? (type === 'ENTRADA' ? product.stockQuantity + qty : type === 'SALIDA' ? product.stockQuantity - qty : qty) : null

  return (
    <Panel title="Registrar movimiento">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!product || !validQty || reason.trim().length < 3) return
          setSaving(true)
          try {
            const result = await adminApi.createMovement({ productId, type, quantity: qty, reason: reason.trim() })
            onDone(`${product.productName}: ${result.quantityBefore} → ${result.quantityAfter} unidades.`)
            setQuantity('')
            setReason('')
          } catch (err) {
            onError(errorMessage(err))
          } finally {
            setSaving(false)
          }
        }}
      >
        <Field label="Producto">
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {items.map((i) => (
              <option key={i.productId} value={i.productId}>
                {i.productName} ({i.stockQuantity})
              </option>
            ))}
          </Select>
        </Field>
        <div role="radiogroup" aria-label="Tipo de movimiento" className="grid grid-cols-3 gap-2">
          {TYPES.map((t) => (
            <label
              key={t.value}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-ink-600 bg-ink-800 p-2 text-xs font-semibold text-cream-100 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-500/10"
            >
              <input type="radio" name="type" className="sr-only" checked={type === t.value} onChange={() => setType(t.value)} />
              <t.icon className="size-4 text-brand-500" aria-hidden />
              {t.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-cream-300">{TYPES.find((t) => t.value === type)!.help}</p>
        <Field label={type === 'AJUSTE' ? 'Cantidad contada' : 'Unidades'}>
          <TextInput type="number" min={type === 'AJUSTE' ? 0 : 1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Motivo">
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: compra a proveedor, conteo del lunes" />
        </Field>
        {preview !== null && (
          <p className={`text-sm ${preview < 0 ? 'text-red-300' : 'text-cream-300'}`}>
            Quedarán <strong className="text-cream-50">{preview}</strong> unidades{preview < 0 ? ' — no se permite stock negativo' : ''}.
          </p>
        )}
        <Button type="submit" variant="primary" loading={saving} disabled={!validQty || reason.trim().length < 3 || (preview !== null && preview < 0)} className="w-full">
          Registrar
        </Button>
      </form>
    </Panel>
  )
}

// Activa el control de inventario para un producto que hoy no lo tiene.
function EnableTracking({ onEnabled }: { onEnabled: (name: string) => void }) {
  const products = useAdminData(() => adminApi.products({ status: 'active' }), [])
  const [productId, setProductId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const untracked = products.data?.filter((p) => !p.trackStock) ?? []

  return (
    <Panel title="Activar inventario en un producto">
      <p className="mb-3 text-xs text-cream-300">
        Úsalo para productos que se cuentan por unidad (bebidas, empacados). Al activarlo empieza en 0 y se muestra agotado hasta registrar una entrada.
      </p>
      {error && (
        <div className="mb-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <div className="flex gap-2">
        <Select value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Producto" className="mt-0">
          <option value="">Elige un producto</option>
          {untracked.map((p) => (
            <option key={p.id} value={p.id}>
              {p.categoryName} · {p.name}
            </option>
          ))}
        </Select>
        <Button
          disabled={!productId}
          onClick={async () => {
            setError(null)
            try {
              const updated = await adminApi.updateProduct(productId, { trackStock: true })
              setProductId('')
              products.reload()
              onEnabled(updated.name)
            } catch (err) {
              setError(errorMessage(err))
            }
          }}
        >
          Activar
        </Button>
      </div>
    </Panel>
  )
}
