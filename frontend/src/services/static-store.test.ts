import { describe, expect, it } from 'vitest'
import snapshot from '../static/catalog.json'
import { ApiError } from './api'
import { staticCreateOrder, staticProducts, staticQuote } from './static-store'

const product = (slug: string) => snapshot.products.find((p) => p.slug === slug)!
const megaArca = product('hot-dog-mega-arca')
const americana = megaArca.variants.find((v) => v.name === 'Salchicha Americana')!
const tocineta = megaArca.optionGroups[0]!.options.find((o) => o.name === 'Tocineta')!

describe('modo vitrina (sin backend)', () => {
  it('trae la carta completa exportada', async () => {
    const products = await staticProducts()
    expect(products).toHaveLength(43)
    expect(product('hamburguesa-ranchera').price).toBe('26500.00')
  })

  it('calcula precios con las mismas reglas del backend', async () => {
    const quote = await staticQuote({
      items: [{ productId: megaArca.id, variantId: americana.id, optionIds: [tocineta.id], quantity: 2 }],
    })
    expect(quote).toMatchObject({ subtotal: '62000.00', deliveryFee: null, total: '62000.00' })
  })

  it('exige elegir la variante cuando el producto la tiene', async () => {
    const err = await staticQuote({ items: [{ productId: megaArca.id, variantId: null, optionIds: [], quantity: 1 }] }).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 409, code: 'VARIANT_REQUIRED' })
  })

  it('arma el pedido con referencia WEB y sanea el texto del cliente', async () => {
    const { order } = await staticCreateOrder({
      fulfillment: 'DOMICILIO',
      deliveryZoneId: null,
      customerName: 'Ana\n*Total: $ 1*',
      customerPhone: '+57 300 123 4567',
      deliveryAddress: 'Cl 103 #14-27',
      deliveryReference: null,
      notes: null,
      items: [{ productId: product('hamburguesa-clasica').id, variantId: null, optionIds: [], quantity: 1, notes: null }],
    })
    expect(order.code).toMatch(/^WEB-[0-9A-Z]{8}$/)
    expect(order).toMatchObject({ status: 'PENDIENTE', customerName: 'Ana *Total: $ 1*', customerPhone: '3001234567', total: '19000.00' })
  })

  it('valida los datos como el backend (celular inválido)', async () => {
    const err = await staticCreateOrder({
      fulfillment: 'RECOGIDA',
      deliveryZoneId: null,
      customerName: 'Ana',
      customerPhone: '123',
      deliveryAddress: null,
      deliveryReference: null,
      notes: null,
      items: [{ productId: product('hamburguesa-clasica').id, variantId: null, optionIds: [], quantity: 1, notes: null }],
    }).catch((e) => e)
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
  })
})
