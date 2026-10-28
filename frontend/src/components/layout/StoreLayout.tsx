import { AtSign, MapPin, MessageCircle, ShoppingBag } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { business, mapsUrl, whatsappUrl } from '../../config/business'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'bg-brand-500 text-ink-900' : 'text-cream-100 hover:text-brand-400'
  }`

export function StoreLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-ink-700/80 bg-ink-900/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-3" aria-label="El Arca, inicio">
            <img
              src="/brand/logo-el-arca.webp"
              alt=""
              width={40}
              height={40}
              className="size-10 rounded-xl object-cover"
            />
            <span className="leading-none">
              <span className="block text-lg font-black tracking-tight text-brand-500 uppercase">
                {business.name}
              </span>
              <span className="block text-[11px] font-medium tracking-[0.2em] text-cream-300 uppercase">
                {business.tagline}
              </span>
            </span>
          </Link>

          <nav aria-label="Principal" className="hidden items-center gap-1 sm:flex">
            <NavLink to="/" end className={navLinkClass}>
              Inicio
            </NavLink>
            <NavLink to="/menu" className={navLinkClass}>
              Menú
            </NavLink>
          </nav>

          <Link
            to="/carrito"
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-ink-900 transition hover:bg-brand-400 active:scale-95"
          >
            <ShoppingBag className="size-4" aria-hidden />
            <span>Carrito</span>
          </Link>
        </div>

        <nav aria-label="Principal móvil" className="flex justify-center gap-1 border-t border-ink-700/60 py-2 sm:hidden">
          <NavLink to="/" end className={navLinkClass}>
            Inicio
          </NavLink>
          <NavLink to="/menu" className={navLinkClass}>
            Menú
          </NavLink>
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink-700 bg-ink-950">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <p className="font-script text-3xl text-brand-500">{business.name}</p>
            <p className="mt-1 text-sm text-cream-300">{business.tagline} · Bucaramanga</p>
          </div>
          <ul className="space-y-3 text-sm">
            <li>
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-start gap-2 hover:text-brand-400">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden />
                {business.address}
              </a>
            </li>
            <li>
              <a href={whatsappUrl()} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-brand-400">
                <MessageCircle className="size-4 shrink-0 text-brand-500" aria-hidden />
                Domicilios {business.whatsapp.display}
              </a>
            </li>
            <li>
              <a
                href={business.instagram.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:text-brand-400"
              >
                <AtSign className="size-4 shrink-0 text-brand-500" aria-hidden />{business.instagram.handle}
              </a>
            </li>
          </ul>
          <div className="text-sm">
            <p className="font-semibold text-cream-50">Horario</p>
            <p className="mt-1 text-cream-300">{business.schedule ?? 'Pendiente por confirmar'}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
