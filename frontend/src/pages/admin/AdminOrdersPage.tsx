import { Bike, ChevronLeft, ChevronRight, ClipboardList, RefreshCw, Search, Store } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert, Button, Empty, Loading, PageHeader, StatusBadge, TextInput } from '../../components/admin/ui'
import { useAdminData } from '../../hooks/useAdminData'
import { formatCOP, formatDateTime } from '../../lib/format'
import { adminApi } from '../../services/admin'
import { STATUS_LABELS, type OrderStatus } from '../../types/order'

const STATUS_FILTERS: OrderStatus[] = ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO']
const PAGE_SIZE = 20

// Los filtros viven en la URL: se pueden compartir y sobreviven una recarga.
export function AdminOrdersPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('estado')?.split(',').filter((s): s is OrderStatus => STATUS_FILTERS.includes(s as OrderStatus)) ?? [])
  const from = params.get('desde') ?? ''
  const to = params.get('hasta') ?? ''
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('pagina')) || 1)
  const [search, setSearch] = useState(q)

  const orders = useAdminData(() => adminApi.orders({ status, from, to, q, page, pageSize: PAGE_SIZE }), [status, from, to, q, page], {
    refreshMs: 30_000,
  })

  const update = (changes: Record<string, string | null>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      if (!('pagina' in changes)) next.delete('pagina')
      return next
    })
  }

  const toggleStatus = (s: OrderStatus) => {
    const next = status.includes(s) ? status.filter((x) => x !== s) : [...status, s]
    update({ estado: next.join(',') || null })
  }

  const totalPages = orders.data ? Math.max(1, Math.ceil(orders.data.total / PAGE_SIZE)) : 1

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Pedidos"
        description="Se actualiza cada 30 segundos. Las fechas son en hora de Bogotá."
        actions={
          <Button onClick={orders.reload} loading={orders.status === 'loading' && !!orders.data}>
            <RefreshCw className="size-4" aria-hidden /> Actualizar
          </Button>
        }
      />

      <div className="mb-4 space-y-3 rounded-2xl border border-ink-700 bg-ink-900 p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
          <button
            type="button"
            onClick={() => update({ estado: null })}
            aria-pressed={status.length === 0}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status.length === 0 ? 'bg-brand-500 text-ink-900' : 'bg-ink-800 text-cream-100'}`}
          >
            Todos
          </button>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              aria-pressed={status.includes(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status.includes(s) ? 'bg-brand-500 text-ink-900' : 'bg-ink-800 text-cream-100'}`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              update({ q: search.trim() || null })
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 mt-0.5 size-4 -translate-y-1/2 text-cream-300" aria-hidden />
            <TextInput
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código (ARC-1001), nombre o celular"
              aria-label="Buscar pedidos"
              className="pl-9"
            />
          </form>
          <label className="flex items-center gap-2 text-xs text-cream-300">
            Desde
            <TextInput type="date" value={from} onChange={(e) => update({ desde: e.target.value || null })} className="mt-0 w-auto" />
          </label>
          <label className="flex items-center gap-2 text-xs text-cream-300">
            Hasta
            <TextInput type="date" value={to} onChange={(e) => update({ hasta: e.target.value || null })} className="mt-0 w-auto" />
          </label>
        </div>
      </div>

      {orders.status === 'error' && <Alert tone="error">{orders.error}</Alert>}
      {!orders.data && orders.status === 'loading' && <Loading />}

      {orders.data && orders.data.items.length === 0 && (
        <Empty icon={ClipboardList} title="No hay pedidos con estos filtros">
          Los pedidos de la tienda aparecen aquí apenas el cliente los registra.
        </Empty>
      )}

      {orders.data && orders.data.items.length > 0 && (
        <>
          {/* Tabla en pantallas grandes */}
          <div className="hidden overflow-hidden rounded-2xl border border-ink-700 md:block">
            <table className="w-full text-sm">
              <thead className="bg-ink-900 text-left text-xs tracking-wide text-cream-300 uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Pedido</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Entrega</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700 bg-ink-950">
                {orders.data.items.map((o) => (
                  <tr key={o.id} className="hover:bg-ink-900">
                    <td className="px-4 py-3">
                      <Link to={`/admin/pedidos/${o.id}`} className="font-bold text-brand-400 hover:underline">
                        {o.code}
                      </Link>
                      <span className="block text-xs text-cream-300">{formatDateTime(o.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3 text-cream-100">
                      {o.customerName}
                      <span className="block text-xs text-cream-300">{o.customerPhone}</span>
                    </td>
                    <td className="px-4 py-3 text-cream-100">
                      <span className="inline-flex items-center gap-1.5">
                        {o.fulfillment === 'DOMICILIO' ? <Bike className="size-4" aria-hidden /> : <Store className="size-4" aria-hidden />}
                        {o.fulfillment === 'DOMICILIO' ? (o.deliveryZoneName ?? 'Domicilio') : 'Recoge'}
                      </span>
                      <span className="block text-xs text-cream-300">{o.itemsCount} productos</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-cream-50 tabular-nums">{formatCOP(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas en el celular */}
          <ul className="space-y-2 md:hidden">
            {orders.data.items.map((o) => (
              <li key={o.id}>
                <Link to={`/admin/pedidos/${o.id}`} className="block rounded-2xl border border-ink-700 bg-ink-900 p-4 active:bg-ink-800">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-brand-400">{o.code}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3 text-sm">
                    <span className="text-cream-100">
                      {o.customerName}
                      <span className="block text-xs text-cream-300">
                        {formatDateTime(o.createdAt)} · {o.fulfillment === 'DOMICILIO' ? 'Domicilio' : 'Recoge'}
                      </span>
                    </span>
                    <span className="font-semibold text-cream-50">{formatCOP(o.total)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <nav aria-label="Páginas" className="mt-4 flex items-center justify-between text-sm text-cream-300">
            <span>
              {orders.data.total} pedidos · página {page} de {totalPages}
            </span>
            <span className="flex gap-2">
              <Button disabled={page <= 1} onClick={() => update({ pagina: String(page - 1) })} aria-label="Página anterior">
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button disabled={page >= totalPages} onClick={() => update({ pagina: String(page + 1) })} aria-label="Página siguiente">
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </span>
          </nav>
        </>
      )}
    </div>
  )
}
