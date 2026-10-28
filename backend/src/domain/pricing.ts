import { fromCents, toCents, type Cents } from '../lib/money.js'

// Datos del catálogo tal como están en la base de datos al momento de cotizar.
export type CatalogOption = { id: string; name: string; price: string; groupId: string; groupName: string }
export type CatalogOptionGroup = { id: string; name: string; minSelect: number; maxSelect: number | null }
export type CatalogVariant = { id: string; name: string; price: string }
export type CatalogProduct = {
  id: string
  name: string
  price: string
  sellable: boolean
  trackStock: boolean
  stockQuantity: number
  variants: CatalogVariant[]
  optionGroups: CatalogOptionGroup[]
  options: CatalogOption[]
}

export type CartLineInput = {
  productId: string
  variantId?: string | null
  optionIds: string[]
  quantity: number
  notes?: string | null
}

export type DeliveryQuote = { zoneId: string; zoneName: string; fee: string } | null

export type PricedLine = {
  productId: string
  productName: string
  variantId: string | null
  variantName: string | null
  options: { id: string; groupName: string; name: string; price: string }[]
  basePrice: string
  optionsPrice: string
  unitPrice: string
  quantity: number
  lineTotal: string
  notes: string | null
}

export type Quote = {
  lines: PricedLine[]
  subtotal: string
  deliveryFee: string | null
  total: string
  deliveryZone: { id: string; name: string } | null
}

// Error de validación del carrito: el servicio lo convierte en HTTP 409/422.
export class CartError extends Error {
  readonly code: string
  readonly details: Record<string, unknown>

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'CartError'
    this.code = code
    this.details = details
  }
}

// Calcula el pedido con los precios vigentes del catálogo. Nunca usa precios
// enviados por el cliente. Función pura: misma entrada → misma salida.
export function priceCart(
  lines: CartLineInput[],
  catalog: Map<string, CatalogProduct>,
  delivery: DeliveryQuote,
): Quote {
  const requestedByProduct = new Map<string, number>()

  const priced = lines.map((line, index): PricedLine & { lineCents: Cents } => {
    const product = catalog.get(line.productId)
    if (!product || !product.sellable) {
      throw new CartError('PRODUCT_UNAVAILABLE', 'Un producto del carrito ya no está disponible', {
        line: index,
        productId: line.productId,
        productName: product?.name,
      })
    }

    // Variante: obligatoria si el producto tiene variantes; prohibida si no.
    let variant: CatalogVariant | null = null
    if (product.variants.length > 0) {
      variant = product.variants.find((v) => v.id === line.variantId) ?? null
      if (!variant) {
        throw new CartError('VARIANT_REQUIRED', `Elige una opción para ${product.name}`, {
          line: index,
          productId: product.id,
        })
      }
    } else if (line.variantId) {
      throw new CartError('INVALID_VARIANT', `${product.name} no tiene variantes`, { line: index, productId: product.id })
    }

    // Opciones: deben pertenecer a un grupo del producto y respetar mínimos y máximos.
    const uniqueOptionIds = [...new Set(line.optionIds)]
    const chosen = uniqueOptionIds.map((optionId) => {
      const option = product.options.find((o) => o.id === optionId)
      if (!option) {
        throw new CartError('INVALID_OPTION', `Una opción elegida no está disponible para ${product.name}`, {
          line: index,
          productId: product.id,
          optionId,
        })
      }
      return option
    })
    for (const group of product.optionGroups) {
      const count = chosen.filter((o) => o.groupId === group.id).length
      if (count < group.minSelect || (group.maxSelect !== null && count > group.maxSelect)) {
        throw new CartError('INVALID_OPTION_COUNT', `Revisa las opciones de "${group.name}" en ${product.name}`, {
          line: index,
          productId: product.id,
          groupId: group.id,
        })
      }
    }

    requestedByProduct.set(product.id, (requestedByProduct.get(product.id) ?? 0) + line.quantity)

    const baseCents = toCents(variant ? variant.price : product.price)
    const optionsCents = chosen.reduce((sum, o) => sum + toCents(o.price), 0)
    const unitCents = baseCents + optionsCents
    const lineCents = unitCents * line.quantity

    return {
      productId: product.id,
      productName: product.name,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      options: chosen.map((o) => ({ id: o.id, groupName: o.groupName, name: o.name, price: o.price })),
      basePrice: fromCents(baseCents),
      optionsPrice: fromCents(optionsCents),
      unitPrice: fromCents(unitCents),
      quantity: line.quantity,
      lineTotal: fromCents(lineCents),
      notes: line.notes?.trim() || null,
      lineCents,
    }
  })

  // Existencias: se valida la suma de todas las líneas del mismo producto.
  for (const [productId, requested] of requestedByProduct) {
    const product = catalog.get(productId)!
    if (product.trackStock && requested > product.stockQuantity) {
      throw new CartError('INSUFFICIENT_STOCK', `Solo quedan ${product.stockQuantity} unidades de ${product.name}`, {
        productId,
        productName: product.name,
        available: product.stockQuantity,
        requested,
      })
    }
  }

  const subtotalCents = priced.reduce((sum, line) => sum + line.lineCents, 0)
  const feeCents = delivery ? toCents(delivery.fee) : null

  return {
    lines: priced.map(({ lineCents: _omit, ...line }) => line),
    subtotal: fromCents(subtotalCents),
    deliveryFee: feeCents === null ? null : fromCents(feeCents),
    total: fromCents(subtotalCents + (feeCents ?? 0)),
    deliveryZone: delivery ? { id: delivery.zoneId, name: delivery.zoneName } : null,
  }
}
