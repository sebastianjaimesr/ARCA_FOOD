import pg from 'pg'
import { loadEnv } from 'vite'

// El setup global corre en el proceso principal de Vitest, donde `test.env`
// todavía no se aplicó: se lee backend/.env directamente.
const DATABASE_URL = process.env.DATABASE_URL ?? loadEnv('development', process.cwd(), '').DATABASE_URL

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000 })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

// Antes de empezar: si la base local no responde, se avisa claramente en vez
// de dejar que las pruebas de integración se omitan en silencio.
export async function setup() {
  if (!DATABASE_URL) {
    console.warn('\n⚠️  Sin DATABASE_URL: solo se ejecutan las pruebas unitarias.\n')
    return
  }
  try {
    await withClient((c) => c.query('select 1'))
  } catch {
    console.warn(
      '\n⚠️  Supabase local no responde (¿Docker apagado?). Las pruebas de integración van a FALLAR.\n' +
        '   Ejecuta `npx supabase start` y vuelve a correr las pruebas.\n',
    )
  }
}

// Al terminar todas las pruebas (aunque alguna falle a mitad de camino) se
// desactivan los datos de prueba para que no aparezcan en la tienda local.
export async function teardown() {
  if (!DATABASE_URL) return
  await withClient(async (client) => {
    await client.query(`update public.categories set is_active = false where slug like 'prueba-%' and is_active`)
    await client.query(`update public.option_groups set is_active = false where name like 'Extras prueba %' and is_active`)
    await client.query(`update public.delivery_zones set is_active = false where name like 'Zona prueba %' and is_active`)
  }).catch(() => undefined)
}
