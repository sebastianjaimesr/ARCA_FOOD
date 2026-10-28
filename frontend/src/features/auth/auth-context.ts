import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { StaffUser } from '../../services/api'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  // Sesión válida en Supabase pero la cuenta no tiene rol en el panel.
  | { status: 'forbidden'; email: string }
  | { status: 'error'; message: string }
  | { status: 'signed-in'; session: Session; user: StaffUser }

export type AuthContextValue = {
  state: AuthState
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
