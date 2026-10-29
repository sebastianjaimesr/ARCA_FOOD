import { CategoryArt } from '../../components/brand/CategoryArt'
import type { Product } from '../../types/catalog'

// Foto real si el restaurante la cargó; si no, la ilustración de su categoría.
export function ProductVisual({ product, className = '' }: { product: Product; className?: string }) {
  if (product.imageUrl) {
    return (
      <img
        src={product.imageUrl}
        alt={product.imageAlt ?? product.name}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover ${className}`}
      />
    )
  }
  return (
    <div
      className={`grid h-full w-full place-items-center bg-[radial-gradient(circle_at_50%_40%,rgba(255,199,0,0.16),transparent_65%)] ${className}`}
    >
      <CategoryArt slug={product.category.slug} className="h-3/5 w-3/5 text-brand-500 drop-shadow-[0_0_18px_rgba(255,199,0,0.25)]" />
    </div>
  )
}
