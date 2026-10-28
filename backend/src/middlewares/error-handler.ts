import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../lib/http-error.js'
import { logger } from '../lib/logger.js'

// Formato único de error para toda la API: { error: { code, message, details? } }
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } })
    return
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: err.issues },
    })
    return
  }
  // JSON mal formado en el cuerpo de la solicitud (lo lanza express.json()).
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo no es JSON válido' } })
    return
  }
  if (typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'La solicitud es demasiado grande' } })
    return
  }
  logger.error({ err }, 'Error no controlado')
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } })
}
