import type { Fulfillment } from './catalog'

export type OrderStatus = 'PENDIENTE' | 'CONFIRMADO' | 'EN_PREPARACION' | 'LISTO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO'

export type OrderItem = {
  id: string
  productId: string
  productName: string
  variantName: string | null
  options: { groupName: string; name: string; price: string }[]
  basePrice: string
  optionsPrice: string
  unitPrice: string
  quantity: number
  lineTotal: string
  notes: string | null
}

// Pedido tal como lo devuelve POST /api/orders (precios calculados por el backend).
export type Order = {
  id: string
  code: string
  status: OrderStatus
  fulfillment: Fulfillment
  customerName: string
  customerPhone: string
  deliveryAddress: string | null
  deliveryReference: string | null
  deliveryZoneName: string | null
  notes: string | null
  subtotal: string
  deliveryFee: string | null
  total: string
  createdAt: string
  items: OrderItem[]
}

export type OrderLookup = Pick<Order, 'code' | 'status' | 'fulfillment' | 'items' | 'subtotal' | 'deliveryFee' | 'total' | 'createdAt'>

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDIENTE: 'Pendiente de confirmación',
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En preparación',
  LISTO: 'Listo',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
}
