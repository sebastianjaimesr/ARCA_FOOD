import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { StaffUser } from '../../services/api'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  // Sesión válida en Supabase pero la cuenta no tiene rol en el panel.
  | { status: 'forbidden'; email: string }
  | { status: 'error'; message: string }
  // `session` solo existe con Supabase Auth (modo completo).
  | { status: 'signed-in'; user: StaffUser; session?: Session }

export type AuthContextValue = {
  state: AuthState
  signIn: (identifier: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  // Con qué se inicia sesión: correo (Supabase) o usuario (modo demostración).
  identifierKind: 'email' | 'username'
  // Problema de configuración que impide iniciar sesión (o null).
  configError: string | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
