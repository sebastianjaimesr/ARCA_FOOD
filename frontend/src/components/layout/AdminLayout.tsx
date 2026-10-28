import { Boxes, ClipboardList, LayoutDashboard, Settings, UtensilsCrossed } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'

const sections = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList },
  { to: '/admin/productos', label: 'Productos', icon: UtensilsCrossed },
  { to: '/admin/inventario', label: 'Inventario', icon: Boxes },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
]

export function AdminLayout() {
  return (
    <div className="flex min-h-dvh bg-ink-950">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-900 md:flex">
        <Link to="/admin" className="flex h-16 items-center gap-2 border-b border-ink-700 px-5">
          <span className="font-script text-2xl text-brand-500">El Arca</span>
          <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">Admin</span>
        </Link>
        <nav aria-label="Panel" className="flex-1 space-y-1 p-3">
          {sections.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-500 text-ink-900' : 'text-cream-300 hover:bg-ink-700 hover:text-cream-50'
                }`
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <Link to="/" className="border-t border-ink-700 p-4 text-xs text-cream-300 hover:text-brand-400">
          ← Ver la tienda
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center border-b border-ink-700 bg-ink-900 px-4 md:px-8">
          <h1 className="text-sm font-semibold text-cream-300">Panel administrativo</h1>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
