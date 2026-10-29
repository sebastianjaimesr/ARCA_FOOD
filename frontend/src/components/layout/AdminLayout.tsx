import { Boxes, ClipboardList, LayoutDashboard, ListPlus, LogOut, Settings, Store, UtensilsCrossed } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../../features/auth/auth-context'

// "adminOnly": el personal (staff) no ve estas secciones. Es solo interfaz:
// el backend rechaza igual cualquier cambio sin el rol adecuado.
const sections = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, adminOnly: false },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList, adminOnly: false },
  { to: '/admin/productos', label: 'Productos', icon: UtensilsCrossed, adminOnly: false },
  { to: '/admin/catalogo', label: 'Catálogo', icon: ListPlus, adminOnly: false },
  { to: '/admin/inventario', label: 'Inventario', icon: Boxes, adminOnly: false },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings, adminOnly: true },
]

export function AdminLayout() {
  const { state, signOut } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  const visible = sections.filter((s) => !s.adminOnly || user?.role === 'admin')

  return (
    <div className="flex min-h-dvh bg-ink-950">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-900 md:flex">
        <Link to="/admin" className="flex h-16 items-center gap-2 border-b border-ink-700 px-5">
          <span className="font-script text-2xl text-brand-500">El Arca</span>
          <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">Admin</span>
        </Link>
        <nav aria-label="Panel" className="flex-1 space-y-1 p-3">
          {visible.map(({ to, label, icon: Icon, end }) => (
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
        <Link to="/" className="flex items-center gap-2 border-t border-ink-700 p-4 text-xs text-cream-300 hover:text-brand-400">
          <Store className="size-4" aria-hidden /> Ver la tienda
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-900/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-4 px-4 md:h-16 md:px-8">
            <h1 className="text-sm font-semibold text-cream-300">
              <span className="font-script text-xl text-brand-500 md:hidden">El Arca · </span>
              Panel administrativo
            </h1>
            {user && (
              <div className="flex min-w-0 items-center gap-3">
                <span className="hidden truncate text-xs text-cream-300 sm:block">
                  {user.email} · <span className="font-semibold text-brand-400">{user.role === 'admin' ? 'Administrador' : 'Personal'}</span>
                </span>
                <button
                  onClick={signOut}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-1.5 text-xs font-semibold text-cream-100 hover:border-brand-500 hover:text-brand-400"
                >
                  <LogOut className="size-3.5" aria-hidden />
                  Salir
                </button>
              </div>
            )}
          </div>
          {/* Navegación en el celular: fila deslizable. */}
          <nav aria-label="Panel móvil" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] md:hidden">
            {visible.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    isActive ? 'bg-brand-500 text-ink-900' : 'bg-ink-800 text-cream-100'
                  }`
                }
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
