import { ORDER_STATUSES, type OrderStatus } from '../domain/order-status.js'
import { pool } from '../lib/db.js'
import { fromCents, toCents } from '../lib/money.js'

export type StatsRange = 'day' | 'week' | 'month'

// Reglas (ver docs/reglas-de-negocio.md):
//   * Pedido recibido: cualquier pedido creado en el periodo (incluye pendientes).
//   * Venta completada: pedido ENTREGADO; cuenta en la fecha de entrega.
//   * Ingresos: suma de "total" de los ENTREGADO (productos + domicilio). Son
//     ingresos registrados, no pagos confirmados.
//   * Pendientes y cancelados nunca suman ingresos.
//   * Ticket promedio: ingresos / número de pedidos entregados.
//   * Periodos en hora de Bogotá: día desde las 00:00, semana desde el lunes,
//     mes desde el día 1.
export async function getDashboardStats(range: StatsRange) {
  const timezone = 'America/Bogota'
  const { rows: boundRows } = await pool.query<{ startAt: Date; now: Date }>(
    `select (date_trunc($1, now() at time zone $2) at time zone $2) as "startAt", now() as now`,
    [range, timezone],
  )
  const { startAt, now } = boundRows[0]!

  const [queue, created, sales, top, lowStock] = await Promise.all([
    // Cola operativa actual (sin filtro de fecha): lo que hay que atender ya.
    pool.query<{ status: OrderStatus; count: number }>(
      `select status, count(*)::int as count from public.orders
       where status not in ('ENTREGADO', 'CANCELADO') group by status`,
    ),
    pool.query<{ status: OrderStatus; count: number }>(
      `select status, count(*)::int as count from public.orders where created_at >= $1 group by status`,
      [startAt],
    ),
    pool.query<{ orders: number; total: string; subtotal: string; deliveryFees: string }>(
      `select count(*)::int as orders, coalesce(sum(total), 0)::text as total,
              coalesce(sum(subtotal), 0)::text as subtotal, coalesce(sum(delivery_fee), 0)::text as "deliveryFees"
       from public.orders where status = 'ENTREGADO' and delivered_at >= $1`,
      [startAt],
    ),
    pool.query<{ productId: string; name: string; quantity: number; revenue: string }>(
      `select i.product_id as "productId", p.name, sum(i.quantity)::int as quantity, sum(i.line_total)::text as revenue
       from public.order_items i
       join public.orders o on o.id = i.order_id
       join public.products p on p.id = i.product_id
       where o.status = 'ENTREGADO' and o.delivered_at >= $1
       group by i.product_id, p.name
       order by quantity desc, sum(i.line_total) desc
       limit 5`,
      [startAt],
    ),
    pool.query<{ productId: string; name: string; stockQuantity: number; minStock: number }>(
      `select id as "productId", name, stock_quantity as "stockQuantity", min_stock as "minStock"
       from public.products where track_stock and is_active and stock_quantity <= min_stock
       order by stock_quantity, name`,
    ),
  ])

  const byStatus = (rows: { status: OrderStatus; count: number }[]) =>
    Object.fromEntries(ORDER_STATUSES.map((s) => [s, rows.find((r) => r.status === s)?.count ?? 0])) as Record<OrderStatus, number>

  const createdByStatus = byStatus(created.rows)
  const salesRow = sales.rows[0]!
  const revenueCents = toCents(salesRow.total)

  return {
    range,
    timezone,
    from: startAt.toISOString(),
    to: now.toISOString(),
    queue: byStatus(queue.rows),
    received: {
      total: Object.values(createdByStatus).reduce((a, b) => a + b, 0),
      byStatus: createdByStatus,
    },
    sales: {
      deliveredOrders: salesRow.orders,
      revenue: salesRow.total,
      productsRevenue: salesRow.subtotal,
      deliveryRevenue: salesRow.deliveryFees,
      averageTicket: salesRow.orders > 0 ? fromCents(Math.round(revenueCents / salesRow.orders)) : null,
    },
    topProducts: top.rows,
    lowStock: lowStock.rows,
  }
}
