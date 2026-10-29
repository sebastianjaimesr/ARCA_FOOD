import compression from 'compression'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { env } from './config/env.js'
import { logger } from './lib/logger.js'
import { errorHandler } from './middlewares/error-handler.js'
import { notFound } from './middlewares/not-found.js'
import { apiRouter } from './routes/index.js'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  // Solo se confía en X-Forwarded-For si hay proxies configurados (TRUST_PROXY).
  app.set('trust proxy', env.TRUST_PROXY)
  app.use(helmet())
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    }),
  )
  // El catálogo completo pesa ~60 KB en JSON y ~8 KB comprimido.
  app.use(compression())
  app.use(express.json({ limit: '100kb' }))
  app.use(pinoHttp({ logger }))

  app.use('/api', apiRouter)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
