import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, LogIn } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation } from 'react-router'
import { z } from 'zod'
import { useAuth } from '../../features/auth/auth-context'

// Modo completo: correo de Supabase Auth. Modo demostración: nombre de usuario.
const loginSchema = (kind: 'email' | 'username') =>
  z.object({
    identifier:
      kind === 'email'
        ? z.string().trim().email('Escribe un correo válido')
        : z.string().trim().min(3, 'Escribe tu usuario'),
    password: z.string().min(1, 'Escribe tu contraseña'),
  })
type LoginForm = z.infer<ReturnType<typeof loginSchema>>

const inputClass =
  'mt-1.5 w-full rounded-lg border border-ink-600 bg-ink-800 px-3.5 py-2.5 text-cream-50 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none'

export function AdminLoginPage() {
  const { state, signIn, identifierKind, configError } = useAuth()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema(identifierKind)) })

  if (state.status === 'signed-in') {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/admin/login' ? from : '/admin'} replace />
  }

  const onSubmit = handleSubmit(async ({ identifier, password }) => {
    setError(null)
    try {
      await signIn(identifier, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos iniciar sesión')
    }
  })

  return (
    <main className="grid min-h-dvh place-items-center bg-ink-950 px-4">
      <form onSubmit={onSubmit} noValidate className="w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-7 shadow-2xl">
        <p className="font-script text-4xl text-brand-500">El Arca</p>
        <h1 className="mt-1 text-lg font-bold text-cream-50">Panel administrativo</h1>

        {configError && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{configError}</p>}

        <label className="mt-6 block text-sm font-medium text-cream-100">
          {identifierKind === 'email' ? 'Correo' : 'Usuario'}
          <input
            type={identifierKind === 'email' ? 'email' : 'text'}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className={inputClass}
            aria-invalid={!!errors.identifier}
            {...register('identifier')}
          />
        </label>
        {errors.identifier && <p className="mt-1 text-xs text-red-400">{errors.identifier.message}</p>}

        <label className="mt-4 block text-sm font-medium text-cream-100">
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            className={inputClass}
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </label>
        {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-5 py-3 font-bold text-ink-900 transition hover:bg-brand-400 disabled:opacity-60"
        >
          {isSubmitting ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <LogIn className="size-5" aria-hidden />}
          Ingresar
        </button>
      </form>
    </main>
  )
}
