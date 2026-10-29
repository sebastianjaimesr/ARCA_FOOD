import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, ApiError } from './api'

const respond = (status: number, body: unknown, contentType = 'application/json') =>
  vi.fn().mockResolvedValue(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': contentType } }),
  )

describe('apiFetch (errores de red y del servidor)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sin conexión responde un error claro y reintentable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const err = await apiFetch('/api/products').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })

  it('si el servidor está caído (502 sin JSON) lo dice en lenguaje claro', async () => {
    vi.stubGlobal('fetch', respond(502, '<html>Bad Gateway</html>', 'text/html'))
    const err = await apiFetch('/api/products').catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 502, code: 'SERVER_UNAVAILABLE' })
    expect((err as ApiError).message).toMatch(/no está disponible/)
  })

  it('conserva el código, mensaje y detalles de los errores de la API', async () => {
    vi.stubGlobal('fetch', respond(409, { error: { code: 'INSUFFICIENT_STOCK', message: 'Solo quedan 2', details: { available: 2 } } }))
    const err = await apiFetch('/api/orders').catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 409, code: 'INSUFFICIENT_STOCK', message: 'Solo quedan 2', details: { available: 2 } })
  })

  it('envía el token del panel solo cuando se indica', async () => {
    const fetchMock = respond(200, { ok: true })
    vi.stubGlobal('fetch', fetchMock)
    await apiFetch('/api/admin/me', { token: 'abc' })
    await apiFetch('/api/products')
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer abc')
    expect(fetchMock.mock.calls[1]![1].headers.Authorization).toBeUndefined()
  })
})
