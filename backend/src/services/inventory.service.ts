import type pg from 'pg'
import { audit } from '../lib/audit.js'
import { withTransaction } from '../lib/db.js'
import { HttpError } from '../lib/http-error.js'
import { applyStockChange, lockProductsStock, orderQuantities } from '../repositories/inventory.repository.js'

export type ManualMovement = {
  productId: string
  type: 'ENTRADA' | 'SALIDA' | 'AJUSTE'
  // ENTRADA/SALIDA: unidades que entran o salen. AJUSTE: cantidad final contada.
  quantity: number
  reason: string
}

export async function registerManualMovement(input: ManualMovement, actorId: string) {
  return withTransaction(async (client) => {
    const product = (await lockProductsStock(client, [input.productId])).get(input.productId)
    if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'El producto no existe')
    if (!product.trackStock) {
      throw new HttpError(409, 'STOCK_NOT_TRACKED', 'Activa el control de inventario de este producto antes de registrar movimientos')
    }

    const before = product.stockQuantity
    const after =
      input.type === 'ENTRADA' ? before + input.quantity : input.type === 'SALIDA' ? before - input.quantity : input.quantity

    if (after < 0) {
      throw new HttpError(409, 'INSUFFICIENT_STOCK', `Solo hay ${before} unidades de ${product.name}`, { available: before })
    }

    await applyStockChange(client, {
      productId: product.id,
      type: input.type,
      quantityBefore: before,
      quantityAfter: after,
      reason: input.reason,
      createdBy: actorId,
    })
    await audit(client, {
      actorId,
      action: `inventory.${input.type.toLowerCase()}`,
      entity: 'product',
      entityId: product.id,
      data: { before, after, reason: input.reason },
    })
    return { productId: product.id, quantityBefore: before, quantityAfter: after }
  })
}

// Descuenta las existencias de un pedido al confirmarlo. Si algún producto no
// alcanza, lanza 409 y la transacción completa se revierte (no queda nada a medias).
export async function deductStockForOrder(client: pg.PoolClient, order: { id: string; code: string }, actorId: string) {
  const quantities = await orderQuantities(client, order.id)
  const products = await lockProductsStock(
    client,
    quantities.map((q) => q.productId),
  )

  let applied = false
  for (const { productId, quantity } of quantities) {
    const product = products.get(productId)
    if (!product?.trackStock) continue
    if (product.stockQuantity < quantity) {
      throw new HttpError(409, 'INSUFFICIENT_STOCK', `No hay existencias suficientes de ${product.name}`, {
        productId,
        productName: product.name,
        available: product.stockQuantity,
        requested: quantity,
      })
    }
    await applyStockChange(client, {
      productId,
      type: 'PEDIDO',
      quantityBefore: product.stockQuantity,
      quantityAfter: product.stockQuantity - quantity,
      reason: `Pedido ${order.code} confirmado`,
      orderId: order.id,
      createdBy: actorId,
    })
    applied = true
  }
  return applied
}

// Devuelve exactamente lo que se descontó al confirmar (según los movimientos
// PEDIDO registrados), aunque el producto haya cambiado de configuración después.
export async function revertStockForOrder(client: pg.PoolClient, order: { id: string; code: string }, actorId: string) {
  const { rows } = await client.query<{ productId: string; quantity: number }>(
    `select product_id as "productId", (-sum(quantity_change))::int as quantity
     from public.inventory_movements
     where order_id = $1 and type in ('PEDIDO', 'REVERSION_PEDIDO')
     group by product_id
     having sum(quantity_change) < 0
     order by product_id`,
    [order.id],
  )
  const products = await lockProductsStock(
    client,
    rows.map((r) => r.productId),
  )
  for (const { productId, quantity } of rows) {
    const product = products.get(productId)!
    await applyStockChange(client, {
      productId,
      type: 'REVERSION_PEDIDO',
      quantityBefore: product.stockQuantity,
      quantityAfter: product.stockQuantity + quantity,
      reason: `Pedido ${order.code} cancelado`,
      orderId: order.id,
      createdBy: actorId,
    })
  }
}
