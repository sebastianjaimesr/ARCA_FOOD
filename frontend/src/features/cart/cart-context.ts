import { createContext, useContext } from 'react'
import type { Product, Quote } from '../../types/catalog'
import type { CartLine, CartSelection } from './cart-logic'

export type CartContextValue = {
  lines: CartLine[]
  count: number
  subtotal: string
  add: (product: Product, selection: CartSelection) => void
  update: (lineId: string, product: Product, selection: CartSelection) => void
  setQuantity: (lineId: string, quantity: number) => void
  remove: (lineId: string) => void
  clear: () => void
  // Sincroniza los precios mostrados con la cotización del backend.
  syncWithQuote: (quote: Quote) => string[]
  // Último producto agregado: lo usa la notificación "Agregado al pedido".
  lastAdded: { name: string; at: number } | null
}

export const CartContext = createContext<CartContextValue | null>(null)

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>')
  return ctx
}
