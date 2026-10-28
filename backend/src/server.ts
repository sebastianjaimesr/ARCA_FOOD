import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './lib/logger.js'

const server = createApp().listen(env.PORT, () => {
  logger.info(`API de El Arca escuchando en http://localhost:${env.PORT}`)
})

function shutdown(signal: string) {
  logger.info(`${signal} recibido, cerrando servidor`)
  server.close(() => process.exit(0))
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
