import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

const app = createApp()

describe('API base', () => {
  it('GET /api/health informa el estado del servicio y de la base de datos', async () => {
    // En pruebas unitarias la base puede estar apagada: 200 (ok) o 503 (degraded).
    const res = await request(app).get('/api/health')
    expect([200, 503]).toContain(res.status)
    expect(res.body.service).toBe('el-arca-api')
    expect(res.body.database).toBe(res.status === 200 ? 'ok' : 'unreachable')
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('incluye cabeceras de seguridad y oculta Express', async () => {
    const res = await request(app).get('/api/no-existe')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('rutas desconocidas devuelven 404 con formato de error', async () => {
    const res = await request(app).get('/api/no-existe')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('JSON mal formado devuelve 400', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"roto":')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_JSON')
  })

  it('cuerpos de más de 100 KB devuelven 413', async () => {
    const res = await request(app)
      .post('/api/health')
      .send({ relleno: 'x'.repeat(120_000) })
    expect(res.status).toBe(413)
  })

  it('las respuestas del panel nunca se guardan en caché', async () => {
    const admin = await request(app).get('/api/admin/me')
    expect(admin.headers['cache-control']).toBe('no-store')
  })

  it('por defecto ignora X-Forwarded-For (no se puede falsear la IP)', () => {
    expect(app.get('trust proxy')).toBe(0)
  })

  it('CORS solo permite orígenes configurados', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173')
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    const blocked = await request(app).get('/api/health').set('Origin', 'https://sitio-ajeno.com')
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined()
  })
})
