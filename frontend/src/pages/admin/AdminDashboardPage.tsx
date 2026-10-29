import { AlertTriangle, BarChart3, ChefHat, CircleCheckBig, Clock, PackageX, Receipt, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Alert, Empty, Loading, PageHeader, Panel, StatTile } from '../../components/admin/ui'
import { useAdminData } from '../../hooks/useAdminData'
import { formatCOP } from '../../lib/format'
import { adminApi } from '../../services/admin'
import type { DashboardStats, StatsRange } from '../../types/admin'

const RANGES: { value: StatsRange; label: string; period: string }[] = [
  { value: 'day', label: 'Hoy', period: 'hoy' },
  { value: 'week', label: 'Esta semana', period: 'esta semana (desde el lunes)' },
  { value: 'month', label: 'Este mes', period: 'este mes' },
]

export function AdminDashboardPage() {
  const [range, setRange] = useState<StatsRange>('day')
  const stats = useAdminData(() => adminApi.dashboard(range), [range], { refreshMs: 60_000 })
  const current = RANGES.find((r) => r.value === range)!

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Dashboard"
        description={`Cifras de ${current.period}, en hora de Bogotá. Se actualiza cada minuto.`}
        actions={
          <div role="group" aria-label="Periodo" className="inline-flex rounded-lg border border-ink-600 bg-ink-800 p-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                aria-pressed={range === r.value}
                onClick={() => setRange(r.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  range === r.value ? 'bg-brand-500 text-ink-900' : 'text-cream-300 hover:text-cream-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {stats.status === 'error' && <Alert tone="error">{stats.error}</Alert>}
      {!stats.data && stats.status === 'loading' && <Loading />}
      {stats.data && <DashboardContent stats={stats.data} />}
    </div>
  )
}

function DashboardContent({ stats }: { stats: DashboardStats }) {
  const { queue, received, sales } = stats
  const inKitchen = queue.EN_PREPARACION + queue.LISTO
  const hasSales = sales.deliveredOrders > 0

  return (
    <div className="space-y-6">
      {/* Cola operativa: pedidos activos de cualquier fecha. */}
      <section aria-labelledby="queue-title">
        <h3 id="queue-title" className="mb-3 text-xs font-bold tracking-[0.15em] text-cream-300 uppercase">
          Para atender ahora
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link to="/admin/pedidos?estado=PENDIENTE" className="rounded-2xl ring-brand-500 transition hover:ring-1">
            <StatTile label="Pendientes" value={queue.PENDIENTE} hint="Esperan confirmación" icon={Clock} />
          </Link>
          <Link to="/admin/pedidos?estado=CONFIRMADO" className="rounded-2xl ring-brand-500 transition hover:ring-1">
            <StatTile label="Confirmados" value={queue.CONFIRMADO} hint="Por empezar a preparar" icon={CircleCheckBig} />
          </Link>
          <Link to="/admin/pedidos?estado=EN_PREPARACION,LISTO" className="rounded-2xl ring-brand-500 transition hover:ring-1">
            <StatTile label="En cocina" value={inKitchen} hint={`${queue.EN_PREPARACION} preparando · ${queue.LISTO} listos`} icon={ChefHat} />
          </Link>
          <Link to="/admin/pedidos?estado=EN_CAMINO" className="rounded-2xl ring-brand-500 transition hover:ring-1">
            <StatTile label="En camino" value={queue.EN_CAMINO} hint="Domicilios en ruta" icon={Receipt} />
          </Link>
        </div>
      </section>

      <section aria-labelledby="period-title">
        <h3 id="period-title" className="mb-3 text-xs font-bold tracking-[0.15em] text-cream-300 uppercase">
          Resultados del periodo
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Ingresos entregados" value={formatCOP(sales.revenue)} hint={`Productos ${formatCOP(sales.productsRevenue)} · Domicilios ${formatCOP(sales.deliveryRevenue)}`} icon={Wallet} />
          <StatTile label="Pedidos entregados" value={sales.deliveredOrders} icon={CircleCheckBig} />
          <StatTile label="Ticket promedio" value={sales.averageTicket ? formatCOP(sales.averageTicket) : '—'} hint="Ingresos ÷ pedidos entregados" icon={Receipt} />
          <StatTile
            label="Pedidos recibidos"
            value={received.total}
            hint={`${received.byStatus.CANCELADO} cancelados · ${received.byStatus.PENDIENTE} sin confirmar`}
            icon={BarChart3}
          />
        </div>
        <p className="mt-2 text-xs text-cream-300">
          Solo los pedidos ENTREGADOS suman ingresos. Son ingresos registrados, no pagos confirmados.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Productos más vendidos">
          {hasSales && stats.topProducts.length > 0 ? (
            <TopProducts items={stats.topProducts} />
          ) : (
            <Empty icon={BarChart3} title="Todavía no hay ventas entregadas en este periodo">
              Aparecerán aquí cuando se entreguen pedidos.
            </Empty>
          )}
        </Panel>

        <Panel
          title="Stock bajo"
          actions={
            <Link to="/admin/inventario" className="text-xs font-semibold text-brand-400 hover:underline">
              Ver inventario
            </Link>
          }
        >
          {stats.lowStock.length === 0 ? (
            <Empty icon={PackageX} title="Sin alertas de stock">
              Solo se vigilan los productos con control de inventario activo.
            </Empty>
          ) : (
            <ul className="divide-y divide-ink-700 text-sm">
              {stats.lowStock.map((p) => (
                <li key={p.productId} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2 text-cream-100">
                    <AlertTriangle className="size-4 text-amber-300" aria-hidden />
                    {p.name}
                  </span>
                  <span className="text-xs text-cream-300 tabular-nums">
                    <strong className="text-cream-50">{p.stockQuantity}</strong> / mín. {p.minStock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

// Ranking de una sola serie: barras finas en el color de marca, valores en texto
// neutro. La lista misma es la tabla accesible (nombre, unidades, ingresos).
function TopProducts({ items }: { items: DashboardStats['topProducts'] }) {
  const max = Math.max(...items.map((i) => i.quantity))
  return (
    <ol className="space-y-3.5">
      {items.map((item, index) => (
        <li key={item.productId} title={`${item.name}: ${item.quantity} unidades · ${formatCOP(item.revenue)}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-cream-100">
              <span className="mr-2 text-xs text-cream-300 tabular-nums">{index + 1}.</span>
              {item.name}
            </span>
            <span className="shrink-0 text-xs text-cream-300 tabular-nums">
              <strong className="text-cream-50">{item.quantity}</strong> und · {formatCOP(item.revenue)}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 w-full rounded-r bg-ink-800" aria-hidden>
            <div className="h-full rounded-r-[4px] bg-brand-500" style={{ width: `${(item.quantity / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}
