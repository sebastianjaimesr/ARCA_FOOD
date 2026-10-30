import type { Category, Fulfillment, Product, PublicSettings, Quote } from '../types/catalog'
import { apiFetch } from './api'

// En modo vitrina los datos salen del catálogo exportado (sin backend). La
// condición va en línea (import.meta.env…) y el módulo se importa bajo demanda
// para que el build normal elimine este código y el catálogo.
const staticStore = () => import('./static-store')

export const getSettings = () =>
  import.meta.env.VITE_STATIC_MODE === 'true' ? staticStore().then((s) => s.staticSettings()) : apiFetch<PublicSettings>('/api/settings')

export const getCategories = () =>
  import.meta.env.VITE_STATIC_MODE === 'true'
    ? staticStore().then((s) => s.staticCategories())
    : apiFetch<{ items: Category[] }>('/api/categories').then((r) => r.items)

export const getProducts = () =>
  import.meta.env.VITE_STATIC_MODE === 'true'
    ? staticStore().then((s) => s.staticProducts())
    : apiFetch<{ items: Product[] }>('/api/products').then((r) => r.items)

export type QuoteRequest = {
  // Sin modalidad, el backend solo valida productos y precios.
  fulfillment?: Fulfillment
  deliveryZoneId?: string | null
  items: { productId: string; variantId: string | null; optionIds: string[]; quantity: number; notes?: string | null }[]
}

export const quoteCart = (body: QuoteRequest, signal?: AbortSignal) =>
  import.meta.env.VITE_STATIC_MODE === 'true'
    ? staticStore().then((s) => s.staticQuote(body))
    : apiFetch<Quote>('/api/cart/quote', { method: 'POST', body: JSON.stringify(body), signal })
