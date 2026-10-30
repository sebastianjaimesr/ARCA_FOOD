/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  // "true" para el modo vitrina (GitHub Pages, sin backend).
  readonly VITE_STATIC_MODE?: string
  // Ruta base del sitio, ej. "/ARCA_FOOD/" en GitHub Pages.
  readonly VITE_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
