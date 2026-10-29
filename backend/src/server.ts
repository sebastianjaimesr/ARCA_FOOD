import { createApp } from './app.js'
import { env } from './config/env.js'
import { pool } from './lib/db.js'
import { logger } from './lib/logger.js'

const server = createApp().listen(env.PORT, () => {
  logger.info(`API de El Arca escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`)
})

// Cierre ordenado: deja de aceptar conexiones, termina las solicitudes en curso
// y cierra el pool de PostgreSQL. Si tarda demasiado, se fuerza la salida.
function shutdown(signal: string) {
  logger.info(`${signal} recibido, cerrando servidor`)
  const force = setTimeout(() => process.exit(1), 10_000)
  force.unref()
  server.close(() => {
    pool.end().finally(() => process.exit(0))
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Promesa rechazada sin manejar'))
