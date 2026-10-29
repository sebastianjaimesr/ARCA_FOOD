// Cliente HTTP único del frontend. En desarrollo usa el proxy de Vite (/api);
// en producción, VITE_API_URL apunta al dominio del backend.
const API_URL = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

type ApiOptions = RequestInit & { token?: string | null }

export async function apiFetch<T>(path: string, { token, headers, ...init }: ApiOptions = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectar con el servidor. Revisa tu conexión.')
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const error = body?.error
    if (!error && res.status >= 500) {
      // Respuesta sin el formato de la API: el servidor está caído o reiniciando.
      throw new ApiError(res.status, 'SERVER_UNAVAILABLE', 'El servidor no está disponible en este momento. Intenta de nuevo en unos segundos.')
    }
    throw new ApiError(res.status, error?.code ?? 'UNKNOWN', error?.message ?? 'Ocurrió un error inesperado', error?.details)
  }
  return body as T
}

export type Health = { status: 'ok'; service: string; time: string }

export const getHealth = () => apiFetch<Health>('/api/health')

export type StaffUser = { id: string; email: string; fullName: string | null; role: 'admin' | 'staff' }

export const getMe = (token: string) => apiFetch<StaffUser>('/api/admin/me', { token })
