import { describe, expect, it } from 'vitest'
import { loadEnv } from '../src/config/env.js'

describe('loadEnv', () => {
  it('usa valores por defecto seguros', () => {
    const env = loadEnv({})
    expect(env.PORT).toBe(4000)
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173'])
  })

  it('separa los orígenes CORS por comas', () => {
    const env = loadEnv({ CORS_ORIGINS: 'http://a.com, http://b.com' })
    expect(env.CORS_ORIGINS).toEqual(['http://a.com', 'http://b.com'])
  })

  it('trata las variables vacías del .env como no definidas', () => {
    const env = loadEnv({ DATABASE_URL: '', SUPABASE_URL: '', PORT: '' })
    expect(env.DATABASE_URL).toBeUndefined()
    expect(env.PORT).toBe(4000)
  })

  it('rechaza un puerto inválido con un mensaje claro', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow(/PORT/)
  })
})
