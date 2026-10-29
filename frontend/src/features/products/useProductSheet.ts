import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import type { Product } from '../../types/catalog'

// El detalle del producto vive en la URL (?producto=slug): se puede compartir
// el enlace y el botón "atrás" del celular cierra la hoja.
export function useProductSheet(products: Product[] | undefined) {
  const [params, setParams] = useSearchParams()
  const slug = params.get('producto')
  const product = slug ? (products?.find((p) => p.slug === slug) ?? null) : null

  const open = useCallback(
    (p: Product) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('producto', p.slug)
        return next
      })
    },
    [setParams],
  )

  const close = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('producto')
        return next
      },
      { replace: true },
    )
  }, [setParams])

  return { product, slug, open, close }
}
