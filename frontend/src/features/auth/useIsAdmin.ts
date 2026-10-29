import { useAuth } from './auth-context'

// Solo para mostrar u ocultar controles. La autorización real está en el backend.
export function useIsAdmin() {
  const { state } = useAuth()
  return state.status === 'signed-in' && state.user.role === 'admin'
}
