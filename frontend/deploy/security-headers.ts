// Cabeceras HTTP del sitio estático. Una sola definición que usan:
//   - `vite preview` (para probarlas en local), y
//   - el build, que genera dist/_headers y dist/_redirects
//     (formato de Cloudflare Pages y Netlify).

const origin = (url: string | undefined) => {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export function securityHeaders(env: { VITE_API_URL?: string; VITE_SUPABASE_URL?: string }, production: boolean) {
  // La tienda solo habla con su API y con Supabase Auth (inicio de sesión del panel).
  const connect = ["'self'", origin(env.VITE_API_URL), origin(env.VITE_SUPABASE_URL)].filter(Boolean)

  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    // Fotos de productos: enlaces https (por ejemplo Cloudinary).
    "img-src 'self' data: https:",
    `connect-src ${connect.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(production ? ['upgrade-insecure-requests'] : []),
  ].join('; ')

  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    ...(production ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
  }
}

// Archivo _headers: seguridad en todas las rutas; los archivos con hash en el
// nombre (/assets/*) se cachean un año; index.html siempre se revalida.
export function headersFile(headers: Record<string, string>) {
  const block = (path: string, entries: Record<string, string>) =>
    [path, ...Object.entries(entries).map(([k, v]) => `  ${k}: ${v}`)].join('\n')
  return [
    block('/*', headers),
    block('/assets/*', { 'Cache-Control': 'public, max-age=31536000, immutable' }),
    block('/index.html', { 'Cache-Control': 'no-cache' }),
    '',
  ].join('\n\n')
}

// Lee un archivo _headers (para que `vite preview` sirva lo mismo que el hosting).
// Soporta rutas exactas y comodín final ("/assets/*", "/*").
export function parseHeadersFile(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').filter(Boolean))
    .filter((lines) => lines.length > 1)
    .map(([path, ...entries]) => {
      const pattern = path!.trim()
      const headers = Object.fromEntries(
        entries.map((line) => {
          const i = line.indexOf(':')
          return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
        }),
      )
      const matches = (url: string) =>
        pattern.endsWith('/*') ? url.startsWith(pattern.slice(0, -1)) : url === pattern || (pattern === '/index.html' && url === '/')
      return { pattern, headers, matches }
    })
}

// Aplicación de una sola página: toda ruta sirve index.html (200, no redirección).
export const redirectsFile = '/*    /index.html    200\n'
