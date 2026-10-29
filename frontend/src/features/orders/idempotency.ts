// Estrategia anti-duplicados del lado del navegador:
// - Cada intento de pedido lleva una clave (UUID) en la cabecera Idempotency-Key.
// - Mientras el contenido del pedido NO cambie, se reutiliza la misma clave:
//   doble clic, red lenta o recargar la página no crean un segundo pedido
//   (el backend devuelve el mismo).
// - Si el cliente cambia algo (otro producto, otra dirección…), es un pedido
//   distinto y se genera una clave nueva.

const STORAGE_KEY = 'el-arca:checkout-attempt'

type Attempt = { key: string; fingerprint: string }

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const newUuid = () =>
  crypto.randomUUID?.() ??
  // Respaldo para navegadores viejos sin randomUUID.
  '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(c) / 4)))).toString(16),
  )

function safeStore(): Store | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

let memoryAttempt: Attempt | null = null

export function idempotencyKeyFor(body: unknown, store: Store | null = safeStore()): string {
  const fingerprint = JSON.stringify(body)
  let current: Attempt | null = memoryAttempt
  try {
    const raw = store?.getItem(STORAGE_KEY)
    if (raw) current = JSON.parse(raw) as Attempt
  } catch {
    // Almacenamiento bloqueado o dañado: se usa la copia en memoria.
  }
  if (current && current.fingerprint === fingerprint) return current.key

  const attempt = { key: newUuid(), fingerprint }
  memoryAttempt = attempt
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(attempt))
  } catch {
    // Sin almacenamiento sigue funcionando dentro de la misma página.
  }
  return attempt.key
}

// Se llama cuando el pedido ya quedó creado: el próximo pedido usa otra clave.
export function resetIdempotencyKey(store: Store | null = safeStore()) {
  memoryAttempt = null
  try {
    store?.removeItem(STORAGE_KEY)
  } catch {
    // Nada que limpiar.
  }
}
