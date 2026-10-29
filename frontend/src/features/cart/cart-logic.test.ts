import { describe, expect, it } from 'vitest'
import type { Product } from '../../types/catalog'
import {
  addLine,
  applyQuote,
  buildLine,
  cartCount,
  estimateSubtotal,
  replaceLine,
  setQuantity,
  startingPrice,
  storedCartSchema,
} from './cart-logic'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const hotDog: Product = {
  id: uuid(1),
  slug: 'hot-dog-clasico',
  name: 'Clásico',
  description: null,
  price: '15000.00',
  imageUrl: null,
  imageAlt: null,
  isFeatured: false,
  available: true,
  category: { id: uuid(9), slug: 'hot-dogs', name: 'Hot Dogs' },
  variants: [
    { id: uuid(2), name: 'Salchicha Zenú', price: '15000.00' },
    { id: uuid(3), name: 'Salchicha Americana', price: '16000.00' },
  ],
  optionGroups: [
    {
      id: uuid(4),
      name: 'Adicionales',
      minSelect: 0,
      maxSelect: null,
      options: [
        { id: uuid(5), name: 'Tocineta', price: '3000.00' },
        { id: uuid(6), name: 'Queso rayado', price: '2000.00' },
      ],
    },
  ],
}

const sel = (variantId: string | null, optionIds: string[] = [], quantity = 1, notes: string | null = null) => ({
  variantId,
  optionIds,
  quantity,
  notes,
})

describe('carrito', () => {
  it('calcula el precio con variante y adicionales', () => {
    const line = buildLine(hotDog, sel(uuid(3), [uuid(5), uuid(6)]), 'a')
    expect(line.unitPrice).toBe('21000.00')
    expect(line.variantName).toBe('Salchicha Americana')
    expect(line.options.map((o) => o.name)).toEqual(['Tocineta', 'Queso rayado'])
  })

  it('muestra el precio "desde" de la variante más barata', () => {
    expect(startingPrice(hotDog)).toBe('15000.00')
  })

  it('suma cantidades cuando se agrega la misma combinación', () => {
    let lines = addLine([], buildLine(hotDog, sel(uuid(2), [uuid(5), uuid(6)], 1), 'a'))
    lines = addLine(lines, buildLine(hotDog, sel(uuid(2), [uuid(6), uuid(5)], 2), 'b'))
    expect(lines).toHaveLength(1)
    expect(lines[0]!.quantity).toBe(3)
  })

  it('separa líneas con distinta variante, adicionales u observaciones', () => {
    let lines = addLine([], buildLine(hotDog, sel(uuid(2)), 'a'))
    lines = addLine(lines, buildLine(hotDog, sel(uuid(3)), 'b'))
    lines = addLine(lines, buildLine(hotDog, sel(uuid(2), [], 1, 'sin cebolla'), 'c'))
    expect(lines).toHaveLength(3)
  })

  it('calcula subtotal y cantidad de productos', () => {
    let lines = addLine([], buildLine(hotDog, sel(uuid(2), [], 2), 'a'))
    lines = addLine(lines, buildLine(hotDog, sel(uuid(3), [uuid(5)], 1), 'b'))
    expect(cartCount(lines)).toBe(3)
    expect(estimateSubtotal(lines)).toBe('49000.00')
  })

  it('limita la cantidad entre 1 y 50', () => {
    const lines = [buildLine(hotDog, sel(uuid(2)), 'a')]
    expect(setQuantity(lines, 'a', 0)[0]!.quantity).toBe(1)
    expect(setQuantity(lines, 'a', 99)[0]!.quantity).toBe(50)
  })

  it('al editar una línea conserva su posición o la fusiona si queda igual a otra', () => {
    const a = buildLine(hotDog, sel(uuid(2)), 'a')
    const b = buildLine(hotDog, sel(uuid(3)), 'b')
    const edited = replaceLine([a, b], 'a', buildLine(hotDog, sel(uuid(2), [uuid(5)]), 'x'))
    expect(edited.map((l) => l.lineId)).toEqual(['a', 'b'])
    expect(edited[0]!.unitPrice).toBe('18000.00')

    const merged = replaceLine([a, b], 'a', buildLine(hotDog, sel(uuid(3)), 'x'))
    expect(merged).toHaveLength(1)
    expect(merged[0]!.quantity).toBe(2)
  })

  it('actualiza los precios con la cotización del backend y avisa qué cambió', () => {
    const lines = [buildLine(hotDog, sel(uuid(2), [uuid(5)]), 'a')]
    const { lines: next, changed } = applyQuote(lines, {
      lines: [
        {
          productId: hotDog.id,
          productName: 'Clásico',
          variantId: uuid(2),
          variantName: 'Salchicha Zenú',
          options: [{ id: uuid(5), groupName: 'Adicionales', name: 'Tocineta', price: '3500.00' }],
          basePrice: '15000.00',
          optionsPrice: '3500.00',
          unitPrice: '18500.00',
          quantity: 1,
          lineTotal: '18500.00',
          notes: null,
        },
      ],
      subtotal: '18500.00',
      deliveryFee: null,
      total: '18500.00',
      deliveryZone: null,
    })
    expect(changed).toEqual(['Clásico'])
    expect(next[0]!.unitPrice).toBe('18500.00')
    expect(next[0]!.options[0]!.price).toBe('3500.00')
  })

  it('descarta un carrito guardado con formato inválido', () => {
    expect(storedCartSchema.safeParse({ version: 1, lines: [{ productId: 'x' }] }).success).toBe(false)
    expect(storedCartSchema.safeParse({ version: 1, lines: [buildLine(hotDog, sel(uuid(2)), 'a')] }).success).toBe(true)
  })
})
