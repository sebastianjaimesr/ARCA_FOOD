import { Info, MessageCircle } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '../components/ui/EmptyState'
import { useSettings } from '../hooks/useCatalog'
import { formatPhone, whatsappUrl } from '../lib/business'

// Aviso en el modo vitrina para funciones que necesitan el backend.
export function StaticModeNotice({ feature }: { feature: 'admin' | 'lookup' }) {
  const { data } = useSettings()
  const wa = whatsappUrl(data?.whatsappPhone)

  return (
    <div className="px-4 py-20">
      <h1 className="sr-only">{feature === 'admin' ? 'Panel administrativo' : 'Consultar pedido'}</h1>
      <EmptyState icon={Info} title={feature === 'admin' ? 'Panel no disponible en esta versión' : 'Consulta de pedidos no disponible'}>
        <p>
          {feature === 'admin'
            ? 'Esta versión publicada de la tienda funciona sin servidor: muestra el menú y envía los pedidos por WhatsApp. El panel administrativo se activa cuando se publique el backend.'
            : 'Los pedidos de esta versión se confirman directamente por WhatsApp. Escríbenos con tu número de referencia para saber cómo va tu pedido.'}
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          {feature === 'lookup' && wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 font-bold text-ink-950"
            >
              <MessageCircle className="size-4" aria-hidden /> WhatsApp {formatPhone(data?.whatsappPhone)}
            </a>
          )}
          <Link to="/menu" className="font-semibold text-brand-400 hover:underline">
            Ver el menú
          </Link>
        </div>
      </EmptyState>
    </div>
  )
}
