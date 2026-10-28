export const ORDER_STATUSES = [
  'PENDIENTE',
  'CONFIRMADO',
  'EN_PREPARACION',
  'LISTO',
  'EN_CAMINO',
  'ENTREGADO',
  'CANCELADO',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]
export type Fulfillment = 'DOMICILIO' | 'RECOGIDA'

// Flujo del pedido. CANCELADO y ENTREGADO son finales.
//   Domicilio: PENDIENTE → CONFIRMADO → EN_PREPARACION → LISTO → EN_CAMINO → ENTREGADO
//   Recogida:  PENDIENTE → CONFIRMADO → EN_PREPARACION → LISTO → ENTREGADO
// Se puede cancelar en cualquier estado no final.
const FORWARD: Record<Fulfillment, Partial<Record<OrderStatus, OrderStatus>>> = {
  DOMICILIO: {
    PENDIENTE: 'CONFIRMADO',
    CONFIRMADO: 'EN_PREPARACION',
    EN_PREPARACION: 'LISTO',
    LISTO: 'EN_CAMINO',
    EN_CAMINO: 'ENTREGADO',
  },
  RECOGIDA: {
    PENDIENTE: 'CONFIRMADO',
    CONFIRMADO: 'EN_PREPARACION',
    EN_PREPARACION: 'LISTO',
    LISTO: 'ENTREGADO',
  },
}

export const FINAL_STATUSES: readonly OrderStatus[] = ['ENTREGADO', 'CANCELADO']

export function allowedTransitions(from: OrderStatus, fulfillment: Fulfillment): OrderStatus[] {
  if (FINAL_STATUSES.includes(from)) return []
  const next = FORWARD[fulfillment][from]
  return next ? [next, 'CANCELADO'] : ['CANCELADO']
}

export function canTransition(from: OrderStatus, to: OrderStatus, fulfillment: Fulfillment): boolean {
  return allowedTransitions(from, fulfillment).includes(to)
}

// Regla de inventario: las existencias se descuentan al CONFIRMAR el pedido
// (no al crearlo ni al abrir WhatsApp) y se devuelven si se cancela después.
export const STOCK_DEDUCTION_STATUS: OrderStatus = 'CONFIRMADO'
