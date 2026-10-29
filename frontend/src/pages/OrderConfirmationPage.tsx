import { motion } from 'framer-motion'
import { Check, ClipboardCopy, ExternalLink, MessageCircle, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { readLastOrder } from '../features/orders/last-order'
import { OrderSummary } from '../features/orders/OrderSummary'
import { buildWhatsappMessage } from '../features/orders/whatsapp-message'
import { useSettings } from '../hooks/useCatalog'
import { formatPhone, whatsappUrl } from '../lib/business'

export function OrderConfirmationPage() {
  const { code = '' } = useParams()
  const settings = useSettings()
  const order = readLastOrder(code)
  const [opened, setOpened] = useState(false)
  const [copied, setCopied] = useState(false)

  // Visita directa sin el pedido en esta sesión: se consulta por código + teléfono.
  if (!order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-black text-cream-50">Pedido {code}</h1>
        <p className="mt-2 text-cream-300">Para ver el estado de tu pedido, consúltalo con tu número de celular.</p>
        <Link
          to={`/pedido/consultar?codigo=${encodeURIComponent(code)}`}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 font-bold text-ink-900 hover:bg-brand-400"
        >
          <Search className="size-4" aria-hidden /> Consultar pedido
        </Link>
      </div>
    )
  }

  const businessName = settings.data?.businessName ?? 'El Arca'
  const message = buildWhatsappMessage(order, businessName)
  const waLink = whatsappUrl(settings.data?.whatsappPhone, message)

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 pb-16">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto grid size-16 place-items-center rounded-full bg-brand-500 text-ink-900">
        <Check className="size-9" strokeWidth={3} aria-hidden />
      </motion.div>
      <h1 className="mt-5 text-center text-3xl font-black text-cream-50">Pedido registrado</h1>
      <p className="mt-2 text-center text-cream-300">
        Tu código es <strong className="text-2xl font-black tracking-wide text-brand-400">{order.code}</strong>
      </p>

      <section className="mt-8 rounded-2xl border-2 border-brand-500/60 bg-brand-500/5 p-5" aria-labelledby="send-step">
        <h2 id="send-step" className="text-lg font-black text-cream-50">
          Falta un paso: envíalo por WhatsApp
        </h2>
        <p className="mt-1 text-sm text-cream-300">
          Tu pedido quedó guardado como <strong className="text-cream-100">pendiente</strong>. El restaurante lo confirma cuando reciba tu
          mensaje{order.fulfillment === 'DOMICILIO' && order.deliveryFee === null ? ', junto con el valor del domicilio' : ''}.
        </p>

        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpened(true)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-4 text-lg font-bold text-ink-950 transition hover:brightness-110 active:scale-[0.98]"
          >
            <MessageCircle className="size-6" aria-hidden />
            {opened ? 'Abrir WhatsApp de nuevo' : 'Enviar pedido por WhatsApp'}
          </a>
        ) : (
          <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
            El número de WhatsApp del restaurante no está configurado. Copia el mensaje y comunícate con el restaurante.
          </p>
        )}

        {opened && (
          <p className="mt-3 text-center text-sm text-cream-300" role="status">
            Si WhatsApp se abrió, solo toca <strong className="text-cream-100">Enviar</strong> en el chat. Abrirlo no envía el mensaje
            automáticamente.
          </p>
        )}

        <details className="mt-4 rounded-xl border border-ink-600 bg-ink-900 p-4 text-sm" open={opened}>
          <summary className="cursor-pointer font-semibold text-cream-100">¿No se abrió WhatsApp?</summary>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-cream-300">
            <li>Copia el resumen del pedido.</li>
            <li>
              Pégalo en un chat de WhatsApp con el {settings.data?.whatsappPhone ? <strong className="text-cream-100">{formatPhone(settings.data.whatsappPhone)}</strong> : 'restaurante'}.
            </li>
          </ol>
          <button
            type="button"
            onClick={copyMessage}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-ink-600 px-4 py-2 font-semibold text-cream-50 hover:border-brand-500"
          >
            {copied ? <Check className="size-4 text-brand-400" aria-hidden /> : <ClipboardCopy className="size-4" aria-hidden />}
            {copied ? 'Mensaje copiado' : 'Copiar mensaje'}
          </button>
          <pre className="mt-3 max-h-60 overflow-auto rounded-lg bg-ink-950 p-3 font-sans text-xs whitespace-pre-wrap text-cream-300">{message}</pre>
        </details>
      </section>

      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-800 p-5" aria-labelledby="order-detail">
        <h2 id="order-detail" className="mb-4 text-lg font-black text-cream-50">
          Detalle
        </h2>
        <OrderSummary order={order} />
        <dl className="mt-4 space-y-1 border-t border-ink-600 pt-4 text-sm text-cream-300">
          <div>
            <dt className="inline font-semibold text-cream-100">Entrega: </dt>
            <dd className="inline">{order.fulfillment === 'DOMICILIO' ? `Domicilio a ${order.deliveryAddress}` : 'Recoger en el local'}</dd>
          </div>
          {order.deliveryReference && (
            <div>
              <dt className="inline font-semibold text-cream-100">Referencia: </dt>
              <dd className="inline">{order.deliveryReference}</dd>
            </div>
          )}
          {order.notes && (
            <div>
              <dt className="inline font-semibold text-cream-100">Observaciones: </dt>
              <dd className="inline">{order.notes}</dd>
            </div>
          )}
        </dl>
      </section>

      <div className="mt-6 flex flex-col items-center gap-3 text-sm sm:flex-row sm:justify-center">
        <Link to={`/pedido/consultar?codigo=${order.code}`} className="inline-flex items-center gap-1.5 font-semibold text-brand-400 hover:underline">
          <Search className="size-4" aria-hidden /> Consultar el estado más tarde
        </Link>
        <Link to="/menu" className="inline-flex items-center gap-1.5 text-cream-300 hover:text-cream-50">
          <ExternalLink className="size-4" aria-hidden /> Hacer otro pedido
        </Link>
      </div>
    </div>
  )
}
