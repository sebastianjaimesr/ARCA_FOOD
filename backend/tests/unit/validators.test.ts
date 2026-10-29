import { describe, expect, it } from 'vitest'
import { colombianPhone, money, slugify } from '../../src/validators/common.js'
import { createOrderSchema } from '../../src/validators/orders.validators.js'

const item = { productId: '0b9c0c55-6a3e-4c1d-9b5e-0d8f3f1f2a11', quantity: 1 }

describe('validadores', () => {
  it('normaliza teléfonos colombianos', () => {
    expect(colombianPhone.parse('300 668 1727')).toBe('3006681727')
    expect(colombianPhone.parse('+57 300-668-1727')).toBe('3006681727')
    expect(colombianPhone.parse('6076431234')).toBe('6076431234')
    expect(colombianPhone.safeParse('12345').success).toBe(false)
  })

  it('normaliza importes y rechaza negativos', () => {
    expect(money.parse(19000)).toBe('19000.00')
    expect(money.parse('26500.5')).toBe('26500.50')
    expect(money.safeParse(-1).success).toBe(false)
    expect(money.safeParse('1,5').success).toBe(false)
  })

  it('genera slugs sin tildes', () => {
    expect(slugify('Patacón Especial')).toBe('patacon-especial')
    expect(slugify('  Jalapeños x 2 ')).toBe('jalapenos-x-2')
  })

  it('exige dirección para domicilio pero no para recogida', () => {
    const base = { customerName: 'Ana', customerPhone: '3001234567', items: [item] }
    expect(createOrderSchema.safeParse({ ...base, fulfillment: 'DOMICILIO' }).success).toBe(false)
    expect(createOrderSchema.safeParse({ ...base, fulfillment: 'DOMICILIO', deliveryAddress: 'Cl 100 #20-10' }).success).toBe(true)
    expect(createOrderSchema.safeParse({ ...base, fulfillment: 'RECOGIDA' }).success).toBe(true)
  })

  it('no acepta precios enviados por el cliente en las líneas', () => {
    const parsed = createOrderSchema.parse({
      customerName: 'Ana',
      customerPhone: '3001234567',
      fulfillment: 'RECOGIDA',
      items: [{ ...item, unitPrice: 1 }],
    })
    expect(parsed.items[0]).not.toHaveProperty('unitPrice')
  })

  it('impide insertar líneas falsas en el resumen de WhatsApp', () => {
    const parsed = createOrderSchema.parse({
      customerName: 'Ana\n*Total: $ 1.000*',
      customerPhone: '3001234567',
      fulfillment: 'DOMICILIO',
      deliveryAddress: 'Cl 1 #2-3\r\nDomicilio: gratis',
      notes: 'sin\u2028cebolla\u0000',
      items: [{ ...item, notes: 'nota\n\nfalsa' }],
    })
    expect(parsed.customerName).toBe('Ana *Total: $ 1.000*')
    expect(parsed.deliveryAddress).toBe('Cl 1 #2-3 Domicilio: gratis')
    expect(parsed.notes).toBe('sin cebolla')
    expect(parsed.items[0]!.notes).toBe('nota falsa')
  })

  it('un nombre de solo espacios o saltos de línea no es válido', () => {
    const base = { customerPhone: '3001234567', fulfillment: 'RECOGIDA', items: [item] }
    expect(createOrderSchema.safeParse({ ...base, customerName: ' \n \t ' }).success).toBe(false)
  })

  it('rechaza carritos vacíos y cantidades fuera de rango', () => {
    const base = { customerName: 'Ana', customerPhone: '3001234567', fulfillment: 'RECOGIDA' }
    expect(createOrderSchema.safeParse({ ...base, items: [] }).success).toBe(false)
    expect(createOrderSchema.safeParse({ ...base, items: [{ ...item, quantity: 0 }] }).success).toBe(false)
    expect(createOrderSchema.safeParse({ ...base, items: [{ ...item, quantity: 51 }] }).success).toBe(false)
  })
})
