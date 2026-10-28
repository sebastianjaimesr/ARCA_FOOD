import { rateLimit } from 'express-rate-limit'
import { env } from '../config/env.js'

const message = { error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' } }
const skip = () => env.NODE_ENV === 'test'

// Creación y consulta de pedidos: evita spam de pedidos falsos.
export const ordersLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message,
  skip,
})

// Cotización del carrito: se llama en cada cambio del carrito, límite más amplio.
export const quoteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message,
  skip,
})

// Panel administrativo: límite amplio, solo para frenar abusos.
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message,
  skip,
})
