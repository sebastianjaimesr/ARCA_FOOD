import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Product, Quote } from '../../types/catalog'
import { CartContext } from './cart-context'
import {
  addLine,
  applyQuote,
  buildLine,
  cartCount,
  estimateSubtotal,
  removeLine,
  replaceLine,
  setQuantity as setLineQuantity,
  storedCartSchema,
  type CartLine,
  type CartSelection,
} from './cart-logic'

const STORAGE_KEY = 'el-arca:cart'

// El carrito se conserva en el navegador del cliente (sobrevive recargas y
// navegación). Si el almacenamiento no está disponible, funciona en memoria.
function readStoredCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = storedCartSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data.lines : []
  } catch {
    return []
  }
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readStoredCart)
  const [lastAdded, setLastAdded] = useState<{ name: string; at: number } | null>(null)
  const linesRef = useRef(lines)

  useEffect(() => {
    linesRef.current = lines
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, lines }))
    } catch {
      // Modo privado o almacenamiento lleno: el carrito sigue funcionando en memoria.
    }
  }, [lines])

  // Mantiene sincronizadas varias pestañas abiertas de la tienda.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLines(readStoredCart())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback((product: Product, selection: CartSelection) => {
    setLines((prev) => addLine(prev, buildLine(product, selection, newId())))
    setLastAdded({ name: product.name, at: Date.now() })
  }, [])

  const update = useCallback((lineId: string, product: Product, selection: CartSelection) => {
    setLines((prev) => replaceLine(prev, lineId, buildLine(product, selection, lineId)))
  }, [])

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    setLines((prev) => setLineQuantity(prev, lineId, quantity))
  }, [])

  const remove = useCallback((lineId: string) => setLines((prev) => removeLine(prev, lineId)), [])
  const clear = useCallback(() => setLines([]), [])

  const syncWithQuote = useCallback((quote: Quote) => {
    const { lines: next, changed } = applyQuote(linesRef.current, quote)
    if (changed.length > 0 || next.some((l, i) => l !== linesRef.current[i])) setLines(next)
    return changed
  }, [])

  const value = useMemo(
    () => ({
      lines,
      count: cartCount(lines),
      subtotal: estimateSubtotal(lines),
      add,
      update,
      setQuantity,
      remove,
      clear,
      syncWithQuote,
      lastAdded,
    }),
    [lines, add, update, setQuantity, remove, clear, syncWithQuote, lastAdded],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
