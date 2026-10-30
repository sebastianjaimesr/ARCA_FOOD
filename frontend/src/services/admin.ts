import { ApiError } from './api'

// El panel usa esta API sin saber dónde viven los datos:
//   - modo completo: backend Express + Supabase Auth (admin-remote.ts)
//   - modo demostración (GitHub Pages): LocalStorage del navegador (local/local-admin-api.ts)
// La elección se hace al compilar (condición en línea) para que el build de
// demostración no incluya Supabase y el build completo no incluya la base local.
type AdminApi = typeof import('./admin-remote').adminApi

const load = (): Promise<{ adminApi: AdminApi }> =>
  import.meta.env.VITE_STATIC_MODE === 'true' ? import('../local/local-admin-api') : import('./admin-remote')

export const adminApi = new Proxy({} as AdminApi, {
  get:
    (_target, method: string) =>
    (...args: unknown[]) =>
      load().then((impl) => (impl.adminApi[method as keyof AdminApi] as (...a: unknown[]) => Promise<unknown>)(...args)),
})

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
