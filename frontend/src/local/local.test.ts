import { beforeEach, describe, expect, it } from 'vitest'
import { staticCreateOrder, staticProducts } from '../services/static-store'
import { adminApi, computeDashboard, periodStart } from './local-admin-api'
import { CREDENTIALS, currentLocalUser, hashPassword, signInLocal, signOutLocal, verifyCredentials } from './local-auth'
import { readDb, resetDb, subscribeLocalDb } from './local-db'

const productBySlug = (slug: string) => readDb().products.find((p) => p.slug === slug)!

const pickupOrder = (slug = 'hamburguesa-clasica', quantity = 1) =>
  staticCreateOrder({
    fulfillment: 'RECOGIDA',
    deliveryZoneId: null,
    customerName: 'Cliente Demo',
    customerPhone: '3001234567',
    deliveryAddress: null,
    deliveryReference: null,
    notes: null,
    items: [{ productId: productBySlug(slug).id, variantId: null, optionIds: [], quantity, notes: null }],
  })

beforeEach(() => {
  resetDb()
  sessionStorage.clear()
})

describe('base local (modo demostración)', () => {
  it('empieza con la carta real', () => {
    const db = readDb()
    expect(db.products).toHaveLength(43)
    expect(db.categories).toHaveLength(8)
    expect(db.orders).toEqual([])
  })

  it('el pedido de la tienda aparece al instante en el panel y avisa del cambio', async () => {
    let notified = 0
    const unsubscribe = subscribeLocalDb(() => notified++)
    const { order } = await pickupOrder()
    unsubscribe()

    const list = await adminApi.orders({ page: 1 })
    expect(list.total).toBe(1)
    expect(list.items[0]).toMatchObject({ code: order.code, status: 'PENDIENTE', total: '19000.00' })
    expect(notified).toBe(1)
  })

  it('los cambios del menú en el panel se reflejan en la tienda', async () => {
    const clasica = productBySlug('hamburguesa-clasica')
    await adminApi.updateProduct(clasica.id, { price: 20500, isAvailable: false })
    const inStore = (await staticProducts()).find((p) => p.id === clasica.id)!
    expect(inStore).toMatchObject({ price: '20500.00', available: false })

    await adminApi.updateProduct(clasica.id, { isActive: false })
    expect((await staticProducts()).some((p) => p.id === clasica.id)).toBe(false)
  })

  it('crear producto valida con las reglas del backend', async () => {
    const categoryId = readDb().categories[0]!.id
    await expect(adminApi.createProduct({ categoryId, name: 'X', price: -1 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    const created = await adminApi.createProduct({ categoryId, name: 'Hamburguesa del Día', price: 22000 })
    expect(created.slug).toBe('hamburguesa-del-dia')
    expect((await staticProducts()).some((p) => p.slug === 'hamburguesa-del-dia')).toBe(true)
  })

  it('los estados siguen las transiciones del backend (recogida sin EN_CAMINO)', async () => {
    const { order } = await pickupOrder()
    const id = readDb().orders.find((o) => o.code === order.code)!.id
    for (const s of ['CONFIRMADO', 'EN_PREPARACION', 'LISTO'] as const) await adminApi.setOrderStatus(id, s)
    await expect(adminApi.setOrderStatus(id, 'EN_CAMINO')).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    const delivered = await adminApi.setOrderStatus(id, 'ENTREGADO')
    expect(delivered.allowedTransitions).toEqual([])
    expect(delivered.history.map((h) => h.toStatus)).toEqual(['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'])
  })

  it('cancelar exige motivo', async () => {
    const { order } = await pickupOrder()
    const id = readDb().orders.find((o) => o.code === order.code)!.id
    await expect(adminApi.setOrderStatus(id, 'CANCELADO')).rejects.toMatchObject({ code: 'CANCEL_REASON_REQUIRED' })
    expect((await adminApi.setOrderStatus(id, 'CANCELADO', 'Prueba')).cancelReason).toBe('Prueba')
  })

  it('KPIs: solo los ENTREGADOS suman ventas; ticket promedio y top ventas', async () => {
    const a = await pickupOrder('hamburguesa-clasica', 2) // 38.000
    const b = await pickupOrder('hamburguesa-ranchera', 1) // 26.500
    await pickupOrder('hamburguesa-especial', 1) // queda pendiente
    for (const code of [a.order.code, b.order.code]) {
      const id = readDb().orders.find((o) => o.code === code)!.id
      for (const s of ['CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'] as const) await adminApi.setOrderStatus(id, s)
    }
    const stats = computeDashboard(readDb(), 'day')
    expect(stats.sales).toMatchObject({ deliveredOrders: 2, revenue: '64500.00', averageTicket: '32250.00' })
    expect(stats.received.total).toBe(3)
    expect(stats.queue.PENDIENTE).toBe(1)
    expect(stats.topProducts[0]).toMatchObject({ name: 'Clásica', quantity: 2 })
  })

  it('los periodos empiezan a medianoche de Bogotá (semana desde el lunes)', () => {
    const now = new Date('2026-10-30T03:00:00Z') // jueves 29 de octubre, 22:00 en Bogotá
    expect(periodStart('day', now).toISOString()).toBe('2026-10-29T05:00:00.000Z')
    expect(periodStart('week', now).toISOString()).toBe('2026-10-26T05:00:00.000Z')
    expect(periodStart('month', now).toISOString()).toBe('2026-10-01T05:00:00.000Z')
  })
})

describe('inicio de sesión del modo demostración', () => {
  it('el usuario configurado es el indicado y la contraseña solo está como hash', () => {
    expect(CREDENTIALS.username).toBe('sebasjaimes222')
    expect(CREDENTIALS.hash).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(CREDENTIALS.iterations).toBeGreaterThanOrEqual(210_000)
  })

  it('verifica usuario y contraseña contra el hash', async () => {
    const creds = { username: 'demo', ...(await hashPassword('clave-de-prueba', 1000)) }
    expect(await verifyCredentials('demo', 'clave-de-prueba', creds)).toBe(true)
    expect(await verifyCredentials('demo', 'otra', creds)).toBe(false)
    expect(await verifyCredentials('otro', 'clave-de-prueba', creds)).toBe(false)
  })

  it('rechaza credenciales incorrectas y bloquea tras 5 intentos', async () => {
    for (let i = 0; i < 5; i++) await expect(signInLocal('sebasjaimes222', 'incorrecta')).rejects.toThrow('Usuario o contraseña incorrectos')
    await expect(signInLocal('sebasjaimes222', 'incorrecta')).rejects.toThrow(/Demasiados intentos/)
    expect(currentLocalUser()).toBeNull()
  })

  it('cerrar sesión borra la sesión de la pestaña', () => {
    sessionStorage.setItem('el-arca:local-session', JSON.stringify({ username: 'sebasjaimes222', expiresAt: Date.now() + 60_000 }))
    expect(currentLocalUser()?.role).toBe('admin')
    signOutLocal()
    expect(currentLocalUser()).toBeNull()
  })
})
