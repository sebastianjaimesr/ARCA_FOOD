import { useEffect, useState } from 'react'
import { ApiError } from '../../services/api'
import { quoteCart } from '../../services/catalog'
import type { Quote } from '../../types/catalog'
import { useCart } from './cart-context'
import { toQuoteItems } from './cart-logic'

export type CartIssue = { code: string; message: string; lineIndex: number | null; productId: string | null }

export type QuoteState =
  | { status: 'idle' | 'loading' }
  | { status: 'ok'; quote: Quote; priceChanges: string[] }
  | { status: 'issue'; issue: CartIssue }
  | { status: 'network-error'; message: string }

// Valida el carrito con el backend cada vez que cambia su contenido (con una
// pequeña espera para no llamar en cada clic). Si un precio cambió, actualiza
// el carrito y devuelve qué productos cambiaron para avisarle al cliente.
export function useCartQuote() {
  const { lines, syncWithQuote } = useCart()
  const [attempt, setAttempt] = useState(0)
  // El resultado se guarda junto con la "llave" del carrito que se cotizó: si
  // el carrito cambió, el resultado anterior ya no aplica y se muestra "cargando".
  const [result, setResult] = useState<{ key: string; value: QuoteState } | null>(null)
  const key = `${attempt}:${JSON.stringify(toQuoteItems(lines))}`
  const isEmpty = lines.length === 0

  useEffect(() => {
    if (isEmpty) return
    const items = JSON.parse(key.slice(key.indexOf(':') + 1)) as ReturnType<typeof toQuoteItems>
    const controller = new AbortController()
    const timer = setTimeout(() => {
      quoteCart({ items }, controller.signal)
        .then((quote) => setResult({ key, value: { status: 'ok', quote, priceChanges: syncWithQuote(quote) } }))
        .catch((err: unknown) => {
          if (controller.signal.aborted) return
          if (err instanceof ApiError && err.status === 409) {
            const details = (err.details ?? {}) as { line?: number; productId?: string }
            setResult({
              key,
              value: {
                status: 'issue',
                issue: { code: err.code, message: err.message, lineIndex: details.line ?? null, productId: details.productId ?? null },
              },
            })
          } else {
            setResult({ key, value: { status: 'network-error', message: err instanceof Error ? err.message : 'Error de conexión' } })
          }
        })
    }, 350)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [key, isEmpty, syncWithQuote])

  const state: QuoteState = isEmpty ? { status: 'idle' } : result?.key === key ? result.value : { status: 'loading' }
  return { state, retry: () => setAttempt((n) => n + 1) }
}
