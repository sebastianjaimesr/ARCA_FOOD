import type { ReactNode } from 'react'

// Ilustraciones de línea propias, en el estilo de la carta impresa de El Arca.
// Se usan mientras no haya fotografías reales de los productos; no son fotos ni
// pretenden mostrar el plato exacto.

const ART: Record<string, ReactNode> = {
  hamburguesas: (
    <>
      <path d="M12 29c0-9.4 9-16 20-16s20 6.6 20 16z" />
      <path d="M24 20.5h.01M32 18h.01M40 20.5h.01M28 24h.01M36 24h.01" strokeWidth="3.2" />
      <path d="M10 34c3 0 3 3 6 3s3-3 6-3 3 3 6 3 3-3 6-3 3 3 6 3 3-3 6-3 3 3 6 3" />
      <rect x="11" y="39" width="42" height="6" rx="3" />
      <path d="M12 49h40l-1.5 3.2A3 3 0 0 1 47.8 54H16.2a3 3 0 0 1-2.7-1.8z" />
    </>
  ),
  'hot-dogs': (
    <>
      <path d="M8 36a8 8 0 0 1 8-8h32a8 8 0 0 1 0 16H16a8 8 0 0 1-8-8z" />
      <path d="M6 33.5a5 5 0 0 1 5-5h42a5 5 0 0 1 0 10H11a5 5 0 0 1-5-5z" />
      <path d="M13 33.5c3-3 5 3 8 0s5 3 8 0 5 3 8 0 5 3 8 0 5 3 7 0" />
    </>
  ),
  'papas-locas': (
    <>
      <path d="M20 26l-3-14M26 25l-1-16M32 25V8M38 25l1-16M44 26l3-14" />
      <path d="M15 26h34l-4 28H19z" />
      <path d="M17 32c4 0 4 5 8 5s3-5 7-5 4 6 8 6 4-6 7-6" />
    </>
  ),
  desgranados: (
    <>
      <path d="M10 32h44a22 18 0 0 1-44 0z" />
      <path d="M20 28h.01M26 26h.01M32 28h.01M38 26h.01M44 28h.01M23 23h.01M35 23h.01M29 22h.01" strokeWidth="3.4" />
      <path d="M44 22L54 8" />
      <ellipse cx="55" cy="7" rx="2.5" ry="4" transform="rotate(35 55 7)" />
    </>
  ),
  salchipapas: (
    <>
      <path d="M22 30l-2-14M28 29V12M34 29l1-15M40 30l3-13" />
      <path d="M16 30h32l-5 24H21z" />
      <circle cx="26" cy="40" r="3.2" />
      <circle cx="36" cy="38" r="3.2" />
      <circle cx="31" cy="47" r="3.2" />
    </>
  ),
  choripapas: (
    <>
      <path d="M24 30l-2-14M30 29V12M36 29l1-15M42 30l2-12" />
      <path d="M18 30h30l-4 24H22z" />
      <path d="M8 44c0-3 2.5-5 5.5-5s5.5 2 5.5 5-2.5 5-5.5 5S8 47 8 44z" />
      <path d="M19 44h2M50 40c0-3 2.5-5 5.5-5s5.5 2 5.5 5-2.5 5-5.5 5S50 43 50 40z" />
    </>
  ),
  carnes: (
    <>
      <path d="M14 22c6-10 26-12 36-3 8 7 4 22-6 26-9 4-14 0-20 4s-14 2-14-7 0-14 4-20z" />
      <circle cx="40" cy="26" r="4" />
      <path d="M22 30c4-3 9-3 12 0M20 37c5-2 10-1 14 2" />
    </>
  ),
  bebidas: (
    <>
      <path d="M18 18h28l-4 38H22z" />
      <path d="M16 18h32" />
      <path d="M36 18l6-12h6" />
      <rect x="25" y="28" width="7" height="7" rx="1.5" transform="rotate(-12 28.5 31.5)" />
      <rect x="33" y="33" width="6" height="6" rx="1.5" transform="rotate(10 36 36)" />
      <path d="M26 46h.01M33 50h.01M37 44h.01" strokeWidth="3" />
    </>
  ),
}

const FALLBACK = ART.hamburguesas

type CategoryArtProps = { slug: string; className?: string; title?: string }

export function CategoryArt({ slug, className, title }: CategoryArtProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {ART[slug] ?? FALLBACK}
    </svg>
  )
}
