import type { Order } from '../../types/order'

// El último pedido creado se guarda en la sesión de esta pestaña para que la
// página de confirmación sobreviva una recarga o la vuelta desde WhatsApp.
// sessionStorage se borra al cerrar la pestaña.
const KEY = 'el-arca:last-order'

export function saveLastOrder(order: Order) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(order))
  } catch {
    // Sin almacenamiento: la confirmación se muestra igual en esta navegación.
  }
}

export function readLastOrder(code: string): Order | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    const order = raw ? (JSON.parse(raw) as Order) : null
    return order?.code === code ? order : null
  } catch {
    return null
  }
}
