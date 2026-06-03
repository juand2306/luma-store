# Guía de Despliegue en Producción — LUMA Store

> **Plataforma objetivo:** Railway (backend) + Vercel o Railway (frontends)
> **Tiempo estimado:** 45–90 minutos la primera vez

---

## Tabla de contenido

1. [Cuentas externas que necesitas crear](#1-cuentas-externas)
2. [Preparar el repositorio](#2-preparar-el-repositorio)
3. [Desplegar el backend en Railway](#3-backend-en-railway)
4. [Variables de entorno del backend](#4-variables-de-entorno-backend)
5. [Desplegar los frontends](#5-frontends)
6. [Variables de entorno de los frontends](#6-variables-de-entorno-frontends)
7. [Configuración inicial post-deploy](#7-configuracion-inicial)
8. [Checklist de verificación](#8-checklist-de-verificacion)
9. [Activar funciones opcionales](#9-funciones-opcionales)
10. [Replicar para un nuevo cliente](#10-nuevo-cliente)
11. [Mantenimiento y operación](#11-mantenimiento)

---

## 1. Cuentas externas

Crea estas cuentas **antes** de hacer el deploy. Todas tienen plan gratuito suficiente para empezar.

### Obligatorias

| Servicio | URL | Para qué | Costo |
|----------|-----|----------|-------|
| **Railway** | railway.app | Hosting del backend (Django + PostgreSQL + Redis) | Gratis hasta $5/mes de uso |
| **Cloudinary** | cloudinary.com | Almacenamiento de imágenes de productos | Gratis: 25 GB storage + 25 GB/mes transferencia |
| **Sentry** | sentry.io | Monitoreo de errores en tiempo real | Gratis: 5.000 errores/mes |

### Opcionales pero recomendadas

| Servicio | URL | Para qué | Costo |
|----------|-----|----------|-------|
| **Resend** | resend.com | Envío de emails a clientes | Gratis: 3.000 emails/mes |
| **Gmail** (alternativa) | myaccount.google.com | Envío de emails via SMTP | Gratis: ~500/día |
| **Vercel** | vercel.com | Hosting de los frontends React | Gratis para proyectos personales |

---

## 2. Preparar el repositorio

Antes de hacer el primer deploy, verifica que estos archivos existen y están correctos:

```
luma-store/
  backend/
    Procfile           ← Railway lo usa para saber cómo iniciar el servidor
    .python-version    ← Debe tener "3.12"
    requirements.txt   ← Debe incluir todas las dependencias de producción
    .env               ← NUNCA subir a Git (ya está en .gitignore)
  frontend/
    admin/
      .env.local       ← NUNCA subir a Git
    store/
      .env.local       ← NUNCA subir a Git
```

### Verificar que .env no está en Git

```bash
git check-ignore -v backend/.env
# Debe mostrar: .gitignore:... backend/.env
```

Si no aparece, agrégalo manualmente al `.gitignore`.

---

## 3. Backend en Railway

### 3.1 Crear el proyecto

1. Ir a [railway.app](https://railway.app) → **New Project**
2. Seleccionar **Deploy from GitHub repo**
3. Conectar tu cuenta de GitHub y seleccionar el repositorio `luma-store`
4. Railway detectará el `Procfile` automáticamente

### 3.2 Configurar el servicio de backend

En la configuración del servicio:

- **Root Directory:** `backend`
- **Build Command:** *(dejar vacío — Railway lo detecta)*
- **Start Command:** *(ya está en el Procfile, no cambiar)*

### 3.3 Agregar PostgreSQL

1. En el proyecto Railway → **+ New** → **Database** → **PostgreSQL**
2. Railway inyecta `DATABASE_URL` automáticamente al servicio backend
3. **No necesitas copiar ni pegar nada** — la conexión es automática

### 3.4 Agregar Redis (recomendado)

1. En el proyecto Railway → **+ New** → **Database** → **Redis**
2. Railway inyecta `REDIS_URL` automáticamente
3. Sin Redis la app funciona igual, pero la caché no se comparte entre workers

> **¿Cuándo es obligatorio Redis?** Cuando tengas más de 1 worker (`--workers 2` en el Procfile). Con 1 worker no es necesario.

---

## 4. Variables de entorno — Backend

Ve a tu servicio de backend en Railway → **Variables** → agregar cada una:

### 4.1 Seguridad base (OBLIGATORIAS)

```env
SECRET_KEY=<genera-una-nueva-clave-segura>
DEBUG=False
ALLOWED_HOSTS=<tu-dominio-railway>.railway.app
```

**Cómo generar SECRET_KEY:**
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```
Copia el resultado y pégalo en Railway. **Nunca uses la clave por defecto en producción.**

### 4.2 Base de datos y caché

```env
# Railway las inyecta automáticamente al agregar los addons.
# NO las configures manualmente si usas los addons de Railway.
# DATABASE_URL  ← inyectada por el addon PostgreSQL
# REDIS_URL     ← inyectada por el addon Redis
```

### 4.3 CORS — Dominios del frontend

```env
CORS_ALLOWED_ORIGINS=https://tu-admin.vercel.app,https://tu-tienda.vercel.app
```

> Llena esto DESPUÉS de desplegar los frontends para tener las URLs reales.
> Mientras configuras puedes dejarlo vacío y agregar las URLs cuando las tengas.

### 4.4 Datos de la tienda

```env
STORE_NAME=Nombre de la Tienda
STORE_WHATSAPP=573001234567
STORE_PRIMARY_COLOR=#2E86C1
```

> `STORE_WHATSAPP` debe incluir el código de país **sin el +** (ej: Colombia → 57...)

### 4.5 Cloudinary — Imágenes

Obtén estos valores en [cloudinary.com](https://cloudinary.com) → Dashboard:

```env
CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret
```

Sin estas variables las imágenes se intentan guardar en el filesystem de Railway
(que es efímero — se pierden con cada deploy). **Son obligatorias para producción.**

**Dónde encontrarlos:**
1. Inicia sesión en cloudinary.com
2. En el Dashboard verás las 3 credenciales directamente

### 4.6 Email — Notificaciones a clientes (opcional pero recomendado)

**Opción A — Resend.com** (recomendada, sin tarjeta de crédito):

```env
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=465
EMAIL_USE_TLS=True
EMAIL_HOST_USER=resend
EMAIL_HOST_PASSWORD=re_xxxxxxxxxxxxxxxxxxxx
DEFAULT_FROM_EMAIL=Tu Tienda <noreply@tudominio.com>
```

1. Crear cuenta en [resend.com](https://resend.com)
2. **API Keys** → **Create API Key**
3. Pegar la key en `EMAIL_HOST_PASSWORD`

**Opción B — Gmail con App Password:**

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=tucorreo@gmail.com
EMAIL_HOST_PASSWORD=xxxx xxxx xxxx xxxx
DEFAULT_FROM_EMAIL=Tu Tienda <tucorreo@gmail.com>
```

1. Activar verificación en 2 pasos en tu cuenta Gmail
2. Ir a **Seguridad** → **Contraseñas de aplicaciones**
3. Crear una contraseña para "Correo" → copiar las 16 letras

> **Sin email configurado:** la app funciona normalmente, solo que los clientes no reciben confirmación por correo.

### 4.7 Sentry — Monitoreo de errores

```env
SENTRY_DSN=https://xxxx@xxxx.ingest.sentry.io/xxxx
```

**Cómo obtenerlo:**
1. Crear cuenta en [sentry.io](https://sentry.io)
2. **Projects** → **Create Project** → Plataforma: **Django**
3. Copiar el DSN que aparece en la pantalla de configuración

### 4.8 Pagos (esqueleto — desactivado por defecto)

```env
PAYMENT_ENABLED=False
# Dejar así hasta que decidas activar pagos reales.
# Ver sección 9 para activar.
```

### Resumen completo de variables Railway

```env
SECRET_KEY=<generada>
DEBUG=False
ALLOWED_HOSTS=<tu-dominio>.railway.app

STORE_NAME=Nombre de la Tienda
STORE_WHATSAPP=573001234567
STORE_PRIMARY_COLOR=#2E86C1

CORS_ALLOWED_ORIGINS=https://admin.tudominio.com,https://tudominio.com

CLOUDINARY_CLOUD_NAME=<cloudname>
CLOUDINARY_API_KEY=<apikey>
CLOUDINARY_API_SECRET=<apisecret>

EMAIL_HOST=smtp.resend.com
EMAIL_PORT=465
EMAIL_USE_TLS=True
EMAIL_HOST_USER=resend
EMAIL_HOST_PASSWORD=<resend-api-key>
DEFAULT_FROM_EMAIL=Tu Tienda <noreply@tudominio.com>

SENTRY_DSN=<dsn>

PAYMENT_ENABLED=False
```

---

## 5. Frontends

Tienes dos frontends independientes. Puedes hospedarlos en Vercel (recomendado) o en Railway como servicios estáticos.

### 5.1 Opción A — Vercel (recomendada)

**Para el panel de administración:**

1. Ir a [vercel.com](https://vercel.com) → **Add New Project**
2. Importar el repositorio → **Root Directory:** `frontend/admin`
3. **Build Command:** `npm run build`
4. **Output Directory:** `dist`
5. Agregar variables de entorno (ver sección 6)
6. Deploy

**Para el portal de clientes:**

1. Mismo proceso → **Root Directory:** `frontend/store`
2. Agregar variables de entorno (ver sección 6)
3. Deploy

### 5.2 Opción B — Railway (mismo proyecto)

1. En tu proyecto Railway → **+ New** → **Empty Service**
2. Conectar al mismo repo → **Root Directory:** `frontend/admin`
3. **Build Command:** `npm install && npm run build`
4. **Start Command:** `npx serve dist -p $PORT`
5. Repetir para `frontend/store`

---

## 6. Variables de entorno — Frontends

Configura en Vercel (o Railway) para cada frontend:

### Panel de administración (`frontend/admin`)

```env
VITE_API_URL=https://<tu-backend>.railway.app
VITE_SENTRY_DSN=https://xxxx@xxxx.ingest.sentry.io/xxxx
```

> El `VITE_SENTRY_DSN` puede ser el mismo del backend o uno separado.
> Para separar errores de admin vs backend, crea dos proyectos en Sentry.

### Portal de clientes (`frontend/store`)

```env
VITE_API_URL=https://<tu-backend>.railway.app
VITE_SENTRY_DSN=https://xxxx@xxxx.ingest.sentry.io/xxxx
```

---

## 7. Configuración inicial post-deploy

Una vez que el backend está corriendo, haz esto **una sola vez**:

### 7.1 Crear el superusuario

```bash
# Conectarte al servicio de Railway via CLI
railway link          # seleccionar el proyecto
railway run python manage.py createsuperuser
```

O desde el panel de Railway → **Shell** → ejecutar el comando directamente.

**Guarda bien estas credenciales** — son el acceso de dueño al sistema.

### 7.2 Configurar los datos de la tienda

1. Iniciar sesión en el panel de administración con el superusuario
2. Ir a **Configuración** (ícono de engranaje en el sidebar)
3. Completar:
   - Nombre de la tienda
   - Número de WhatsApp
   - Color principal (en hexadecimal, ej: `#0D8585`)
   - Dirección y horario (opcional)
   - Política de devoluciones (opcional)
   - Texto del banner (opcional)
   - Métodos de pago aceptados
   - Plantillas de mensajes de WhatsApp por estado

### 7.3 Crear el primer usuario administrador/vendedor

1. Panel admin → **Perfil** (o via Django Admin en `/admin/`)
2. Crear usuarios con el rol correspondiente:
   - `owner` — Acceso total, puede cambiar configuración
   - `admin` — Acceso total excepto configuración de la tienda
   - `seller` — Puede vender y gestionar pedidos, no puede borrar

### 7.4 Cargar el inventario inicial

1. Ir a **Inventario** → **Categorías** → crear categorías
2. Ir a **Inventario** → **Productos** → agregar productos con:
   - Imágenes (se subirán a Cloudinary automáticamente)
   - Variantes (talla + color + stock)
   - Precio
   - Marcar como **Visible** para que aparezcan en la tienda

---

## 8. Checklist de verificación

Verifica cada punto después del primer deploy:

### Backend

- [ ] `https://<backend>.railway.app/api/v1/store/config/` retorna datos de la tienda
- [ ] `https://<backend>.railway.app/api/v1/store/products/` retorna los productos
- [ ] Las migraciones corrieron sin errores (ver logs de Railway → release)
- [ ] Los archivos estáticos se sirven correctamente (`/static/admin/...`)
- [ ] Cloudinary: subir una imagen en el panel y verificar que la URL sea de cloudinary.com
- [ ] Sentry: ir a sentry.io y verificar que llegan eventos del backend

### Frontend — Admin

- [ ] El login funciona con el superusuario creado
- [ ] El dashboard muestra estadísticas
- [ ] Se puede crear un producto con imagen
- [ ] La imagen subida aparece en la tienda

### Frontend — Store

- [ ] La página carga con el color correcto de la tienda
- [ ] Los productos del catálogo se ven con imágenes
- [ ] Se puede agregar un producto al carrito
- [ ] El checkout completa el pedido y redirige a /confirmacion
- [ ] WhatsApp se abre con el mensaje correcto al confirmar

### Emails (si configurados)

- [ ] Hacer un pedido de prueba con un email real
- [ ] Verificar que llega el email de confirmación
- [ ] Cambiar el estado del pedido a "confirmado" en el admin
- [ ] Verificar que llega el email de actualización de estado

---

## 9. Funciones opcionales

### 9.1 Activar emails a clientes

Ya está implementado. Solo agrega las variables de entorno de email en Railway (sección 4.6) y Railway reiniciará el servicio automáticamente.

**Verificar:** hacer un pedido de prueba en la tienda con un email real y confirmar que llega.

### 9.2 Activar pasarela de pagos

El skeleton está listo para Wompi y Bold. Para activar:

**Wompi (Bancolombia Pay):**

1. Crear cuenta en [wompi.co](https://wompi.co)
2. Obtener las llaves de producción desde el dashboard
3. En Railway, agregar:

```env
PAYMENT_ENABLED=True
PAYMENT_PROVIDER=wompi
PAYMENT_PUBLIC_KEY=pub_prod_xxxxxxxxxxxx
PAYMENT_PRIVATE_KEY=prv_prod_xxxxxxxxxxxx
```

4. Configurar el webhook en el dashboard de Wompi:
   - URL: `https://<backend>.railway.app/api/v1/payments/webhook/`
   - Eventos: `transaction.updated`

5. Implementar la lógica de cobro en `apps/payments/providers.py` → `WompiProvider`
   (el skeleton está listo, solo falta el código de la API de Wompi)

**Bold:**

Mismo proceso con `PAYMENT_PROVIDER=bold` y las credenciales de Bold.

> **Nota:** La lógica del frontend para mostrar el botón de pago y redirigir al checkout de Wompi/Bold también debe implementarse. El backend skeleton está listo.

### 9.3 Limpiar clientes duplicados (datos existentes)

Si ya tienes datos de clientes con duplicados antes del deploy:

```bash
railway run python manage.py merge_duplicate_customers --dry-run
# Ver qué se fusionaría sin aplicar cambios

railway run python manage.py merge_duplicate_customers
# Aplicar la fusión
```

### 9.4 Activar dominio personalizado

1. En Railway → tu servicio backend → **Settings** → **Domains** → **Add Domain**
2. Agregar el dominio `api.tudominio.com` (o el que prefieras)
3. Copiar los registros DNS y configurarlos en tu proveedor de dominio
4. Actualizar `ALLOWED_HOSTS` en Railway:
   ```env
   ALLOWED_HOSTS=api.tudominio.com,<anterior>.railway.app
   ```
5. Actualizar `VITE_API_URL` en los frontends a `https://api.tudominio.com`

---

## 10. Replicar para un nuevo cliente

Para instalar el sistema en otro cliente, solo cambias credenciales — el código no se toca.

### Lo que cambia por cliente

| Variable | Descripción |
|----------|-------------|
| `STORE_NAME` | Nombre de la tienda del cliente |
| `STORE_WHATSAPP` | Número de WhatsApp del cliente |
| `STORE_PRIMARY_COLOR` | Color de marca del cliente |
| `CLOUDINARY_CLOUD_NAME` | Cuenta Cloudinary del cliente (o subcarpeta tuya) |
| `CLOUDINARY_API_KEY` | Clave de la cuenta del cliente |
| `CLOUDINARY_API_SECRET` | Secreto de la cuenta del cliente |
| `EMAIL_HOST_USER` | Correo del cliente para enviar notificaciones |
| `EMAIL_HOST_PASSWORD` | App Password del correo del cliente |
| `DEFAULT_FROM_EMAIL` | Nombre y correo que ven los clientes |
| `SECRET_KEY` | Generar una nueva por cada instalación |

### Opciones de aislamiento

**Opción A — Proyecto Railway separado por cliente** (recomendada):
- Cada cliente tiene su propio proyecto Railway con su propia BD
- Total aislamiento de datos
- Costo: ~$5–10/mes por cliente según el tráfico

**Opción B — Cloudinary compartida con MEDIA_TAG:**
- Si compartes tu cuenta Cloudinary con varios clientes, cambia en settings.py:
  ```python
  "MEDIA_TAG": "nombre-cliente",   # en CLOUDINARY_STORAGE
  ```
- Esto separa las imágenes de cada cliente dentro de la misma cuenta

---

## 11. Mantenimiento y operación

### Actualizar el sistema (nueva versión)

```bash
git push origin main
# Railway detecta el push y redespliega automáticamente
# El Procfile ejecuta las migraciones antes de iniciar el servidor
```

### Ver logs en tiempo real

```bash
railway logs          # últimas líneas
railway logs --tail   # streaming en tiempo real
```

O desde el panel de Railway → tu servicio → **Logs**.

### Ejecutar comandos de gestión

```bash
railway run python manage.py <comando>

# Ejemplos:
railway run python manage.py createsuperuser
railway run python manage.py merge_duplicate_customers
railway run python manage.py create_e2e_fixtures
```

### Backups de la base de datos

Railway hace backups automáticos del addon PostgreSQL en el plan de pago.
Para exportar manualmente:

```bash
railway run python manage.py dumpdata --natural-foreign --natural-primary \
  --exclude auth.permission --exclude contenttypes \
  -o backup_$(date +%Y%m%d).json
```

### Monitoreo

- **Sentry:** ir a [sentry.io](https://sentry.io) → ver errores en tiempo real
- **Railway:** ver uso de CPU/RAM/red en el dashboard del servicio
- **Uptime:** Railway reinicia automáticamente el servicio si cae

### Escalar el servidor

Si el tráfico crece, en el `Procfile` cambiar:
```
web: gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 4 --timeout 120
```

Con más workers, Redis pasa a ser obligatorio para compartir la caché entre procesos.

---

## Resumen rápido — Primer deploy

```
1. Crear cuentas: Railway, Cloudinary, Sentry, Resend
2. Railway: nuevo proyecto → conectar repo → root: backend
3. Railway: agregar addon PostgreSQL
4. Railway: agregar addon Redis (recomendado)
5. Railway: configurar todas las variables de entorno (sección 4)
6. Vercel: deploy frontend/admin → configurar variables
7. Vercel: deploy frontend/store → configurar variables
8. Railway: actualizar CORS_ALLOWED_ORIGINS con las URLs de Vercel
9. railway run python manage.py createsuperuser
10. Iniciar sesión en el admin → Configuración → datos de la tienda
11. Crear categorías y productos con imágenes
12. Hacer un pedido de prueba desde la tienda
13. Verificar en Sentry que no hay errores
```

---

*Documento generado para LUMA Store — Sistema de Gestión de Tienda*
