// Tipos de la API pública (ver docs/api.md). Los importes llegan como texto
// "19000.00" y solo se convierten a número para mostrarlos.

export type Category = { id: string; slug: string; name: string; description: string | null }

export type Variant = { id: string; name: string; price: string }
export type Option = { id: string; name: string; price: string }
export type OptionGroup = { id: string; name: string; minSelect: number; maxSelect: number | null; options: Option[] }

export type Product = {
  id: string
  slug: string
  name: string
  description: string | null
  price: string
  imageUrl: string | null
  imageAlt: string | null
  isFeatured: boolean
  available: boolean
  category: { id: string; slug: string; name: string }
  variants: Variant[]
  optionGroups: OptionGroup[]
}

export type OpeningHours = { day: number; open: string; close: string }[]

export type PublicSettings = {
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
  deliveryZones: { id: string; name: string; fee: string }[]
}

export type Fulfillment = 'DOMICILIO' | 'RECOGIDA'

export type QuoteLine = {
  productId: string
  productName: string
  variantId: string | null
  variantName: string | null
  options: { id: string; groupName: string; name: string; price: string }[]
  basePrice: string
  optionsPrice: string
  unitPrice: string
  quantity: number
  lineTotal: string
  notes: string | null
}

export type Quote = {
  lines: QuoteLine[]
  subtotal: string
  deliveryFee: string | null
  total: string
  deliveryZone: { id: string; name: string } | null
}
