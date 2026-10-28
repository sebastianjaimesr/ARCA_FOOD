import { createBrowserRouter } from 'react-router'
import { AdminLayout } from '../components/layout/AdminLayout'
import { StoreLayout } from '../components/layout/StoreLayout'
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage'
import { CartPage } from '../pages/CartPage'
import { HomePage } from '../pages/HomePage'
import { MenuPage } from '../pages/MenuPage'
import { NotFoundPage } from '../pages/NotFoundPage'

// La tienda y el panel tienen layouts separados. El panel se protegerá con
// autenticación en la Fase 3; el backend valida el rol en cada petición.
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
    element: <AdminLayout />,
    children: [{ index: true, element: <AdminDashboardPage /> }],
  },
])
