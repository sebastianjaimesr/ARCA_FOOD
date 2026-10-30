import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../services/admin'

export type AdminDataState<T> =
  | { status: 'loading'; data?: T; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: T; error: string }

// Carga datos del panel. No usa caché: el panel siempre muestra lo vigente.
// Al recargar conserva los datos anteriores (sin parpadeo) mientras llega lo nuevo.
// `deps` es la llave de la consulta (filtros); cambiarla vuelve a cargar.
export function useAdminData<T>(fetcher: () => Promise<T>, deps: unknown[], options: { refreshMs?: number } = {}) {
  const [state, setState] = useState<AdminDataState<T>>({ status: 'loading' })
  const [version, setVersion] = useState(0)
  const key = JSON.stringify(deps)

  useEffect(() => {
    let active = true
    fetcher()
      .then((data) => active && setState({ status: 'success', data }))
      .catch((err: unknown) => active && setState((prev) => ({ status: 'error', data: prev.data, error: errorMessage(err) })))
    return () => {
      active = false
    }
    // La llave de dependencias es `key` (los filtros serializados) y `version`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version])

  // Actualización periódica (ej. pedidos nuevos), solo con la pestaña visible.
  useEffect(() => {
    if (!options.refreshMs) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setVersion((v) => v + 1)
    }, options.refreshMs)
    return () => clearInterval(timer)
  }, [options.refreshMs])

  // Modo demostración: los datos viven en este navegador; cualquier cambio
  // (un pedido nuevo desde la tienda, otra pestaña del panel) recarga al instante.
  useEffect(() => {
    if (import.meta.env.VITE_STATIC_MODE === 'true') {
      let unsubscribe = () => {}
      let cancelled = false
      import('../local/local-db').then((db) => {
        if (!cancelled) unsubscribe = db.subscribeLocalDb(() => setVersion((v) => v + 1))
      })
      return () => {
        cancelled = true
        unsubscribe()
      }
    }
  }, [])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const setData = useCallback((data: T) => setState({ status: 'success', data }), [])

  return { ...state, reload, setData }
}
