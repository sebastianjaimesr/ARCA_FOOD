import pg from 'pg'

// Al terminar todas las pruebas (aunque alguna falle a mitad de camino) se
// desactivan los datos de prueba para que no aparezcan en la tienda local.
export async function teardown() {
  if (!process.env.DATABASE_URL) return
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query(`update public.categories set is_active = false where slug like 'prueba-%' and is_active`)
    await client.query(`update public.option_groups set is_active = false where name like 'Extras prueba %' and is_active`)
    await client.query(`update public.delivery_zones set is_active = false where name like 'Zona prueba %' and is_active`)
  } finally {
    await client.end()
  }
}
