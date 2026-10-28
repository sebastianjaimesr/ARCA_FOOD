import { z } from 'zod'
import { money, optionalText, slug, uuid } from './common.js'

// URL de imagen: solo https (o rutas locales /brand/...) para evitar contenido mixto o esquemas peligrosos.
const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v.startsWith('https://') || v.startsWith('/'), 'La imagen debe ser una URL https')
  .nullish()
  .transform((v) => v ?? null)

const variant = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(60),
  price: money,
  isActive: z.boolean().default(true),
})

const productBase = z.object({
  categoryId: uuid,
  slug: slug.optional(),
  name: z.string().trim().min(2).max(80),
  description: optionalText(500),
  price: money,
  imageUrl,
  imageAlt: optionalText(200),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  trackStock: z.boolean().default(false),
  minStock: z.number().int().min(0).max(100_000).default(0),
  variants: z.array(variant).max(10).default([]),
  optionGroupIds: z.array(uuid).max(10).default([]),
})

const uniqueVariantNames = (variants: { name: string }[] | undefined) =>
  !variants || new Set(variants.map((v) => v.name.toLowerCase())).size === variants.length

export const createProductSchema = productBase.refine((p) => uniqueVariantNames(p.variants), {
  path: ['variants'],
  message: 'Las variantes no pueden repetir nombre',
})

// En PATCH ningún campo tiene valor por defecto: solo cambia lo que se envía.
export const updateProductSchema = z
  .object({
    categoryId: uuid,
    slug,
    name: z.string().trim().min(2).max(80),
    description: optionalText(500),
    price: money,
    imageUrl,
    imageAlt: optionalText(200),
    isActive: z.boolean(),
    isAvailable: z.boolean(),
    isFeatured: z.boolean(),
    sortOrder: z.number().int().min(0).max(10_000),
    trackStock: z.boolean(),
    minStock: z.number().int().min(0).max(100_000),
    variants: z.array(variant).max(10),
    optionGroupIds: z.array(uuid).max(10),
  })
  .partial()
  .refine((p) => uniqueVariantNames(p.variants), { path: ['variants'], message: 'Las variantes no pueden repetir nombre' })

export const listProductsQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  categoryId: uuid.optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
})

export const categorySchema = z.object({
  slug: slug.optional(),
  name: z.string().trim().min(2).max(60),
  description: optionalText(200),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
})

export const updateCategorySchema = z
  .object({
    slug,
    name: z.string().trim().min(2).max(60),
    description: optionalText(200),
    sortOrder: z.number().int().min(0).max(10_000),
    isActive: z.boolean(),
  })
  .partial()

const groupLimits = <T extends { minSelect?: number; maxSelect?: number | null }>(g: T) =>
  g.maxSelect === undefined || g.maxSelect === null || g.minSelect === undefined || g.maxSelect >= g.minSelect

export const optionGroupSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    minSelect: z.number().int().min(0).max(20).default(0),
    maxSelect: z.number().int().min(1).max(20).nullable().default(null),
  })
  .refine(groupLimits, { path: ['maxSelect'], message: 'El máximo no puede ser menor que el mínimo' })

export const updateOptionGroupSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    minSelect: z.number().int().min(0).max(20),
    maxSelect: z.number().int().min(1).max(20).nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .refine(groupLimits, { path: ['maxSelect'], message: 'El máximo no puede ser menor que el mínimo' })

export const optionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  price: money,
  sortOrder: z.number().int().min(0).max(10_000).default(0),
})

export const updateOptionSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    price: money,
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0).max(10_000),
  })
  .partial()

export const inventoryMovementSchema = z
  .object({
    productId: uuid,
    type: z.enum(['ENTRADA', 'SALIDA', 'AJUSTE']),
    quantity: z.number().int().min(0).max(100_000),
    reason: z.string().trim().min(3, 'Explica el motivo del movimiento').max(200),
  })
  .refine((m) => m.type === 'AJUSTE' || m.quantity > 0, { path: ['quantity'], message: 'La cantidad debe ser mayor que cero' })

export const listMovementsQuerySchema = z.object({
  productId: uuid.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa HH:MM (24 horas)')

export const updateSettingsSchema = z
  .object({
    businessName: z.string().trim().min(2).max(80),
    tagline: optionalText(80),
    whatsappPhone: z
      .string()
      .transform((v) => v.replace(/\D/g, ''))
      .refine((v) => /^[0-9]{10,15}$/.test(v), 'Número en formato internacional, ej. 573006681727')
      .nullable(),
    address: optionalText(200),
    city: optionalText(80),
    instagramHandle: z
      .string()
      .trim()
      .transform((v) => v.replace(/^@/, ''))
      .refine((v) => /^[A-Za-z0-9._]{1,30}$/.test(v), 'Usuario de Instagram inválido')
      .nullable(),
    logoUrl: imageUrl,
    openingHours: z
      .array(z.object({ day: z.number().int().min(1).max(7), open: hhmm, close: hhmm }))
      .max(21)
      .nullable(),
    deliveryEnabled: z.boolean(),
    pickupEnabled: z.boolean(),
    acceptingOrders: z.boolean(),
    deliveryNotes: optionalText(300),
  })
  .partial()

export const deliveryZoneSchema = z.object({
  name: z.string().trim().min(2).max(80),
  fee: money,
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
})

export const updateDeliveryZoneSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    fee: money,
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0).max(10_000),
  })
  .partial()

export const statsQuerySchema = z.object({ range: z.enum(['day', 'week', 'month']).default('day') })

export const idParamSchema = z.object({ id: uuid })
