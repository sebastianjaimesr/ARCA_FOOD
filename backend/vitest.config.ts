import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Las pruebas de integración usan la base de datos local de backend/.env.
    // Sin DATABASE_URL se omiten y solo corren las unitarias.
    env: { ...loadEnv('development', process.cwd(), ''), NODE_ENV: 'test' },
    // Las pruebas de integración comparten la base de datos: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
})
