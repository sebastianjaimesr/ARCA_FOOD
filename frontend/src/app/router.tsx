import { createBrowserRouter } from 'react-router'
import { StoreLayout } from '../components/layout/StoreLayout'
import { CartPage } from '../pages/CartPage'
import { HomePage } from '../pages/HomePage'
import { MenuPage } from '../pages/MenuPage'
import { NotFoundPage } from '../pages/NotFoundPage'

// La tienda y el panel tienen layouts separados. Todo /admin se carga bajo
// demanda (lazy) para que la tienda sea liviana en el celular.
export const router = createBrowserRouter([
  {
    element: <StoreLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'menu', element: <MenuPage /> },
      { path: 'carrito', element: <CartPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
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
        ],
      },
    ],
  },
])
