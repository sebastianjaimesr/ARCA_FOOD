// Cliente HTTP único del frontend. En desarrollo usa el proxy de Vite (/api);
// en producción, VITE_API_URL apunta al dominio del backend.
const API_URL = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectar con el servidor. Revisa tu conexión.')
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const error = body?.error
    throw new ApiError(res.status, error?.code ?? 'UNKNOWN', error?.message ?? 'Ocurrió un error inesperado')
  }
  return body as T
}

export type Health = { status: 'ok'; service: string; time: string }

export const getHealth = () => apiFetch<Health>('/api/health')
