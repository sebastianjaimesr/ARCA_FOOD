import { m } from 'framer-motion'
import { ArrowRight, Clock, MapPin, MessageCircle, Send, ShoppingBag, UtensilsCrossed } from 'lucide-react'
import { Link } from 'react-router'
import { CategoryArt } from '../components/brand/CategoryArt'
import { useCart } from '../features/cart/cart-context'
import { ProductCard } from '../features/products/ProductCard'
import { ProductSheet } from '../features/products/ProductSheet'
import { useProductSheet } from '../features/products/useProductSheet'
import { useCategories, useProducts, useSettings } from '../hooks/useCatalog'
import { describeHours, formatPhone, fullAddress, mapsUrl, whatsappUrl } from '../lib/business'

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.45 },
}

export function HomePage() {
  const settings = useSettings()
  const categories = useCategories()
  const products = useProducts()
  const cart = useCart()
  const sheet = useProductSheet(products.data)
  const featured = products.data?.filter((p) => p.isFeatured) ?? []
  const s = settings.data

  return (
    <>
      <Hero acceptingOrders={s?.acceptingOrders ?? true} whatsapp={s?.whatsappPhone ?? null} />

      {/* Categorías reales de la carta */}
      <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="home-categories">
        <m.h2 {...fadeUp} id="home-categories" className="font-script text-4xl text-brand-500 sm:text-5xl">
          Nuestra carta
        </m.h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(categories.data ?? []).map((c, i) => (
            <m.div key={c.id} {...fadeUp} transition={{ duration: 0.4, delay: i * 0.04 }}>
              <Link
                to={`/menu?categoria=${c.slug}`}
                className="group flex h-full flex-col items-center rounded-2xl border border-ink-700 bg-ink-800 px-3 pt-5 pb-4 text-center transition hover:-translate-y-0.5 hover:border-brand-500/60"
              >
                <CategoryArt slug={c.slug} className="size-16 text-brand-500 transition group-hover:scale-110" />
                <span className="mt-3 font-extrabold text-cream-50 uppercase">{c.name}</span>
                {c.description && <span className="mt-1 text-[11px] leading-tight text-cream-300">{c.description}</span>}
              </Link>
            </m.div>
          ))}
          {categories.status === 'loading' &&
            Array.from({ length: 8 }, (_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-ink-800" />)}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="border-y border-ink-700 bg-ink-950/60" aria-labelledby="home-featured">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="flex items-end justify-between gap-4">
              <m.h2 {...fadeUp} id="home-featured" className="font-script text-4xl text-brand-500 sm:text-5xl">
                Destacados
              </m.h2>
              <Link to="/menu" className="inline-flex items-center gap-1 text-sm font-semibold text-cream-100 hover:text-brand-400">
                Ver todo <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} onOpen={sheet.open} />
              ))}
            </div>
          </div>
        </section>
      )}

      <HowToOrder />

      {s && (
        <section className="mx-auto max-w-6xl px-4 pb-16" aria-labelledby="home-visit">
          <m.h2 {...fadeUp} id="home-visit" className="font-script text-4xl text-brand-500 sm:text-5xl">
            Encuéntranos
          </m.h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <InfoCard icon={MapPin} title="Dirección">
              {fullAddress(s) ? (
                <a href={mapsUrl(fullAddress(s)!)} target="_blank" rel="noreferrer" className="hover:text-brand-400">
                  {fullAddress(s)}
                  <span className="mt-1 block text-xs font-semibold text-brand-400">Abrir en Google Maps →</span>
                </a>
              ) : (
                'Pendiente por confirmar'
              )}
            </InfoCard>
            <InfoCard icon={Clock} title="Horario">
              {describeHours(s.openingHours)?.map((h) => <span key={h} className="block">{h}</span>) ?? 'Pendiente por confirmar'}
            </InfoCard>
            <InfoCard icon={MessageCircle} title="Domicilios">
              {s.whatsappPhone ? (
                <a href={whatsappUrl(s.whatsappPhone)!} target="_blank" rel="noreferrer" className="hover:text-brand-400">
                  WhatsApp {formatPhone(s.whatsappPhone)}
                </a>
              ) : (
                'Pendiente por confirmar'
              )}
              <span className="mt-1 block text-xs text-cream-300">
                {s.deliveryZones.length > 0
                  ? 'El valor del domicilio depende de tu zona.'
                  : (s.deliveryNotes ?? 'El valor del domicilio se confirma por WhatsApp.')}
              </span>
            </InfoCard>
          </div>
        </section>
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
    </>
  )
}

function Hero({ acceptingOrders, whatsapp }: { acceptingOrders: boolean; whatsapp: string | null }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_10%,rgba(255,199,0,0.2),transparent_70%)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pt-10 pb-14 sm:pt-16 md:grid-cols-[1.1fr_0.9fr]">
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="order-2 text-center md:order-1 md:text-left"
        >
          {!acceptingOrders && (
            <p className="mb-4 inline-block rounded-full bg-red-500/15 px-4 py-1.5 text-sm font-semibold text-red-300">
              En este momento no estamos recibiendo pedidos en línea
            </p>
          )}
          <h1 className="text-4xl leading-[1.05] font-black tracking-tight text-cream-50 sm:text-6xl">
            Hamburguesas, hot dogs <span className="text-brand-500">y mucho más</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base text-cream-300 sm:text-lg md:mx-0">
            Arma tu pedido en minutos, elige tus adicionales y envíalo por WhatsApp. Domicilios en Bucaramanga.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
            <Link
              to="/menu"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-7 py-4 font-bold text-ink-900 shadow-[0_10px_40px_-10px_rgba(255,199,0,0.6)] transition hover:bg-brand-400 active:scale-95"
            >
              <UtensilsCrossed className="size-5" aria-hidden />
              Ver el menú y pedir
            </Link>
            {whatsapp && (
              <a
                href={whatsappUrl(whatsapp)!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-600 px-7 py-4 font-semibold text-cream-50 transition hover:border-brand-500 hover:text-brand-400"
              >
                <MessageCircle className="size-5" aria-hidden />
                {formatPhone(whatsapp)}
              </a>
            )}
          </div>
        </m.div>

        <m.img
          src="/brand/logo-el-arca-512.webp"
          alt="Logo de El Arca Comidas Rápidas"
          width={512}
          height={512}
          fetchPriority="high"
          className="order-1 mx-auto w-56 rounded-[2rem] shadow-2xl shadow-brand-500/10 sm:w-72 md:order-2 md:w-full md:max-w-sm"
          initial={{ opacity: 0, scale: 0.92, rotate: -2 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </section>
  )
}

const STEPS = [
  { icon: UtensilsCrossed, title: 'Arma tu pedido', text: 'Elige del menú, agrega adicionales y escribe tus observaciones.' },
  { icon: Send, title: 'Envíalo por WhatsApp', text: 'Generamos el resumen con tu código de pedido, listo para enviar.' },
  { icon: ShoppingBag, title: 'Te confirmamos', text: 'El restaurante revisa tu pedido y te confirma por WhatsApp.' },
]

function HowToOrder() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="home-how">
      <m.h2 {...fadeUp} id="home-how" className="font-script text-4xl text-brand-500 sm:text-5xl">
        Así de fácil
      </m.h2>
      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <m.li
            key={title}
            {...fadeUp}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="relative rounded-2xl border border-ink-700 bg-ink-800 p-5"
          >
            <span className="absolute top-4 right-5 text-4xl font-black text-ink-600">{i + 1}</span>
            <Icon className="size-7 text-brand-500" aria-hidden />
            <h3 className="mt-3 font-extrabold text-cream-50">{title}</h3>
            <p className="mt-1 text-sm text-cream-300">{text}</p>
          </m.li>
        ))}
      </ol>
    </section>
  )
}

function InfoCard({ icon: Icon, title, children }: { icon: typeof MapPin; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-800 p-5">
      <p className="flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-brand-500 uppercase">
        <Icon className="size-4" aria-hidden />
        {title}
      </p>
      <div className="mt-2 text-sm leading-relaxed text-cream-100">{children}</div>
    </div>
  )
}
