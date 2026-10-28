// Datos confirmados del negocio (carta 2025 y dirección entregada por el cliente).
// Temporal: en la Fase 3 estos valores pasan a la tabla de configuración y se
// leen desde GET /api/settings, editables desde el panel.
export const business = {
  name: 'El Arca',
  tagline: 'Comidas Rápidas',
  whatsapp: { display: '300 668 1727', e164: '573006681727' },
  instagram: { handle: 'elarcafastfood', url: 'https://www.instagram.com/elarcafastfood/' },
  address: 'Cl 103 #14-27, Bucaramanga, Santander',
  // Pendientes: el restaurante todavía no los ha entregado.
  schedule: null as string | null,
} as const

export const whatsappUrl = (text?: string) =>
  `https://wa.me/${business.whatsapp.e164}${text ? `?text=${encodeURIComponent(text)}` : ''}`

export const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`
