import type { Fulfillment, OpeningHours } from './catalog'
import type { OrderItem, OrderStatus } from './order'

export type StatsRange = 'day' | 'week' | 'month'

export type DashboardStats = {
  range: StatsRange
  timezone: string
  from: string
  to: string
  queue: Record<OrderStatus, number>
  received: { total: number; byStatus: Record<OrderStatus, number> }
  sales: {
    deliveredOrders: number
    revenue: string
    productsRevenue: string
    deliveryRevenue: string
    averageTicket: string | null
  }
  topProducts: { productId: string; name: string; quantity: number; revenue: string }[]
  lowStock: { productId: string; name: string; stockQuantity: number; minStock: number }[]
}

export type AdminOrderListItem = {
  id: string
  code: string
  status: OrderStatus
  fulfillment: Fulfillment
  customerName: string
  customerPhone: string
  deliveryZoneName: string | null
  total: string
  createdAt: string
  itemsCount: number
}

export type AdminOrder = {
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
  stockApplied: boolean
  cancelReason: string | null
  createdAt: string
  confirmedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  items: OrderItem[]
  history: { fromStatus: OrderStatus | null; toStatus: OrderStatus; note: string | null; changedBy: string | null; createdAt: string }[]
  allowedTransitions: OrderStatus[]
}

export type AdminVariant = { id?: string; name: string; price: string; isActive: boolean; sortOrder?: number }

export type AdminProduct = {
  id: string
  categoryId: string
  categoryName: string
  slug: string
  name: string
  description: string | null
  price: string
  imageUrl: string | null
  imageAlt: string | null
  isActive: boolean
  isAvailable: boolean
  isFeatured: boolean
  sortOrder: number
  trackStock: boolean
  stockQuantity: number
  minStock: number
  variants: AdminVariant[]
  optionGroupIds: string[]
  updatedAt: string
}

export type AdminCategory = {
  id: string
  slug: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  productsCount: number
}

export type AdminOptionGroup = {
  id: string
  name: string
  minSelect: number
  maxSelect: number | null
  isActive: boolean
  options: { id: string; name: string; price: string; isActive: boolean; sortOrder: number }[]
}

export type InventoryItem = {
  productId: string
  productName: string
  categoryName: string
  isActive: boolean
  stockQuantity: number
  minStock: number
  lowStock: boolean
}

export type MovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'PEDIDO' | 'REVERSION_PEDIDO'

export type InventoryMovement = {
  id: number
  productId: string
  productName: string
  type: MovementType
  quantityChange: number
  quantityBefore: number
  quantityAfter: number
  reason: string
  orderCode: string | null
  createdBy: string | null
  createdAt: string
}

export type DeliveryZone = { id: string; name: string; fee: string; isActive: boolean; sortOrder: number }

export type AdminSettings = {
  businessName: string
  tagline: string | null
  whatsappPhone: string | null
  address: string | null
  city: string | null
  instagramHandle: string | null
  logoUrl: string | null
  currency: string
  timezone: string
  openingHours: OpeningHours | null
  deliveryEnabled: boolean
  pickupEnabled: boolean
  acceptingOrders: boolean
  deliveryNotes: string | null
  updatedAt: string
  deliveryZones: DeliveryZone[]
}
