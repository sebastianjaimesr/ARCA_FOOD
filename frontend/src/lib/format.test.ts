import { describe, expect, it } from 'vitest'
import { formatCOP } from './format'

describe('formatCOP', () => {
  it('formatea pesos colombianos sin decimales', () => {
    expect(formatCOP(19000)).toBe('$ 19.000')
    expect(formatCOP('26500.00')).toBe('$ 26.500')
  })

  it('devuelve un guion para valores inválidos', () => {
    expect(formatCOP('abc')).toBe('—')
  })
})
