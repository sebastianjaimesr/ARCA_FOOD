// Crea (o reutiliza) la cuenta de administrador de DESARROLLO LOCAL usando
// DEV_ADMIN_EMAIL y DEV_ADMIN_PASSWORD de backend/.env y le asigna el rol admin.
// Se usa después de `npm run db:reset`. Nunca apuntes esto a producción.
import { pool } from '../src/lib/db.js'
import { supabaseAdmin } from '../src/lib/supabase.js'

const email = process.env.DEV_ADMIN_EMAIL
const password = process.env.DEV_ADMIN_PASSWORD
const url = process.env.SUPABASE_URL ?? ''

if (!email || !password) {
  console.log('Sin DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD en backend/.env: no se crea cuenta de desarrollo.')
  process.exit(0)
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)) {
  console.error('Este script solo se ejecuta contra Supabase local (SUPABASE_URL debe ser localhost).')
  process.exit(1)
}

const { error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })
if (error && !/already|registered|exists/i.test(error.message)) {
  console.error(`No se pudo crear la cuenta: ${error.message}`)
  process.exit(1)
}
const { rowCount } = await pool.query(`update public.profiles set role = 'admin' where email = $1`, [email.toLowerCase()])
await pool.end()
console.log(rowCount ? `Cuenta de desarrollo lista: ${email} (admin)` : 'No se encontró el perfil de la cuenta.')
