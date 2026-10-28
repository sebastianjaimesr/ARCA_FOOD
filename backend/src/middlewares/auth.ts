import type { RequestHandler } from 'express'
import { pool } from '../lib/db.js'
import { HttpError } from '../lib/http-error.js'
import { supabaseAdmin } from '../lib/supabase.js'

export type StaffRole = 'admin' | 'staff'
export type StaffUser = { id: string; email: string; fullName: string | null; role: StaffRole }

declare module 'express-serve-static-core' {
  interface Request {
    user?: StaffUser
  }
}

// Valida el token de Supabase Auth (Authorization: Bearer <jwt>) y carga el
// perfil. Una cuenta sin rol o desactivada no entra al panel.
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar')

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'INVALID_SESSION', 'Tu sesión expiró. Inicia sesión de nuevo')

  const { rows } = await pool.query<{ id: string; email: string; full_name: string | null; role: StaffRole | null; is_active: boolean }>(
    'select id, email, full_name, role, is_active from public.profiles where id = $1',
    [data.user.id],
  )
  const profile = rows[0]
  if (!profile || !profile.role || !profile.is_active) {
    throw new HttpError(403, 'FORBIDDEN', 'Tu cuenta no tiene acceso al panel administrativo')
  }

  req.user = { id: profile.id, email: profile.email, fullName: profile.full_name, role: profile.role }
  next()
}

// Se usa después de requireAuth. "admin" tiene acceso total; "staff" solo a lo operativo.
export function requireRole(...roles: StaffRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new HttpError(403, 'FORBIDDEN', 'No tienes permiso para esta operación')
    }
    next()
  }
}
