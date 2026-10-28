import { z } from 'zod'
import { fromCents, toCents } from '../lib/money.js'

export const uuid = z.string().uuid('Identificador inválido')

// Tope de 99.999.999,99 por importe: muy por encima de cualquier precio real y
// dentro de NUMERIC(12,2).
const MAX_MONEY_CENTS = 99_999_999_99

// Acepta 19000, "19000" o "19000.50" y lo normaliza a "19000.00".
export const money = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    try {
      const cents = toCents(value)
      if (cents < 0 || cents > MAX_MONEY_CENTS) throw new Error()
      return fromCents(cents)
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Importe inválido' })
      return z.NEVER
    }
  })

// Celular colombiano (3xx) o fijo (60x). Acepta espacios, guiones y +57.
export const colombianPhone = z
  .string()
  .transform((value) => {
    const digits = value.replace(/\D/g, '')
    return digits.length === 12 && digits.startsWith('57') ? digits.slice(2) : digits
  })
  .refine((digits) => /^(3\d{9}|60\d{8})$/.test(digits), 'Escribe un número de 10 dígitos, por ejemplo 300 123 4567')

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .nullish()
    .transform((value) => (value ? value : null))

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones')

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD')

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
