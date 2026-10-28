import { UtensilsCrossed } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'

export function MenuPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-script text-5xl text-brand-500">Menú</h1>
      <div className="mt-10">
        <EmptyState icon={UtensilsCrossed} title="El menú se está cargando a la base de datos">
          Las categorías y productos de la carta 2025 se conectan en la Fase 4.
        </EmptyState>
      </div>
    </div>
  )
}
