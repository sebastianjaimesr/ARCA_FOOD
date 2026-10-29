import { describe, expect, it } from 'vitest'
import { checkoutSchema } from './checkout-schema'

const base = { customerName: 'Ana Pérez', customerPhone: '300 123 4567', fulfillment: 'RECOGIDA' as const }
const errorsOf = (result: ReturnType<ReturnType<typeof checkoutSchema>['safeParse']>) =>
  result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]))

describe('formulario de pedido', () => {
  it('acepta un pedido para recoger con nombre y celular', () => {
    const result = checkoutSchema({ requireZone: false }).safeParse(base)
    expect(result.success).toBe(true)
    expect(result.success && result.data.customerPhone).toBe('3001234567')
  })

  it('pide nombre, celular válido y modalidad', () => {
    const errors = errorsOf(checkoutSchema({ requireZone: false }).safeParse({ customerName: 'A', customerPhone: '123' }))
    expect(errors).toMatchObject({
      customerName: 'Escribe tu nombre',
      customerPhone: expect.stringContaining('10 dígitos'),
      fulfillment: 'Elige cómo quieres recibir tu pedido',
    })
  })

  it('a domicilio exige dirección; la zona solo si hay zonas configuradas', () => {
    const delivery = { ...base, fulfillment: 'DOMICILIO' as const }
    expect(errorsOf(checkoutSchema({ requireZone: false }).safeParse(delivery))).toEqual({ deliveryAddress: 'Escribe la dirección de entrega' })
    expect(checkoutSchema({ requireZone: false }).safeParse({ ...delivery, deliveryAddress: 'Cra 27 #45-10' }).success).toBe(true)
    expect(errorsOf(checkoutSchema({ requireZone: true }).safeParse({ ...delivery, deliveryAddress: 'Cra 27 #45-10' }))).toEqual({
      deliveryZoneId: 'Elige tu barrio o zona',
    })
  })

  it('acepta el celular con +57, espacios o guiones', () => {
    const parsed = checkoutSchema({ requireZone: false }).parse({ ...base, customerPhone: '+57 300-123-4567' })
    expect(parsed.customerPhone).toBe('3001234567')
  })
})
