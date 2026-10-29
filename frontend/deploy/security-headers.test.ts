import { describe, expect, it } from 'vitest'
import { headersFile, redirectsFile, securityHeaders } from './security-headers.ts'

describe('cabeceras del sitio estático', () => {
  const headers = securityHeaders({ VITE_API_URL: 'https://api.elarca.example/', VITE_SUPABASE_URL: 'https://abc.supabase.co' }, true)
  const csp = headers['Content-Security-Policy']

  it('solo permite scripts propios y conexiones a la API y a Supabase', () => {
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("connect-src 'self' https://api.elarca.example https://abc.supabase.co")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain('unsafe-inline')
    expect(csp).not.toContain('googleapis')
  })

  it('en producción fuerza https', () => {
    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000')
    expect(csp).toContain('upgrade-insecure-requests')
    expect(securityHeaders({}, false)['Strict-Transport-Security']).toBeUndefined()
  })

  it('genera _headers con caché larga para /assets y _redirects de SPA', () => {
    const file = headersFile(headers)
    expect(file).toMatch(/^\/\*\n {2}Content-Security-Policy: /)
    expect(file).toContain('/assets/*\n  Cache-Control: public, max-age=31536000, immutable')
    expect(redirectsFile).toBe('/*    /index.html    200\n')
  })
})

describe('lectura de _headers (vite preview)', () => {
  it('aplica las reglas por ruta como el hosting', async () => {
    const { parseHeadersFile } = await import('./security-headers.ts')
    const rules = parseHeadersFile(headersFile({ 'X-Frame-Options': 'DENY' }))
    const forPath = (p: string) => Object.assign({}, ...rules.filter((r) => r.matches(p)).map((r) => r.headers))
    expect(forPath('/menu')).toEqual({ 'X-Frame-Options': 'DENY' })
    expect(forPath('/assets/index-abc.js')['Cache-Control']).toContain('immutable')
    expect(forPath('/')['Cache-Control']).toBe('no-cache')
  })
})
