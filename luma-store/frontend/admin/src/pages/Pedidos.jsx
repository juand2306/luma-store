import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  Store, RefreshCw, Clock, ChevronRight,
  MessageCircle, ShoppingBag, CheckCircle2, Package, Search,
  Bell, X, SlidersHorizontal
} from 'lucide-react'
import { buildWhatsAppUrl, buildOrderMessage } from '../utils/whatsapp'
import { Button } from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { PageLoader, EmptyState, Pagination } from '../components/ui/Misc'
import { StatusBadge } from '../components/ui/Badge'
import * as svc from '../api/services'
import { usePaymentMethods } from '../hooks/usePaymentMethods'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`

const STATUS_OPTIONS = [
  { value: 'in_progress', label: '👀 En gestión' },
  { value: 'confirmed',   label: '✓ Confirmado' },
  { value: 'preparing',   label: '📦 En preparación' },
  { value: 'shipped',     label: '✅ Listo para entregar' },
  { value: 'delivered',   label: '🚚 Marcar como entregado' },
  { value: 'cancelled',   label: '✕ Cancelar pedido' },
]

// Iconos de respaldo por clave de método
const METHOD_ICONS = {
  cash: '💵', transfer: '🏦', nequi: '🟣', daviplata: '🔴',
  debit: '💳', credit: '💳', other: '🔄',
}

const POLL_INTERVAL    = 60000
const PAGE_SIZE_PEDIDOS = 50

// ── Mini-modal de confirmación de entrega ─────────────────────────────────────
function DeliveryConfirmModal({ order, onConfirm, onCancel, loading }) {
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const { enabledMethods } = usePaymentMethods()

  return (
    <Modal
      open
      onClose={onCancel}
      title="Confirmar entrega del pedido"
      size="sm"
      footer={
        <div className="flex gap-2 justify-end w-full">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="teal"
            icon={ShoppingBag}
            loading={loading}
            onClick={() => onConfirm(paymentMethod)}
          >
            Confirmar entrega
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Info del pedido */}
        <div className="bg-cream-100 rounded-xl p-3 flex items-center justify-between text-[12px]">
          <div>
            <p className="font-mono font-bold text-teal-600">{order.number}</p>
            <p className="text-luma-muted mt-0.5">{order.customer_name || 'Anónimo'}</p>
          </div>
          <p className="text-[16px] font-bold text-luma-text">{fmt(order.total)}</p>
        </div>

        {/* Qué va a pasar */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
          <p className="text-[12px] font-semibold text-amber-700 flex items-center gap-1.5">
            <Package size={13} /> Al confirmar la entrega:
          </p>
          <ul className="text-[11px] text-amber-600 space-y-1 pl-4 list-disc">
            <li>Se registrará una <strong>Venta</strong> en el sistema</li>
            <li>El <strong>inventario</strong> se descontará automáticamente</li>
            <li>El ingreso se registrará en <strong>caja</strong> (si está abierta)</li>
          </ul>
        </div>

        {/* Método de pago — campo central */}
        <div className="space-y-2">
          <label className="block text-[13px] font-semibold text-luma-text">
            ¿Cómo pagó el cliente? <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {enabledMethods.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPaymentMethod(key)}
                className={`px-3 py-2.5 rounded-xl border text-[12px] font-medium text-left transition-all ${
                  paymentMethod === key
                    ? 'border-teal-400 bg-teal-50 text-teal-700 shadow-sm'
                    : 'border-luma-border hover:border-teal-300 hover:bg-cream-50 text-luma-muted'
                }`}
              >
                {METHOD_ICONS[key] || '💰'} {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Tarjeta de pedido ─────────────────────────────────────────────────────────
function OrderCard({ order, onView }) {
  const isNew = order.status === 'new'
  const timeAgo = () => {
    const diff = Date.now() - new Date(order.created_at).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `hace ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `hace ${hrs}h`
    return new Date(order.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
  }

  return (
    <div
      onClick={() => onView(order)}
      className={`card p-4 hover:shadow-card-md transition-all duration-200 cursor-pointer group relative overflow-hidden
        ${isNew ? 'ring-1 ring-amber-300 bg-gradient-to-br from-amber-50/60 to-white' : 'hover:bg-cream-50/40'}`}
    >
      {/* Franja lateral para nuevos */}
      {isNew && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-l-xl" />
      )}

      <div className="flex items-start justify-between gap-3">
        {/* Izquierda */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
              {order.number}
            </span>
            <StatusBadge status={order.status} />
            {order.sale_number && (
              <span className="text-[10px] font-mono bg-teal-50 text-teal-600 border border-teal-200 rounded px-1.5 py-0.5">
                {order.sale_number}
              </span>
            )}
          </div>
          <p className="text-[13px] font-semibold text-luma-text mt-2 truncate">
            {order.customer_name || 'Cliente anónimo'}
          </p>
          {order.customer_phone && (
            <p className="text-[11px] text-luma-faint mt-0.5">{order.customer_phone}</p>
          )}
        </div>

        {/* Derecha */}
        <div className="text-right flex-shrink-0">
          <p className="text-[15px] font-bold text-luma-text">{fmt(order.total)}</p>
          <p className="text-[10px] text-luma-faint mt-1 flex items-center gap-1 justify-end">
            <Clock size={9} /> {timeAgo()}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-luma-border flex items-center justify-between">
        <p className="text-[11px] text-luma-faint">
          <span className="font-medium text-luma-muted">{order.item_count}</span> producto(s)
        </p>
        <ChevronRight size={13} className="text-luma-faint group-hover:text-teal-500 transition-colors" />
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
// Mapa: estado del pedido → campo de plantilla en StoreConfig
const STATUS_TEMPLATE_KEY = {
  new:         'msg_in_progress',
  in_progress: 'msg_in_progress',
  confirmed:   'msg_confirmed',
  preparing:   'msg_preparing',
  shipped:     'msg_shipped',
  delivered:   'msg_delivered',
  cancelled:   'msg_cancelled',
}

export default function Pedidos() {
  const [orders,         setOrders]         = useState([])
  const [loading,        setLoading]        = useState(true)
  const [page,           setPage]           = useState(1)
  const [totalCount,     setTotalCount]     = useState(0)
  const [stats,          setStats]          = useState({ total: 0, new: 0, in_progress: 0, done: 0 })
  const [filter,         setFilter]         = useState('')
  const [inputSearch,    setInputSearch]    = useState('')  // inmediato
  const [search,         setSearch]         = useState('')  // debounced
  const [detail,         setDetail]         = useState(null)
  const [detailLoading,  setDetailLoading]  = useState(false)
  const [newStatus,      setNewStatus]      = useState('')
  const [saving,         setSaving]         = useState(false)
  const [showDelivery,   setShowDelivery]   = useState(false)
  const [storeConfig,    setStoreConfig]    = useState(null)

  const prevCountRef = useRef(0)

  // Debounce: 350 ms tras dejar de tipear
  useEffect(() => {
    const t = setTimeout(() => setSearch(inputSearch), 350)
    return () => clearTimeout(t)
  }, [inputSearch])

  // Params compartidos entre load y loadStats
  const filterParams = useMemo(() => {
    const p = { status: filter || undefined }
    if (search) p.search = search
    return p
  }, [filter, search])

  const load = useCallback(async (p = 1, silent = false) => {
    if (!silent) { setPage(p); setLoading(true) }
    try {
      const params = { ...filterParams, page: p, page_size: PAGE_SIZE_PEDIDOS }
      const { data } = await svc.getOrders(params)
      const list = data?.results ?? data ?? []

      // En modo silencioso (polling): solo actualizar el conteo de nuevos y mostrar
      // el toast si corresponde — SIN reemplazar la página que el usuario está viendo
      const newCount = list.filter(o => o.status === 'new').length
      if (silent) {
        if (newCount > prevCountRef.current) {
          toast(`🔔 ${newCount - prevCountRef.current} nuevo(s) pedido(s)`, { icon: '📦' })
        }
        prevCountRef.current = newCount
        return
      }

      setOrders(list)
      setTotalCount(data?.count ?? 0)
      prevCountRef.current = newCount
    } catch { if (!silent) toast.error('Error cargando pedidos') }
    finally { if (!silent) setLoading(false) }
  }, [filterParams])

  // loadStats — conteos reales del servidor (no limitados a la página actual)
  const loadStats = useCallback(async () => {
    try {
      const { data } = await svc.getOrderStats(filterParams)
      setStats(data)
    } catch {}
  }, [filterParams])

  // Cargar config de tienda una sola vez (para las plantillas de WhatsApp)
  useEffect(() => {
    svc.getStoreConfig()
      .then(({ data }) => setStoreConfig(data))
      .catch(() => {})
  }, [])

  useEffect(() => { load(1)    }, [load])
  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => {
    const interval = setInterval(() => load(1, true), POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [load])

  const openDetail = async (order) => {
    setDetailLoading(true)
    try {
      const { data } = await svc.getOrder(order.id)
      setDetail(data)
      // Si el estado es 'new' (no en STATUS_OPTIONS), inicializar al primer paso
      const validStatus = STATUS_OPTIONS.find(s => s.value === data.status)
      setNewStatus(validStatus ? data.status : STATUS_OPTIONS[0].value)
    } catch { toast.error('Error al cargar pedido') }
    finally { setDetailLoading(false) }
  }

  // Clic en "Actualizar" → si es entrega, abre el mini-modal; si no, guarda directo
  const handleUpdateClick = () => {
    if (!newStatus || newStatus === detail.status) { setDetail(null); return }
    if (newStatus === 'delivered') {
      setShowDelivery(true) // abre el mini-modal de confirmación de pago
    } else {
      saveStatus(newStatus, null)
    }
  }

  // Guardar el cambio de estado (con o sin payment_method)
  const saveStatus = async (status, paymentMethod) => {
    setSaving(true)
    try {
      const payload = { status }
      if (paymentMethod) payload.payment_method = paymentMethod
      const { data } = await svc.updateOrder(detail.id, payload)
      if (status === 'delivered' && data.sale_number) {
        toast.success(`✅ Entregado · Venta ${data.sale_number} registrada`)
      } else {
        toast.success('Estado actualizado')
      }
      setDetail(null)
      setShowDelivery(false)
      load(1)
      loadStats()
    } catch { toast.error('Error al actualizar') }
    finally { setSaving(false) }
  }

  const newOrders  = orders.filter(o => o.status === 'new')
  const inProgress = orders.filter(o => ['in_progress','confirmed','preparing','shipped'].includes(o.status))
  const done       = orders.filter(o => ['delivered','cancelled'].includes(o.status))

  if (loading) return <PageLoader />

  const hasActiveFilters = filter || inputSearch

  return (
    <div className="space-y-4 animate-fade-up">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="page-title">Pedidos</h2>
          <p className="text-[13px] text-luma-muted mt-0.5">
            {totalCount.toLocaleString('es-CO')} pedidos en total
            {stats.new > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-semibold">
                <Bell size={11} />
                {stats.new} nuevos
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => { load(1); loadStats() }}
          className="btn-ghost p-2 mt-1 flex-shrink-0"
          title="Actualizar"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Nuevos */}
        <div className="card p-4 flex items-center gap-3 group hover:shadow-card-md transition-all duration-200">
          <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bell size={17} className="text-teal-500" />
          </div>
          <div className="min-w-0">
            <p className="section-label">Nuevos</p>
            <p className="text-[22px] font-bold text-teal-600 leading-tight mt-0.5">{stats.new}</p>
          </div>
          {stats.new > 0 && (
            <span className="ml-auto w-2 h-2 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />
          )}
        </div>
        {/* En proceso */}
        <div className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-all duration-200">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Clock size={17} className="text-amber-500" />
          </div>
          <div>
            <p className="section-label">En proceso</p>
            <p className="text-[22px] font-bold text-amber-600 leading-tight mt-0.5">{stats.in_progress}</p>
          </div>
        </div>
        {/* Completados */}
        <div className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-all duration-200">
          <div className="w-10 h-10 bg-cream-200 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={17} className="text-luma-muted" />
          </div>
          <div>
            <p className="section-label">Completados</p>
            <p className="text-[22px] font-bold text-luma-muted leading-tight mt-0.5">{stats.done}</p>
          </div>
        </div>
      </div>

      {/* ── Barra de filtros ── */}
      <div className="card p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Buscar por número o cliente..."
              value={inputSearch}
              onChange={e => setInputSearch(e.target.value)}
              className="input-base w-full pl-9"
            />
          </div>
          {/* Status filter */}
          <div className="relative">
            <SlidersHorizontal size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="input-base pl-8 w-full sm:w-52 appearance-none"
            >
              <option value="">Todos los estados</option>
              <option value="new">🔔 Nuevos</option>
              <option value="in_progress">👀 En gestión</option>
              <option value="confirmed">✓ Confirmados</option>
              <option value="preparing">📦 En preparación</option>
              <option value="shipped">✅ Listos para entregar</option>
              <option value="delivered">🚚 Entregados</option>
              <option value="cancelled">✕ Cancelados</option>
            </select>
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-luma-border">
            <span className="text-[11px] text-luma-faint">Filtros:</span>
            {filter && (
              <button
                onClick={() => setFilter('')}
                className="inline-flex items-center gap-1 text-[11px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-lg hover:bg-teal-100 transition-colors"
              >
                {filter === 'new' ? '🔔 Nuevos'
                  : filter === 'in_progress' ? '👀 En gestión'
                  : filter === 'confirmed' ? '✓ Confirmados'
                  : filter === 'preparing' ? '📦 Preparando'
                  : filter === 'shipped' ? '✅ Listos'
                  : filter === 'delivered' ? '🚚 Entregados'
                  : '✕ Cancelados'}
                <X size={10} />
              </button>
            )}
            {inputSearch && (
              <button
                onClick={() => setInputSearch('')}
                className="inline-flex items-center gap-1 text-[11px] bg-cream-100 text-luma-muted border border-luma-border px-2 py-0.5 rounded-lg hover:bg-cream-200 transition-colors"
              >
                "{inputSearch}" <X size={10} />
              </button>
            )}
            <button
              onClick={() => { setFilter(''); setInputSearch('') }}
              className="text-[11px] text-luma-faint hover:text-red-500 transition-colors ml-auto"
            >
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="card py-14 text-center">
          <div className="w-14 h-14 bg-cream-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store size={24} className="text-luma-faint" />
          </div>
          <p className="text-[15px] font-semibold text-luma-text">Sin pedidos</p>
          <p className="text-[13px] text-luma-muted mt-1">
            {hasActiveFilters ? 'No hay pedidos con los filtros actuales' : 'Los pedidos del portal online aparecerán aquí'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={() => { setFilter(''); setInputSearch('') }}
              className="mt-3 text-[12px] text-teal-600 hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Columna izquierda: pendientes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <p className="section-label">
                Nuevos & Pendientes
                {([...newOrders, ...inProgress].length > 0) && (
                  <span className="ml-2 text-amber-600 font-bold">({[...newOrders, ...inProgress].length})</span>
                )}
              </p>
            </div>
            <div className="space-y-2.5">
              {[...newOrders, ...inProgress].length === 0 ? (
                <div className="card p-8 text-center">
                  <CheckCircle2 size={22} className="text-teal-400 mx-auto mb-2" />
                  <p className="text-[12px] text-luma-faint">Sin pedidos pendientes ✓</p>
                </div>
              ) : (
                [...newOrders, ...inProgress].map(o => (
                  <OrderCard key={o.id} order={o} onView={openDetail} />
                ))
              )}
            </div>
          </div>

          {/* Columna derecha: finalizados */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-luma-faint" />
              <p className="section-label">
                Completados & Cancelados
                {done.length > 0 && (
                  <span className="ml-2 text-luma-faint font-bold">({done.length})</span>
                )}
              </p>
            </div>
            <div className="space-y-2.5">
              {done.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-[12px] text-luma-faint">Aún no hay pedidos finalizados</p>
                </div>
              ) : (
                done.map(o => <OrderCard key={o.id} order={o} onView={openDetail} />)
              )}
            </div>
          </div>
        </div>
      )}

      <Pagination
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE_PEDIDOS}
        onPageChange={load}
      />

      {/* ── Modal de detalle ── */}
      {detail && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title={`Pedido ${detail.number}`}
          size="md"
          footer={
            <div className="flex items-center gap-2 flex-wrap justify-end w-full">
              {detail.customer_phone && (
                <a
                  href={buildWhatsAppUrl(
                    detail.customer_phone,
                    buildOrderMessage(
                      detail,
                      storeConfig?.[STATUS_TEMPLATE_KEY[detail.status]] || null
                    )
                  )}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-[12px] font-semibold rounded-xl transition-colors"
                >
                  <MessageCircle size={13} /> Notificar WhatsApp
                </a>
              )}
              {detail.status !== 'delivered' && detail.status !== 'cancelled' && (
                <div className="flex items-center gap-2">
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                    className="input-base w-52 text-[12px]"
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <Button
                    variant={newStatus === 'delivered' ? 'teal' : 'outline'}
                    loading={saving}
                    onClick={handleUpdateClick}
                  >
                    {newStatus === 'delivered' ? '🚚 Entregar' : 'Actualizar'}
                  </Button>
                </div>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            {/* Banner venta vinculada */}
            {detail.sale_number && (
              <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-xl p-3">
                <CheckCircle2 size={18} className="text-teal-500 flex-shrink-0" />
                <div>
                  <p className="text-[12px] font-semibold text-teal-700">Venta registrada automáticamente</p>
                  <p className="text-[11px] text-teal-600">
                    Venta <strong className="font-mono">{detail.sale_number}</strong> · Inventario descontado
                  </p>
                </div>
              </div>
            )}

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              {[
                ['Cliente',  detail.customer_name || 'Anónimo'],
                ['Teléfono', detail.customer_phone || '—'],
                ['Fecha',    new Date(detail.created_at).toLocaleString('es-CO')],
                ['Estado',   <StatusBadge status={detail.status} />],
              ].map(([k, v]) => (
                <div key={k} className="bg-cream-100 rounded-xl p-3">
                  <p className="text-luma-faint text-[10px] uppercase">{k}</p>
                  <div className="font-semibold mt-0.5">{v}</div>
                </div>
              ))}
            </div>

            {detail.note && (
              <div className="bg-cream-100 rounded-xl p-3">
                <p className="text-[10px] text-luma-faint uppercase">Nota del cliente</p>
                <p className="text-[12px] mt-0.5">{detail.note}</p>
              </div>
            )}

            {/* Productos */}
            <div>
              <p className="section-label mb-2">Productos</p>
              {detail.items?.map(item => (
                <div key={item.id} className="flex justify-between py-2 border-b border-luma-border last:border-0 text-[12px]">
                  <div>
                    <p className="font-semibold">{item.product_name}</p>
                    <p className="text-luma-faint">{item.variant_display} × {item.quantity}</p>
                  </div>
                  <span className="font-bold">{fmt(item.subtotal)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-3 font-bold text-[14px]">
                <span>Total</span>
                <span className="text-teal-600">{fmt(detail.total)}</span>
              </div>
            </div>

            {/* Historial */}
            {detail.history?.length > 0 && (
              <div>
                <p className="section-label mb-2">Historial</p>
                <div className="space-y-1.5 max-h-28 overflow-y-auto">
                  {[...detail.history].reverse().map(h => (
                    <div key={h.id} className="flex items-center gap-2 text-[11px] text-luma-muted">
                      <span className="text-luma-faint whitespace-nowrap text-[10px]">
                        {new Date(h.created_at).toLocaleString('es-CO', {
                          hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
                        })}
                      </span>
                      <StatusBadge status={h.status} />
                      {h.changed_by_name && <span>· {h.changed_by_name}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Mini-modal de confirmación de entrega ── */}
      {showDelivery && detail && (
        <DeliveryConfirmModal
          order={detail}
          loading={saving}
          onConfirm={(pm) => saveStatus('delivered', pm)}
          onCancel={() => setShowDelivery(false)}
        />
      )}
    </div>
  )
}
