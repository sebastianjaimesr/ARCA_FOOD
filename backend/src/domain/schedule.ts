import type { OpeningHours } from '../repositories/settings.repository.js'

// Día (lunes = 1 … domingo = 7) y minutos desde medianoche en la zona horaria del negocio.
function localTime(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h! * 60 + m!
}

// Sin horario configurado (pendiente) no se bloquean pedidos: el restaurante
// decide al recibir el WhatsApp. Soporta turnos que pasan la medianoche.
export function isOpenAt(hours: OpeningHours | null, now: Date, timeZone: string): boolean {
  if (!hours || hours.length === 0) return true
  const { day, minutes } = localTime(now, timeZone)
  const previousDay = day === 1 ? 7 : day - 1

  return hours.some((slot) => {
    const open = toMinutes(slot.open)
    const close = toMinutes(slot.close)
    if (close > open) return slot.day === day && minutes >= open && minutes < close
    // Turno nocturno, ej. 17:00 → 01:00
    return (slot.day === day && minutes >= open) || (slot.day === previousDay && minutes < close)
  })
}
