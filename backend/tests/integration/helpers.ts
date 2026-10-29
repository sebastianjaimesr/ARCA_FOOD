import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { pool } from '../../src/lib/db.js'
import { supabaseAdmin } from '../../src/lib/supabase.js'

// Las pruebas de integración necesitan Supabase local (npx supabase start).
export const hasDb = Boolean(process.env.DATABASE_URL && process.env.SUPABASE_ANON_KEY)

const suffix = () => randomBytes(4).toString('hex')

// Supabase Auth local a veces tarda en responder justo después de arrancar
// (o devuelve 429/5xx transitorios). Se reintenta unas veces y, si sigue
// fallando, el error dice qué pasó en vez de omitir el archivo en silencio.
async function withRetry<R extends { error: { message: string; status?: number } | null }>(label: string, fn: () => Promise<R>): Promise<R> {
  let last = ''
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fn()
    const { error } = response
    if (!error) return response
    last = `${error.status ?? '?'} ${error.message}`
    const transient = !error.status || error.status === 429 || error.status >= 500
    if (!transient) break
    await new Promise((r) => setTimeout(r, 500 * attempt))
  }
  throw new Error(`Supabase Auth (${label}) falló: ${last}`)
}

// Crea un usuario de Auth con contraseña aleatoria (nunca se guarda) y devuelve
// su token de sesión. role = null simula una cuenta sin acceso al panel.
export async function createStaffSession(role: 'admin' | 'staff' | null) {
  const email = `prueba-${role ?? 'sinrol'}-${suffix()}@el-arca.test`
  const password = randomBytes(24).toString('base64url')
  const { data } = await withRetry('crear usuario', () => supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true }))
  if (!data.user) throw new Error('No se pudo crear el usuario de prueba')
  if (role) await pool.query('update public.profiles set role = $2 where id = $1', [data.user.id, role])

  const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const session = await withRetry('iniciar sesión', () => anon.auth.signInWithPassword({ email, password }))
  if (!session.data.session) throw new Error('No se pudo iniciar sesión')

  return {
    id: data.user.id,
    email,
    token: session.data.session.access_token,
    remove: () => supabaseAdmin.auth.admin.deleteUser(data.user.id),
  }
}

// Catálogo aislado para las pruebas: no toca los productos reales de la carta.
// Al terminar se desactiva la categoría para que no aparezca en la tienda.
export async function createTestCatalog() {
  const s = suffix()
  const category = await pool.query<{ id: string }>(
    `insert into public.categories (slug, name, sort_order) values ($1, $2, 999) returning id`,
    [`prueba-${s}`, `Prueba ${s}`],
  )
  const categoryId = category.rows[0]!.id

  const insertProduct = async (name: string, price: number, extra: { trackStock?: boolean; stock?: number } = {}) => {
    const { rows } = await pool.query<{ id: string }>(
      `insert into public.products (category_id, slug, name, price, track_stock, stock_quantity)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [categoryId, `prueba-${s}-${name.toLowerCase().replace(/\W+/g, '-')}`, name, price, extra.trackStock ?? false, extra.stock ?? 0],
    )
    return rows[0]!.id
  }

  const burgerId = await insertProduct('Hamburguesa prueba', 20000)
  const drinkId = await insertProduct('Gaseosa prueba', 4000, { trackStock: true, stock: 5 })
  const hotDogId = await insertProduct('Perro prueba', 15000)

  const variants = await pool.query<{ id: string; name: string }>(
    `insert into public.product_variants (product_id, name, price, sort_order)
     values ($1, 'Zenú', 15000, 1), ($1, 'Americana', 16000, 2) returning id, name`,
    [hotDogId],
  )
  const group = await pool.query<{ id: string }>(
    `insert into public.option_groups (name, max_select) values ($1, 2) returning id`,
    [`Extras prueba ${s}`],
  )
  const groupId = group.rows[0]!.id
  const options = await pool.query<{ id: string; name: string }>(
    `insert into public.options (group_id, name, price) values ($1, 'Tocineta', 3000), ($1, 'Queso', 2000) returning id, name`,
    [groupId],
  )
  await pool.query(
    `insert into public.product_option_groups (product_id, group_id) values ($1, $3), ($2, $3)`,
    [burgerId, hotDogId, groupId],
  )

  return {
    categoryId,
    burgerId,
    drinkId,
    hotDogId,
    zenuId: variants.rows.find((v) => v.name === 'Zenú')!.id,
    americanaId: variants.rows.find((v) => v.name === 'Americana')!.id,
    tocinetaId: options.rows.find((o) => o.name === 'Tocineta')!.id,
    quesoId: options.rows.find((o) => o.name === 'Queso')!.id,
    groupId,
    cleanup: async () => {
      await pool.query('update public.categories set is_active = false where id = $1', [categoryId])
      await pool.query('update public.option_groups set is_active = false where id = $1', [groupId])
    },
  }
}

export function orderBody(items: unknown[], extra: Record<string, unknown> = {}) {
  return {
    customerName: 'Cliente de prueba',
    customerPhone: '3001234567',
    fulfillment: 'RECOGIDA',
    items,
    ...extra,
  }
}

export const newKey = () => randomUUID()
