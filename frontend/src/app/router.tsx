import { createBrowserRouter } from 'react-router'
import { StoreLayout } from '../components/layout/StoreLayout'
import { STATIC_MODE } from '../config/mode'
import { CartPage } from '../pages/CartPage'
import { HomePage } from '../pages/HomePage'
import { MenuPage } from '../pages/MenuPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { StaticModeNotice } from '../pages/StaticModeNotice'
import { adminRoutes } from './admin-routes'

// La tienda y el panel tienen layouts separados. Todo /admin y las páginas del
// pedido (formularios) se cargan bajo demanda (lazy) para que la portada y el
// menú sean livianos en el celular.

export const router = createBrowserRouter(
  [
    {
      element: <StoreLayout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'menu', element: <MenuPage /> },
        { path: 'carrito', element: <CartPage /> },
        { path: 'pedido', lazy: async () => ({ Component: (await import('../pages/CheckoutPage')).CheckoutPage }) },
        STATIC_MODE
          ? { path: 'pedido/consultar', element: <StaticModeNotice feature="lookup" /> }
          : {
              path: 'pedido/consultar',
              lazy: async () => ({ Component: (await import('../pages/OrderLookupPage')).OrderLookupPage }),
            },
        {
          path: 'pedido/:code',
          lazy: async () => ({ Component: (await import('../pages/OrderConfirmationPage')).OrderConfirmationPage }),
        },
        // En modo vitrina no hay backend: el panel no se incluye en el sitio.
        ...(STATIC_MODE ? [{ path: 'admin/*', element: <StaticModeNotice feature="admin" /> }] : []),
        { path: '*', element: <NotFoundPage /> },
      ],
    },
    // Condición escrita en línea (no con STATIC_MODE) para que el empaquetador
    // elimine el panel y Supabase del build vitrina.
    ...(import.meta.env.VITE_STATIC_MODE === 'true' ? [] : [adminRoutes]),
  ],
  // En GitHub Pages el sitio vive en /ARCA_FOOD/.
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
)
