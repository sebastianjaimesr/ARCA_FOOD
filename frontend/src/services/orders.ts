import type { Fulfillment } from '../types/catalog'
import type { Order, OrderLookup } from '../types/order'
import { apiFetch, ApiError } from './api'

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

// En modo vitrina el pedido no se registra: se arma con las mismas reglas del
// backend y se envía por WhatsApp.
export const createOrder = (body: CreateOrderBody, idempotencyKey: string) =>
  import.meta.env.VITE_STATIC_MODE === 'true'
    ? import('./static-store').then((s) => s.staticCreateOrder(body))
    : apiFetch<{ order: Order; replayed: boolean }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Idempotency-Key': idempotencyKey },
      })

export const lookupOrder = (code: string, phone: string) =>
  import.meta.env.VITE_STATIC_MODE === 'true'
    ? Promise.reject(new ApiError(404, 'NOT_AVAILABLE', 'La consulta de pedidos no está disponible en esta versión'))
    : apiFetch<OrderLookup>('/api/orders/lookup', { method: 'POST', body: JSON.stringify({ code, phone }) })
