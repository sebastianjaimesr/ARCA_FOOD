import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { currentLocalUser, signInLocal, signOutLocal } from '../../local/local-auth'
import { AuthContext, type AuthState } from './auth-context'

// Sesión del modo demostración (GitHub Pages): usuario y contraseña verificados
// en el navegador contra un hash. Ver las advertencias en local/local-auth.ts.
export function LocalAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const user = currentLocalUser()
    return user ? { status: 'signed-in', user } : { status: 'signed-out' }
  })

  const signIn = useCallback(async (username: string, password: string) => {
    const user = await signInLocal(username, password)
    setState({ status: 'signed-in', user })
  }, [])

  const signOut = useCallback(async () => {
    signOutLocal()
    setState({ status: 'signed-out' })
  }, [])

  const value = useMemo(
    () => ({ state, signIn, signOut, identifierKind: 'username' as const, configError: null }),
    [state, signIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
