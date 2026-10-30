import type { RouteObject } from 'react-router'

// Rutas del panel (cargadas bajo demanda). El shell define de dónde salen la
// sesión y los datos: Supabase + backend (modo completo) o el navegador (modo
// demostración). La condición va en línea para que cada build incluya solo el suyo.
const shell = () => (import.meta.env.VITE_STATIC_MODE === 'true' ? import('./AdminShellLocal') : import('./AdminShell'))
export const adminRoutes: RouteObject = {
  path: 'admin',
  lazy: async () => ({ Component: (await shell()).AdminRoot }),
  children: [
    {
      path: 'login',
      lazy: async () => ({ Component: (await import('../pages/admin/AdminLoginPage')).AdminLoginPage }),
    },
    {
      lazy: async () => ({ Component: (await shell()).ProtectedAdminLayout }),
      children: [
        {
          index: true,
          lazy: async () => ({ Component: (await import('../pages/admin/AdminDashboardPage')).AdminDashboardPage }),
        },
        { path: 'pedidos', lazy: async () => ({ Component: (await import('../pages/admin/AdminOrdersPage')).AdminOrdersPage }) },
        {
          path: 'pedidos/:id',
          lazy: async () => ({ Component: (await import('../pages/admin/AdminOrderDetailPage')).AdminOrderDetailPage }),
        },
        { path: 'productos', lazy: async () => ({ Component: (await import('../pages/admin/AdminProductsPage')).AdminProductsPage }) },
        {
          path: 'productos/nuevo',
          lazy: async () => ({ Component: (await import('../pages/admin/AdminProductFormPage')).AdminProductFormPage }),
        },
        {
          path: 'productos/:id',
          lazy: async () => ({ Component: (await import('../pages/admin/AdminProductFormPage')).AdminProductFormPage }),
        },
        { path: 'catalogo', lazy: async () => ({ Component: (await import('../pages/admin/AdminCatalogPage')).AdminCatalogPage }) },
        { path: 'inventario', lazy: async () => ({ Component: (await import('../pages/admin/AdminInventoryPage')).AdminInventoryPage }) },
        { path: 'guia', lazy: async () => ({ Component: (await import('../pages/admin/AdminGuidePage')).AdminGuidePage }) },
        {
          path: 'configuracion',
          lazy: async () => ({ Component: (await import('../pages/admin/AdminSettingsPage')).AdminSettingsPage }),
        },
      ],
    },
  ],
}
