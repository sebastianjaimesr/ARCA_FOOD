import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { formatCOP } from '../../lib/format'
import type { Product } from '../../types/catalog'
import { startingPrice } from '../cart/cart-logic'
import { ProductVisual } from './ProductVisual'

type ProductCardProps = { product: Product; onOpen: (product: Product) => void }

export function ProductCard({ product, onOpen }: ProductCardProps) {
  const hasVariants = product.variants.length > 0

  return (
    <motion.article
      layout="position"
      // Animación al montar (no "al entrar en pantalla"): un producto nunca
      // debe quedar invisible si el observador de visibilidad no se dispara.
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`group relative flex overflow-hidden rounded-2xl border border-ink-700 bg-ink-800 transition-colors hover:border-brand-500/50 sm:flex-col ${
        product.available ? '' : 'opacity-60'
      }`}
    >
      <div className="relative aspect-square w-28 shrink-0 bg-ink-900 sm:aspect-[4/3] sm:w-full">
        <ProductVisual product={product} />
        {!product.available && (
          <span className="absolute top-2 left-2 rounded-full bg-ink-950/90 px-2.5 py-1 text-[11px] font-bold tracking-wide text-cream-100 uppercase">
            Agotado
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <h3 className="text-base leading-tight font-extrabold text-cream-50 uppercase">
          {/* El botón cubre toda la tarjeta: un solo elemento interactivo, accesible por teclado. */}
          <button onClick={() => onOpen(product)} className="text-left uppercase after:absolute after:inset-0 focus-visible:outline-none">
            {product.name}
          </button>
        </h3>
        {product.description && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-cream-300">{product.description}</p>}

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="text-lg font-black text-cream-50">
            {hasVariants && <span className="mr-1 text-xs font-semibold text-cream-300">Desde</span>}
            {formatCOP(startingPrice(product))}
          </p>
          {product.available && (
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-full bg-brand-500 text-ink-900 transition group-hover:scale-110 group-has-[:focus-visible]:ring-2 group-has-[:focus-visible]:ring-brand-300"
            >
              <Plus className="size-5" />
            </span>
          )}
        </div>
      </div>
    </motion.article>
  )
}
