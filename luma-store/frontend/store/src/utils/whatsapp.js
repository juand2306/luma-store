/**
 * Construye la URL de WhatsApp para abrir el chat con un mensaje prellenado.
 * @param {string} phoneNumber - Número de teléfono de la tienda (sin + ni espacios)
 * @param {string} message - Mensaje de texto plano
 * @returns {string} URL de WhatsApp
 */
export function buildWhatsAppUrl(phoneNumber, message) {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phoneNumber}?text=${encoded}`;
}

/**
 * Construye el mensaje de pedido para WhatsApp.
 * @param {Object} order - Objeto del pedido con items, customer_name, number, total, status_display
 * @param {string} [template] - Plantilla personalizable con variables
 * @returns {string} Mensaje formateado
 */
export function buildOrderMessage(order, template) {
  const productLines = order.items
    .map((item) => {
      const size = item.variant?.size || item.size || "";
      const color = item.variant?.color || item.color || "";
      const productName = item.variant?.product?.name || item.product_name || item.name || "";
      const qty = item.quantity;
      const sub = Number(item.subtotal).toLocaleString("es-CO");
      return `  - ${productName}${size ? ` talla ${size}` : ""}${color ? ` color ${color}` : ""} x${qty} — $${sub}`;
    })
    .join("\n");

  if (template) {
    return template
      .replace("{nombre_cliente}", order.customer_name || "Cliente")
      .replace("{numero_pedido}", order.number)
      .replace("{productos}", productLines)
      .replace("{total}", `$${Number(order.total).toLocaleString("es-CO")}`)
      .replace("{estado}", order.status_display || "Nuevo");
  }

  // Mensaje por defecto
  return `📦 *Nuevo pedido desde el catálogo online*

👤 Nombre: ${order.customer_name || "No especificado"}
🔖 Pedido N°: ${order.number}

🛍️ Productos solicitados:
${productLines}

💰 *Total estimado: $${Number(order.total).toLocaleString("es-CO")}*
${order.note ? `\n📝 Nota: ${order.note}` : ""}`;
}
