// API del panel en el MODO DEMOSTRACIÓN: misma forma que la API remota
// (services/admin-remote.ts) pero sobre la base local de este navegador.
// Las reglas vienen del backend (sin duplicarlas):
//   - transiciones de estado: backend/src/domain/order-status.ts
//   - validación de productos, categorías, opciones y configuración:
//     backend/src/validators/admin.validators.ts
import type { ZodType } from 'zod'
import { allowedTransitions, canTransition } from '../../../backend/src/domain/order-status.ts'
import {
  categorySchema,
  createProductSchema,
  deliveryZoneSchema,
  optionGroupSchema,
  optionSchema,
  updateCategorySchema,
  updateDeliveryZoneSchema,
  updateOptionGroupSchema,
  updateOptionSchema,
  updateProductSchema,
  updateSettingsSchema,
} from '../../../backend/src/validators/admin.validators.ts'
import { slugify } from '../../../backend/src/validators/common.ts'
import { ApiError } from '../services/api'
import type {
  AdminCategory,
  AdminOptionGroup,
  AdminOrder,
  AdminOrderListItem,
  AdminProduct,
  AdminSettings,
  DashboardStats,
  DeliveryZone,
  InventoryItem,
  InventoryMovement,
  StatsRange,
} from '../types/admin'
import type { OrderStatus } from '../types/order'
import { currentLocalUser } from './local-auth'
import { readDb, updateDb, type LocalDb, type StoredOrder, type StoredProduct } from './local-db'

const STATUSES: OrderStatus[] = ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO']
const cents = (v: string | null | undefined) => Math.round(Number(v ?? 0) * 100)
const money = (c: number) => (c / 100).toFixed(2)

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Datos inválidos', result.error.issues)
  }
  return result.data
}

const notFound = (what: string) => new ApiError(404, 'NOT_FOUND', `${what} no existe`)
const actor = () => currentLocalUser()?.email ?? 'admin'

// --- Fechas en hora de Bogotá (UTC-5 todo el año, sin horario de verano) -------
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000

export function periodStart(range: StatsRange, now = new Date()): Date {
  const local = new Date(now.getTime() - BOGOTA_OFFSET_MS)
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  let d = local.getUTCDate()
  if (range === 'week') d -= (local.getUTCDay() + 6) % 7 // semana desde el lunes
  if (range === 'month') d = 1
  return new Date(Date.UTC(y, m, d) + BOGOTA_OFFSET_MS)
}

const dayStart = (isoDate: string, plusDays = 0) => {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + plusDays) + BOGOTA_OFFSET_MS)
}

// --- Vistas ------------------------------------------------------------------

const withTransitions = (o: StoredOrder): AdminOrder => ({ ...o, allowedTransitions: allowedTransitions(o.status, o.fulfillment) })

function adminProduct(db: LocalDb, p: StoredProduct): AdminProduct {
  return { ...p, categoryName: db.categories.find((c) => c.id === p.categoryId)?.name ?? '' }
}

function adminCategories(db: LocalDb): AdminCategory[] {
  return [...db.categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({ ...c, productsCount: db.products.filter((p) => p.categoryId === c.id).length }))
}

// Mismas definiciones que backend/src/services/stats.service.ts:
// ingresos = pedidos ENTREGADOS (por fecha de entrega); recibidos = creados en el periodo.
export function computeDashboard(db: LocalDb, range: StatsRange, now = new Date()): DashboardStats {
  const from = periodStart(range, now)
  const byStatus = (list: StoredOrder[]) =>
    Object.fromEntries(STATUSES.map((s) => [s, list.filter((o) => o.status === s).length])) as Record<OrderStatus, number>

  const active = db.orders.filter((o) => o.status !== 'ENTREGADO' && o.status !== 'CANCELADO')
  const received = db.orders.filter((o) => new Date(o.createdAt) >= from)
  const delivered = db.orders.filter((o) => o.status === 'ENTREGADO' && o.deliveredAt && new Date(o.deliveredAt) >= from)

  const revenue = delivered.reduce((s, o) => s + cents(o.total), 0)
  const products = delivered.reduce((s, o) => s + cents(o.subtotal), 0)
  const fees = delivered.reduce((s, o) => s + cents(o.deliveryFee), 0)

  const top = new Map<string, { productId: string; name: string; quantity: number; revenue: number }>()
  for (const o of delivered) {
    for (const i of o.items) {
      const row = top.get(i.productId) ?? { productId: i.productId, name: i.productName, quantity: 0, revenue: 0 }
      row.quantity += i.quantity
      row.revenue += cents(i.lineTotal)
      top.set(i.productId, row)
    }
  }

  return {
    range,
    timezone: 'America/Bogota',
    from: from.toISOString(),
    to: now.toISOString(),
    queue: byStatus(active),
    received: { total: received.length, byStatus: byStatus(received) },
    sales: {
      deliveredOrders: delivered.length,
      revenue: money(revenue),
      productsRevenue: money(products),
      deliveryRevenue: money(fees),
      averageTicket: delivered.length ? money(Math.round(revenue / delivered.length)) : null,
    },
    topProducts: [...top.values()]
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 5)
      .map((t) => ({ ...t, revenue: money(t.revenue) })),
    lowStock: db.products
      .filter((p) => p.trackStock && p.isActive && p.stockQuantity <= p.minStock)
      .map((p) => ({ productId: p.id, name: p.name, stockQuantity: p.stockQuantity, minStock: p.minStock })),
  }
}

// Variantes: las que traen id se actualizan, las nuevas reciben id y las que ya
// no vienen se desactivan (igual que el backend: pueden estar en pedidos).
function syncVariants(current: StoredProduct['variants'], next: { id?: string; name: string; price: string; isActive: boolean }[]) {
  const kept = next.map((v, i) => {
    if (v.id && !current.some((c) => c.id === v.id)) throw new ApiError(422, 'INVALID_REFERENCE', 'Una de las variantes no pertenece a este producto')
    return { id: v.id ?? crypto.randomUUID(), name: v.name, price: v.price, isActive: v.isActive, sortOrder: i + 1 }
  })
  const dropped = current.filter((c) => !kept.some((k) => k.id === c.id)).map((c) => ({ ...c, isActive: false }))
  return [...kept, ...dropped]
}

function assertProductRefs(db: LocalDb, categoryId: string | undefined, groupIds: string[] | undefined, slug: string | undefined, selfId?: string) {
  if (categoryId && !db.categories.some((c) => c.id === categoryId)) throw new ApiError(422, 'INVALID_REFERENCE', 'La categoría elegida no existe')
  if (groupIds?.some((g) => !db.optionGroups.some((x) => x.id === g))) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'El grupo de opciones elegido no existe')
  }
  if (slug && db.products.some((p) => p.slug === slug && p.id !== selfId)) {
    throw new ApiError(409, 'DUPLICATE', 'Ya existe un producto con ese nombre o identificador')
  }
}

const done = <T>(value: T) => Promise.resolve(value)
const run = <T>(fn: () => T): Promise<T> => {
  try {
    return Promise.resolve(fn())
  } catch (err) {
    return Promise.reject(err)
  }
}

export const adminApi = {
  dashboard: (range: StatsRange) => run(() => computeDashboard(readDb(), range)),

  orders: (filters: { status?: OrderStatus[]; from?: string; to?: string; q?: string; page: number; pageSize?: number }) =>
    run(() => {
      const pageSize = filters.pageSize ?? 20
      const q = filters.q?.trim().toLowerCase()
      const list = readDb().orders.filter(
        (o) =>
          (!filters.status?.length || filters.status.includes(o.status)) &&
          (!filters.from || new Date(o.createdAt) >= dayStart(filters.from)) &&
          (!filters.to || new Date(o.createdAt) < dayStart(filters.to, 1)) &&
          (!q || o.code.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.customerPhone.includes(q)),
      )
      const items: AdminOrderListItem[] = list.slice((filters.page - 1) * pageSize, filters.page * pageSize).map((o) => ({
        id: o.id,
        code: o.code,
        status: o.status,
        fulfillment: o.fulfillment,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        deliveryZoneName: o.deliveryZoneName,
        total: o.total,
        createdAt: o.createdAt,
        itemsCount: o.items.reduce((s, i) => s + i.quantity, 0),
      }))
      return { items, total: list.length, page: filters.page, pageSize }
    }),

  order: (id: string) =>
    run(() => {
      const order = readDb().orders.find((o) => o.id === id)
      if (!order) throw notFound('El pedido')
      return withTransitions(order)
    }),

  setOrderStatus: (id: string, status: OrderStatus, note?: string | null) =>
    run(() =>
      updateDb((db) => {
        const order = db.orders.find((o) => o.id === id)
        if (!order) throw notFound('El pedido')
        if (!canTransition(order.status, status, order.fulfillment)) {
          throw new ApiError(409, 'INVALID_TRANSITION', `Un pedido ${order.status} no puede pasar a ${status}`)
        }
        if (status === 'CANCELADO' && !note?.trim()) throw new ApiError(422, 'CANCEL_REASON_REQUIRED', 'Indica el motivo de la cancelación')
        const now = new Date().toISOString()
        order.history.push({ fromStatus: order.status, toStatus: status, note: note?.trim() || null, changedBy: actor(), createdAt: now })
        order.status = status
        if (status === 'CONFIRMADO') order.confirmedAt = now
        if (status === 'ENTREGADO') order.deliveredAt = now
        if (status === 'CANCELADO') {
          order.cancelledAt = now
          order.cancelReason = note!.trim()
        }
        return withTransitions(order)
      }),
    ),

  products: (filters: { q?: string; categoryId?: string; status?: 'active' | 'inactive' | 'all' } = {}) =>
    run(() => {
      const db = readDb()
      const q = filters.q?.toLowerCase()
      const order = new Map(db.categories.map((c) => [c.id, c.sortOrder]))
      return db.products
        .filter(
          (p) =>
            (!q || p.name.toLowerCase().includes(q) || p.slug.includes(q)) &&
            (!filters.categoryId || p.categoryId === filters.categoryId) &&
            (filters.status !== 'active' || p.isActive) &&
            (filters.status !== 'inactive' || !p.isActive),
        )
        .sort((a, b) => (order.get(a.categoryId)! - order.get(b.categoryId)!) || a.sortOrder - b.sortOrder)
        .map((p) => adminProduct(db, p))
    }),

  product: (id: string) =>
    run(() => {
      const db = readDb()
      const p = db.products.find((x) => x.id === id)
      if (!p) throw notFound('El producto')
      return adminProduct(db, p)
    }),

  createProduct: (body: unknown) =>
    run(() => {
      const input = parse(createProductSchema, body)
      return updateDb((db) => {
        const slug = input.slug ?? slugify(input.name)
        assertProductRefs(db, input.categoryId, input.optionGroupIds, slug)
        const product: StoredProduct = {
          id: crypto.randomUUID(),
          categoryId: input.categoryId,
          slug,
          name: input.name,
          description: input.description,
          price: input.price,
          imageUrl: input.imageUrl,
          imageAlt: input.imageAlt,
          isActive: input.isActive,
          isAvailable: input.isAvailable,
          isFeatured: input.isFeatured,
          sortOrder: input.sortOrder,
          trackStock: input.trackStock,
          stockQuantity: 0,
          minStock: input.minStock,
          variants: syncVariants([], input.variants),
          optionGroupIds: input.optionGroupIds,
          updatedAt: new Date().toISOString(),
        }
        db.products.push(product)
        return adminProduct(db, product)
      })
    }),

  updateProduct: (id: string, body: unknown) =>
    run(() => {
      const patch = parse(updateProductSchema, body)
      return updateDb((db) => {
        const product = db.products.find((p) => p.id === id)
        if (!product) throw notFound('El producto')
        assertProductRefs(db, patch.categoryId, patch.optionGroupIds, patch.slug, id)
        const { variants, ...fields } = patch
        Object.assign(
          product,
          Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
          variants ? { variants: syncVariants(product.variants, variants) } : {},
          { updatedAt: new Date().toISOString() },
        )
        return adminProduct(db, product)
      })
    }),

  categories: () => run(() => adminCategories(readDb())),

  createCategory: (body: unknown) =>
    run(() => {
      const input = parse(categorySchema, body)
      return updateDb((db) => {
        const slug = input.slug ?? slugify(input.name)
        if (db.categories.some((c) => c.slug === slug)) throw new ApiError(409, 'DUPLICATE', 'Ya existe una categoría con ese nombre')
        const category = { id: crypto.randomUUID(), ...input, slug }
        db.categories.push(category)
        return adminCategories(db).find((c) => c.id === category.id)!
      })
    }),

  updateCategory: (id: string, body: unknown) =>
    run(() => {
      const patch = parse(updateCategorySchema, body)
      return updateDb((db) => {
        const category = db.categories.find((c) => c.id === id)
        if (!category) throw notFound('La categoría')
        Object.assign(category, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
        return adminCategories(db).find((c) => c.id === id)!
      })
    }),

  optionGroups: () => run(() => readDb().optionGroups),

  createOptionGroup: (body: unknown) =>
    run(() => {
      const input = parse(optionGroupSchema, body)
      return updateDb((db) => {
        if (db.optionGroups.some((g) => g.name.toLowerCase() === input.name.toLowerCase())) {
          throw new ApiError(409, 'DUPLICATE', 'Ya existe un grupo con ese nombre')
        }
        const group: AdminOptionGroup = { id: crypto.randomUUID(), ...input, isActive: true, options: [] }
        db.optionGroups.push(group)
        return group
      })
    }),

  updateOptionGroup: (id: string, body: unknown) =>
    run(() => {
      const patch = parse(updateOptionGroupSchema, body)
      return updateDb((db) => {
        const group = db.optionGroups.find((g) => g.id === id)
        if (!group) throw notFound('El grupo')
        Object.assign(group, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
        return group
      })
    }),

  createOption: (groupId: string, body: unknown) =>
    run(() => {
      const input = parse(optionSchema, body)
      return updateDb((db) => {
        const group = db.optionGroups.find((g) => g.id === groupId)
        if (!group) throw notFound('El grupo')
        group.options.push({ id: crypto.randomUUID(), name: input.name, price: input.price, sortOrder: input.sortOrder, isActive: true })
        return group
      })
    }),

  updateOption: (id: string, body: unknown) =>
    run(() => {
      const patch = parse(updateOptionSchema, body)
      return updateDb((db) => {
        const option = db.optionGroups.flatMap((g) => g.options).find((o) => o.id === id)
        if (!option) throw notFound('La opción')
        Object.assign(option, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
        return { ok: true as const }
      })
    }),

  // El inventario por unidades necesita el backend (transacciones y bloqueo de filas).
  inventory: (_lowStock = false) => done<InventoryItem[]>([]),
  movements: (_productId?: string, _page = 1) => done<InventoryMovement[]>([]),
  createMovement: (_body: unknown): Promise<{ productId: string; quantityBefore: number; quantityAfter: number }> =>
    Promise.reject(new ApiError(409, 'NOT_AVAILABLE', 'El inventario no está disponible en el modo demostración')),

  settings: () => run((): AdminSettings => readDb().settings),

  updateSettings: (body: unknown) =>
    run(() => {
      const patch = parse(updateSettingsSchema, body)
      return updateDb((db) => {
        Object.assign(db.settings, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)), {
          updatedAt: new Date().toISOString(),
        })
        return db.settings
      })
    }),

  createZone: (body: unknown) =>
    run(() => {
      const input = parse(deliveryZoneSchema, body)
      return updateDb((db) => {
        if (db.settings.deliveryZones.some((z) => z.name.toLowerCase() === input.name.toLowerCase())) {
          throw new ApiError(409, 'DUPLICATE', 'Ya existe una zona con ese nombre')
        }
        const zone: DeliveryZone = { id: crypto.randomUUID(), ...input }
        db.settings.deliveryZones.push(zone)
        return zone
      })
    }),

  updateZone: (id: string, body: unknown) =>
    run(() => {
      const patch = parse(updateDeliveryZoneSchema, body)
      return updateDb((db) => {
        const zone = db.settings.deliveryZones.find((z) => z.id === id)
        if (!zone) throw notFound('La zona')
        Object.assign(zone, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
        return zone
      })
    }),
}
