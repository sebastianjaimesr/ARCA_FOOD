import { describe, expect, it } from 'vitest'
import { isOpenAt } from '../../src/domain/schedule.js'

const TZ = 'America/Bogota'
// Bogotá es UTC-5 todo el año. 2026-10-28 es miércoles (día 3).
const bogota = (isoLocal: string) => new Date(`${isoLocal}-05:00`)

describe('isOpenAt', () => {
  it('sin horario configurado no bloquea pedidos', () => {
    expect(isOpenAt(null, new Date(), TZ)).toBe(true)
    expect(isOpenAt([], new Date(), TZ)).toBe(true)
  })

  it('respeta el horario del día en hora de Bogotá', () => {
    const hours = [{ day: 3, open: '17:00', close: '23:00' }]
    expect(isOpenAt(hours, bogota('2026-10-28T18:30:00'), TZ)).toBe(true)
    expect(isOpenAt(hours, bogota('2026-10-28T16:59:00'), TZ)).toBe(false)
    expect(isOpenAt(hours, bogota('2026-10-28T23:00:00'), TZ)).toBe(false)
    expect(isOpenAt(hours, bogota('2026-10-29T18:30:00'), TZ)).toBe(false) // jueves
  })

  it('soporta turnos que pasan la medianoche', () => {
    const hours = [{ day: 3, open: '18:00', close: '01:00' }]
    expect(isOpenAt(hours, bogota('2026-10-28T23:30:00'), TZ)).toBe(true)
    expect(isOpenAt(hours, bogota('2026-10-29T00:30:00'), TZ)).toBe(true)
    expect(isOpenAt(hours, bogota('2026-10-29T01:30:00'), TZ)).toBe(false)
  })
})
