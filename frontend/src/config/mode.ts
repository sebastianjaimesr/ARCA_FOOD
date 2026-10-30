// Modo vitrina (GitHub Pages): el sitio funciona sin backend. El menú sale de
// src/static/catalog.json, los precios se calculan con las mismas reglas del
// backend y el pedido se envía directo por WhatsApp, sin registrarse en una
// base de datos. Se activa al compilar con VITE_STATIC_MODE=true.
export const STATIC_MODE = import.meta.env.VITE_STATIC_MODE === 'true'

// Ruta a un archivo de public/ respetando la base del sitio
// (en GitHub Pages el sitio vive en /ARCA_FOOD/).
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
