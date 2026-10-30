import { useCallback, useEffect, useState } from 'react'

// Caché mínima en memoria compartida entre páginas: el catálogo se descarga una
// vez por visita y navegar entre Inicio y Menú no vuelve a pedirlo.
const cache = new Map<string, { data: unknown; at: number }>()
const inflight = new Map<string, Promise<unknown>>()
const TTL_MS = 2 * 60 * 1000

function load<T>(key: string, fetcher: () => Promise<T>, force = false): Promise<T> {
  const cached = cache.get(key)
  if (!force && cached && Date.now() - cached.at < TTL_MS) return Promise.resolve(cached.data as T)
  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>
  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data, at: Date.now() })
      return data
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, promise)
  return promise
}

export type QueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error }

export function useQuery<T>(key: string, fetcher: () => Promise<T>) {
  const initial = cache.get(key)
  const [state, setState] = useState<QueryState<T>>(
    initial ? { status: 'success', data: initial.data as T } : { status: 'loading' },
  )

  const run = useCallback(
    (force: boolean) => {
      let active = true
      load(key, fetcher, force)
        .then((data) => active && setState({ status: 'success', data }))
        .catch((error: unknown) => active && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }))
      return () => {
        active = false
      }
    },
    // fetcher es estable por clave; no se incluye para no recargar en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  useEffect(() => run(false), [run])

  // Modo demostración: si el panel cambia el menú o la configuración en este
  // navegador, la tienda se actualiza al instante (sin esperar la caché).
  useEffect(() => {
    if (import.meta.env.VITE_STATIC_MODE === 'true') {
      let unsubscribe = () => {}
      let cancelled = false
      import('../local/local-db').then((db) => {
        if (!cancelled) unsubscribe = db.subscribeLocalDb(() => run(true))
      })
      return () => {
        cancelled = true
        unsubscribe()
      }
    }
  }, [run])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    run(true)
  }, [run])

  return { ...state, retry }
}
