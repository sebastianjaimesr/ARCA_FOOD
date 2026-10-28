import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/app.js'

const app = createApp()

describe('API base', () => {
  it('GET /api/health responde ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok', service: 'el-arca-api' })
  })

  it('incluye cabeceras de seguridad y oculta Express', async () => {
    const res = await request(app).get('/api/health')
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

  it('CORS solo permite orígenes configurados', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173')
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    const blocked = await request(app).get('/api/health').set('Origin', 'https://sitio-ajeno.com')
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined()
  })
})
