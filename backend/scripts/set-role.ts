// Asigna o retira el rol de una cuenta del personal.
//
//   npm run set-role -w backend -- correo@ejemplo.com admin
//   npm run set-role -w backend -- correo@ejemplo.com staff
//   npm run set-role -w backend -- correo@ejemplo.com none     (quita el acceso)
//
// La cuenta debe existir antes en Supabase Auth (Studio → Authentication →
// Add user). Este script nunca crea ni muestra contraseñas.
import { pool } from '../src/lib/db.js'

const [email, role] = process.argv.slice(2)
const roles = { admin: 'admin', staff: 'staff', none: null } as const

if (!email || !role || !(role in roles)) {
  console.error('Uso: npm run set-role -w backend -- <correo> <admin|staff|none>')
  process.exit(1)
}

const { rows } = await pool.query<{ email: string; role: string | null }>(
  'update public.profiles set role = $2 where email = $1 returning email, role',
  [email.trim().toLowerCase(), roles[role as keyof typeof roles]],
)
await pool.end()

if (rows.length === 0) {
  console.error(`No existe una cuenta con el correo ${email}. Créala primero en Supabase Auth.`)
  process.exit(1)
}
console.log(`Listo: ${rows[0]!.email} → ${rows[0]!.role ?? 'sin acceso'}`)
