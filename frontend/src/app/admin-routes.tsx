import type { RouteObject } from 'react-router'

// Rutas del panel (cargadas bajo demanda). No se incluyen en el modo vitrina.
export const adminRoutes: RouteObject = {
  path: 'admin',
  lazy: async () => ({ Component: (await import('./AdminShell')).AdminRoot }),
  children: [
    {
      path: 'login',
      lazy: async () => ({ Component: (await import('../pages/admin/AdminLoginPage')).AdminLoginPage }),
    },
    {
      lazy: async () => ({ Component: (await import('./AdminShell')).ProtectedAdminLayout }),
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
        {
          path: 'configuracion',
          lazy: async () => ({ Component: (await import('../pages/admin/AdminSettingsPage')).AdminSettingsPage }),
        },
      ],
    },
  ],
}
