import { AnimatePresence, m } from 'framer-motion'
import { AtSign, CheckCircle2, Clock, MapPin, MessageCircle, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { useCart } from '../../features/cart/cart-context'
import { CartProvider } from '../../features/cart/CartProvider'
import { useSettings } from '../../hooks/useCatalog'
import { describeHours, formatPhone, fullAddress, mapsUrl, whatsappUrl } from '../../lib/business'
import { formatCOP } from '../../lib/format'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'text-brand-400' : 'text-cream-100 hover:text-brand-400'
  }`

export function StoreLayout() {
  return (
    <CartProvider>
      <div className="flex min-h-dvh flex-col">
        <StoreHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <StoreFooter />
        <FloatingCartBar />
        <AddedToast />
      </div>
      <ScrollRestoration />
    </CartProvider>
  )
}

function StoreHeader() {
  const { count } = useCart()
  const settings = useSettings()
  const name = settings.data?.businessName ?? 'El Arca'

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/80 bg-ink-900/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex min-w-0 items-center gap-3" aria-label={`${name}, inicio`}>
          <img src="/brand/logo-el-arca-96.webp" alt="" width={40} height={40} className="size-10 shrink-0 rounded-xl" />
          <span className="hidden leading-none min-[380px]:block">
            <span className="block text-lg font-black tracking-tight text-brand-500 uppercase">{name}</span>
            <span className="block text-[10px] font-medium tracking-[0.2em] text-cream-300 uppercase">
              {settings.data?.tagline ?? 'Comidas Rápidas'}
            </span>
          </span>
        </Link>

        <nav aria-label="Principal" className="flex items-center gap-1">
          <NavLink to="/" end className={({ isActive }) => `hidden sm:inline-flex ${navLinkClass({ isActive })}`}>
            Inicio
          </NavLink>
          <NavLink to="/menu" className={navLinkClass}>
            Menú
          </NavLink>
          <Link
            to="/carrito"
            className="relative ml-1 inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-ink-900 transition hover:bg-brand-400 active:scale-95"
            aria-label={`Ver pedido, ${count} ${count === 1 ? 'producto' : 'productos'}`}
          >
            <ShoppingBag className="size-4" aria-hidden />
            <span className="hidden sm:inline">Pedido</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <m.span
                key={count}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                className="grid min-w-5 place-items-center rounded-full bg-ink-900 px-1.5 text-xs text-brand-400 tabular-nums"
              >
                {count}
              </m.span>
            </AnimatePresence>
          </Link>
        </nav>
      </div>
    </header>
  )
}

// Barra inferior en el celular con el resumen del pedido.
function FloatingCartBar() {
  const { count, subtotal } = useCart()
  const { pathname } = useLocation()
  // No se muestra donde taparía los botones del pedido.
  const visible = count > 0 && pathname !== '/carrito' && !pathname.startsWith('/pedido')

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          exit={{ y: 80 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
        >
          <Link
            to="/carrito"
            className="flex items-center justify-between rounded-full bg-brand-500 px-5 py-3.5 font-bold text-ink-900 shadow-[0_10px_40px_-8px_rgba(255,199,0,0.55)] active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="size-5" aria-hidden />
              Ver pedido · {count}
            </span>
            <span>{formatCOP(subtotal)}</span>
          </Link>
        </m.div>
      )}
    </AnimatePresence>
  )
}

function AddedToast() {
  const { lastAdded } = useCart()
  // Se oculta comparando con el momento en que expira, sin estado sincronizado.
  const [expiredAt, setExpiredAt] = useState(0)
  const shown = lastAdded && lastAdded.at > expiredAt ? lastAdded : null

  useEffect(() => {
    if (!lastAdded) return
    const timer = setTimeout(() => setExpiredAt(lastAdded.at), 2200)
    return () => clearTimeout(timer)
  }, [lastAdded])

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4">
      <AnimatePresence>
        {shown && (
          <m.p
            key={shown.at}
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            className="flex items-center gap-2 rounded-full border border-brand-500/40 bg-ink-800 px-4 py-2.5 text-sm font-semibold text-cream-50 shadow-xl"
          >
            <CheckCircle2 className="size-4 text-brand-500" aria-hidden />
            {shown.name} agregado al pedido
          </m.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function StoreFooter() {
  const { data } = useSettings()
  const address = data ? fullAddress(data) : null
  const hours = data ? describeHours(data.openingHours) : null
  const wa = whatsappUrl(data?.whatsappPhone)

  return (
    <footer className="border-t border-ink-700 bg-ink-950 pb-20 sm:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="font-script text-3xl text-brand-500">{data?.businessName ?? 'El Arca'}</p>
          <p className="mt-1 text-sm text-cream-300">{data?.tagline ?? 'Comidas Rápidas'} · Bucaramanga</p>
        </div>
        <ul className="space-y-3 text-sm">
          {address && (
            <li>
              <a href={mapsUrl(address)} target="_blank" rel="noreferrer" className="flex items-start gap-2 hover:text-brand-400">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden />
                {address}
              </a>
            </li>
          )}
          {wa && (
            <li>
              <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-brand-400">
                <MessageCircle className="size-4 shrink-0 text-brand-500" aria-hidden />
                Domicilios {formatPhone(data?.whatsappPhone)}
              </a>
            </li>
          )}
          {data?.instagramHandle && (
            <li>
              <a
                href={`https://www.instagram.com/${data.instagramHandle}/`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:text-brand-400"
              >
                <AtSign className="size-4 shrink-0 text-brand-500" aria-hidden />
                {data.instagramHandle}
              </a>
            </li>
          )}
        </ul>
        <div className="text-sm">
          <p className="flex items-center gap-2 font-semibold text-cream-50">
            <Clock className="size-4 text-brand-500" aria-hidden />
            Horario
          </p>
          {hours ? (
            <ul className="mt-1 space-y-0.5 text-cream-300">
              {hours.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-cream-300">Pendiente por confirmar</p>
          )}
          <Link to="/pedido/consultar" className="mt-4 inline-block font-semibold text-brand-400 hover:underline">
            Consultar mi pedido →
          </Link>
        </div>
      </div>
    </footer>
  )
}
