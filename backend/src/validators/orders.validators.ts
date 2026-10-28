import { z } from 'zod'
import { ORDER_STATUSES } from '../domain/order-status.js'
import { colombianPhone, isoDate, money, optionalText, uuid } from './common.js'

const cartLine = z.object({
  productId: uuid,
  variantId: uuid.nullish().transform((v) => v ?? null),
  optionIds: z.array(uuid).max(20).default([]),
  quantity: z.number().int().min(1, 'Mínimo 1').max(50, 'Máximo 50 unidades por producto'),
  notes: optionalText(200),
})

const fulfillment = z.enum(['DOMICILIO', 'RECOGIDA'])

export const quoteSchema = z.object({
  fulfillment,
  deliveryZoneId: uuid.nullish().transform((v) => v ?? null),
  items: z.array(cartLine).min(1, 'El carrito está vacío').max(30, 'Máximo 30 líneas por pedido'),
})

export const createOrderSchema = quoteSchema
  .extend({
    customerName: z.string().trim().min(2, 'Escribe tu nombre').max(80),
    customerPhone: colombianPhone,
    deliveryAddress: optionalText(200),
    deliveryReference: optionalText(200),
    notes: optionalText(500),
    expectedTotal: money.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.fulfillment === 'DOMICILIO' && (!value.deliveryAddress || value.deliveryAddress.length < 5)) {
      ctx.addIssue({ code: 'custom', path: ['deliveryAddress'], message: 'Escribe la dirección de entrega' })
    }
  })

export const idempotencyKeySchema = z.string({ message: 'Falta la cabecera Idempotency-Key' }).uuid('Idempotency-Key debe ser un UUID')

export const orderLookupSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^ARC-\d{1,10}$/, 'Código de pedido inválido'),
  phone: colombianPhone,
})

export const listOrdersQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',') : undefined))
    .pipe(z.array(z.enum(ORDER_STATUSES)).optional()),
  from: isoDate.optional(),
  to: isoDate.optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

export const changeStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: optionalText(300),
})
