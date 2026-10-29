#!/usr/bin/env node
// Verificación posterior al despliegue. Solo lee: no crea pedidos ni cambia datos.
//
//   node scripts/smoke.mjs --api https://api.tudominio.com --site https://tudominio.com \
//        [--supabase https://xxxx.supabase.co --anon <clave anon pública>]
//
// Sale con código 1 si alguna verificación falla.

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
)
const api = args.api?.replace(/\/$/, '')
const site = args.site?.replace(/\/$/, '')
if (!api || !site) {
  console.error('Uso: node scripts/smoke.mjs --api <URL de la API> --site <URL del sitio> [--supabase <URL> --anon <clave>]')
  process.exit(2)
}
const https = api.startsWith('https://')

const results = []
async function check(name, fn) {
  try {
    const detail = await fn()
    results.push({ ok: true, name, detail: detail ?? '' })
  } catch (err) {
    results.push({ ok: false, name, detail: err instanceof Error ? err.message : String(err) })
  }
}
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const get = (url, headers = {}) => fetch(url, { headers, redirect: 'manual' })

await check('API: salud y base de datos', async () => {
  const res = await get(`${api}/api/health`)
  const body = await res.json()
  assert(res.status === 200 && body.database === 'ok', `HTTP ${res.status}, base: ${body.database}`)
  return 'ok'
})

await check('API: catálogo publicado', async () => {
  const res = await get(`${api}/api/products`, { 'Accept-Encoding': 'gzip' })
  const body = await res.json()
  assert(res.ok && body.items.length > 0, `HTTP ${res.status}, ${body.items?.length ?? 0} productos`)
  assert((res.headers.get('cache-control') ?? '').includes('max-age'), 'sin Cache-Control')
  return `${body.items.length} productos`
})

await check('API: el panel exige sesión', async () => {
  const none = await get(`${api}/api/admin/orders`)
  const fake = await get(`${api}/api/admin/orders`, { Authorization: 'Bearer token-falso' })
  assert(none.status === 401 && fake.status === 401, `sin token ${none.status}, token falso ${fake.status}`)
  assert(none.headers.get('cache-control') === 'no-store', 'el panel no envía no-store')
  return '401 / 401'
})

await check('API: pedidos exigen clave anti-duplicados', async () => {
  const res = await fetch(`${api}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  assert(res.status === 400, `HTTP ${res.status} (esperado 400, no se crea nada)`)
  return '400'
})

await check('API: CORS solo para el sitio', async () => {
  const siteOrigin = new URL(site).origin
  const allowed = await get(`${api}/api/categories`, { Origin: siteOrigin })
  const blocked = await get(`${api}/api/categories`, { Origin: 'https://sitio-ajeno.example' })
  assert(allowed.headers.get('access-control-allow-origin') === siteOrigin, `el sitio no está permitido (${siteOrigin})`)
  assert(!blocked.headers.get('access-control-allow-origin'), 'un origen ajeno está permitido')
  return siteOrigin
})

await check('API: cabeceras de seguridad', async () => {
  const res = await get(`${api}/api/health`)
  assert(res.headers.get('x-content-type-options') === 'nosniff', 'falta nosniff')
  assert(!res.headers.get('x-powered-by'), 'expone X-Powered-By')
  if (https) assert(res.headers.get('strict-transport-security'), 'falta HSTS')
  return https ? 'nosniff + HSTS' : 'nosniff (sin https: HSTS no aplica)'
})

await check('Sitio: portada con CSP y anti-iframe', async () => {
  const res = await get(`${site}/`)
  const html = await res.text()
  assert(res.status === 200 && html.includes('<div id="root">'), `HTTP ${res.status}`)
  const csp = res.headers.get('content-security-policy') ?? ''
  assert(csp.includes("script-src 'self'"), 'falta Content-Security-Policy')
  assert(csp.includes(new URL(api).origin) || new URL(api).origin === new URL(site).origin, 'el CSP no permite conectar con la API')
  assert(res.headers.get('x-frame-options') === 'DENY', 'falta X-Frame-Options')
  return 'ok'
})

await check('Sitio: rutas internas (SPA) responden', async () => {
  for (const path of ['/menu', '/carrito', '/admin/login']) {
    const res = await get(`${site}${path}`)
    assert(res.status === 200, `${path} → HTTP ${res.status}`)
  }
  return '/menu, /carrito, /admin/login'
})

await check('Sitio: archivos con caché larga', async () => {
  const html = await (await get(`${site}/`)).text()
  const asset = html.match(/\/assets\/[^"']+\.js/)?.[0]
  assert(asset, 'no se encontró el JS principal')
  const res = await get(`${site}${asset}`)
  assert(res.ok && (res.headers.get('cache-control') ?? '').includes('immutable'), `${asset}: ${res.headers.get('cache-control')}`)
  return asset
})

if (args.supabase && args.anon) {
  await check('Supabase: las tablas no son accesibles desde el navegador', async () => {
    const headers = { apikey: args.anon, Authorization: `Bearer ${args.anon}` }
    for (const table of ['orders', 'products', 'profiles']) {
      const res = await get(`${args.supabase.replace(/\/$/, '')}/rest/v1/${table}?select=*&limit=1`, headers)
      assert(!res.ok, `la tabla ${table} responde HTTP ${res.status}`)
    }
    return 'orders, products, profiles bloqueadas'
  })
}

for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
const failed = results.filter((r) => !r.ok).length
console.log(failed ? `\n${failed} verificación(es) fallaron.` : `\nTodo en orden (${results.length} verificaciones).`)
process.exit(failed ? 1 : 0)
