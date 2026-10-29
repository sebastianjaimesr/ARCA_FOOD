import pg from 'pg'
import { env } from '../config/env.js'
import { logger } from './logger.js'

// NUMERIC llega como texto ("19000.00") para no perder precisión; la conversión
// a centavos enteros la hace lib/money.ts.
export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Ninguna consulta de la aplicación debería tardar más de 10 s; si pasa, se
  // corta en vez de bloquear una conexión del pool.
  statement_timeout: 10_000,
  query_timeout: 15_000,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
})

pool.on('error', (err) => logger.error({ err }, 'Error inesperado en el pool de PostgreSQL'))

export type Db = pg.Pool | pg.PoolClient

// Ejecuta fn dentro de una transacción. Si fn lanza, se hace ROLLBACK.
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (err) {
    await client.query('rollback').catch(() => undefined)
    throw err
  } finally {
    client.release()
  }
}

// Códigos de error de PostgreSQL que la aplicación interpreta.
export const PG_UNIQUE_VIOLATION = '23505'
export const PG_FOREIGN_KEY_VIOLATION = '23503'
export const PG_CHECK_VIOLATION = '23514'

export function isPgError(err: unknown, code: string): err is pg.DatabaseError {
  return err instanceof pg.DatabaseError && err.code === code
}
