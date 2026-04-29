/**
 * Construye la URL de WhatsApp con mensaje prellenado.
 * @param {string} phoneNumber - Número de la tienda (sin + ni espacios)
 * @param {string} message
 * @returns {string}
 */
export function buildWhatsAppUrl(phoneNumber, message) {
  const cleaned = String(phoneNumber || '').replace(/\D/g, '')
  if (!cleaned) return ''
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${cleaned}?text=${encoded}`
}

/**
 * Construye el mensaje de notificación de pedido.
 * @param {Object} order - Objeto del pedido
 * @param {string|null} template - Plantilla personalizable (opciones: {nombre_cliente}, {numero_pedido}, {productos}, {total}, {estado})
 * @returns {string}
 */
export function buildOrderMessage(order, template = null) {
  const productLines = (order.items || [])
    .map((item) => {
      const size   = item.variant?.size  || item.size  || ''
      const color  = item.variant?.color || item.color || ''
      const name   = item.variant?.product?.name || item.product_name || ''
      const qty    = item.quantity
      const sub    = Number(item.subtotal || item.unit_price * item.quantity).toLocaleString('es-CO')
      return `  • ${name}${size ? ` T:${size}` : ''}${color ? ` ${color}` : ''} ×${qty} — $${sub}`
    })
    .join('\n')

  if (template) {
    return template
      .replace('{nombre_cliente}', order.customer_name || 'Cliente')
      .replace('{numero_pedido}',  order.number)
      .replace('{productos}',      productLines)
      .replace('{total}',          `$${Number(order.total).toLocaleString('es-CO')}`)
      .replace('{estado}',         order.status_display || order.status || '')
  }

  return `✅ *Actualización de tu pedido — ${order.number}*

👤 ${order.customer_name || 'Estimado cliente'},

🛍️ Productos:
${productLines}

💰 *Total: $${Number(order.total).toLocaleString('es-CO')}*
📋 Estado: ${order.status_display || order.status}
${order.note ? `\n📝 Nota: ${order.note}` : ''}

¡Gracias por tu pedido! 🙌`
}
