import { describe, expect, it } from 'vitest'
import { allowedTransitions, canTransition } from '../../src/domain/order-status.js'

describe('transiciones de estado', () => {
  it('domicilio sigue el flujo completo con EN_CAMINO', () => {
    expect(canTransition('PENDIENTE', 'CONFIRMADO', 'DOMICILIO')).toBe(true)
    expect(canTransition('LISTO', 'EN_CAMINO', 'DOMICILIO')).toBe(true)
    expect(canTransition('LISTO', 'ENTREGADO', 'DOMICILIO')).toBe(false)
    expect(canTransition('EN_CAMINO', 'ENTREGADO', 'DOMICILIO')).toBe(true)
  })

  it('recogida no pasa por EN_CAMINO', () => {
    expect(canTransition('LISTO', 'ENTREGADO', 'RECOGIDA')).toBe(true)
    expect(canTransition('LISTO', 'EN_CAMINO', 'RECOGIDA')).toBe(false)
  })

  it('no permite saltar estados', () => {
    expect(canTransition('PENDIENTE', 'ENTREGADO', 'RECOGIDA')).toBe(false)
    expect(canTransition('PENDIENTE', 'EN_PREPARACION', 'DOMICILIO')).toBe(false)
  })

  it('se puede cancelar desde cualquier estado no final', () => {
    for (const status of ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'EN_CAMINO'] as const) {
      expect(canTransition(status, 'CANCELADO', 'DOMICILIO')).toBe(true)
    }
  })

  it('ENTREGADO y CANCELADO son finales', () => {
    expect(allowedTransitions('ENTREGADO', 'DOMICILIO')).toEqual([])
    expect(allowedTransitions('CANCELADO', 'RECOGIDA')).toEqual([])
  })
})
