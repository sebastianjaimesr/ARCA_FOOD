import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'
import { pool } from '../../src/lib/db.js'
import { createStaffSession, createTestCatalog, hasDb, newKey, orderBody } from './helpers.js'

describe.skipIf(!hasDb)('pedidos (integración)', () => {
  const app = createApp()
  let catalog: Awaited<ReturnType<typeof createTestCatalog>>
  let admin: Awaited<ReturnType<typeof createStaffSession>>

  beforeAll(async () => {
    catalog = await createTestCatalog()
    admin = await createStaffSession('admin')
  })

  afterAll(async () => {
    await catalog?.cleanup()
    await admin?.remove()
    await pool.end()
  })

  const post = (body: object, key = newKey()) => request(app).post('/api/orders').set('Idempotency-Key', key).send(body)
  const setStatus = (orderId: string, status: string, note?: string) =>
    request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status, note })
  const stockOf = async (productId: string) =>
    (await pool.query<{ s: number }>('select stock_quantity as s from public.products where id = $1', [productId])).rows[0]!.s

  it('crea el pedido con precios del servidor e ignora precios del cliente', async () => {
    const res = await post(
      orderBody([
        { productId: catalog.burgerId, optionIds: [catalog.tocinetaId], quantity: 2, unitPrice: 1 },
        { productId: catalog.hotDogId, variantId: catalog.americanaId, quantity: 1 },
      ]),
    )
    expect(res.status).toBe(201)
    const { order } = res.body
    expect(order.code).toMatch(/^ARC-\d+$/)
    expect(order.status).toBe('PENDIENTE')
    expect(order.items[0]).toMatchObject({ unitPrice: '23000.00', quantity: 2, lineTotal: '46000.00' })
    expect(order.items[1]).toMatchObject({ variantName: 'Americana', unitPrice: '16000.00' })
    expect(order.subtotal).toBe('62000.00')
    expect(order.total).toBe('62000.00')
  })

  it('guarda una copia histórica: cambiar el precio no altera el pedido', async () => {
    const res = await post(orderBody([{ productId: catalog.burgerId, quantity: 1 }]))
    await pool.query('update public.products set price = 99000 where id = $1', [catalog.burgerId])
    const detail = await request(app).get(`/api/admin/orders/${res.body.order.id}`).set('Authorization', `Bearer ${admin.token}`)
    expect(detail.body.items[0].unitPrice).toBe('20000.00')
    await pool.query('update public.products set price = 20000 where id = $1', [catalog.burgerId])
  })

  it('es idempotente: la misma clave devuelve el mismo pedido', async () => {
    const key = newKey()
    const body = orderBody([{ productId: catalog.burgerId, quantity: 1 }])
    const first = await post(body, key)
    const second = await post(body, key)
    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect(second.body.replayed).toBe(true)
    expect(second.body.order.id).toBe(first.body.order.id)

    const count = await pool.query('select count(*)::int as n from public.orders where idempotency_key = $1', [key])
    expect(count.rows[0].n).toBe(1)
  })

  it('reintentos simultáneos con la misma clave crean un solo pedido', async () => {
    const key = newKey()
    const body = orderBody([{ productId: catalog.burgerId, quantity: 1 }])
    const results = await Promise.all([post(body, key), post(body, key), post(body, key)])
    const ids = new Set(results.map((r) => r.body.order?.id))
    expect(ids.size).toBe(1)
    expect(results.filter((r) => r.status === 201)).toHaveLength(1)
  })

  it('rechaza la misma clave con otro contenido', async () => {
    const key = newKey()
    await post(orderBody([{ productId: catalog.burgerId, quantity: 1 }]), key)
    const res = await post(orderBody([{ productId: catalog.burgerId, quantity: 3 }]), key)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('IDEMPOTENCY_CONFLICT')
  })

  it('cotiza el carrito sin modalidad (solo productos) y con precios vigentes', async () => {
    const res = await request(app)
      .post('/api/cart/quote')
      .send({ items: [{ productId: catalog.hotDogId, variantId: catalog.zenuId, optionIds: [catalog.quesoId], quantity: 2 }] })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ subtotal: '34000.00', deliveryFee: null, total: '34000.00' })

    const noFulfillment = await post({ ...orderBody([{ productId: catalog.burgerId, quantity: 1 }]), fulfillment: undefined })
    expect(noFulfillment.status).toBe(400)
  })

  it('exige la cabecera Idempotency-Key', async () => {
    const res = await request(app).post('/api/orders').send(orderBody([{ productId: catalog.burgerId, quantity: 1 }]))
    expect(res.status).toBe(400)
  })

  it('avisa si el total cambió desde que el cliente vio el carrito', async () => {
    const res = await post(orderBody([{ productId: catalog.burgerId, quantity: 1 }], { expectedTotal: '18000' }))
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('PRICE_CHANGED')
    expect(res.body.error.details.quote.total).toBe('20000.00')
  })

  it('no permite comprar productos desactivados o agotados', async () => {
    await pool.query('update public.products set is_available = false where id = $1', [catalog.burgerId])
    const res = await post(orderBody([{ productId: catalog.burgerId, quantity: 1 }]))
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('PRODUCT_UNAVAILABLE')
    await pool.query('update public.products set is_available = true where id = $1', [catalog.burgerId])
  })

  it('rechaza pedidos con más unidades que el stock disponible', async () => {
    const res = await post(orderBody([{ productId: catalog.drinkId, quantity: 6 }]))
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK')
    expect(res.body.error.details.available).toBe(5)
  })

  it('el stock se descuenta al CONFIRMAR, no al crear, y se devuelve al cancelar', async () => {
    const created = await post(orderBody([{ productId: catalog.drinkId, quantity: 2 }]))
    const orderId = created.body.order.id
    expect(await stockOf(catalog.drinkId)).toBe(5)

    const confirmed = await setStatus(orderId, 'CONFIRMADO')
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.stockApplied).toBe(true)
    expect(await stockOf(catalog.drinkId)).toBe(3)

    const noReason = await setStatus(orderId, 'CANCELADO')
    expect(noReason.status).toBe(422)

    const cancelled = await setStatus(orderId, 'CANCELADO', 'Cliente no respondió')
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.cancelReason).toBe('Cliente no respondió')
    expect(await stockOf(catalog.drinkId)).toBe(5)

    const movements = await pool.query(
      `select type, quantity_change from public.inventory_movements where order_id = $1 order by id`,
      [orderId],
    )
    expect(movements.rows).toEqual([
      { type: 'PEDIDO', quantity_change: -2 },
      { type: 'REVERSION_PEDIDO', quantity_change: 2 },
    ])
  })

  it('dos confirmaciones simultáneas no dejan el stock negativo', async () => {
    await pool.query('update public.products set stock_quantity = 1 where id = $1', [catalog.drinkId])
    const a = await post(orderBody([{ productId: catalog.drinkId, quantity: 1 }]))
    const b = await post(orderBody([{ productId: catalog.drinkId, quantity: 1 }]))

    const results = await Promise.all([setStatus(a.body.order.id, 'CONFIRMADO'), setStatus(b.body.order.id, 'CONFIRMADO')])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe('INSUFFICIENT_STOCK')
    expect(await stockOf(catalog.drinkId)).toBe(0)
    await pool.query('update public.products set stock_quantity = 5 where id = $1', [catalog.drinkId])
  })

  it('recorre el flujo de recogida sin EN_CAMINO y registra el historial', async () => {
    const { body } = await post(orderBody([{ productId: catalog.burgerId, quantity: 1 }]))
    const id = body.order.id
    for (const status of ['CONFIRMADO', 'EN_PREPARACION', 'LISTO']) {
      expect((await setStatus(id, status)).status).toBe(200)
    }
    const ready = await request(app).get(`/api/admin/orders/${id}`).set('Authorization', `Bearer ${admin.token}`)
    expect(ready.body.allowedTransitions).toEqual(['ENTREGADO', 'CANCELADO'])

    const invalid = await setStatus(id, 'EN_CAMINO')
    expect(invalid.status).toBe(409)
    expect(invalid.body.error.code).toBe('INVALID_TRANSITION')

    const delivered = await setStatus(id, 'ENTREGADO')
    expect(delivered.status).toBe(200)
    expect(delivered.body.deliveredAt).not.toBeNull()
    expect(delivered.body.history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
      'PENDIENTE',
      'CONFIRMADO',
      'EN_PREPARACION',
      'LISTO',
      'ENTREGADO',
    ])
    expect(delivered.body.history[1].changedBy).toBe(admin.email)

    const afterFinal = await setStatus(id, 'CANCELADO', 'tarde')
    expect(afterFinal.status).toBe(409)
  })

  it('el cliente consulta su pedido con código + teléfono, sin ver la dirección', async () => {
    const { body } = await post(
      orderBody([{ productId: catalog.burgerId, quantity: 1 }], { fulfillment: 'DOMICILIO', deliveryAddress: 'Cl 100 #20-10' }),
    )
    const found = await request(app).post('/api/orders/lookup').send({ code: body.order.code, phone: '300 123 4567' })
    expect(found.status).toBe(200)
    expect(found.body.status).toBe('PENDIENTE')
    expect(found.body).not.toHaveProperty('deliveryAddress')

    const wrongPhone = await request(app).post('/api/orders/lookup').send({ code: body.order.code, phone: '3009999999' })
    expect(wrongPhone.status).toBe(404)
  })
})
