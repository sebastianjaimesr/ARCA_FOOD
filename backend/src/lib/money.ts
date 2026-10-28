// Todo cálculo de dinero se hace en centavos enteros: 19.000 pesos = 1_900_000.
// Así se evita el error de redondeo de los números de punto flotante.

export type Cents = number

export function toCents(value: string | number): Cents {
  const text = typeof value === 'number' ? value.toFixed(2) : value.trim()
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text)
  if (!match) throw new Error(`Importe inválido: ${value}`)
  const [, sign, whole, fraction = ''] = match
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) throw new Error(`Importe fuera de rango: ${value}`)
  return sign === '-' ? -cents : cents
}

// Formato que entiende NUMERIC(12,2) y que devuelve la API: "19000.00".
export function fromCents(cents: Cents): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}
