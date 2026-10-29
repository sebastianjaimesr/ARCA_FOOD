import { supabase } from '../lib/supabase'
import type {
  AdminCategory,
  AdminOptionGroup,
  AdminOrder,
  AdminOrderListItem,
  AdminProduct,
  AdminSettings,
  DashboardStats,
  DeliveryZone,
  InventoryItem,
  InventoryMovement,
  StatsRange,
} from '../types/admin'
import type { OrderStatus } from '../types/order'
import { apiFetch, ApiError } from './api'

// Cliente del panel: cada solicitud lleva el token vigente de Supabase Auth
// (se renueva solo). El backend valida token y rol en cada llamada.
async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Tu sesión terminó. Inicia sesión de nuevo')
  try {
    return await apiFetch<T>(`/api/admin${path}`, { ...init, token })
  } catch (err) {
    // Sesión vencida o revocada: se cierra para volver al login.
    if (err instanceof ApiError && err.status === 401) await supabase.auth.signOut()
    throw err
  }
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })
const qs = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') search.set(k, String(v))
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const adminApi = {
  dashboard: (range: StatsRange) => adminFetch<DashboardStats>(`/dashboard${qs({ range })}`),

  orders: (filters: { status?: OrderStatus[]; from?: string; to?: string; q?: string; page: number; pageSize?: number }) =>
    adminFetch<{ items: AdminOrderListItem[]; total: number; page: number; pageSize: number }>(
      `/orders${qs({ status: filters.status?.join(','), from: filters.from, to: filters.to, q: filters.q, page: filters.page, pageSize: filters.pageSize ?? 20 })}`,
    ),
  order: (id: string) => adminFetch<AdminOrder>(`/orders/${id}`),
  setOrderStatus: (id: string, status: OrderStatus, note?: string | null) =>
    adminFetch<AdminOrder>(`/orders/${id}/status`, json('PATCH', { status, note })),

  products: (filters: { q?: string; categoryId?: string; status?: 'active' | 'inactive' | 'all' } = {}) =>
    adminFetch<{ items: AdminProduct[] }>(`/products${qs(filters)}`).then((r) => r.items),
  product: (id: string) => adminFetch<AdminProduct>(`/products/${id}`),
  createProduct: (body: unknown) => adminFetch<AdminProduct>('/products', json('POST', body)),
  updateProduct: (id: string, body: unknown) => adminFetch<AdminProduct>(`/products/${id}`, json('PATCH', body)),

  categories: () => adminFetch<{ items: AdminCategory[] }>('/categories').then((r) => r.items),
  createCategory: (body: unknown) => adminFetch<AdminCategory>('/categories', json('POST', body)),
  updateCategory: (id: string, body: unknown) => adminFetch<AdminCategory>(`/categories/${id}`, json('PATCH', body)),

  optionGroups: () => adminFetch<{ items: AdminOptionGroup[] }>('/option-groups').then((r) => r.items),
  createOptionGroup: (body: unknown) => adminFetch<AdminOptionGroup>('/option-groups', json('POST', body)),
  updateOptionGroup: (id: string, body: unknown) => adminFetch<AdminOptionGroup>(`/option-groups/${id}`, json('PATCH', body)),
  createOption: (groupId: string, body: unknown) => adminFetch<AdminOptionGroup>(`/option-groups/${groupId}/options`, json('POST', body)),
  updateOption: (id: string, body: unknown) => adminFetch<{ ok: true }>(`/options/${id}`, json('PATCH', body)),

  inventory: (lowStock = false) => adminFetch<{ items: InventoryItem[] }>(`/inventory${qs({ lowStock: lowStock ? 'true' : undefined })}`).then((r) => r.items),
  movements: (productId?: string, page = 1) =>
    adminFetch<{ items: InventoryMovement[] }>(`/inventory/movements${qs({ productId, page, pageSize: 30 })}`).then((r) => r.items),
  createMovement: (body: { productId: string; type: 'ENTRADA' | 'SALIDA' | 'AJUSTE'; quantity: number; reason: string }) =>
    adminFetch<{ productId: string; quantityBefore: number; quantityAfter: number }>('/inventory/movements', json('POST', body)),

  settings: () => adminFetch<AdminSettings>('/settings'),
  updateSettings: (body: unknown) => adminFetch<AdminSettings>('/settings', json('PATCH', body)),
  createZone: (body: unknown) => adminFetch<DeliveryZone>('/delivery-zones', json('POST', body)),
  updateZone: (id: string, body: unknown) => adminFetch<DeliveryZone>(`/delivery-zones/${id}`, json('PATCH', body)),
}

// Mensaje legible para mostrar en el panel; incluye el detalle de validación.
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
      const first = err.details[0] as { path?: (string | number)[]; message?: string } | undefined
      return first?.message ? `${err.message}: ${first.path?.join('.') ?? ''} ${first.message}`.trim() : err.message
    }
    return err.message
  }
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado'
}
