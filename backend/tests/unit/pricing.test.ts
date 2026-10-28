import { describe, expect, it } from 'vitest'
import { CartError, priceCart, type CatalogProduct } from '../../src/domain/pricing.js'

const ADICIONALES = { id: 'g-add', name: 'Adicionales', minSelect: 0, maxSelect: null }
const tocineta = { id: 'o-toc', name: 'Tocineta', price: '3000.00', groupId: 'g-add', groupName: 'Adicionales' }
const queso = { id: 'o-que', name: 'Queso rayado', price: '2000.00', groupId: 'g-add', groupName: 'Adicionales' }

const ranchera: CatalogProduct = {
  id: 'p-ran',
  name: 'Ranchera',
  price: '26500.00',
  sellable: true,
  trackStock: false,
  stockQuantity: 0,
  variants: [],
  optionGroups: [ADICIONALES],
  options: [tocineta, queso],
}

const hotDog: CatalogProduct = {
  id: 'p-hd',
  name: 'Clásico',
  price: '15000.00',
  sellable: true,
  trackStock: false,
  stockQuantity: 0,
  variants: [
    { id: 'v-zenu', name: 'Salchicha Zenú', price: '15000.00' },
    { id: 'v-ame', name: 'Salchicha Americana', price: '16000.00' },
  ],
  optionGroups: [ADICIONALES],
  options: [tocineta, queso],
}

const agua: CatalogProduct = {
  id: 'p-agua',
  name: 'Botella de Agua',
  price: '3000.00',
  sellable: true,
  trackStock: true,
  stockQuantity: 3,
  variants: [],
  optionGroups: [],
  options: [],
}

const catalog = new Map([ranchera, hotDog, agua].map((p) => [p.id, p]))

const expectCartError = (fn: () => unknown, code: string) => {
  try {
    fn()
  } catch (err) {
    expect(err).toBeInstanceOf(CartError)
    expect((err as CartError).code).toBe(code)
    return
  }
  throw new Error(`Se esperaba CartError ${code}`)
}

describe('priceCart', () => {
  it('calcula precio base + adicionales × cantidad', () => {
    const quote = priceCart([{ productId: 'p-ran', optionIds: ['o-toc', 'o-que'], quantity: 2 }], catalog, null)
    expect(quote.lines[0]).toMatchObject({
      basePrice: '26500.00',
      optionsPrice: '5000.00',
      unitPrice: '31500.00',
      lineTotal: '63000.00',
    })
    expect(quote.subtotal).toBe('63000.00')
    expect(quote.deliveryFee).toBeNull()
    expect(quote.total).toBe('63000.00')
  })

  it('usa el precio de la variante elegida', () => {
    const quote = priceCart([{ productId: 'p-hd', variantId: 'v-ame', optionIds: [], quantity: 1 }], catalog, null)
    expect(quote.lines[0]).toMatchObject({ variantName: 'Salchicha Americana', unitPrice: '16000.00' })
  })

  it('suma el domicilio de la zona al total', () => {
    const quote = priceCart([{ productId: 'p-ran', optionIds: [], quantity: 1 }], catalog, {
      zoneId: 'z1',
      zoneName: 'Cabecera',
      fee: '4000.00',
    })
    expect(quote.deliveryFee).toBe('4000.00')
    expect(quote.total).toBe('30500.00')
    expect(quote.deliveryZone).toEqual({ id: 'z1', name: 'Cabecera' })
  })

  it('ignora adicionales repetidos (no cobra dos veces)', () => {
    const quote = priceCart([{ productId: 'p-ran', optionIds: ['o-toc', 'o-toc'], quantity: 1 }], catalog, null)
    expect(quote.lines[0]!.optionsPrice).toBe('3000.00')
  })

  it('exige variante cuando el producto la tiene', () => {
    expectCartError(() => priceCart([{ productId: 'p-hd', optionIds: [], quantity: 1 }], catalog, null), 'VARIANT_REQUIRED')
  })

  it('rechaza variantes de otro producto o en productos sin variantes', () => {
    expectCartError(
      () => priceCart([{ productId: 'p-hd', variantId: 'v-otro', optionIds: [], quantity: 1 }], catalog, null),
      'VARIANT_REQUIRED',
    )
    expectCartError(
      () => priceCart([{ productId: 'p-ran', variantId: 'v-zenu', optionIds: [], quantity: 1 }], catalog, null),
      'INVALID_VARIANT',
    )
  })

  it('rechaza adicionales que el producto no ofrece', () => {
    expectCartError(() => priceCart([{ productId: 'p-agua', optionIds: ['o-toc'], quantity: 1 }], catalog, null), 'INVALID_OPTION')
  })

  it('respeta el máximo de opciones del grupo', () => {
    const limited = new Map(catalog)
    limited.set('p-ran', { ...ranchera, optionGroups: [{ ...ADICIONALES, maxSelect: 1 }] })
    expectCartError(
      () => priceCart([{ productId: 'p-ran', optionIds: ['o-toc', 'o-que'], quantity: 1 }], limited, null),
      'INVALID_OPTION_COUNT',
    )
  })

  it('rechaza productos inexistentes o no vendibles', () => {
    expectCartError(() => priceCart([{ productId: 'nope', optionIds: [], quantity: 1 }], catalog, null), 'PRODUCT_UNAVAILABLE')
    const agotado = new Map(catalog)
    agotado.set('p-ran', { ...ranchera, sellable: false })
    expectCartError(() => priceCart([{ productId: 'p-ran', optionIds: [], quantity: 1 }], agotado, null), 'PRODUCT_UNAVAILABLE')
  })

  it('valida existencias sumando todas las líneas del mismo producto', () => {
    expect(() => priceCart([{ productId: 'p-agua', optionIds: [], quantity: 3 }], catalog, null)).not.toThrow()
    expectCartError(
      () =>
        priceCart(
          [
            { productId: 'p-agua', optionIds: [], quantity: 2 },
            { productId: 'p-agua', optionIds: [], quantity: 2 },
          ],
          catalog,
          null,
        ),
      'INSUFFICIENT_STOCK',
    )
  })
})
