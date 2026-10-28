import type pg from 'pg'
import type { Fulfillment, OrderStatus } from '../domain/order-status.js'
import type { Quote } from '../domain/pricing.js'
import type { Db } from '../lib/db.js'

export type OrderItem = {
  id: string
  productId: string
  productName: string
  variantName: string | null
  options: { groupName: string; name: string; price: string }[]
  basePrice: string
  optionsPrice: string
  unitPrice: string
  quantity: number
  lineTotal: string
  notes: string | null
}

export type OrderDetail = {
  id: string
  code: string
  status: OrderStatus
  fulfillment: Fulfillment
  customerName: string
  customerPhone: string
  deliveryAddress: string | null
  deliveryReference: string | null
  deliveryZoneName: string | null
  notes: string | null
  subtotal: string
  deliveryFee: string | null
  total: string
  stockApplied: boolean
  cancelReason: string | null
  createdAt: string
  confirmedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  items: OrderItem[]
  history?: { fromStatus: OrderStatus | null; toStatus: OrderStatus; note: string | null; changedBy: string | null; createdAt: string }[]
}

const ORDER_COLUMNS = `
  o.id, o.code, o.status, o.fulfillment, o.customer_name as "customerName", o.customer_phone as "customerPhone",
  o.delivery_address as "deliveryAddress", o.delivery_reference as "deliveryReference",
  o.delivery_zone_name as "deliveryZoneName", o.notes, o.subtotal::text as subtotal,
  o.delivery_fee::text as "deliveryFee", o.total::text as total, o.stock_applied as "stockApplied",
  o.cancel_reason as "cancelReason", o.created_at as "createdAt", o.confirmed_at as "confirmedAt",
  o.delivered_at as "deliveredAt", o.cancelled_at as "cancelledAt"`

const ITEMS_JSON = `
  coalesce((
    select json_agg(json_build_object(
      'id', i.id, 'productId', i.product_id, 'productName', i.product_name, 'variantName', i.variant_name,
      'basePrice', i.base_price::text, 'optionsPrice', i.options_price::text, 'unitPrice', i.unit_price::text,
      'quantity', i.quantity, 'lineTotal', i.line_total::text, 'notes', i.notes,
      'options', coalesce((
        select json_agg(json_build_object('groupName', io.group_name, 'name', io.option_name, 'price', io.price::text) order by io.option_name)
        from public.order_item_options io where io.order_item_id = i.id
      ), '[]')
    ) order by i.sort_order)
    from public.order_items i where i.order_id = o.id
  ), '[]') as items`

const HISTORY_JSON = `
  coalesce((
    select json_agg(json_build_object(
      'fromStatus', h.from_status, 'toStatus', h.to_status, 'note', h.note,
      'changedBy', pr.email, 'createdAt', h.created_at
    ) order by h.created_at, h.id)
    from public.order_status_history h
    left join public.profiles pr on pr.id = h.changed_by
    where h.order_id = o.id
  ), '[]') as history`

export async function findOrderById(db: Db, id: string, withHistory = false): Promise<OrderDetail | null> {
  const { rows } = await db.query<OrderDetail>(
    `select ${ORDER_COLUMNS}, ${ITEMS_JSON} ${withHistory ? `, ${HISTORY_JSON}` : ''} from public.orders o where o.id = $1`,
    [id],
  )
  return rows[0] ?? null
}

export async function findOrderByCodeAndPhone(db: Db, code: string, phone: string): Promise<OrderDetail | null> {
  const { rows } = await db.query<OrderDetail>(
    `select ${ORDER_COLUMNS}, ${ITEMS_JSON} from public.orders o where o.code = $1 and o.customer_phone = $2`,
    [code, phone],
  )
  return rows[0] ?? null
}

export async function findOrderByIdempotencyKey(db: Db, key: string): Promise<{ id: string; requestHash: string } | null> {
  const { rows } = await db.query<{ id: string; requestHash: string }>(
    'select id, request_hash as "requestHash" from public.orders where idempotency_key = $1',
    [key],
  )
  return rows[0] ?? null
}

export type NewOrder = {
  idempotencyKey: string
  requestHash: string
  fulfillment: Fulfillment
  customerName: string
  customerPhone: string
  deliveryAddress: string | null
  deliveryReference: string | null
  notes: string | null
  quote: Quote
}

// Inserta el pedido, sus líneas, opciones y el primer registro de historial.
// Debe llamarse dentro de una transacción.
export async function insertOrder(client: pg.PoolClient, order: NewOrder): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.orders (
       idempotency_key, request_hash, fulfillment, customer_name, customer_phone,
       delivery_address, delivery_reference, delivery_zone_id, delivery_zone_name, notes,
       subtotal, delivery_fee, total
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     returning id`,
    [
      order.idempotencyKey,
      order.requestHash,
      order.fulfillment,
      order.customerName,
      order.customerPhone,
      order.deliveryAddress,
      order.deliveryReference,
      order.quote.deliveryZone?.id ?? null,
      order.quote.deliveryZone?.name ?? null,
      order.notes,
      order.quote.subtotal,
      order.quote.deliveryFee,
      order.quote.total,
    ],
  )
  const orderId = rows[0]!.id

  for (const [index, line] of order.quote.lines.entries()) {
    const item = await client.query<{ id: string }>(
      `insert into public.order_items (
         order_id, product_id, variant_id, product_name, variant_name,
         base_price, options_price, unit_price, quantity, line_total, notes, sort_order
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning id`,
      [
        orderId,
        line.productId,
        line.variantId,
        line.productName,
        line.variantName,
        line.basePrice,
        line.optionsPrice,
        line.unitPrice,
        line.quantity,
        line.lineTotal,
        line.notes,
        index,
      ],
    )
    for (const option of line.options) {
      await client.query(
        `insert into public.order_item_options (order_item_id, option_id, group_name, option_name, price)
         values ($1, $2, $3, $4, $5)`,
        [item.rows[0]!.id, option.id, option.groupName, option.name, option.price],
      )
    }
  }

  await insertStatusHistory(client, { orderId, fromStatus: null, toStatus: 'PENDIENTE', note: 'Pedido creado desde la tienda' })
  return orderId
}

export async function insertStatusHistory(
  db: Db,
  entry: { orderId: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; note?: string | null; changedBy?: string | null },
) {
  await db.query(
    'insert into public.order_status_history (order_id, from_status, to_status, note, changed_by) values ($1, $2, $3, $4, $5)',
    [entry.orderId, entry.fromStatus, entry.toStatus, entry.note ?? null, entry.changedBy ?? null],
  )
}

// Bloquea la fila del pedido hasta el final de la transacción para que dos
// administradores no cambien el mismo pedido a la vez.
export async function lockOrder(client: pg.PoolClient, id: string) {
  const { rows } = await client.query<{ id: string; status: OrderStatus; fulfillment: Fulfillment; stockApplied: boolean }>(
    'select id, status, fulfillment, stock_applied as "stockApplied" from public.orders where id = $1 for update',
    [id],
  )
  return rows[0] ?? null
}

export async function updateOrderStatus(
  client: pg.PoolClient,
  id: string,
  status: OrderStatus,
  extra: { stockApplied?: boolean; cancelReason?: string | null },
) {
  await client.query(
    `update public.orders set
       status = $2::public.order_status,
       stock_applied = coalesce($3::boolean, stock_applied),
       cancel_reason = case when $2::public.order_status = 'CANCELADO' then $4::text else cancel_reason end,
       confirmed_at = case when $2::public.order_status = 'CONFIRMADO' then now() else confirmed_at end,
       delivered_at = case when $2::public.order_status = 'ENTREGADO' then now() else delivered_at end,
       cancelled_at = case when $2::public.order_status = 'CANCELADO' then now() else cancelled_at end
     where id = $1`,
    [id, status, extra.stockApplied ?? null, extra.cancelReason ?? null],
  )
}

export type OrderListItem = Pick<
  OrderDetail,
  'id' | 'code' | 'status' | 'fulfillment' | 'customerName' | 'customerPhone' | 'deliveryZoneName' | 'total' | 'createdAt'
> & { itemsCount: number }

export async function listOrders(
  db: Db,
  filters: { status?: OrderStatus[]; from?: string; to?: string; q?: string; limit: number; offset: number },
): Promise<{ items: OrderListItem[]; total: number }> {
  const params: unknown[] = []
  const where: string[] = []
  if (filters.status?.length) {
    params.push(filters.status)
    where.push(`o.status = any($${params.length}::public.order_status[])`)
  }
  // Las fechas llegan como YYYY-MM-DD y se interpretan en hora de Bogotá.
  if (filters.from) {
    params.push(filters.from)
    where.push(`o.created_at >= ($${params.length}::date::timestamp at time zone 'America/Bogota')`)
  }
  if (filters.to) {
    params.push(filters.to)
    where.push(`o.created_at < (($${params.length}::date + 1)::timestamp at time zone 'America/Bogota')`)
  }
  if (filters.q) {
    params.push(`%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
    where.push(`(o.code ilike $${params.length} or o.customer_name ilike $${params.length} or o.customer_phone ilike $${params.length})`)
  }
  const whereSql = where.length ? `where ${where.join(' and ')}` : ''

  const count = await db.query<{ total: number }>(`select count(*)::int as total from public.orders o ${whereSql}`, params)
  params.push(filters.limit, filters.offset)
  const { rows } = await db.query<OrderListItem>(
    `select o.id, o.code, o.status, o.fulfillment, o.customer_name as "customerName", o.customer_phone as "customerPhone",
            o.delivery_zone_name as "deliveryZoneName", o.total::text as total, o.created_at as "createdAt",
            (select coalesce(sum(i.quantity), 0)::int from public.order_items i where i.order_id = o.id) as "itemsCount"
     from public.orders o ${whereSql}
     order by o.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  )
  return { items: rows, total: count.rows[0]!.total }
}
