import { ShoppingBag } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '../components/ui/EmptyState'

export function CartPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-black text-cream-50">Tu pedido</h1>
      <div className="mt-10">
        <EmptyState icon={ShoppingBag} title="Tu carrito está vacío">
          <Link to="/menu" className="font-semibold text-brand-400 hover:underline">
            Explora el menú
          </Link>{' '}
          para empezar tu pedido.
        </EmptyState>
      </div>
    </div>
  )
}
