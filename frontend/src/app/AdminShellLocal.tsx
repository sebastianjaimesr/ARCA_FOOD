import { Outlet } from 'react-router'
import { AdminLayout } from '../components/layout/AdminLayout'
import { LocalAuthProvider } from '../features/auth/LocalAuthProvider'
import { RequireStaff } from '../features/auth/RequireStaff'

// Raíz del panel en el modo demostración: sesión local (sin Supabase).
export function AdminRoot() {
  return (
    <LocalAuthProvider>
      <Outlet />
    </LocalAuthProvider>
  )
}

export function ProtectedAdminLayout() {
  return (
    <RequireStaff>
      <AdminLayout />
    </RequireStaff>
  )
}
