import { describe, expect, it } from 'vitest'
import type { Order } from '../../types/order'
import { idempotencyKeyFor, resetIdempotencyKey } from './idempotency'
import { buildWhatsappMessage } from './whatsapp-message'

const order: Order = {
  id: 'o1',
  code: 'ARC-1042',
  status: 'PENDIENTE',
  fulfillment: 'DOMICILIO',
  customerName: 'Ana Pérez',
  customerPhone: '3001234567',
  deliveryAddress: 'Cra 27 #45-10 apto 301',
  deliveryReference: 'Edificio azul',
  deliveryZoneName: null,
  notes: 'Tocar el timbre',
  subtotal: '64000.00',
  deliveryFee: null,
  total: '64000.00',
  createdAt: '2026-10-28T22:00:00Z',
  items: [
    {
      id: 'i1',
      productId: 'p1',
      productName: 'Mega Arca',
      variantName: 'Salchicha Americana',
      options: [{ groupName: 'Adicionales', name: 'Tocineta', price: '3000.00' }],
      basePrice: '28000.00',
      optionsPrice: '3000.00',
      unitPrice: '31000.00',
      quantity: 2,
      lineTotal: '62000.00',
      notes: 'sin cebolla',
    },
    {
      id: 'i2',
      productId: 'p2',
      productName: 'Botella de Agua',
      variantName: null,
      options: [],
      basePrice: '1000.00',
      optionsPrice: '0.00',
      unitPrice: '1000.00',
      quantity: 2,
      lineTotal: '2000.00',
      notes: null,
    },
  ],
}

describe('mensaje de WhatsApp', () => {
  const message = buildWhatsappMessage(order, 'El Arca')

  it('incluye código, productos, opciones, precios y totales', () => {
    expect(message).toContain('*Pedido ARC-1042*')
    expect(message).toContain('*2 x Mega Arca – Salchicha Americana*')
    expect(message).toContain('$ 28.000 c/u')
    expect(message).toContain('+ Tocineta ($ 3.000)')
    expect(message).toContain('Valor unitario: $ 31.000')
    expect(message).toContain('Subtotal: $ 62.000')
    expect(message).toContain('_Nota: sin cebolla_')
    expect(message).toContain('Subtotal: $ 64.000')
  })

  it('con domicilio sin tarifa lo indica como por confirmar', () => {
    expect(message).toContain('Domicilio: por confirmar')
    expect(message).toContain('*Total: $ 64.000* + domicilio')
  })

  it('incluye datos del cliente, dirección, referencia y observaciones', () => {
    expect(message).toContain('Nombre: Ana Pérez')
    expect(message).toContain('Entrega: Domicilio')
    expect(message).toContain('Dirección: Cra 27 #45-10 apto 301')
    expect(message).toContain('Referencia: Edificio azul')
    expect(message).toContain('Observaciones: Tocar el timbre')
  })

  it('con tarifa de zona muestra el valor y el total completo', () => {
    const withFee = buildWhatsappMessage({ ...order, deliveryFee: '4000.00', deliveryZoneName: 'Cabecera', total: '68000.00' }, 'El Arca')
    expect(withFee).toContain('Domicilio (Cabecera): $ 4.000')
    expect(withFee).toContain('*Total: $ 68.000*\n')
  })

  it('para recogida no muestra dirección ni domicilio', () => {
    const pickup = buildWhatsappMessage({ ...order, fulfillment: 'RECOGIDA', deliveryAddress: null, deliveryReference: null }, 'El Arca')
    expect(pickup).toContain('Entrega: Recoger en el local')
    expect(pickup).not.toContain('Dirección')
    expect(pickup).not.toContain('Domicilio:')
  })
})

describe('clave de idempotencia', () => {
  const memory = () => {
    const data = new Map<string, string>()
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    }
  }

  it('reutiliza la clave mientras el pedido no cambie (doble clic, reintento)', () => {
    const store = memory()
    const a = idempotencyKeyFor({ items: [1] }, store)
    expect(idempotencyKeyFor({ items: [1] }, store)).toBe(a)
    expect(a).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('genera otra clave si el pedido cambia o ya se creó', () => {
    const store = memory()
    const a = idempotencyKeyFor({ items: [1] }, store)
    const b = idempotencyKeyFor({ items: [2] }, store)
    expect(b).not.toBe(a)
    resetIdempotencyKey(store)
    expect(idempotencyKeyFor({ items: [2] }, store)).not.toBe(b)
  })
})
