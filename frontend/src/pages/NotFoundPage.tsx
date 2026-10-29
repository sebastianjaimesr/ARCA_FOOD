import { SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '../components/ui/EmptyState'

export function NotFoundPage() {
  return (
    <div className="px-4 py-20">
      <h1 className="sr-only">Página no encontrada</h1>
      <EmptyState icon={SearchX} title="No encontramos esta página">
        <Link to="/" className="font-semibold text-brand-400 hover:underline">
          Volver al inicio
        </Link>
      </EmptyState>
    </div>
  )
}
