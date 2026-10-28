import { pino } from 'pino'
import { env } from '../config/env.js'

// Nunca se registran cabeceras de autenticación ni cookies.
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
})
