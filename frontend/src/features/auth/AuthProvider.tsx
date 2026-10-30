import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { ApiError, getMe } from '../../services/api'
import { AuthContext, type AuthState } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  // El backend decide si la cuenta tiene acceso (rol admin/staff y activa).
  const resolveSession = useCallback(async (session: Session | null) => {
    if (!session) {
      setState({ status: 'signed-out' })
      return
    }
    try {
      const user = await getMe(session.access_token)
      setState({ status: 'signed-in', session, user })
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setState({ status: 'forbidden', email: session.user.email ?? '' })
      } else if (err instanceof ApiError && err.status === 401) {
        await supabase.auth.signOut()
        setState({ status: 'signed-out' })
      } else {
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Error desconocido' })
      }
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => resolveSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Al renovar el token solo se actualiza la sesión guardada.
      if (event === 'TOKEN_REFRESHED' && session) {
        setState((prev) => (prev.status === 'signed-in' ? { ...prev, session } : prev))
      } else if (event === 'SIGNED_OUT') {
        setState({ status: 'signed-out' })
      }
    })
    return () => data.subscription.unsubscribe()
  }, [resolveSession])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message)
      setState({ status: 'loading' })
      await resolveSession(data.session)
    },
    [resolveSession],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setState({ status: 'signed-out' })
  }, [])

  const value = useMemo(
    () => ({
      state,
      signIn,
      signOut,
      identifierKind: 'email' as const,
      configError: isSupabaseConfigured ? null : 'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.',
    }),
    [state, signIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
