import { LoaderCircle, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { EmptyState } from '../../components/ui/EmptyState'
import { useAuth } from './auth-context'

// Protege la interfaz del panel. Es solo comodidad visual: la protección real
// está en el backend, que valida el token y el rol en cada solicitud.
export function RequireStaff({ children }: { children: ReactNode }) {
  const { state, signOut } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink-950" role="status">
        <LoaderCircle className="size-8 animate-spin text-brand-500" aria-label="Cargando" />
      </div>
    )
  }
  if (state.status === 'signed-out') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }
  if (state.status === 'forbidden' || state.status === 'error') {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink-950 px-4">
        <EmptyState icon={ShieldAlert} title={state.status === 'forbidden' ? 'Sin acceso al panel' : 'No pudimos verificar tu sesión'}>
          <p>
            {state.status === 'forbidden'
              ? `La cuenta ${state.email} no tiene un rol asignado. Pide a un administrador que te dé acceso.`
              : state.message}
          </p>
          <button onClick={signOut} className="mt-4 font-semibold text-brand-400 hover:underline">
            Cerrar sesión
          </button>
        </EmptyState>
      </div>
    )
  }
  return <>{children}</>
}
