import { formatCOP } from '../../lib/format'
import type { Order } from '../../types/order'

// Arma el resumen que el cliente envía por WhatsApp. Se construye con el pedido
// que devolvió el backend (precios ya calculados y guardados), nunca con los
// precios del carrito. Usa el formato de WhatsApp: *negrita*, _cursiva_.
export function buildWhatsappMessage(order: Order, businessName: string): string {
  const lines: string[] = []
  lines.push(`Hola ${businessName}, quiero hacer este pedido:`)
  lines.push('')
  lines.push(`*Pedido ${order.code}*`)
  lines.push('')

  for (const item of order.items) {
    const title = [item.productName, item.variantName].filter(Boolean).join(' – ')
    lines.push(`*${item.quantity} x ${title}*`)
    lines.push(`   ${formatCOP(item.basePrice)} c/u`)
    for (const option of item.options) {
      lines.push(`   + ${option.name} (${formatCOP(option.price)})`)
    }
    if (item.notes) lines.push(`   _Nota: ${item.notes}_`)
    if (item.options.length > 0) lines.push(`   Valor unitario: ${formatCOP(item.unitPrice)}`)
    lines.push(`   Subtotal: ${formatCOP(item.lineTotal)}`)
  }

  lines.push('')
  lines.push(`Subtotal: ${formatCOP(order.subtotal)}`)
  if (order.fulfillment === 'DOMICILIO') {
    lines.push(
      order.deliveryFee === null
        ? 'Domicilio: por confirmar'
        : `Domicilio${order.deliveryZoneName ? ` (${order.deliveryZoneName})` : ''}: ${formatCOP(order.deliveryFee)}`,
    )
  }
  lines.push(`*Total: ${formatCOP(order.total)}*${order.fulfillment === 'DOMICILIO' && order.deliveryFee === null ? ' + domicilio' : ''}`)
  lines.push('')
  lines.push(`Nombre: ${order.customerName}`)
  lines.push(`Teléfono: ${order.customerPhone}`)
  if (order.fulfillment === 'DOMICILIO') {
    lines.push('Entrega: Domicilio')
    lines.push(`Dirección: ${order.deliveryAddress ?? ''}`)
    if (order.deliveryReference) lines.push(`Referencia: ${order.deliveryReference}`)
  } else {
    lines.push('Entrega: Recoger en el local')
  }
  if (order.notes) lines.push(`Observaciones: ${order.notes}`)

  return lines.join('\n')
}
