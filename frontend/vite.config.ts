/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { headersFile, parseHeadersFile, redirectsFile, securityHeaders } from './deploy/security-headers.ts'

// Genera dist/_headers y dist/_redirects para el hosting estático. `vite preview`
// lee ese mismo dist/_headers, así se prueba exactamente lo que se publicará
// (menos HSTS y upgrade-insecure-requests, que en local sin https no aplican).
function staticHostingFiles(headers: Record<string, string>): Plugin {
  return {
    name: 'el-arca-static-hosting',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: headersFile(headers) })
      this.emitFile({ type: 'asset', fileName: '_redirects', source: redirectsFile })
    },
    configurePreviewServer(server) {
      const rules = parseHeadersFile(readFileSync(resolve(server.config.build.outDir, '_headers'), 'utf8'))
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '/').split('?')[0]!
        for (const rule of rules) {
          if (!rule.matches(path)) continue
          for (const [key, value] of Object.entries(rule.headers)) {
            if (key === 'Strict-Transport-Security') continue
            res.setHeader(key, key === 'Content-Security-Policy' ? value.replace('; upgrade-insecure-requests', '') : value)
          }
        }
        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const production = mode === 'production'

  return {
    plugins: [react(), tailwindcss(), staticHostingFiles(securityHeaders(env, true))],
    server: {
      port: 5173,
      // En desarrollo, /api se reenvía al backend de Express para evitar problemas de CORS.
      proxy: { '/api': 'http://localhost:4000' },
    },
    preview: {
      port: 4173,
      proxy: { '/api': 'http://localhost:4000' },
    },
    // Sin mapas de código en producción: no se publican archivos .map.
    build: { sourcemap: !production },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})
