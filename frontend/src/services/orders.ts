import type { Fulfillment } from '../types/catalog'
import type { Order, OrderLookup } from '../types/order'
import { apiFetch } from './api'

export type CreateOrderBody = {
  fulfillment: Fulfillment
  deliveryZoneId: string | null
  customerName: string
  customerPhone: string
  deliveryAddress: string | null
  deliveryReference: string | null
  notes: string | null
  // Total que el cliente vio; si cambió, el backend responde PRICE_CHANGED.
  expectedTotal?: string
  items: { productId: string; variantId: string | null; optionIds: string[]; quantity: number; notes: string | null }[]
}

export const createOrder = (body: CreateOrderBody, idempotencyKey: string) =>
  apiFetch<{ order: Order; replayed: boolean }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Idempotency-Key': idempotencyKey },
  })

export const lookupOrder = (code: string, phone: string) =>
  apiFetch<OrderLookup>('/api/orders/lookup', { method: 'POST', body: JSON.stringify({ code, phone }) })
