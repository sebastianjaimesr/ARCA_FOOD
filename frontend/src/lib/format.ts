const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

// Los importes viajan desde la API como texto ("19000.00") para no perder
// precisión; aquí solo se formatean para mostrar.
export function formatCOP(amount: number | string): string {
  const value = typeof amount === 'string' ? Number(amount) : amount
  if (!Number.isFinite(value)) return '—'
  return copFormatter.format(value).replace(/ /g, ' ')
}

// Fecha y hora corta en hora de Bogotá: "28/10/26, 5:30 p. m."
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })
