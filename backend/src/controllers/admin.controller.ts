import type { RequestHandler } from 'express'
import { audit } from '../lib/audit.js'
import { pool } from '../lib/db.js'
import { HttpError } from '../lib/http-error.js'
import { listInventory, listMovements } from '../repositories/inventory.repository.js'
import { findOrderById, listOrders } from '../repositories/orders.repository.js'
import {
  findAdminCategory,
  findAdminProduct,
  insertCategory,
  insertOption,
  insertOptionGroup,
  listAdminCategories,
  listAdminProducts,
  listOptionGroups,
  updateCategory,
  updateOption,
  updateOptionGroup,
} from '../repositories/products.repository.js'
import {
  createDeliveryZone,
  getSettings,
  listDeliveryZones,
  updateDeliveryZone,
  updateSettings,
} from '../repositories/settings.repository.js'
import { registerManualMovement } from '../services/inventory.service.js'
import { changeOrderStatus } from '../services/orders.service.js'
import { createProduct, translateDbError, updateProduct } from '../services/products.service.js'
import { getDashboardStats } from '../services/stats.service.js'
import {
  categorySchema,
  createProductSchema,
  deliveryZoneSchema,
  idParamSchema,
  inventoryMovementSchema,
  listMovementsQuerySchema,
  listProductsQuerySchema,
  optionGroupSchema,
  optionSchema,
  statsQuerySchema,
  updateCategorySchema,
  updateDeliveryZoneSchema,
  updateOptionGroupSchema,
  updateOptionSchema,
  updateProductSchema,
  updateSettingsSchema,
} from '../validators/admin.validators.js'
import { slugify } from '../validators/common.js'
import { changeStatusSchema, listOrdersQuerySchema } from '../validators/orders.validators.js'

const actor = (req: Parameters<RequestHandler>[0]) => req.user!.id
const idOf = (req: Parameters<RequestHandler>[0]) => idParamSchema.parse(req.params).id

export const getMe: RequestHandler = (req, res) => {
  res.json(req.user)
}

// --- Dashboard ---------------------------------------------------------------
export const getDashboard: RequestHandler = async (req, res) => {
  const { range } = statsQuerySchema.parse(req.query)
  res.json(await getDashboardStats(range))
}

// --- Pedidos -----------------------------------------------------------------
export const getOrders: RequestHandler = async (req, res) => {
  const query = listOrdersQuerySchema.parse(req.query)
  const result = await listOrders(pool, {
    status: query.status,
    from: query.from,
    to: query.to,
    q: query.q,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  })
  res.json({ ...result, page: query.page, pageSize: query.pageSize })
}

export const getOrder: RequestHandler = async (req, res) => {
  const order = await findOrderById(pool, idOf(req), true)
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'El pedido no existe')
  res.json(order)
}

export const patchOrderStatus: RequestHandler = async (req, res) => {
  const { status, note } = changeStatusSchema.parse(req.body)
  res.json(await changeOrderStatus(idOf(req), status, actor(req), note))
}

// --- Productos ---------------------------------------------------------------
export const getAdminProducts: RequestHandler = async (req, res) => {
  res.json({ items: await listAdminProducts(pool, listProductsQuerySchema.parse(req.query)) })
}

export const getAdminProduct: RequestHandler = async (req, res) => {
  const product = await findAdminProduct(pool, idOf(req))
  if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'El producto no existe')
  res.json(product)
}

export const postProduct: RequestHandler = async (req, res) => {
  const input = createProductSchema.parse(req.body)
  res.status(201).json(await createProduct({ ...input, slug: input.slug ?? slugify(input.name) }, actor(req)))
}

export const patchProduct: RequestHandler = async (req, res) => {
  res.json(await updateProduct(idOf(req), updateProductSchema.parse(req.body), actor(req)))
}

// --- Categorías --------------------------------------------------------------
export const getAdminCategories: RequestHandler = async (_req, res) => {
  res.json({ items: await listAdminCategories(pool) })
}

export const postCategory: RequestHandler = async (req, res) => {
  const input = categorySchema.parse(req.body)
  try {
    const id = await insertCategory(pool, { ...input, slug: input.slug ?? slugify(input.name) })
    await audit(pool, { actorId: actor(req), action: 'category.create', entity: 'category', entityId: id, data: { name: input.name } })
    res.status(201).json(await findAdminCategory(pool, id))
  } catch (err) {
    translateDbError(err)
  }
}

export const patchCategory: RequestHandler = async (req, res) => {
  const id = idOf(req)
  const patch = updateCategorySchema.parse(req.body)
  if (!(await findAdminCategory(pool, id))) throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'La categoría no existe')
  try {
    await updateCategory(pool, id, patch)
  } catch (err) {
    translateDbError(err)
  }
  await audit(pool, { actorId: actor(req), action: 'category.update', entity: 'category', entityId: id, data: patch })
  res.json(await findAdminCategory(pool, id))
}

// --- Grupos de opciones / adicionales ---------------------------------------
export const getOptionGroups: RequestHandler = async (_req, res) => {
  res.json({ items: await listOptionGroups(pool) })
}

export const postOptionGroup: RequestHandler = async (req, res) => {
  const input = optionGroupSchema.parse(req.body)
  try {
    const id = await insertOptionGroup(pool, input)
    await audit(pool, { actorId: actor(req), action: 'option_group.create', entity: 'option_group', entityId: id, data: input })
    res.status(201).json((await listOptionGroups(pool)).find((g) => g.id === id))
  } catch (err) {
    translateDbError(err)
  }
}

export const patchOptionGroup: RequestHandler = async (req, res) => {
  const id = idOf(req)
  const patch = updateOptionGroupSchema.parse(req.body)
  let updated = 0
  try {
    updated = await updateOptionGroup(pool, id, patch)
  } catch (err) {
    translateDbError(err)
  }
  if (!updated) throw new HttpError(404, 'OPTION_GROUP_NOT_FOUND', 'El grupo no existe')
  await audit(pool, { actorId: actor(req), action: 'option_group.update', entity: 'option_group', entityId: id, data: patch })
  res.json((await listOptionGroups(pool)).find((g) => g.id === id))
}

export const postOption: RequestHandler = async (req, res) => {
  const groupId = idOf(req)
  const input = optionSchema.parse(req.body)
  try {
    const id = await insertOption(pool, groupId, input)
    await audit(pool, { actorId: actor(req), action: 'option.create', entity: 'option', entityId: id, data: input })
  } catch (err) {
    translateDbError(err)
  }
  res.status(201).json((await listOptionGroups(pool)).find((g) => g.id === groupId))
}

export const patchOption: RequestHandler = async (req, res) => {
  const id = idOf(req)
  const patch = updateOptionSchema.parse(req.body)
  let updated = 0
  try {
    updated = await updateOption(pool, id, patch)
  } catch (err) {
    translateDbError(err)
  }
  if (!updated) throw new HttpError(404, 'OPTION_NOT_FOUND', 'La opción no existe')
  await audit(pool, { actorId: actor(req), action: 'option.update', entity: 'option', entityId: id, data: patch })
  res.json({ ok: true })
}

// --- Inventario --------------------------------------------------------------
export const getInventory: RequestHandler = async (req, res) => {
  res.json({ items: await listInventory(pool, { lowStockOnly: req.query.lowStock === 'true' }) })
}

export const getMovements: RequestHandler = async (req, res) => {
  const query = listMovementsQuerySchema.parse(req.query)
  res.json({
    items: await listMovements(pool, {
      productId: query.productId,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    page: query.page,
    pageSize: query.pageSize,
  })
}

export const postMovement: RequestHandler = async (req, res) => {
  res.status(201).json(await registerManualMovement(inventoryMovementSchema.parse(req.body), actor(req)))
}

// --- Configuración -----------------------------------------------------------
export const getAdminSettings: RequestHandler = async (_req, res) => {
  const [settings, zones] = await Promise.all([getSettings(pool), listDeliveryZones(pool, false)])
  res.json({ ...settings, deliveryZones: zones })
}

export const patchSettings: RequestHandler = async (req, res) => {
  const patch = updateSettingsSchema.parse(req.body)
  const settings = await updateSettings(pool, patch, actor(req))
  await audit(pool, { actorId: actor(req), action: 'settings.update', entity: 'settings', entityId: '1', data: Object.keys(patch) })
  res.json(settings)
}

export const postDeliveryZone: RequestHandler = async (req, res) => {
  const input = deliveryZoneSchema.parse(req.body)
  try {
    const zone = await createDeliveryZone(pool, input)
    await audit(pool, { actorId: actor(req), action: 'delivery_zone.create', entity: 'delivery_zone', entityId: zone.id, data: input })
    res.status(201).json(zone)
  } catch (err) {
    translateDbError(err)
  }
}

export const patchDeliveryZone: RequestHandler = async (req, res) => {
  const id = idOf(req)
  const patch = updateDeliveryZoneSchema.parse(req.body)
  let zone = null
  try {
    zone = await updateDeliveryZone(pool, id, patch)
  } catch (err) {
    translateDbError(err)
  }
  if (!zone) throw new HttpError(404, 'ZONE_NOT_FOUND', 'La zona no existe')
  await audit(pool, { actorId: actor(req), action: 'delivery_zone.update', entity: 'delivery_zone', entityId: id, data: patch })
  res.json(zone)
}
