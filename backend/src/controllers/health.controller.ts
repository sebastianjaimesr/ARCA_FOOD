import type { RequestHandler } from 'express'
import { pool } from '../lib/db.js'

// Lo usa el hosting para saber si el servicio está sano. Incluye la base de
// datos: si no responde, devuelve 503 para que el hosting no le envíe tráfico.
export const getHealth: RequestHandler = async (_req, res) => {
  const time = new Date().toISOString()
  try {
    await pool.query('select 1')
    res.set('Cache-Control', 'no-store').json({ status: 'ok', service: 'el-arca-api', database: 'ok', time })
  } catch {
    res.status(503).set('Cache-Control', 'no-store').json({ status: 'degraded', service: 'el-arca-api', database: 'unreachable', time })
  }
}
