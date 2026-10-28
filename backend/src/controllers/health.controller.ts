import type { RequestHandler } from 'express'

export const getHealth: RequestHandler = (_req, res) => {
  res.json({ status: 'ok', service: 'el-arca-api', time: new Date().toISOString() })
}
