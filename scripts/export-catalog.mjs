#!/usr/bin/env node
// Exporta el catálogo público (configuración, categorías y productos) a
// frontend/src/static/catalog.json para el modo vitrina (GitHub Pages).
//
//   node scripts/export-catalog.mjs [URL de la API]   (por defecto http://localhost:4000)
//
// Úsalo después de cambiar la carta en el panel local y vuelve a publicar.
// Solo incluye datos públicos (los mismos que ve cualquier cliente en la tienda).
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const api = (process.argv[2] ?? 'http://localhost:4000').replace(/\/$/, '')
const get = async (path) => {
  const res = await fetch(`${api}${path}`)
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`)
  return res.json()
}

const [settings, categories, products] = await Promise.all([get('/api/settings'), get('/api/categories'), get('/api/products')])

const snapshot = {
  exportedAt: new Date().toISOString(),
  settings,
  categories: categories.items,
  products: products.items,
}

const target = fileURLToPath(new URL('../frontend/src/static/catalog.json', import.meta.url))
writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(`Catálogo exportado: ${snapshot.categories.length} categorías, ${snapshot.products.length} productos → ${target}`)
