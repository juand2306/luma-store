import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  Store, RefreshCw, Clock, ChevronRight,
  MessageCircle, ShoppingBag, CheckCircle2, Package
} from 'lucide-react'
import { buildWhatsAppUrl, buildOrderMessage } from '../utils/whatsapp'
import { Button } from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { PageLoader, EmptyState } from '../components/ui/Misc'
import { StatusBadge } from '../components/ui/Badge'
import * as svc from '../api/services'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`

const STATUS_OPTIONS = [
  { value: 'in_progress', label: '👀 En gestión' },
  { value: 'confirmed',   label: '✓ Confirmado' },
  { value: 'preparing',   label: '📦 En preparación' },
  { value: 'shipped',     label: '✅ Listo para entregar' },
  { value: 'delivered',   label: '🚚 Marcar como entregado' },
  { value: 'cancelled',   label: '✕ Cancelar pedido' },
]

const PAYMENT_OPTIONS = [
  { value: 'cash',      label: '💵 Efectivo' },
  { value: 'transfer',  label: '🏦 Transferencia' },
  { value: 'nequi',     label: '🟣 Nequi' },
  { value: 'daviplata', label: '🔴 Daviplata' },
  { value: 'debit',     label: '💳 Tarjeta Débito' },
  { value: 'credit',    label: '💳 Tarjeta Crédito' },
  { value: 'other',     label: '🔄 Otro' },
]

const POLL_INTERVAL = 60000

// ── Mini-modal de confirmación de entrega ─────────────────────────────────────
function DeliveryConfirmModal({ order, onConfirm, onCancel, loading }) {
  const [paymentMethod, setPaymentMethod] = useState('cash')

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
            {PAYMENT_OPTIONS.map(p => (
              <button
                key={p.value}
                onClick={() => setPaymentMethod(p.value)}
                className={`px-3 py-2.5 rounded-xl border text-[12px] font-medium text-left transition-all ${
                  paymentMethod === p.value
                    ? 'border-teal-400 bg-teal-50 text-teal-700 shadow-sm'
                    : 'border-luma-border hover:border-teal-300 hover:bg-cream-50 text-luma-muted'
                }`}
              >
                {p.label}
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
    return new Date(order.created_at).toLocaleDateString('es-CO')
  }

  return (
    <div
      onClick={() => onView(order)}
      className={`card p-4 hover:shadow-card-md transition-all duration-300 cursor-pointer group
        ${isNew ? 'border-l-4 border-amber-400 bg-amber-50/30' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono text-[12px] font-bold text-teal-600">{order.number}</p>
            <StatusBadge status={order.status} />
            {order.sale_number && (
              <span className="text-[10px] font-mono bg-teal-50 text-teal-600 border border-teal-200 rounded px-1.5 py-0.5">
                {order.sale_number}
              </span>
            )}
          </div>
          <p className="text-[13px] font-semibold text-luma-text mt-1">
            {order.customer_name || 'Anónimo'}
          </p>
          {order.customer_phone && (
            <p className="text-[11px] text-luma-faint">{order.customer_phone}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[14px] font-bold text-luma-text">{fmt(order.total)}</p>
          <p className="text-[10px] text-luma-faint mt-1 flex items-center gap-1 justify-end">
            <Clock size={10} />{timeAgo()}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-luma-muted">{order.item_count} producto(s)</p>
        <ChevronRight size={13} className="text-luma-faint group-hover:text-teal-500 transition-colors" />
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Pedidos() {
  const [orders,         setOrders]         = useState([])
  const [loading,        setLoading]        = useState(true)
  const [filter,         setFilter]         = useState('')
  const [detail,         setDetail]         = useState(null)
  const [newStatus,      setNewStatus]      = useState('')
  const [saving,         setSaving]         = useState(false)
  const [showDelivery,   setShowDelivery]   = useState(false) // mini-modal de confirmación

  const prevCountRef = useRef(0)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { data } = await svc.getOrders({ status: filter || undefined })
      const list = data?.results ?? data ?? []
      setOrders(list)
      const newCount = list.filter(o => o.status === 'new').length
      if (silent && newCount > prevCountRef.current) {
        toast(`🔔 ${newCount - prevCountRef.current} nuevo(s) pedido(s)`, { icon: '📦' })
      }
      prevCountRef.current = newCount
    } catch { if (!silent) toast.error('Error cargando pedidos') }
    finally { if (!silent) setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const interval = setInterval(() => load(true), POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [load])

  const openDetail = async (order) => {
    try {
      const { data } = await svc.getOrder(order.id)
      setDetail(data)
      setNewStatus(data.status)
    } catch { toast.error('Error al cargar pedido') }
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
      load()
    } catch { toast.error('Error al actualizar') }
    finally { setSaving(false) }
  }

  const newOrders  = orders.filter(o => o.status === 'new')
  const inProgress = orders.filter(o => ['in_progress','confirmed','preparing','shipped'].includes(o.status))
  const done       = orders.filter(o => ['delivered','cancelled'].includes(o.status))

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Pedidos</h2>
          <p className="text-[13px] text-luma-muted mt-0.5">
            {orders.length} pedidos · {newOrders.length} nuevos
          </p>
        </div>
        <div className="flex gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="input-base w-40 text-[12px]">
            <option value="">Todos</option>
            <option value="new">Nuevos</option>
            <option value="in_progress">En gestión</option>
            <option value="confirmed">Confirmados</option>
            <option value="preparing">En preparación</option>
            <option value="shipped">Listos para entregar</option>
            <option value="delivered">Entregados</option>
            <option value="cancelled">Cancelados</option>
          </select>
          <button onClick={load} className="btn-ghost"><RefreshCw size={15} /></button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 border-l-4 border-teal-500">
          <p className="section-label">Nuevos</p>
          <p className="text-2xl font-bold text-teal-600 mt-1">{newOrders.length}</p>
        </div>
        <div className="card p-4 border-l-4 border-amber-400">
          <p className="section-label">En proceso</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{inProgress.length}</p>
        </div>
        <div className="card p-4 border-l-4 border-cream-400">
          <p className="section-label">Completados</p>
          <p className="text-2xl font-bold text-luma-muted mt-1">{done.length}</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="card">
          <EmptyState icon={Store} title="Sin pedidos" description="Los pedidos del portal online aparecerán aquí." />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="section-label mb-3">Nuevos & Pendientes</p>
            <div className="space-y-3">
              {[...newOrders, ...inProgress].length === 0 ? (
                <div className="card p-6 text-center text-[12px] text-luma-faint">Sin pedidos pendientes ✓</div>
              ) : (
                [...newOrders, ...inProgress].map(o => (
                  <OrderCard key={o.id} order={o} onView={openDetail} />
                ))
              )}
            </div>
          </div>
          <div>
            <p className="section-label mb-3">Completados & Cancelados</p>
            <div className="space-y-3">
              {done.length === 0 ? (
                <div className="card p-6 text-center text-[12px] text-luma-faint">Aún no hay pedidos finalizados</div>
              ) : (
                done.map(o => <OrderCard key={o.id} order={o} onView={openDetail} />)
              )}
            </div>
          </div>
        </div>
      )}

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
                  href={buildWhatsAppUrl(detail.customer_phone, buildOrderMessage(detail))}
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
