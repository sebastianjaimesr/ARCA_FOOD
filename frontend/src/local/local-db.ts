// Base de datos del MODO DEMOSTRACIÓN (GitHub Pages, sin backend).
//
// Vive en el LocalStorage de ESTE navegador: la tienda y el panel abiertos en
// el mismo navegador comparten los datos al instante (incluso entre pestañas),
// pero un pedido hecho desde el celular de un cliente NO llega al panel del
// restaurante. Para eso existe el modo completo con backend (docs/despliegue.md).
import snapshot from '../static/catalog.json'
import type { AdminCategory, AdminOptionGroup, AdminOrder, AdminProduct, AdminSettings } from '../types/admin'
import type { Category, Product, PublicSettings } from '../types/catalog'

const KEY = 'el-arca:local-db:v1'
export const LOCAL_DB_EVENT = 'el-arca:local-db'

export type StoredProduct = Omit<AdminProduct, 'categoryName'>
export type StoredOrder = Omit<AdminOrder, 'allowedTransitions'>
export type StoredCategory = Omit<AdminCategory, 'productsCount'>

export type LocalDb = {
  version: 1
  settings: AdminSettings
  categories: StoredCategory[]
  products: StoredProduct[]
  optionGroups: AdminOptionGroup[]
  orders: StoredOrder[]
}

// Estado inicial: la carta real exportada (frontend/src/static/catalog.json).
export function initialDb(): LocalDb {
  const s = snapshot.settings as PublicSettings
  const now = new Date().toISOString()
  const groups = new Map<string, AdminOptionGroup>()
  for (const p of snapshot.products as Product[]) {
    for (const g of p.optionGroups) {
      if (!groups.has(g.id)) {
        groups.set(g.id, {
          id: g.id,
          name: g.name,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          isActive: true,
          options: g.options.map((o, i) => ({ ...o, isActive: true, sortOrder: i + 1 })),
        })
      }
    }
  }
  return {
    version: 1,
    settings: {
      ...s,
      deliveryZones: s.deliveryZones.map((z, i) => ({ ...z, isActive: true, sortOrder: i + 1 })),
      updatedAt: now,
    },
    categories: (snapshot.categories as Category[]).map((c, i) => ({ ...c, sortOrder: i + 1, isActive: true })),
    products: (snapshot.products as Product[]).map((p, i) => ({
      id: p.id,
      categoryId: p.category.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      price: p.price,
      imageUrl: p.imageUrl,
      imageAlt: p.imageAlt,
      isActive: true,
      isAvailable: p.available,
      isFeatured: p.isFeatured,
      sortOrder: i + 1,
      trackStock: false,
      stockQuantity: 0,
      minStock: 0,
      variants: p.variants.map((v, j) => ({ ...v, isActive: true, sortOrder: j + 1 })),
      optionGroupIds: p.optionGroups.map((g) => g.id),
      updatedAt: now,
    })),
    optionGroups: [...groups.values()],
    orders: [],
  }
}

let memory: LocalDb | null = null

// Lee la base del navegador; si no existe o está dañada, empieza con la carta.
export function readDb(): LocalDb {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as LocalDb
      if (parsed?.version === 1 && Array.isArray(parsed.products) && Array.isArray(parsed.orders)) return parsed
    }
  } catch {
    // Almacenamiento bloqueado o JSON dañado: se usa la copia en memoria.
  }
  return (memory ??= initialDb())
}

export function writeDb(db: LocalDb) {
  memory = db
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // Sin almacenamiento (modo privado): los datos duran mientras la página esté abierta.
  }
  // Misma pestaña: evento propio. Otras pestañas reciben el evento "storage".
  window.dispatchEvent(new Event(LOCAL_DB_EVENT))
}

// Aplica un cambio sobre una copia y la guarda (lectura → cambio → escritura).
export function updateDb<T>(fn: (db: LocalDb) => T): T {
  const db = structuredClone(readDb())
  const result = fn(db)
  writeDb(db)
  return result
}

export function resetDb() {
  memory = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nada que borrar.
  }
  window.dispatchEvent(new Event(LOCAL_DB_EVENT))
}

// Avisa cuando cambian los datos, en esta pestaña o en otra del mismo navegador.
export function subscribeLocalDb(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      memory = null
      callback()
    }
  }
  window.addEventListener(LOCAL_DB_EVENT, callback)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(LOCAL_DB_EVENT, callback)
    window.removeEventListener('storage', onStorage)
  }
}

// --- Vistas públicas (lo que ve la tienda) -----------------------------------

export function publicSettings(db: LocalDb): PublicSettings {
  const { updatedAt: _u, deliveryZones, ...rest } = db.settings
  return { ...rest, deliveryZones: deliveryZones.filter((z) => z.isActive).map(({ id, name, fee }) => ({ id, name, fee })) }
}

export function publicCategories(db: LocalDb): Category[] {
  return db.categories
    .filter((c) => c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ id, slug, name, description }) => ({ id, slug, name, description }))
}

// Mismo criterio que el backend: activo, disponible, categoría activa y stock.
export function publicProducts(db: LocalDb): Product[] {
  const categories = new Map(db.categories.map((c) => [c.id, c]))
  const order = new Map(db.categories.map((c) => [c.id, c.sortOrder]))
  return db.products
    .filter((p) => p.isActive && categories.get(p.categoryId)?.isActive)
    .sort((a, b) => (order.get(a.categoryId)! - order.get(b.categoryId)!) || a.sortOrder - b.sortOrder)
    .map((p) => {
      const category = categories.get(p.categoryId)!
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        price: p.price,
        imageUrl: p.imageUrl,
        imageAlt: p.imageAlt,
        isFeatured: p.isFeatured,
        available: p.isAvailable && (!p.trackStock || p.stockQuantity > 0),
        category: { id: category.id, slug: category.slug, name: category.name },
        variants: p.variants.filter((v) => v.isActive).map(({ id, name, price }) => ({ id: id!, name, price })),
        optionGroups: p.optionGroupIds
          .map((gid) => db.optionGroups.find((g) => g.id === gid))
          .filter((g): g is AdminOptionGroup => Boolean(g?.isActive))
          .map((g) => ({
            id: g.id,
            name: g.name,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            options: g.options.filter((o) => o.isActive).map(({ id, name, price }) => ({ id, name, price })),
          })),
      }
    })
}
