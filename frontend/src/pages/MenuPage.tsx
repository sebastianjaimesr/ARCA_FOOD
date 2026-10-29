import { Search, SearchX, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { useCart } from '../features/cart/cart-context'
import { ProductCard } from '../features/products/ProductCard'
import { ProductSheet } from '../features/products/ProductSheet'
import { useProductSheet } from '../features/products/useProductSheet'
import { useCategories, useProducts } from '../hooks/useCatalog'
import { matches } from '../lib/search'
import type { Category, Product } from '../types/catalog'

export function MenuPage() {
  const categories = useCategories()
  const products = useProducts()
  const cart = useCart()
  const sheet = useProductSheet(products.data)
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [activeSlug, setActiveSlug] = useState<string | null>(null)

  const sections = useMemo(() => {
    if (!categories.data || !products.data) return []
    return categories.data
      .map((category) => ({ category, items: products.data.filter((p) => p.category.id === category.id) }))
      .filter((s) => s.items.length > 0)
  }, [categories.data, products.data])

  const results = useMemo(
    () => (query.trim() && products.data ? products.data.filter((p) => matches(query, p.name, p.description, p.category.name)) : null),
    [query, products.data],
  )

  // Llegar desde la portada con ?categoria=slug lleva directo a esa sección.
  const initialCategory = params.get('categoria')
  const scrolledOnce = useRef(false)
  useEffect(() => {
    if (!initialCategory || scrolledOnce.current || sections.length === 0) return
    // La página sigue creciendo mientras termina de pintar (tipografías,
    // tarjetas): se reintenta unos cuadros hasta que la sección quede en su
    // lugar. Si el usuario toca o desplaza la página, se respeta su gesto.
    // La marca "ya se hizo" se pone al terminar (en desarrollo, el modo
    // estricto de React monta y desmonta el efecto una vez).
    // Usa temporizadores y no requestAnimationFrame: no depende de que el
    // navegador esté pintando cuadros.
    let timer = 0
    let tries = 0
    const stop = () => {
      clearTimeout(timer)
    }
    const userStop = () => {
      scrolledOnce.current = true
      stop()
    }
    const tick = () => {
      const el = document.getElementById(`cat-${initialCategory}`)
      if (!el) return
      el.scrollIntoView({ block: 'start' })
      const offset = parseFloat(getComputedStyle(el).scrollMarginTop) || 0
      if (Math.abs(el.getBoundingClientRect().top - offset) > 4 && ++tries < 40) {
        timer = window.setTimeout(tick, 25)
      } else {
        scrolledOnce.current = true
        setActiveSlug(initialCategory)
      }
    }
    timer = window.setTimeout(tick, 0)
    window.addEventListener('wheel', userStop, { once: true, passive: true })
    window.addEventListener('touchstart', userStop, { once: true, passive: true })
    return () => {
      stop()
      window.removeEventListener('wheel', userStop)
      window.removeEventListener('touchstart', userStop)
    }
  }, [initialCategory, sections.length])

  // Resalta en la barra la última categoría cuyo título ya pasó bajo la barra fija.
  useEffect(() => {
    if (results || sections.length === 0) return
    // Son pocas secciones: medirlas en cada evento de scroll es barato.
    const update = () => {
      let current = sections[0]!.category.slug
      for (const s of sections) {
        const el = document.getElementById(`cat-${s.category.slug}`)
        if (el && el.getBoundingClientRect().top <= 160) current = s.category.slug
      }
      setActiveSlug(current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [sections, results])

  const loading = categories.status === 'loading' || products.status === 'loading'
  const error = categories.error ?? products.error

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-28">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-script text-5xl text-brand-500 sm:text-6xl">Menú</h1>
          <p className="mt-1 text-sm text-cream-300">Toca un producto para elegir opciones y adicionales.</p>
        </div>
        <label className="relative block w-full sm:w-80">
          <span className="sr-only">Buscar en el menú</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-cream-300" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca: ranchera, tocineta, picada…"
            className="w-full rounded-full border border-ink-600 bg-ink-800 py-3 pr-10 pl-11 text-sm text-cream-50 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Borrar búsqueda"
              className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 place-items-center rounded-full text-cream-300 hover:bg-ink-700"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </label>
      </header>

      {loading && <MenuSkeleton />}
      {error && (
        <div className="mt-12">
          <ErrorState
            message={error.message}
            onRetry={() => {
              categories.retry()
              products.retry()
            }}
          />
        </div>
      )}

      {!loading && !error && results && (
        <section aria-live="polite" className="mt-8">
          <p className="text-sm text-cream-300">
            {results.length === 1 ? '1 resultado' : `${results.length} resultados`} para “{query.trim()}”
          </p>
          {results.length === 0 ? (
            <div className="mt-8">
              <EmptyState icon={SearchX} title="No encontramos ese producto">
                Prueba con otra palabra o revisa las categorías.
              </EmptyState>
            </div>
          ) : (
            <ProductGrid products={results} onOpen={sheet.open} />
          )}
        </section>
      )}

      {!loading && !error && !results && (
        <>
          <CategoryNav categories={sections.map((s) => s.category)} active={activeSlug} />
          {sections.map(({ category, items }) => (
            <section key={category.id} id={`cat-${category.slug}`} className="scroll-mt-36 pt-10" aria-labelledby={`h-${category.slug}`}>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 id={`h-${category.slug}`} className="font-script text-4xl text-brand-500">
                  {category.name}
                </h2>
                {category.description && <p className="text-sm font-medium text-cream-300">{category.description}</p>}
              </div>
              <ProductGrid products={items} onOpen={sheet.open} />
            </section>
          ))}
        </>
      )}

      <ProductSheet
        product={sheet.product}
        open={Boolean(sheet.slug)}
        onClose={sheet.close}
        onSubmit={(product, selection) => {
          cart.add(product, selection)
          sheet.close()
        }}
      />
    </div>
  )
}

function ProductGrid({ products, onOpen }: { products: Product[]; onOpen: (p: Product) => void }) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onOpen={onOpen} />
      ))}
    </div>
  )
}

// Barra de categorías fija: en el celular se desliza horizontalmente.
function CategoryNav({ categories, active }: { categories: Category[]; active: string | null }) {
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!active) return
    navRef.current
      ?.querySelector<HTMLElement>(`[data-slug="${active}"]`)
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [active])

  return (
    <nav
      ref={navRef}
      aria-label="Categorías"
      className="sticky top-16 z-30 -mx-4 mt-6 flex gap-2 overflow-x-auto border-b border-ink-700/70 bg-ink-900/90 px-4 py-3 backdrop-blur-md [scrollbar-width:none]"
    >
      {categories.map((c) => (
        <a
          key={c.id}
          href={`#cat-${c.slug}`}
          data-slug={c.slug}
          aria-current={active === c.slug ? 'true' : undefined}
          onClick={(e) => {
            e.preventDefault()
            document.getElementById(`cat-${c.slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
            active === c.slug ? 'bg-brand-500 text-ink-900' : 'bg-ink-800 text-cream-100 hover:bg-ink-700'
          }`}
        >
          {c.name}
        </a>
      ))}
    </nav>
  )
}

function MenuSkeleton() {
  return (
    <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="status" aria-label="Cargando menú">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-ink-800 sm:h-72" />
      ))}
    </div>
  )
}
