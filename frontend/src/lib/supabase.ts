import { createClient } from '@supabase/supabase-js'

// Solo se usa para iniciar sesión en el panel. La clave anon es pública por
// diseño: no da acceso a ninguna tabla (RLS sin políticas). Todos los datos
// pasan por la API de Express.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const isSupabaseConfigured = Boolean(url && anonKey)
