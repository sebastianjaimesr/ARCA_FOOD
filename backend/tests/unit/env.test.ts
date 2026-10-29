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

  describe('en producción', () => {
    const prod = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://usuario:clave@db.ejemplo.com:5432/postgres',
      SUPABASE_URL: 'https://proyecto.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'clave-de-ejemplo',
      CORS_ORIGINS: 'https://elarca.com.co',
      DATABASE_SSL: 'require',
    }

    it('acepta una configuración completa con TLS y CORS https', () => {
      expect(loadEnv(prod).DATABASE_SSL).toBe('require')
    })

    it('no permite la base de datos sin cifrar', () => {
      expect(() => loadEnv({ ...prod, DATABASE_SSL: 'disable' })).toThrow(/DATABASE_SSL/)
    })

    it('no permite orígenes CORS sin https', () => {
      expect(() => loadEnv({ ...prod, CORS_ORIGINS: 'http://elarca.com.co' })).toThrow(/CORS_ORIGINS/)
    })

    it('verify-full exige el certificado raíz y acepta \\n literales', () => {
      expect(() => loadEnv({ ...prod, DATABASE_SSL: 'verify-full' })).toThrow(/DATABASE_CA_CERT/)
      const env = loadEnv({ ...prod, DATABASE_SSL: 'verify-full', DATABASE_CA_CERT: '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----' })
      expect(env.DATABASE_CA_CERT).toContain('\nABC\n')
    })
  })

  it('rechaza un puerto inválido con un mensaje claro', () => {
    expect(() => loadEnv({ ...test, PORT: 'abc' })).toThrow(/PORT/)
  })
})
