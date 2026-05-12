import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, CartesianGrid
} from 'recharts'
import {
  ShoppingCart, Package, AlertTriangle,
  CreditCard, Users, ChevronRight, ShoppingBag, RefreshCw, CheckCircle, ArrowRight,
} from 'lucide-react'
import { getDashboard, createPurchaseOrder } from '../api/services'
import { StatCard } from '../components/ui/Card'
import { Badge, StatusBadge } from '../components/ui/Badge'
import { PageLoader, SkeletonCard, ProgressBar, AlertBanner } from '../components/ui/Misc'
import { Button } from '../components/ui/Button'
import Modal from '../components/ui/Modal'

// ── Custom Tooltip for chart ─────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <p className="text-luma-faint text-[10px] mb-1">{label}</p>
      <p className="text-luma-text font-semibold text-sm">
        ${Number(payload[0].value).toLocaleString('es-CO')}
      </p>
    </div>
  )
}

// ── Mini sparkline ────────────────────────────────────────────────────────────
// uid must be unique per instance to avoid SVG gradient ID collision
function Sparkline({ data, positive = true, uid }) {
  const gradId = `spark-${uid}`
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={positive ? '#0D8585' : '#EF4444'} stopOpacity={0.15} />
            <stop offset="95%" stopColor={positive ? '#0D8585' : '#EF4444'} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="total"
          stroke={positive ? '#0D8585' : '#EF4444'}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Urgency config ────────────────────────────────────────────────────────────
function urgencyConfig(urgency) {
  if (urgency === 'out')      return { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700',      label: 'AGOTADO' }
  if (urgency === 'critical') return { dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', label: 'CRÍTICO' }
  return                             { dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',  label: 'STOCK BAJO' }
}

// ── Stock Alerts Panel ────────────────────────────────────────────────────────
function StockAlertsPanel({ alerts, navigate }) {
  const SHOW = 6
  const [expanded, setExpanded] = useState(false)
  if (!alerts?.length) return null
  const visible = expanded ? alerts : alerts.slice(0, SHOW)

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-luma-border">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-amber-500" />
          <h3 className="text-[13px] font-semibold text-luma-text">Alertas de Stock</h3>
          <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-md">
            {alerts.length}
          </span>
        </div>
        <Link to="/inventario" className="text-[11px] text-teal-500 font-medium hover:text-teal-600 flex items-center gap-1">
          Ver inventario <ChevronRight size={12} />
        </Link>
      </div>
      <div className="divide-y divide-luma-border">
        {visible.map((a) => {
          const ug = urgencyConfig(a.urgency)
          return (
            <button
              key={a.variant_id}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cream-50 transition-colors text-left"
              onClick={() => navigate('/inventario', { state: { openProductId: a.product_id } })}
            >
              <div className={`w-2 h-8 rounded-full flex-shrink-0 ${ug.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-luma-text truncate">{a.product_name}</p>
                <p className="text-[10px] text-luma-faint">
                  T: {a.size || '—'} · {a.color || '—'}
                </p>
              </div>
              <div className="text-right flex-shrink-0 mr-2">
                <p className="text-[12px] font-bold text-luma-text">{a.current_stock} ud.</p>
                <p className="text-[10px] text-luma-faint">Mín: {a.min_stock}</p>
              </div>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${ug.badge}`}>
                {ug.label}
              </span>
            </button>
          )
        })}
      </div>
      {alerts.length > SHOW && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full py-2.5 text-[11px] text-teal-500 font-semibold hover:bg-cream-50 transition-colors border-t border-luma-border"
        >
          {expanded ? 'Mostrar menos' : `Ver ${alerts.length - SHOW} alertas más`}
        </button>
      )}
    </div>
  )
}

// ── Live Orders List ──────────────────────────────────────────────────────────
function LiveOrders({ orders }) {
  if (!orders?.length) return (
    <p className="text-[12px] text-luma-faint py-4 text-center">Sin pedidos recientes</p>
  )
  return (
    <div className="space-y-2.5">
      {orders.map((o) => (
        <div key={o.id} className="flex items-center justify-between py-2 border-b border-luma-border last:border-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-cream-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users size={13} className="text-luma-muted" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-luma-text">{o.number}</p>
              <p className="text-[10px] text-luma-faint">{o.customer_name || 'Cliente anónimo'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[12px] font-bold text-luma-text">
              ${Number(o.total).toLocaleString('es-CO')}
            </p>
            <StatusBadge status={o.status} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Purchase Order Modal ──────────────────────────────────────────────────────
function PurchaseOrderModal({ product, onClose }) {
  const navigate = useNavigate()
  const [qty,       setQty]       = useState(10)
  const [note,      setNote]      = useState('')
  const [saving,    setSaving]    = useState(false)
  const [created,   setCreated]   = useState(null)   // OC creada

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await createPurchaseOrder({
        variant:       product.variant_id || undefined,
        product_name:  product.product_name,
        size:          product.size  || '',
        color:         product.color || '',
        requested_qty: qty,
        note,
      })
      setCreated(data)
    } catch {
      // toast global lo captura vía interceptor
    } finally {
      setSaving(false)
    }
  }

  if (created) {
    return (
      <Modal open onClose={onClose} title="Orden de Compra" size="sm">
        <div className="flex flex-col items-center py-2 gap-4 text-center">
          <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center">
            <CheckCircle size={28} className="text-teal-500" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-luma-text">OC creada correctamente</p>
            <p className="text-[12px] font-mono text-teal-600 mt-1">{created.number}</p>
          </div>
          <div className="w-full p-3 bg-cream-100 rounded-xl text-left space-y-1">
            <p className="text-[12px] font-semibold text-luma-text">{created.product_name}</p>
            <p className="text-[11px] text-luma-muted">
              T: {created.size || '—'} / {created.color || '—'} · {created.requested_qty} unidades solicitadas
            </p>
            {note && <p className="text-[11px] text-luma-faint italic">"{note}"</p>}
          </div>
          <div className="flex gap-2 w-full">
            <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              variant="teal" size="sm" className="flex-1"
              icon={ArrowRight}
              onClick={() => { onClose(); navigate('/compras') }}
            >
              Ver en Compras
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title="Crear Orden de Compra" size="sm">
      <div className="space-y-4">
        <div className="p-3 bg-cream-100 rounded-xl">
          <p className="text-[12px] font-semibold text-luma-text">{product.product_name}</p>
          <p className="text-[11px] text-luma-muted mt-0.5">
            T: {product.size || '—'} · {product.color || '—'} · Stock: {product.current_stock} ud.
          </p>
          <p className="text-[11px] text-amber-600 font-semibold mt-1">
            Agotamiento estimado en {product.days_remaining} días
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[12px] font-medium text-luma-text mb-1">Cantidad a solicitar</label>
            <input
              type="number" min="1"
              value={qty}
              onChange={e => setQty(Number(e.target.value))}
              className="input-base w-full"
              required
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-luma-text mb-1">Nota (opcional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              className="input-base w-full h-16 resize-none"
              placeholder="Ej: Urgente, prioridad alta..."
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="teal" size="sm" className="flex-1" icon={ShoppingBag} loading={saving}>
              Crear orden
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

// ── Parsea "YYYY-MM-DD" como fecha local (evita el off-by-one de UTC) ────────
function parseLocalDate(dateStr) {
  return new Date(dateStr + 'T00:00:00')
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [view,    setView]    = useState('monthly') // weekly | monthly
  const [purchaseOrder, setPurchaseOrder] = useState(null)

  const fetchDashboard = useCallback(() => {
    setLoading(true)
    setError(null)
    getDashboard()
      .then(({ data }) => setData(data))
      .catch(() => setError('No se pudo cargar el dashboard. Verifica la conexión e intenta de nuevo.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <PageLoader />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <AlertBanner type="error" className="max-w-md w-full">{error}</AlertBanner>
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchDashboard}>
          Reintentar
        </Button>
      </div>
    )
  }

  const chart    = data?.sales_chart || []
  const lastWeek = chart.slice(-7)
  const chartData = view === 'monthly' ? chart : lastWeek

  const chartFormatted = chartData.map((d) => ({
    ...d,
    label: parseLocalDate(d.date).toLocaleDateString('es-CO', {
      day: '2-digit', month: view === 'monthly' ? 'short' : '2-digit'
    })
  }))

  const salesSpark  = chart.slice(-14)
  const ordersSpark = (data?.orders_chart || []).slice(-14)

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ── Header con botón de recarga ──────────────────── */}
      <div className="flex items-center justify-between">
        <p className="section-label">Resumen del día</p>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-1.5 text-[11px] text-luma-muted hover:text-teal-600 transition-colors"
          title="Actualizar datos"
        >
          <RefreshCw size={13} />
          Actualizar
        </button>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Ventas del día"
          value={`$${Number(data?.today_revenue || 0).toLocaleString('es-CO')}`}
          sub={`${data?.today_sales_count || 0} transacciones`}
          icon={ShoppingCart}
          change={data?.revenue_change ?? undefined}
          chart={salesSpark.length > 0 ? <Sparkline data={salesSpark} uid="sales" /> : null}
        />
        <StatCard
          label="Pedidos nuevos"
          value={data?.new_orders || 0}
          sub="Pendientes por atender"
          icon={Package}
          change={
            data?.new_orders > 0 && data?.yesterday_new_orders > 0
              ? Math.round(
                  ((data.new_orders - data.yesterday_new_orders) / data.yesterday_new_orders) * 100
                )
              : undefined
          }
          chart={ordersSpark.length > 0 ? <Sparkline data={ordersSpark} uid="orders" /> : null}
        />
        <StatCard
          label="Bajo/Agotado"
          value={data?.out_of_stock_count || 0}
          sub={`${data?.low_stock_count || 0} variantes en mínimo`}
          icon={AlertTriangle}
        />
      </div>

      {/* ── Caja del día ──────────────────────────────────── */}
      {data?.cash_session ? (
        <div className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <CreditCard size={18} className="text-teal-500" />
            </div>
            <div>
              <p className="text-[12px] text-luma-muted">Caja abierta — Saldo actual</p>
              <p className="text-xl font-bold text-teal-600">
                ${Number(data.cash_session.current_cash).toLocaleString('es-CO')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-6 text-center">
            <div>
              <p className="text-[10px] text-luma-faint">Ingresos</p>
              <p className="text-[13px] font-semibold text-green-600">
                +${Number(data.cash_session.total_income).toLocaleString('es-CO')}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-luma-faint">Egresos</p>
              <p className="text-[13px] font-semibold text-red-500">
                -${Number(data.cash_session.total_expense).toLocaleString('es-CO')}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-luma-faint">Apertura</p>
              <p className="text-[13px] font-semibold text-luma-text">
                ${Number(data.cash_session.opening_amount).toLocaleString('es-CO')}
              </p>
            </div>
          </div>
          <Link to="/caja" className="btn-outline text-xs py-2 px-4 flex-shrink-0">
            Ver caja
          </Link>
        </div>
      ) : (
        <div className="card p-5 flex items-center gap-4 border-amber-200 bg-amber-50">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <CreditCard size={18} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-amber-800">Caja no abierta</p>
            <p className="text-[12px] text-amber-600">Abre la caja para registrar ventas hoy.</p>
          </div>
          <Link to="/caja" className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-4 py-2 rounded-xl transition-colors flex-shrink-0">
            Abrir caja
          </Link>
        </div>
      )}

      {/* ── Chart + Alerts (2 cols en desktop) ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Gráfica de ventas */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold text-luma-text">Trayectoria de Ventas</h3>
              <p className="hidden sm:block text-[11px] text-luma-muted mt-0.5">
                Ingresos diarios en los últimos {view === 'monthly' ? '30' : '7'} días
              </p>
            </div>
            <div className="flex gap-1 bg-cream-200 p-0.5 rounded-lg">
              {['weekly', 'monthly'].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200
                    ${view === v ? 'bg-white text-teal-600 shadow-sm' : 'text-luma-muted'}`}
                >
                  {v === 'weekly' ? 'Semanal' : 'Mensual'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartFormatted} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#A1A1AA' }}
                axisLine={false}
                tickLine={false}
                interval={view === 'monthly' ? 4 : 0}
              />
              <YAxis
                width={38}
                tick={{ fontSize: 10, fill: '#A1A1AA' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(13,133,133,0.06)', radius: 4 }} />
              <Bar dataKey="total" fill="#0D8585" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Columna derecha: alertas + pedidos recientes */}
        <div className="space-y-4">
          {data?.stock_alerts?.length > 0 && (
            <StockAlertsPanel alerts={data.stock_alerts} navigate={navigate} />
          )}

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold text-luma-text">Pedidos recientes</h3>
              <Link to="/pedidos" className="text-[11px] text-teal-500 font-medium hover:text-teal-600 flex items-center gap-1">
                Ver todos <ChevronRight size={12} />
              </Link>
            </div>
            <LiveOrders orders={data?.recent_orders || []} />
          </div>
        </div>
      </div>

      {/* ── Top Productos ──────────────────────────────────── */}
      {data?.top_products?.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-semibold text-luma-text">Top Productos — Últimos 30 días</h3>
            <Link to="/inventario" className="text-[11px] text-teal-500 font-medium hover:text-teal-600 flex items-center gap-1">
              Ver catálogo <ChevronRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="luma-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Unidades</th>
                  <th>Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {data.top_products.map((p, i) => (
                  <tr key={p.product_id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 gradient-teal-soft rounded-md flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-teal-600">#{i + 1}</span>
                        </div>
                        <span className="font-medium text-[13px]">{p.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge-gray text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wide">
                        {p.category}
                      </span>
                    </td>
                    <td>
                      <span className="font-semibold text-teal-600">{p.units_sold}</span>
                      <span className="text-luma-faint text-[11px] ml-1">ud.</span>
                    </td>
                    <td>
                      <span className="font-semibold">${Number(p.revenue).toLocaleString('es-CO')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Predicción de Reabastecimiento ────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-luma-text">Predicción de Reabastecimiento</h3>
            <p className="hidden sm:block text-[11px] text-luma-muted mt-0.5">
              Variantes con menos de 10 días de stock estimado según ritmo de ventas
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {data?.pending_purchases > 0 && (
              <Link
                to="/compras"
                className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <ShoppingBag size={11} />
                {data.pending_purchases} OC pendiente{data.pending_purchases !== 1 ? 's' : ''}
              </Link>
            )}
            {data?.restock_alerts?.length > 0 && (
              <Badge variant="amber" dot>⚠ Atención</Badge>
            )}
          </div>
        </div>

        {!data?.restock_alerts?.length ? (
          <div className="py-6 text-center">
            <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Package size={18} className="text-teal-400" />
            </div>
            <p className="text-[13px] font-medium text-luma-text">Todo bajo control</p>
            <p className="text-[12px] text-luma-faint mt-0.5">
              Ninguna variante necesita reabastecimiento en los próximos 10 días.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.restock_alerts.slice(0, 5).map((a) => (
              <div
                key={a.variant_id}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-cream-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[12px] font-semibold text-luma-text truncate">{a.product_name}</p>
                    <span className="text-[10px] text-luma-faint">T: {a.size || '—'} / {a.color || '—'}</span>
                  </div>
                  <p className={`text-[11px] font-bold mt-0.5 ${
                    a.days_remaining <= 3 ? 'text-red-600'
                    : a.days_remaining <= 7 ? 'text-orange-600'
                    : 'text-amber-600'
                  }`}>
                    Se estima agotamiento en {a.days_remaining} días
                  </p>
                  <ProgressBar value={a.days_remaining} max={10} className="mt-1.5" />
                </div>

                {a.has_pending_oc ? (
                  /* Ya existe una OC activa — mostrar estado en vez de botón crear */
                  <Link
                    to="/compras"
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-700 rounded-xl text-[11px] font-semibold transition-colors hover:bg-amber-100"
                  >
                    <CheckCircle size={11} />
                    OC {a.pending_oc_number}
                  </Link>
                ) : (
                  /* Sin OC activa — permitir crear */
                  <button
                    onClick={() => setPurchaseOrder(a)}
                    className="flex-shrink-0 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <ShoppingBag size={11} />
                    Crear orden
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {purchaseOrder && (
        <PurchaseOrderModal product={purchaseOrder} onClose={() => setPurchaseOrder(null)} />
      )}
    </div>
  )
}
