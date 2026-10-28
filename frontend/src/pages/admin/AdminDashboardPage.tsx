import { useEffect, useState } from 'react'
import { ApiError, getHealth, type Health } from '../../services/api'

type Status = { state: 'loading' } | { state: 'ok'; data: Health } | { state: 'error'; message: string }

// Por ahora solo verifica la conexión con la API. Las métricas reales llegan en la Fase 6.
export function AdminDashboardPage() {
  const [status, setStatus] = useState<Status>({ state: 'loading' })

  useEffect(() => {
    getHealth()
      .then((data) => setStatus({ state: 'ok', data }))
      .catch((error: unknown) =>
        setStatus({ state: 'error', message: error instanceof ApiError ? error.message : 'Error desconocido' }),
      )
  }, [])

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-black text-cream-50">Dashboard</h2>
      <div className="mt-6 rounded-xl border border-ink-700 bg-ink-900 p-5" role="status">
        <p className="text-xs font-semibold tracking-wider text-cream-300 uppercase">Estado de la API</p>
        {status.state === 'loading' && <p className="mt-2 text-cream-300">Comprobando…</p>}
        {status.state === 'ok' && (
          <p className="mt-2 font-semibold text-emerald-400">
            Conectada · {new Date(status.data.time).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' })}
          </p>
        )}
        {status.state === 'error' && <p className="mt-2 font-semibold text-red-400">{status.message}</p>}
      </div>
    </div>
  )
}
