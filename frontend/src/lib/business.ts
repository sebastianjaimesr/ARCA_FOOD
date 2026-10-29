import type { OpeningHours, PublicSettings } from '../types/catalog'

// Enlace oficial de WhatsApp (wa.me) con el número configurado en el panel.
export function whatsappUrl(phone: string | null | undefined, text?: string): string | null {
  if (!phone) return null
  return `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

// "573006681727" → "300 668 1727"
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const local = phone.startsWith('57') && phone.length === 12 ? phone.slice(2) : phone
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : local
}

export function fullAddress(settings: Pick<PublicSettings, 'address' | 'city'>): string | null {
  return [settings.address, settings.city].filter(Boolean).join(', ') || null
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Agrupa días con el mismo horario: "Lunes a Viernes · 17:00 – 23:00".
export function describeHours(hours: OpeningHours | null): string[] | null {
  if (!hours || hours.length === 0) return null
  const sorted = [...hours].sort((a, b) => a.day - b.day || a.open.localeCompare(b.open))
  const groups: { from: number; to: number; slot: string }[] = []
  for (const h of sorted) {
    const slot = `${h.open} – ${h.close}`
    const last = groups.at(-1)
    if (last && last.slot === slot && last.to === h.day - 1) last.to = h.day
    else groups.push({ from: h.day, to: h.day, slot })
  }
  return groups.map((g) => `${g.from === g.to ? DAY_NAMES[g.from] : `${DAY_NAMES[g.from]} a ${DAY_NAMES[g.to]}`} · ${g.slot}`)
}
