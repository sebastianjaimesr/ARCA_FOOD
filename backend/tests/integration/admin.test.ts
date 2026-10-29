import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'
import { pool } from '../../src/lib/db.js'
import { createStaffSession, createTestCatalog, hasDb, newKey, orderBody } from './helpers.js'

describe.skipIf(!hasDb)('panel administrativo (integración)', () => {
  const app = createApp()
  let catalog: Awaited<ReturnType<typeof createTestCatalog>>
  let admin: Awaited<ReturnType<typeof createStaffSession>>
  let staff: Awaited<ReturnType<typeof createStaffSession>>
  let noRole: Awaited<ReturnType<typeof createStaffSession>>

  beforeAll(async () => {
    catalog = await createTestCatalog()
    ;[admin, staff, noRole] = await Promise.all([
      createStaffSession('admin'),
      createStaffSession('staff'),
      createStaffSession(null),
    ])
  })

  afterAll(async () => {
    await catalog?.cleanup()
    await Promise.all([admin?.remove(), staff?.remove(), noRole?.remove()])
    await pool.end()
  })

  const as = (session: { token: string } | null) => ({
    get: (url: string) => {
      const r = request(app).get(url)
      return session ? r.set('Authorization', `Bearer ${session.token}`) : r
    },
    post: (url: string, body: unknown) => {
      const r = request(app).post(url).send(body as object)
      return session ? r.set('Authorization', `Bearer ${session.token}`) : r
    },
    patch: (url: string, body: unknown) => {
      const r = request(app).patch(url).send(body as object)
      return session ? r.set('Authorization', `Bearer ${session.token}`) : r
    },
  })

  describe('autenticación y permisos', () => {
    it('sin token → 401', async () => {
      const res = await as(null).get('/api/admin/orders')
      expect(res.status).toBe(401)
    })

    it('token falso → 401', async () => {
      const res = await as({ token: 'eyJhbGciOiJIUzI1NiJ9.e30.firma-falsa' }).get('/api/admin/orders')
      expect(res.status).toBe(401)
    })

    it('cuenta sin rol → 403', async () => {
      const res = await as(noRole).get('/api/admin/me')
      expect(res.status).toBe(403)
    })

    it('cuenta desactivada → 403', async () => {
      await pool.query('update public.profiles set is_active = false where id = $1', [staff.id])
      expect((await as(staff).get('/api/admin/me')).status).toBe(403)
      await pool.query('update public.profiles set is_active = true where id = $1', [staff.id])
    })

    it('staff opera pedidos pero no cambia precios ni configuración', async () => {
      expect((await as(staff).get('/api/admin/orders')).status).toBe(200)
      expect((await as(staff).patch(`/api/admin/products/${catalog.burgerId}`, { price: 1 })).status).toBe(403)
      expect((await as(staff).patch('/api/admin/settings', { acceptingOrders: false })).status).toBe(403)
    })

    it('admin ve su perfil', async () => {
      const res = await as(admin).get('/api/admin/me')
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ email: admin.email, role: 'admin' })
    })
  })

  describe('acceso directo a las tablas', () => {
    it('la API REST de Supabase no expone pedidos ni permite cambiar stock', async () => {
      const headers = { apikey: process.env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}` }
      const read = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?select=*`, { headers })
      expect(read.ok).toBe(false)

      const write = await fetch(`${process.env.SUPABASE_URL}/rest/v1/products?id=eq.${catalog.drinkId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_quantity: 999 }),
      })
      expect(write.ok).toBe(false)

      // Ni siquiera con la sesión de un administrador.
      const asAdmin = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?select=*`, {
        headers: { apikey: process.env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${admin.token}` },
      })
      expect(asAdmin.ok).toBe(false)
    })
  })

  describe('productos', () => {
    it('crea un producto con variantes y valida los datos', async () => {
      const invalid = await as(admin).post('/api/admin/products', { categoryId: catalog.categoryId, name: 'X', price: -5 })
      expect(invalid.status).toBe(400)

      const res = await as(admin).post('/api/admin/products', {
        categoryId: catalog.categoryId,
        name: `Salchipapa prueba ${newKey().slice(0, 6)}`,
        price: 17000,
        variants: [
          { name: 'Zenú', price: 17000 },
          { name: 'Americana', price: 18000 },
        ],
        optionGroupIds: [catalog.groupId],
      })
      expect(res.status).toBe(201)
      expect(res.body.slug).toMatch(/^salchipapa-prueba-/)
      expect(res.body.variants.map((v: { price: string }) => v.price)).toEqual(['17000.00', '18000.00'])
    })

    it('un producto desactivado desaparece de la tienda y no se puede pedir', async () => {
      const off = await as(admin).patch(`/api/admin/products/${catalog.hotDogId}`, { isActive: false })
      expect(off.status).toBe(200)

      const store = await request(app).get('/api/products?q=Perro prueba')
      expect(store.body.items.find((p: { id: string }) => p.id === catalog.hotDogId)).toBeUndefined()

      const order = await request(app)
        .post('/api/orders')
        .set('Idempotency-Key', newKey())
        .send(orderBody([{ productId: catalog.hotDogId, variantId: catalog.zenuId, quantity: 1 }]))
      expect(order.status).toBe(409)

      await as(admin).patch(`/api/admin/products/${catalog.hotDogId}`, { isActive: true })
    })

    it('el stock no se cambia editando el producto (solo con movimientos)', async () => {
      const res = await as(admin).patch(`/api/admin/products/${catalog.drinkId}`, { stockQuantity: 999 })
      expect(res.status).toBe(200)
      expect(res.body.stockQuantity).not.toBe(999)
    })
  })

  describe('inventario', () => {
    it('registra entradas, salidas y ajustes con usuario y motivo', async () => {
      const entry = await as(staff).post('/api/admin/inventory/movements', {
        productId: catalog.drinkId,
        type: 'ENTRADA',
        quantity: 10,
        reason: 'Compra a proveedor',
      })
      expect(entry.status).toBe(201)
      const before = entry.body.quantityBefore
      expect(entry.body.quantityAfter).toBe(before + 10)

      const out = await as(staff).post('/api/admin/inventory/movements', {
        productId: catalog.drinkId,
        type: 'SALIDA',
        quantity: 3,
        reason: 'Botellas dañadas',
      })
      expect(out.body.quantityAfter).toBe(before + 7)

      const adjust = await as(staff).post('/api/admin/inventory/movements', {
        productId: catalog.drinkId,
        type: 'AJUSTE',
        quantity: 4,
        reason: 'Conteo físico',
      })
      expect(adjust.body.quantityAfter).toBe(4)

      const history = await as(staff).get(`/api/admin/inventory/movements?productId=${catalog.drinkId}`)
      expect(history.body.items[0]).toMatchObject({ type: 'AJUSTE', quantityAfter: 4, reason: 'Conteo físico', createdBy: staff.email })
    })

    it('no permite dejar el stock en negativo', async () => {
      const res = await as(staff).post('/api/admin/inventory/movements', {
        productId: catalog.drinkId,
        type: 'SALIDA',
        quantity: 1000,
        reason: 'Prueba',
      })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('INSUFFICIENT_STOCK')
    })

    it('exige motivo y producto con control de inventario', async () => {
      expect(
        (await as(staff).post('/api/admin/inventory/movements', { productId: catalog.drinkId, type: 'ENTRADA', quantity: 1, reason: '' }))
          .status,
      ).toBe(400)
      const untracked = await as(staff).post('/api/admin/inventory/movements', {
        productId: catalog.burgerId,
        type: 'ENTRADA',
        quantity: 1,
        reason: 'Prueba',
      })
      expect(untracked.status).toBe(409)
      expect(untracked.body.error.code).toBe('STOCK_NOT_TRACKED')
    })
  })

  describe('estadísticas', () => {
    it('solo los pedidos ENTREGADOS suman ingresos', async () => {
      const before = (await as(admin).get('/api/admin/dashboard?range=day')).body

      const create = async () =>
        (
          await request(app)
            .post('/api/orders')
            .set('Idempotency-Key', newKey())
            .send(orderBody([{ productId: catalog.burgerId, quantity: 2 }]))
        ).body.order.id as string
      const delivered = await create()
      const cancelled = await create()
      await create() // queda PENDIENTE

      for (const s of ['CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO']) {
        await as(admin).patch(`/api/admin/orders/${delivered}/status`, { status: s })
      }
      await as(admin).patch(`/api/admin/orders/${cancelled}/status`, { status: 'CANCELADO', note: 'Prueba' })

      const after = (await as(admin).get('/api/admin/dashboard?range=day')).body
      expect(Number(after.sales.revenue) - Number(before.sales.revenue)).toBe(40000)
      expect(after.sales.deliveredOrders - before.sales.deliveredOrders).toBe(1)
      expect(after.received.total - before.received.total).toBe(3)
      expect(after.received.byStatus.CANCELADO - before.received.byStatus.CANCELADO).toBe(1)
      expect(after.timezone).toBe('America/Bogota')
      // El ranking acumula las corridas anteriores del día: se valida su forma y orden.
      const quantities = after.topProducts.map((p: { quantity: number }) => p.quantity)
      expect(after.topProducts.length).toBeGreaterThan(0)
      expect(after.topProducts.length).toBeLessThanOrEqual(5)
      expect(quantities).toEqual([...quantities].sort((a, b) => b - a))
    })

    it('rechaza rangos inválidos', async () => {
      expect((await as(admin).get('/api/admin/dashboard?range=year')).status).toBe(400)
    })
  })

  describe('configuración y domicilios', () => {
    it('con zonas activas, el domicilio exige zona y cobra su tarifa', async () => {
      const zone = await as(admin).post('/api/admin/delivery-zones', { name: `Zona prueba ${newKey().slice(0, 6)}`, fee: 4000 })
      expect(zone.status).toBe(201)

      const body = orderBody([{ productId: catalog.burgerId, quantity: 1 }], {
        fulfillment: 'DOMICILIO',
        deliveryAddress: 'Cl 103 #14-27',
      })
      const noZone = await request(app).post('/api/orders').set('Idempotency-Key', newKey()).send(body)
      expect(noZone.status).toBe(422)
      expect(noZone.body.error.code).toBe('ZONE_REQUIRED')

      const ok = await request(app)
        .post('/api/orders')
        .set('Idempotency-Key', newKey())
        .send({ ...body, deliveryZoneId: zone.body.id })
      expect(ok.status).toBe(201)
      expect(ok.body.order).toMatchObject({ deliveryFee: '4000.00', total: '24000.00' })

      // Se desactiva para no afectar la tienda local.
      await as(admin).patch(`/api/admin/delivery-zones/${zone.body.id}`, { isActive: false })
    })

    it('si la tienda no recibe pedidos, se rechazan', async () => {
      await as(admin).patch('/api/admin/settings', { acceptingOrders: false })
      const res = await request(app)
        .post('/api/orders')
        .set('Idempotency-Key', newKey())
        .send(orderBody([{ productId: catalog.burgerId, quantity: 1 }]))
      await as(admin).patch('/api/admin/settings', { acceptingOrders: true })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('STORE_CLOSED')
    })
  })
})
