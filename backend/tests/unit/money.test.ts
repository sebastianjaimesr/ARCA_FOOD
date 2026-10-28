import { describe, expect, it } from 'vitest'
import { fromCents, toCents } from '../../src/lib/money.js'

describe('money', () => {
  it('convierte texto de NUMERIC a centavos sin perder precisión', () => {
    expect(toCents('19000.00')).toBe(1_900_000)
    expect(toCents('0.10')).toBe(10)
    expect(toCents('26500')).toBe(2_650_000)
    expect(toCents(4500)).toBe(450_000)
  })

  it('suma 0.1 + 0.2 sin error de punto flotante', () => {
    expect(fromCents(toCents('0.1') + toCents('0.2'))).toBe('0.30')
  })

  it('formatea centavos como NUMERIC', () => {
    expect(fromCents(1_900_000)).toBe('19000.00')
    expect(fromCents(5)).toBe('0.05')
  })

  it('rechaza importes con más de dos decimales o basura', () => {
    expect(() => toCents('1.234')).toThrow()
    expect(() => toCents('abc')).toThrow()
  })
})
