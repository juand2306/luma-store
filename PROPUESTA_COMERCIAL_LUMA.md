# Propuesta Comercial
## Sistema de Gestión Integral para Tiendas de Ropa y Accesorios
### LUMA Store System

---

**Preparado por:** Juan David  
**Fecha:** Mayo de 2026  
**Versión:** 1.0  
**Destinatario:** [Nombre del cliente / Empresa]

---

## Presentación

La presente propuesta tiene como propósito exponer, de forma detallada y transparente, las características, alcances y condiciones de adquisición del sistema LUMA Store System, una plataforma de gestión empresarial desarrollada específicamente para tiendas de ropa, accesorios y moda en general.

LUMA nació de la observación directa de los desafíos que enfrentan los negocios de retail de moda independientes: la dificultad de controlar el inventario con precisión, la falta de visibilidad sobre las ventas en tiempo real, la desorganización en la gestión de caja, y la ausencia de una presencia digital propia que permita recibir pedidos en línea sin depender de plataformas de terceros con comisiones elevadas. Este sistema fue concebido, diseñado y construido como respuesta a esas necesidades concretas.

Lo que se presenta a continuación no es un producto genérico adaptado a múltiples industrias, sino una solución construida de manera especializada para el mercado de la moda, con la profundidad funcional que ese contexto demanda.

---

## El Problema que Resuelve

Los negocios de moda de tamaño mediano operan, con frecuencia, bajo condiciones de alta informalidad operativa: inventarios llevados en hojas de cálculo sin control de variantes, cajas registradas a mano o en aplicaciones genéricas, pedidos recibidos por WhatsApp sin ningún sistema de seguimiento, y una total ausencia de datos consolidados para tomar decisiones. El dueño del negocio trabaja con información incompleta, dispersa, y muchas veces desactualizada.

Esto genera consecuencias directas: pérdidas por faltantes de inventario no detectados a tiempo, errores en el cuadre de caja, pedidos perdidos o mal gestionados, y una incapacidad estructural de escalar el negocio porque no existe una base de información sólida sobre la cual crecer.

LUMA resuelve este problema centralizando todas las operaciones del negocio en una sola plataforma, accesible desde cualquier dispositivo, con información en tiempo real y una interfaz diseñada para ser usada cómodamente tanto por el dueño como por su equipo de ventas.

---

## La Solución: LUMA Store System

LUMA Store System es una plataforma de gestión empresarial compuesta por dos aplicaciones integradas: un panel administrativo privado para el equipo del negocio, y un portal de ventas en línea público para los clientes. Ambas aplicaciones comparten un mismo motor de datos, lo que garantiza que cualquier cambio en el inventario, en los precios o en las configuraciones se refleje de manera inmediata en todos los frentes.

El sistema está construido sobre tecnología moderna, probada y de alto rendimiento: Django 5 como motor del servidor, React 18 para las interfaces de usuario, y PostgreSQL como base de datos relacional. Se trata de una arquitectura independiente, donde cada cliente dispone de su propia instancia del sistema con su propia base de datos, lo que garantiza privacidad absoluta de la información y total ausencia de interferencias entre clientes.

La plataforma está diseñada para funcionar en cualquier dispositivo con navegador web, con especial atención al uso desde teléfonos móviles, que es el canal principal tanto para los clientes que compran como para los vendedores que operan en el punto de venta.

---

## Panel Administrativo

El panel administrativo es el corazón operativo del negocio. Es una aplicación privada, protegida por autenticación, a la que solo acceden los miembros del equipo según los permisos que les hayan sido asignados.

### Gestión de Inventario

El módulo de inventario permite administrar el catálogo completo de productos con un nivel de detalle que va más allá del nombre y el precio. Cada producto puede tener múltiples variantes definidas por talla y color, con seguimiento de stock independiente por variante. El sistema genera automáticamente el código de barras (formato UPC-12) para cada variante, y calcula el precio de venta automáticamente a partir del costo y el margen deseado, o viceversa.

Cada producto soporta hasta ocho fotografías con posibilidad de ordenarlas, lo que resulta fundamental para la presentación en el portal de ventas en línea. Las categorías pueden organizarse en niveles jerárquicos, permitiendo estructuras como "Ropa" con subcategorías "Vestidos", "Blusas", "Pantalones", entre otras.

El control de stock es en tiempo real: cada venta, cada devolución, cada ajuste manual queda registrado en el historial de movimientos con fecha, hora, usuario responsable y motivo. Esto permite auditar cualquier discrepancia y tener trazabilidad completa de cada unidad de producto. El sistema emite alertas automáticas cuando un producto cae por debajo del umbral de stock mínimo configurado, permitiendo anticipar las compras de reposición.

Para negocios con catálogos extensos, el sistema permite la importación masiva de productos mediante archivos CSV, con validación de datos previa al procesamiento.

### Módulo de Ventas (Punto de Venta)

El punto de venta está diseñado para ser rápido y funcional en entorno de mostrador. El vendedor puede buscar productos por nombre, referencia o código de barras, seleccionar la talla y el color disponibles, y agregar la cantidad deseada al carrito de venta. El sistema muestra en tiempo real el stock disponible por variante y bloquea automáticamente la venta si no hay unidades suficientes.

Los métodos de pago soportados incluyen efectivo, transferencia bancaria, tarjeta débito, tarjeta crédito, Nequi, Daviplata, y cualquier método personalizado que el negocio desee configurar. Cuando el pago es en efectivo, el sistema calcula automáticamente el cambio a devolver.

Al registrar la venta, el sistema ejecuta de manera simultánea la reducción del inventario correspondiente, el registro del ingreso en la caja activa del día, y la actualización del historial del cliente si aplica. Todo ocurre en una sola acción, sin necesidad de registros manuales adicionales.

El módulo también gestiona devoluciones y cambios. Una devolución devuelve el dinero al cliente y reintegra las unidades al inventario. Un cambio permite intercambiar un producto por otro de diferente variante, calculando automáticamente la diferencia de precio a cobrar o a devolver según corresponda. Todas las devoluciones quedan registradas con su motivo y las notas del vendedor.

Para negocios con vendedores en campo o que prefieren una interfaz simplificada, existe la vista de Venta Rápida, una versión compacta del punto de venta optimizada para teléfonos móviles, accesible únicamente por usuarios con el rol de vendedor.

### Control de Caja

El módulo de caja implementa el flujo de una caja registradora formal. Al comenzar el día, el responsable abre la caja registrando el monto inicial disponible. A lo largo del jornada, el sistema registra automáticamente todos los ingresos por ventas y todos los egresos por devoluciones. El encargado puede además registrar movimientos manuales, como gastos operativos, retiros de efectivo o cualquier entrada extraordinaria.

Al finalizar el día, el responsable cierra la caja contando el efectivo físico disponible. El sistema compara ese valor con el saldo calculado según los movimientos del día y muestra de manera clara cualquier diferencia, ya sea sobrante o faltante. El historial de sesiones de caja queda disponible para revisión en cualquier momento, lo que facilita el trabajo contable y la auditoría interna.

### Gestión de Pedidos en Línea

Cuando un cliente realiza un pedido a través del portal de ventas en línea, el pedido aparece de inmediato en el panel administrativo en estado "Nuevo", destacado visualmente para que el equipo pueda verlo sin dilación. El panel se actualiza automáticamente cada minuto, de modo que no es necesario recargar la página para ver los pedidos entrantes.

Cada pedido tiene un flujo de estados claramente definido que va desde "Nuevo" hasta "Entregado", pasando por "En Proceso", "Confirmado", "Preparando" y "Enviado". El equipo puede avanzar el estado del pedido con un solo clic, y en cada cambio de estado tiene la opción de enviar una notificación automática al cliente por WhatsApp.

Las notificaciones de WhatsApp están basadas en plantillas de texto configurables, que el administrador puede personalizar desde el módulo de configuración. Las plantillas incluyen variables dinámicas como el nombre del cliente, el número del pedido, el total y el estado actual, de modo que cada mensaje es personalizado sin requerir redacción manual.

### Gestión de Clientes

El sistema construye automáticamente una base de datos de clientes a partir de las ventas registradas en el punto de venta y de los pedidos recibidos por el portal. Cada cliente tiene un perfil con su información de contacto, su historial completo de compras, el valor acumulado de sus compras, y su saldo de puntos de fidelidad si el programa está activo.

El sistema clasifica automáticamente a los clientes en cuatro segmentos según su comportamiento de compra reciente: Frecuente, Regular, Nuevo e Inactivo. Esta segmentación permite identificar rápidamente qué clientes merecen atención prioritaria y cuáles llevan tiempo sin comprar.

El programa de fidelidad es completamente opcional y configurable. El administrador define cuántos pesos equivale cada punto, cuál es el valor de redención de cada punto, y cuál es el mínimo de puntos necesario para poder canjearlos. Los puntos se acumulan automáticamente en cada venta y pueden ser canjeados como medio de pago en el punto de venta.

### Reportes y Análisis

El módulo de reportes ofrece al dueño del negocio visibilidad real sobre el desempeño de su operación. El tablero principal muestra, en tiempo real, los indicadores clave del día: ventas del día con comparación respecto al día anterior, pedidos nuevos pendientes de atención, productos con stock bajo, y saldo actual de la caja. Incluye además una gráfica de tendencia de ventas de los últimos treinta días y un ranking de los cinco productos más vendidos.

Los reportes detallados cubren cuatro áreas: ventas (con filtros por fecha, método de pago, vendedor y categoría), inventario (valor del stock, potencial de ventas y análisis de margen), clientes (segmentación, valor de vida del cliente, fecha de última compra) y caja (conciliación para contabilidad). Todos los reportes pueden exportarse en formato PDF o Excel con el logo y nombre de la tienda en el encabezado.

### Configuración y Personalización

El módulo de configuración permite adaptar el sistema completamente a la identidad del negocio. El administrador puede cargar el logo de la tienda, definir el color principal que se aplicará tanto en el panel como en el portal de ventas, configurar el número de WhatsApp del negocio, redactar las políticas de devolución y envío que se mostrarán en el portal, y definir los horarios de atención.

El sistema de roles de usuario permite crear cuentas para cada miembro del equipo con acceso restringido según su función. Un vendedor solo puede acceder a la pantalla de venta rápida. Un administrador tiene acceso completo excepto a la configuración del sistema. El dueño tiene acceso total a todo, incluida la gestión de usuarios y la configuración general. Un observador puede ver reportes y el tablero pero no puede modificar nada. Cada acción queda registrada con el usuario que la realizó.

---

## Portal de Ventas en Línea

El portal de ventas es una tienda en línea pública, accesible sin registro por parte del cliente, construida con diseño mobile-first. Su propósito es permitir a los clientes del negocio explorar el catálogo y realizar pedidos directamente desde su teléfono, sin que el negocio tenga que depender de plataformas como Instagram Shopping, Mercado Libre o similares.

El catálogo muestra únicamente los productos que el administrador ha marcado como visibles en el portal, con sus fotografías, precios y disponibilidad por talla y color. Los clientes pueden filtrar por categoría, talla, color, rango de precios, y activar un filtro que muestre solo los productos con stock disponible.

El proceso de compra es deliberadamente simple: el cliente selecciona los productos con sus tallas y cantidades, los agrega al carrito, y al momento de finalizar el pedido ingresa únicamente su nombre y número de WhatsApp. El sistema crea el pedido, lo registra en el panel administrativo, y abre automáticamente WhatsApp con un mensaje preformateado que incluye el detalle completo del pedido y el total a pagar. A partir de ese punto, el negocio confirma el pago por WhatsApp y procede con el despacho.

Este flujo evita la necesidad de integrar pasarelas de pago, que implican costos fijos, comisiones por transacción, largos procesos de aprobación y complejidades técnicas de mantenimiento. En cambio, aprovecha WhatsApp, que es el canal de comunicación ya establecido entre el negocio y sus clientes, para cerrar la transacción de manera natural.

El portal adopta automáticamente el logo, el nombre y el color del negocio configurados en el panel administrativo, por lo que la experiencia visual del cliente es coherente con la identidad de la marca.

---

## Aspectos Técnicos

LUMA Store System está construido sobre una arquitectura sólida y probada que garantiza rendimiento, seguridad y posibilidad de crecimiento a largo plazo.

El servidor utiliza Django 5, uno de los frameworks web más maduros y seguros del mercado, desarrollado y mantenido por una comunidad global activa. La comunicación entre el servidor y las interfaces de usuario se realiza a través de una API REST con más de cuarenta endpoints, protegida mediante autenticación por tokens JWT con tiempo de vida configurable.

Las interfaces de usuario están construidas en React 18 con Vite como motor de compilación, lo que resulta en aplicaciones rápidas, con carga casi instantánea y experiencia fluida en dispositivos móviles y de escritorio. El diseño visual utiliza Tailwind CSS, una tecnología moderna que permite crear interfaces responsivas con alta consistencia visual.

La base de datos en producción es PostgreSQL, reconocida por su robustez, integridad de datos y capacidad para manejar volúmenes de información crecientes sin degradación de rendimiento. Las migraciones de base de datos están versionadas, lo que facilita las actualizaciones del sistema sin pérdida de información.

La generación de reportes en PDF utiliza la librería ReportLab, y la exportación a Excel utiliza openpyxl, ambas ampliamente probadas en entornos empresariales. El procesamiento de imágenes de productos se realiza mediante Pillow, con soporte para múltiples formatos de archivo.

Cada cliente del sistema opera sobre su propia instancia independiente, con su propia base de datos y su propia configuración. Esto garantiza que la información del negocio está completamente aislada y que el rendimiento del sistema no se ve afectado por la actividad de otros clientes.

---

## Entregables

La adquisición del sistema incluye los siguientes entregables:

El sistema completo instalado y configurado en el servidor del cliente o en un servidor gestionado según lo acordado, incluyendo el panel administrativo, el portal de ventas en línea y el servidor API con todos los módulos operativos.

La configuración inicial del sistema con los datos del negocio: nombre de la tienda, logo, color principal, número de WhatsApp, métodos de pago habilitados y plantillas de mensajes personalizadas.

La migración o carga inicial de datos en caso de que el cliente cuente con un catálogo de productos existente en formato Excel o CSV, incluyendo sus categorías, precios y stock.

La creación de las cuentas de usuario para el equipo del negocio con los roles correspondientes.

Una sesión de capacitación para el equipo sobre el uso de todos los módulos del sistema, con énfasis en el punto de venta, la gestión de pedidos y el control de caja.

El código fuente completo del sistema, entregado como propiedad del cliente.

Soporte técnico durante el primer mes posterior a la puesta en marcha, con atención a dudas de uso y corrección de cualquier incidencia que se presente.

---

## Inversión

[Completar con la estructura de precios acordada: valor de la licencia, costo de instalación y configuración, soporte mensual opcional, condiciones de pago.]

---

## Garantías y Compromisos

El sistema se entrega en funcionamiento completo, con todos los módulos operativos y probados. En caso de que durante el primer mes de uso se identifique alguna funcionalidad que no opere según lo descrito en esta propuesta, se realizará la corrección sin costo adicional.

El código fuente entregado es propiedad exclusiva del cliente a partir del momento de la liquidación total. El cliente puede contratar a cualquier desarrollador para hacer modificaciones futuras, sin restricciones ni dependencias del proveedor original.

La información del cliente almacenada en el sistema es de su exclusiva propiedad. No existe ningún mecanismo de telemetría, recolección de datos ni acceso remoto sin autorización explícita del cliente.

---

## Por Qué LUMA

Existen en el mercado soluciones genéricas de punto de venta que cubren parcialmente las necesidades de un negocio de moda, pero ninguna está diseñada con la especificidad que este sector requiere. LUMA no es una herramienta de facturación a la que se le agregó un inventario: es un sistema pensado desde el primer día para el funcionamiento real de una tienda de ropa, con variantes de talla y color, pedidos por WhatsApp, portal de ventas propio, programa de puntos y toda la gestión operativa integrada en un solo lugar.

La decisión de no integrar una pasarela de pago no es una limitación del sistema: es una decisión de diseño deliberada que elimina costos fijos, comisiones por transacción y complejidades regulatorias, y que en cambio aprovecha el canal de comunicación que los clientes colombianos ya usan cotidianamente para hacer sus compras: WhatsApp.

Al adquirir LUMA, el negocio no contrata un servicio con suscripción mensual que puede interrumpirse, encarecerse o descontinuarse. Adquiere el sistema completo como propiedad, con independencia total frente al proveedor y la libertad de evolucionar la plataforma según sus propias necesidades en el tiempo.

---

## Próximos Pasos

Si esta propuesta se ajusta a las expectativas y necesidades del negocio, el proceso para poner el sistema en marcha es el siguiente: en primer lugar se formaliza el acuerdo con la firma del contrato y el pago inicial, a continuación se realiza la instalación y configuración del sistema en un plazo de cinco a diez días hábiles según la complejidad del catálogo inicial, posteriormente se lleva a cabo la capacitación del equipo, y finalmente se activa el sistema para operación en producción con el acompañamiento de soporte durante el primer mes.

Para cualquier pregunta adicional, demostración en vivo del sistema o ajuste de los términos de esta propuesta, quedo disponible para una reunión o llamada en el momento que sea conveniente.

---

*LUMA Store System — Tecnología para negocios de moda*

