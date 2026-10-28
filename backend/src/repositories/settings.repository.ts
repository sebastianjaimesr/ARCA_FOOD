import type { Db } from '../lib/db.js'

export type OpeningHours = { day: number; open: string; close: string }[]

export type Settings = {
  businessName: string
  tagline: string | null
  whatsappPhone: string | null
  address: string | null
  city: string | null
  instagramHandle: string | null
  logoUrl: string | null
  currency: string
  timezone: string
  openingHours: OpeningHours | null
  deliveryEnabled: boolean
  pickupEnabled: boolean
  acceptingOrders: boolean
  deliveryNotes: string | null
  updatedAt: string
}

export type DeliveryZone = { id: string; name: string; fee: string; isActive: boolean; sortOrder: number }

const SETTINGS_COLUMNS: Record<keyof Omit<Settings, 'updatedAt'>, string> = {
  businessName: 'business_name',
  tagline: 'tagline',
  whatsappPhone: 'whatsapp_phone',
  address: 'address',
  city: 'city',
  instagramHandle: 'instagram_handle',
  logoUrl: 'logo_url',
  currency: 'currency',
  timezone: 'timezone',
  openingHours: 'opening_hours',
  deliveryEnabled: 'delivery_enabled',
  pickupEnabled: 'pickup_enabled',
  acceptingOrders: 'accepting_orders',
  deliveryNotes: 'delivery_notes',
}

const SELECT_SETTINGS = `
  select business_name as "businessName", tagline, whatsapp_phone as "whatsappPhone", address, city,
         instagram_handle as "instagramHandle", logo_url as "logoUrl", currency, timezone,
         opening_hours as "openingHours", delivery_enabled as "deliveryEnabled", pickup_enabled as "pickupEnabled",
         accepting_orders as "acceptingOrders", delivery_notes as "deliveryNotes", updated_at as "updatedAt"
  from public.settings where id = 1`

export async function getSettings(db: Db): Promise<Settings> {
  const { rows } = await db.query<Settings>(SELECT_SETTINGS)
  if (!rows[0]) throw new Error('Falta la fila de configuración (settings id = 1)')
  return rows[0]
}

export async function updateSettings(db: Db, patch: Partial<Omit<Settings, 'updatedAt'>>, actorId: string): Promise<Settings> {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as [keyof typeof SETTINGS_COLUMNS, unknown][]
  if (entries.length > 0) {
    const sets = entries.map(([key], i) => `${SETTINGS_COLUMNS[key]} = $${i + 1}`)
    const values = entries.map(([key, value]) => (key === 'openingHours' && value !== null ? JSON.stringify(value) : value))
    await db.query(`update public.settings set ${sets.join(', ')}, updated_by = $${values.length + 1} where id = 1`, [
      ...values,
      actorId,
    ])
  }
  return getSettings(db)
}

const SELECT_ZONE = `select id, name, fee::text as fee, is_active as "isActive", sort_order as "sortOrder" from public.delivery_zones`

export async function listDeliveryZones(db: Db, onlyActive: boolean): Promise<DeliveryZone[]> {
  const { rows } = await db.query<DeliveryZone>(`${SELECT_ZONE} ${onlyActive ? 'where is_active' : ''} order by sort_order, name`)
  return rows
}

export async function createDeliveryZone(db: Db, zone: Omit<DeliveryZone, 'id'>): Promise<DeliveryZone> {
  const { rows } = await db.query<{ id: string }>(
    'insert into public.delivery_zones (name, fee, is_active, sort_order) values ($1, $2, $3, $4) returning id',
    [zone.name, zone.fee, zone.isActive, zone.sortOrder],
  )
  return (await findDeliveryZone(db, rows[0]!.id))!
}

export async function updateDeliveryZone(db: Db, id: string, patch: Partial<Omit<DeliveryZone, 'id'>>): Promise<DeliveryZone | null> {
  const columns = { name: 'name', fee: 'fee', isActive: 'is_active', sortOrder: 'sort_order' } as const
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [keyof typeof columns, unknown][]
  if (entries.length > 0) {
    const sets = entries.map(([key], i) => `${columns[key]} = $${i + 2}`)
    await db.query(`update public.delivery_zones set ${sets.join(', ')} where id = $1`, [id, ...entries.map(([, v]) => v)])
  }
  return findDeliveryZone(db, id)
}

export async function findDeliveryZone(db: Db, id: string): Promise<DeliveryZone | null> {
  const { rows } = await db.query<DeliveryZone>(`${SELECT_ZONE} where id = $1`, [id])
  return rows[0] ?? null
}
