import type { Category, Fulfillment, Product, PublicSettings, Quote } from '../types/catalog'
import { apiFetch } from './api'

export const getSettings = () => apiFetch<PublicSettings>('/api/settings')

export const getCategories = () => apiFetch<{ items: Category[] }>('/api/categories').then((r) => r.items)

export const getProducts = () => apiFetch<{ items: Product[] }>('/api/products').then((r) => r.items)

export type QuoteRequest = {
  // Sin modalidad, el backend solo valida productos y precios.
  fulfillment?: Fulfillment
  deliveryZoneId?: string | null
  items: { productId: string; variantId: string | null; optionIds: string[]; quantity: number; notes?: string | null }[]
}

export const quoteCart = (body: QuoteRequest, signal?: AbortSignal) =>
  apiFetch<Quote>('/api/cart/quote', { method: 'POST', body: JSON.stringify(body), signal })
