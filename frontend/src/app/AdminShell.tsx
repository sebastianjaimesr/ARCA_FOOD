import { Outlet } from 'react-router'
import { AdminLayout } from '../components/layout/AdminLayout'
import { AuthProvider } from '../features/auth/AuthProvider'
import { RequireStaff } from '../features/auth/RequireStaff'

// Raíz del panel: sesión de Supabase Auth. Se carga solo al entrar a /admin,
// así la tienda pública no descarga el cliente de autenticación.
export function AdminRoot() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

export function ProtectedAdminLayout() {
  return (
    <RequireStaff>
      <AdminLayout />
    </RequireStaff>
  )
}
