import { describe, expect, it } from 'vitest'
import { describeHours, formatPhone, whatsappUrl } from './business'

describe('datos del negocio', () => {
  it('arma el enlace oficial de WhatsApp con el mensaje codificado', () => {
    expect(whatsappUrl('573006681727')).toBe('https://wa.me/573006681727')
    expect(whatsappUrl('573006681727', 'Hola & #1')).toBe('https://wa.me/573006681727?text=Hola%20%26%20%231')
    expect(whatsappUrl(null)).toBeNull()
  })

  it('formatea el teléfono para mostrarlo', () => {
    expect(formatPhone('573006681727')).toBe('300 668 1727')
  })

  it('agrupa días consecutivos con el mismo horario', () => {
    expect(
      describeHours([
        { day: 1, open: '17:00', close: '23:00' },
        { day: 2, open: '17:00', close: '23:00' },
        { day: 3, open: '17:00', close: '23:00' },
        { day: 6, open: '12:00', close: '23:00' },
      ]),
    ).toEqual(['Lunes a Miércoles · 17:00 – 23:00', 'Sábado · 12:00 – 23:00'])
    expect(describeHours(null)).toBeNull()
  })
})
