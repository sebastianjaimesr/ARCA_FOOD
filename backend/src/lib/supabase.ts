import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

// Cliente con la clave service_role. Solo vive en el backend y solo se usa para
// validar tokens de sesión y administrar usuarios del personal.
export const supabaseAdmin = createClient(env.SUPABASE_URL ?? 'http://localhost', env.SUPABASE_SERVICE_ROLE_KEY ?? 'missing', {
  auth: { autoRefreshToken: false, persistSession: false },
})
