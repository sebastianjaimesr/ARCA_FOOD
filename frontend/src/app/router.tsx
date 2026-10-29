import { createBrowserRouter } from 'react-router'
import { StoreLayout } from '../components/layout/StoreLayout'
import { CartPage } from '../pages/CartPage'
import { HomePage } from '../pages/HomePage'
import { MenuPage } from '../pages/MenuPage'
import { NotFoundPage } from '../pages/NotFoundPage'

// La tienda y el panel tienen layouts separados. Todo /admin y las páginas del
// pedido (formularios) se cargan bajo demanda (lazy) para que la portada y el
// menú sean livianos en el celular.
export const router = createBrowserRouter([
  {
    element: <StoreLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'menu', element: <MenuPage /> },
      { path: 'carrito', element: <CartPage /> },
      { path: 'pedido', lazy: async () => ({ Component: (await import('../pages/CheckoutPage')).CheckoutPage }) },
      {
        path: 'pedido/consultar',
        lazy: async () => ({ Component: (await import('../pages/OrderLookupPage')).OrderLookupPage }),
      },
      {
        path: 'pedido/:code',
        lazy: async () => ({ Component: (await import('../pages/OrderConfirmationPage')).OrderConfirmationPage }),
      },
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
