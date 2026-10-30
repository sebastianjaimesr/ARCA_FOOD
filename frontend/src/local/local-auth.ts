// Inicio de sesión del MODO DEMOSTRACIÓN (sin backend).
//
// Importante: en un sitio estático cualquier verificación ocurre en el
// navegador y el código es público, así que esto NO es seguridad real. Sirve
// para que el panel de demostración no quede abierto a la vista. Los datos que
// protege son solo los del LocalStorage de quien lo abre (no hay datos
// compartidos). La seguridad real está en el modo completo (Supabase Auth +
// roles validados en el backend).
//
// La contraseña no está en el código: solo su hash PBKDF2-SHA256 con sal.
// Para cambiarla, genera un hash nuevo (ver docs/github-pages.md).
import type { StaffUser } from '../services/api'

export type Credentials = { username: string; salt: string; hash: string; iterations: number }

export const CREDENTIALS: Credentials = {
  username: 'sebasjaimes222',
  salt: 'E8/JKpAMTS6ZLhJ651kkAw==',
  hash: '84EyypSibA4mdsFTeAOa7E4F2nD2Dq8HVFDWcnkSs40=',
  iterations: 210_000,
}

const SESSION_KEY = 'el-arca:local-session'
const ATTEMPTS_KEY = 'el-arca:local-login-attempts'
const SESSION_MS = 8 * 60 * 60 * 1000
const MAX_ATTEMPTS = 5
const LOCK_MS = 60 * 1000

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256)
  return new Uint8Array(bits)
}

// Comparación en tiempo constante (no revela cuántos bytes coinciden).
function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

// Genera el hash de una contraseña (para cambiarla o en las pruebas).
export async function hashPassword(password: string, iterations = 210_000): Promise<Pick<Credentials, 'salt' | 'hash' | 'iterations'>> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { salt: toBase64(salt), hash: toBase64(await pbkdf2(password, salt, iterations)), iterations }
}

export async function verifyCredentials(username: string, password: string, credentials: Credentials = CREDENTIALS): Promise<boolean> {
  // Se calcula siempre el hash (aunque el usuario no coincida) para no revelar por tiempo qué falló.
  const derived = await pbkdf2(password, fromBase64(credentials.salt), credentials.iterations)
  const userOk = username.trim() === credentials.username
  return sameBytes(derived, fromBase64(credentials.hash)) && userOk
}

// Freno a intentos repetidos en este navegador (5 fallos → espera de 1 minuto).
function readAttempts(): { count: number; lockedUntil: number } {
  try {
    return JSON.parse(sessionStorage.getItem(ATTEMPTS_KEY) ?? '') as { count: number; lockedUntil: number }
  } catch {
    return { count: 0, lockedUntil: 0 }
  }
}

export class LoginLockedError extends Error {
  constructor(seconds: number) {
    super(`Demasiados intentos. Espera ${seconds} segundos e intenta de nuevo.`)
    this.name = 'LoginLockedError'
  }
}

export async function signInLocal(username: string, password: string): Promise<StaffUser> {
  const attempts = readAttempts()
  if (attempts.lockedUntil > Date.now()) throw new LoginLockedError(Math.ceil((attempts.lockedUntil - Date.now()) / 1000))

  if (!(await verifyCredentials(username, password))) {
    const count = attempts.count + 1
    const next = count >= MAX_ATTEMPTS ? { count: 0, lockedUntil: Date.now() + LOCK_MS } : { count, lockedUntil: 0 }
    sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(next))
    throw new Error('Usuario o contraseña incorrectos')
  }

  sessionStorage.removeItem(ATTEMPTS_KEY)
  const token = toBase64(crypto.getRandomValues(new Uint8Array(24)))
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: CREDENTIALS.username, token, expiresAt: Date.now() + SESSION_MS }))
  return userFor(CREDENTIALS.username)
}

export function signOutLocal() {
  sessionStorage.removeItem(SESSION_KEY)
}

const userFor = (username: string): StaffUser => ({ id: 'local-admin', email: username, fullName: null, role: 'admin' })

// Sesión vigente en esta pestaña (sessionStorage: se borra al cerrarla) o null.
export function currentLocalUser(): StaffUser | null {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as { username: string; expiresAt: number } | null
    if (!session || session.expiresAt < Date.now()) return null
    return userFor(session.username)
  } catch {
    return null
  }
}
