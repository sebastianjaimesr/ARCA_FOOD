import { z } from 'zod'
import type { Product, Quote } from '../../types/catalog'

// Una línea del carrito guarda IDs (lo que se envía al backend) y una copia de
// nombres y precios solo para mostrar. El precio real siempre lo calcula el
// backend al cotizar o crear el pedido.
export type CartLine = {
  lineId: string
  productId: string
  slug: string
  name: string
  categorySlug: string
  variantId: string | null
  variantName: string | null
  options: { id: string; name: string; price: string }[]
  quantity: number
  notes: string | null
  unitPrice: string
}

export type CartSelection = {
  variantId: string | null
  optionIds: string[]
  quantity: number
  notes: string | null
}

export const MAX_QUANTITY = 50

const toCents = (value: string) => Math.round(Number(value) * 100)
const fromCents = (cents: number) => (cents / 100).toFixed(2)

// Precio unitario estimado con los datos del catálogo cargado.
export function estimateUnitPrice(product: Product, selection: Pick<CartSelection, 'variantId' | 'optionIds'>): string {
  const variant = product.variants.find((v) => v.id === selection.variantId)
  const options = product.optionGroups.flatMap((g) => g.options).filter((o) => selection.optionIds.includes(o.id))
  return fromCents(toCents(variant?.price ?? product.price) + options.reduce((sum, o) => sum + toCents(o.price), 0))
}

// Precio "desde" para productos con variantes (ej. hot dogs Zenú / Americana).
export function startingPrice(product: Product): string {
  if (product.variants.length === 0) return product.price
  return product.variants.reduce((min, v) => (toCents(v.price) < toCents(min) ? v.price : min), product.variants[0]!.price)
}

const sameSelection = (line: CartLine, other: Omit<CartLine, 'lineId' | 'quantity'>) =>
  line.productId === other.productId &&
  line.variantId === other.variantId &&
  (line.notes ?? '') === (other.notes ?? '') &&
  [...line.options.map((o) => o.id)].sort().join() === [...other.options.map((o) => o.id)].sort().join()

export function buildLine(product: Product, selection: CartSelection, lineId: string): CartLine {
  const optionIds = [...new Set(selection.optionIds)]
  const variant = product.variants.find((v) => v.id === selection.variantId) ?? null
  return {
    lineId,
    productId: product.id,
    slug: product.slug,
    name: product.name,
    categorySlug: product.category.slug,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
    options: product.optionGroups
      .flatMap((g) => g.options)
      .filter((o) => optionIds.includes(o.id))
      .map(({ id, name, price }) => ({ id, name, price })),
    quantity: clampQuantity(selection.quantity),
    notes: selection.notes?.trim() || null,
    unitPrice: estimateUnitPrice(product, { variantId: variant?.id ?? null, optionIds }),
  }
}

export const clampQuantity = (quantity: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(quantity) || 1))

// Agregar: si ya existe una línea idéntica, se suma la cantidad.
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const existing = lines.find((l) => sameSelection(l, line))
  if (!existing) return [...lines, line]
  return lines.map((l) => (l === existing ? { ...l, quantity: clampQuantity(l.quantity + line.quantity) } : l))
}

// Editar: reemplaza la línea; si queda idéntica a otra, se fusionan.
export function replaceLine(lines: CartLine[], lineId: string, next: CartLine): CartLine[] {
  const rest = lines.filter((l) => l.lineId !== lineId)
  const index = lines.findIndex((l) => l.lineId === lineId)
  const duplicate = rest.find((l) => sameSelection(l, next))
  if (duplicate) return rest.map((l) => (l === duplicate ? { ...l, quantity: clampQuantity(l.quantity + next.quantity) } : l))
  const result = [...rest]
  result.splice(index < 0 ? result.length : index, 0, { ...next, lineId })
  return result
}

export function setQuantity(lines: CartLine[], lineId: string, quantity: number): CartLine[] {
  return lines.map((l) => (l.lineId === lineId ? { ...l, quantity: clampQuantity(quantity) } : l))
}

export function removeLine(lines: CartLine[], lineId: string): CartLine[] {
  return lines.filter((l) => l.lineId !== lineId)
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0)
}

export function estimateSubtotal(lines: CartLine[]): string {
  return fromCents(lines.reduce((sum, l) => sum + toCents(l.unitPrice) * l.quantity, 0))
}

export function toQuoteItems(lines: CartLine[]) {
  return lines.map((l) => ({
    productId: l.productId,
    variantId: l.variantId,
    optionIds: l.options.map((o) => o.id),
    quantity: l.quantity,
    notes: l.notes,
  }))
}

// Aplica la cotización del backend: los precios mostrados pasan a ser los
// vigentes. Devuelve los nombres de los productos cuyo precio cambió.
export function applyQuote(lines: CartLine[], quote: Quote): { lines: CartLine[]; changed: string[] } {
  const changed: string[] = []
  const next = lines.map((line, i) => {
    const priced = quote.lines[i]
    if (!priced || priced.productId !== line.productId) return line
    if (toCents(priced.unitPrice) !== toCents(line.unitPrice)) changed.push(line.name)
    return {
      ...line,
      name: priced.productName,
      variantName: priced.variantName,
      unitPrice: priced.unitPrice,
      options: line.options.map((o) => ({ ...o, price: priced.options.find((p) => p.id === o.id)?.price ?? o.price })),
    }
  })
  return { lines: next, changed }
}

// Validación del carrito guardado en el navegador: si el formato no coincide
// (versión vieja o datos alterados) se descarta en lugar de romper la página.
const storedLine = z.object({
  lineId: z.string(),
  productId: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  categorySlug: z.string(),
  variantId: z.string().uuid().nullable(),
  variantName: z.string().nullable(),
  options: z.array(z.object({ id: z.string().uuid(), name: z.string(), price: z.string() })).max(20),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  notes: z.string().max(200).nullable(),
  unitPrice: z.string(),
})

export const storedCartSchema = z.object({ version: z.literal(1), lines: z.array(storedLine).max(30) })
