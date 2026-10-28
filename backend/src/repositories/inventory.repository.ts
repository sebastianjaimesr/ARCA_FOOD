import type pg from 'pg'
import type { Db } from '../lib/db.js'

export type MovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'PEDIDO' | 'REVERSION_PEDIDO'

export type InventoryItem = {
  productId: string
  productName: string
  categoryName: string
  isActive: boolean
  stockQuantity: number
  minStock: number
  lowStock: boolean
}

export type Movement = {
  id: number
  productId: string
  productName: string
  type: MovementType
  quantityChange: number
  quantityBefore: number
  quantityAfter: number
  reason: string
  orderCode: string | null
  createdBy: string | null
  createdAt: string
}

export async function listInventory(db: Db, filters: { lowStockOnly?: boolean }): Promise<InventoryItem[]> {
  const { rows } = await db.query<InventoryItem>(
    `select p.id as "productId", p.name as "productName", c.name as "categoryName", p.is_active as "isActive",
            p.stock_quantity as "stockQuantity", p.min_stock as "minStock",
            (p.stock_quantity <= p.min_stock) as "lowStock"
     from public.products p join public.categories c on c.id = p.category_id
     where p.track_stock ${filters.lowStockOnly ? 'and p.stock_quantity <= p.min_stock' : ''}
     order by (p.stock_quantity <= p.min_stock) desc, c.sort_order, p.sort_order`,
  )
  return rows
}

export async function listMovements(db: Db, filters: { productId?: string; limit: number; offset: number }): Promise<Movement[]> {
  const params: unknown[] = []
  let where = ''
  if (filters.productId) {
    params.push(filters.productId)
    where = `where m.product_id = $1`
  }
  params.push(filters.limit, filters.offset)
  const { rows } = await db.query<Movement>(
    `select m.id::int as id, m.product_id as "productId", p.name as "productName", m.type,
            m.quantity_change as "quantityChange", m.quantity_before as "quantityBefore",
            m.quantity_after as "quantityAfter", m.reason, o.code as "orderCode",
            pr.email as "createdBy", m.created_at as "createdAt"
     from public.inventory_movements m
     join public.products p on p.id = m.product_id
     left join public.orders o on o.id = m.order_id
     left join public.profiles pr on pr.id = m.created_by
     ${where}
     order by m.created_at desc, m.id desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  )
  return rows
}

// Bloquea las filas de los productos (en orden por id para evitar bloqueos
// cruzados entre transacciones) y devuelve su stock actual.
export async function lockProductsStock(client: pg.PoolClient, productIds: string[]) {
  const { rows } = await client.query<{ id: string; name: string; trackStock: boolean; stockQuantity: number }>(
    `select id, name, track_stock as "trackStock", stock_quantity as "stockQuantity"
     from public.products where id = any($1::uuid[]) order by id for update`,
    [productIds],
  )
  return new Map(rows.map((row) => [row.id, row]))
}

export async function applyStockChange(
  client: pg.PoolClient,
  movement: {
    productId: string
    type: MovementType
    quantityBefore: number
    quantityAfter: number
    reason: string
    orderId?: string | null
    createdBy?: string | null
  },
) {
  await client.query('update public.products set stock_quantity = $2 where id = $1', [movement.productId, movement.quantityAfter])
  await client.query(
    `insert into public.inventory_movements
       (product_id, type, quantity_change, quantity_before, quantity_after, reason, order_id, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      movement.productId,
      movement.type,
      movement.quantityAfter - movement.quantityBefore,
      movement.quantityBefore,
      movement.quantityAfter,
      movement.reason,
      movement.orderId ?? null,
      movement.createdBy ?? null,
    ],
  )
}

// Cantidades por producto de un pedido (sumando líneas repetidas).
export async function orderQuantities(db: Db, orderId: string) {
  const { rows } = await db.query<{ productId: string; quantity: number }>(
    `select product_id as "productId", sum(quantity)::int as quantity
     from public.order_items where order_id = $1 group by product_id order by product_id`,
    [orderId],
  )
  return rows
}
