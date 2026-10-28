import { describe, expect, it } from 'vitest'
import { loadEnv } from '../../src/config/env.js'

const test = { NODE_ENV: 'test' }

describe('loadEnv', () => {
  it('usa valores por defecto seguros', () => {
    const env = loadEnv(test)
    expect(env.PORT).toBe(4000)
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173'])
  })

  it('separa los orígenes CORS por comas', () => {
    const env = loadEnv({ ...test, CORS_ORIGINS: 'http://a.com, http://b.com' })
    expect(env.CORS_ORIGINS).toEqual(['http://a.com', 'http://b.com'])
  })

  it('trata las variables vacías del .env como no definidas', () => {
    const env = loadEnv({ ...test, DATABASE_URL: '', SUPABASE_URL: '', PORT: '' })
    expect(env.DATABASE_URL).toBeUndefined()
    expect(env.PORT).toBe(4000)
  })

  it('fuera de las pruebas exige la conexión a la base de datos y a Supabase', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL: es obligatoria/)
  })

  it('rechaza un puerto inválido con un mensaje claro', () => {
    expect(() => loadEnv({ ...test, PORT: 'abc' })).toThrow(/PORT/)
  })
})
