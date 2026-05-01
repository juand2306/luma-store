import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Edit2, Tag, Package, AlertTriangle, TrendingUp,
  ArrowUpCircle, ArrowDownCircle, RefreshCw, BarChart2,
  ChevronLeft, ChevronRight, Box, Eye, EyeOff
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { Button } from '../ui/Button'
import { Badge, StatusBadge, CategoryBadge } from '../ui/Badge'
import * as svc from '../../api/services'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`
const pct = (n) => `${Number((n || 0) * 100).toFixed(1)}%`

const MOV_LABELS = {
  entry:    { label: 'Entrada',    cls: 'text-teal-600',   bg: 'bg-teal-50',   icon: ArrowUpCircle   },
  sale:     { label: 'Venta',      cls: 'text-blue-600',   bg: 'bg-blue-50',   icon: ArrowDownCircle },
  return:   { label: 'Devolución', cls: 'text-amber-600',  bg: 'bg-amber-50',  icon: ArrowUpCircle   },
  adjust:   { label: 'Ajuste',     cls: 'text-purple-600', bg: 'bg-purple-50', icon: RefreshCw       },
  swap_in:  { label: 'Cambio +',   cls: 'text-teal-600',   bg: 'bg-teal-50',   icon: ArrowUpCircle   },
  swap_out: { label: 'Cambio −',   cls: 'text-red-500',    bg: 'bg-red-50',    icon: ArrowDownCircle },
}

// ── Image Gallery ─────────────────────────────────────────────────────────────
function ImageGallery({ images }) {
  const [active, setActive] = useState(0)
  const prev = () => setActive(i => Math.max(0, i - 1))
  const next = () => setActive(i => Math.min(images.length - 1, i + 1))

  if (!images || images.length === 0) {
    return (
      <div className="w-full h-56 bg-cream-100 rounded-2xl flex flex-col items-center justify-center gap-2">
        <Package size={36} className="text-luma-faint" />
        <p className="text-[12px] text-luma-faint">Sin imágenes</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative w-full h-56 bg-cream-100 rounded-2xl overflow-hidden group">
        <img
          src={images[active]?.image}
          alt=""
          className="w-full h-full object-contain"
          onError={e => { e.target.style.display = 'none' }}
        />
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              disabled={active === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={next}
              disabled={active === images.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
            >
              <ChevronRight size={16} />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === active ? 'bg-teal-500 w-3' : 'bg-white/60'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id ?? i}
              onClick={() => setActive(i)}
              className={`w-14 h-14 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                i === active ? 'border-teal-500' : 'border-luma-border hover:border-teal-300'
              }`}
            >
              <img src={img.image} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sales Mini-Chart ──────────────────────────────────────────────────────────
function SalesChart({ productId }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!productId) return
    const now = new Date()
    svc.getMovements({ 'variant__product': productId, type: 'sale', page_size: 200 })
      .then(({ data: res }) => {
        const movs = res?.results ?? res ?? []
        // Build last 30 days map
        const map = {}
        for (let d = 29; d >= 0; d--) {
          const dt = new Date(now)
          dt.setDate(dt.getDate() - d)
          const key = dt.toISOString().slice(0, 10)
          map[key] = 0
        }
        movs.forEach(m => {
          const key = m.created_at?.slice(0, 10)
          if (key in map) map[key] += Math.abs(m.quantity)
        })
        setData(
          Object.entries(map).map(([date, units]) => ({
            date: new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
            units,
          }))
        )
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [productId])

  if (loading) return <div className="h-28 bg-cream-100 rounded-xl animate-pulse" />

  const total = data.reduce((s, d) => s + d.units, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-semibold text-luma-text">Ventas últimos 30 días</p>
        <span className="text-[12px] font-bold text-teal-600">{total} ud. vendidas</span>
      </div>
      {total === 0 ? (
        <div className="h-28 bg-cream-100 rounded-xl flex items-center justify-center">
          <p className="text-[12px] text-luma-faint">Sin ventas registradas en este período</p>
        </div>
      ) : (
        <div className="h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D8585" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#0D8585" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#A1A1AA' }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fontSize: 9, fill: '#A1A1AA' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #E4E0D9', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                formatter={(v) => [`${v} ud.`, 'Vendidas']}
              />
              <Area type="monotone" dataKey="units" stroke="#0D8585" strokeWidth={2} fill="url(#tealGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Movement History ──────────────────────────────────────────────────────────
function MovementHistory({ productId }) {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const load = (type = '') => {
    setLoading(true)
    const params = { 'variant__product': productId, page_size: 50 }
    if (type) params.type = type
    svc.getMovements(params)
      .then(({ data }) => setMovements(data?.results ?? data ?? []))
      .catch(() => setMovements([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(filter) }, [productId, filter])

  const filtered = movements

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-luma-text">Historial de movimientos</p>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="text-[11px] border border-luma-border rounded-lg px-2 py-1 bg-white text-luma-muted outline-none focus:border-teal-500"
        >
          <option value="">Todos</option>
          <option value="entry">Entradas</option>
          <option value="sale">Ventas</option>
          <option value="return">Devoluciones</option>
          <option value="adjust">Ajustes</option>
          <option value="swap_in">Cambio +</option>
          <option value="swap_out">Cambio −</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[1,2,3].map(i => <div key={i} className="h-12 bg-cream-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center bg-cream-100 rounded-xl">
          <p className="text-[12px] text-luma-faint">Sin movimientos registrados</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {filtered.map(m => {
            const mt = MOV_LABELS[m.type] || { label: m.type, cls: 'text-luma-muted', bg: 'bg-cream-100', icon: Box }
            const Icon = mt.icon
            const variantLabel = m.variant_display || ''
            return (
              <div key={m.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${mt.bg}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/60`}>
                  <Icon size={13} className={mt.cls} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold ${mt.cls}`}>{mt.label}</span>
                    {variantLabel && (
                      <span className="text-[10px] text-luma-faint truncate">{variantLabel}</span>
                    )}
                  </div>
                  {m.note && <p className="text-[10px] text-luma-faint truncate">{m.note}</p>}
                  <p className="text-[10px] text-luma-faint">
                    {new Date(m.created_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {m.created_by_name && ` · ${m.created_by_name}`}
                  </p>
                </div>
                <span className={`text-[14px] font-bold flex-shrink-0 ${m.quantity > 0 ? 'text-teal-600' : 'text-red-500'}`}>
                  {m.quantity > 0 ? '+' : ''}{m.quantity}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Variants Table ────────────────────────────────────────────────────────────
function VariantsTable({ variants, minStock, loading }) {
  if (loading) {
    return (
      <div className="space-y-1.5">
        {[1,2,3].map(i => <div key={i} className="h-10 bg-cream-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }
  const active = (variants || []).filter(v => v.is_active)
  if (active.length === 0) {
    return <p className="text-[12px] text-luma-faint py-4 text-center bg-cream-100 rounded-xl">Sin variantes configuradas</p>
  }
  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
      {active.map(v => {
        const isOut = v.stock === 0
        const isLow = !isOut && v.stock <= (minStock || 3)
        return (
          <div key={v.id} className="flex items-center justify-between px-3 py-2.5 bg-cream-100 rounded-xl">
            <div>
              <p className="text-[12px] font-semibold text-luma-text">
                {[v.size, v.color].filter(Boolean).join(' / ') || 'Variante única'}
              </p>
              <p className="text-[10px] text-luma-faint font-mono">{v.sku}</p>
            </div>
            <div className="text-right">
              <span className={`text-[13px] font-bold ${isOut ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-teal-600'}`}>
                {v.stock} ud.
              </span>
              {isOut && <p className="text-[9px] font-bold text-red-500 uppercase">Agotado</p>}
              {isLow && !isOut && <p className="text-[9px] font-bold text-amber-500 uppercase">Bajo</p>}
              {v.price && <p className="text-[10px] text-luma-faint">{fmt(v.price)}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ProductDetailModal({ product: initialProduct, categories, onEdit, onVariants, onMovement, onClose }) {
  const [product, setProduct] = useState(initialProduct)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('info')

  useEffect(() => {
    setLoading(true)
    svc.getProduct(initialProduct.id)
      .then(({ data }) => setProduct(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [initialProduct.id])

  const catName = categories?.find(c => c.id === product.category)?.name || product.category_name || '—'
  const totalStock = product.total_stock ?? (product.variants || []).reduce((s, v) => s + v.stock, 0)
  const margin = Number(product.margin || 0)  // Ya viene como porcentaje del backend (ej: 35.5)

  const tabs = [
    { key: 'info',       label: 'Información' },
    { key: 'variants',   label: 'Variantes' },
    { key: 'movements',  label: 'Movimientos' },
    { key: 'sales',      label: 'Ventas' },
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] animate-scale-in overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-luma-border flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <StatusBadge status={product.status} />
              {!product.is_visible && <Badge variant="gray"><EyeOff size={10} className="inline mr-0.5" />Oculto en tienda</Badge>}
              {product.is_featured && <Badge variant="amber">Destacado</Badge>}
            </div>
            <h2 className="text-[17px] font-bold text-luma-text leading-tight truncate">{product.name}</h2>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[11px] text-luma-faint font-mono">SKU: {product.sku_base || '—'}</span>
              {catName && catName !== '—' && <CategoryBadge>{catName}</CategoryBadge>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex-shrink-0 p-1.5 rounded-lg text-luma-faint hover:text-luma-text hover:bg-cream-200 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 px-6 pt-3 border-b border-luma-border flex-shrink-0 bg-white">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-[12px] font-semibold rounded-t-xl transition-all border-b-2 -mb-px ${
                activeTab === t.key
                  ? 'text-teal-600 border-teal-500 bg-teal-50'
                  : 'text-luma-muted border-transparent hover:text-luma-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* TAB: Información */}
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <ImageGallery images={product.images || []} />
                {product.description && (
                  <div className="bg-cream-50 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-luma-faint uppercase tracking-wide mb-1">Descripción</p>
                    <p className="text-[13px] text-luma-muted leading-relaxed">{product.description}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {/* KPI cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-cream-100 rounded-xl p-3">
                    <p className="text-[10px] text-luma-faint uppercase tracking-wide">Costo</p>
                    <p className="text-[15px] font-bold text-luma-text mt-0.5">{fmt(product.cost)}</p>
                  </div>
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
                    <p className="text-[10px] text-teal-600 uppercase tracking-wide">Precio venta</p>
                    <p className="text-[15px] font-bold text-teal-700 mt-0.5">{fmt(product.price)}</p>
                  </div>
                  <div className={`rounded-xl p-3 ${margin > 0 ? 'bg-green-50 border border-green-200' : 'bg-cream-100'}`}>
                    <p className="text-[10px] text-luma-faint uppercase tracking-wide">Margen</p>
                    <p className={`text-[15px] font-bold mt-0.5 ${margin > 0 ? 'text-green-600' : 'text-luma-muted'}`}>
                      {margin.toFixed(1)}%
                    </p>
                  </div>
                  <div className={`rounded-xl p-3 border ${totalStock === 0 ? 'bg-red-50 border-red-200' : totalStock <= (product.min_stock || 3) ? 'bg-amber-50 border-amber-200' : 'bg-teal-50 border-teal-200'}`}>
                    <p className="text-[10px] text-luma-faint uppercase tracking-wide">Stock total</p>
                    <p className={`text-[15px] font-bold mt-0.5 ${totalStock === 0 ? 'text-red-500' : totalStock <= (product.min_stock || 3) ? 'text-amber-500' : 'text-teal-600'}`}>
                      {totalStock} ud.
                    </p>
                  </div>
                </div>

                {/* Alert config */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={13} className="text-amber-500" />
                    <p className="text-[12px] font-semibold text-amber-700">Alerta de stock</p>
                  </div>
                  <p className="text-[12px] text-amber-600">
                    Se activa cuando baje de <strong>{product.min_stock || 3} unidades</strong>
                  </p>
                  {totalStock === 0 && <p className="text-[11px] text-red-600 font-bold mt-1">🔴 Producto agotado</p>}
                  {totalStock > 0 && totalStock <= (product.min_stock || 3) && (
                    <p className="text-[11px] text-amber-700 font-bold mt-1">⚡ Stock por debajo del umbral</p>
                  )}
                </div>

                {/* Meta */}
                <div className="space-y-1.5 text-[12px]">
                  {product.created_at && (
                    <div className="flex items-center justify-between py-1.5 border-b border-luma-border">
                      <span className="text-luma-faint">Creado</span>
                      <span className="text-luma-text font-medium">
                        {new Date(product.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1.5 border-b border-luma-border">
                    <span className="text-luma-faint">Variantes activas</span>
                    <span className="text-luma-text font-medium">{(product.variants || []).filter(v => v.is_active).length}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-luma-faint">Visible en tienda</span>
                    <span className={`font-medium ${product.is_visible ? 'text-teal-600' : 'text-luma-muted'}`}>
                      {product.is_visible ? 'Sí' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Variantes */}
          {activeTab === 'variants' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-semibold text-luma-text">Stock por variante</p>
                  <p className="text-[12px] text-luma-muted mt-0.5">{(product.variants || []).filter(v => v.is_active).length} variantes activas · {totalStock} ud. en total</p>
                </div>
                <Button variant="outline" size="sm" icon={Tag} onClick={() => { onVariants(product); onClose() }}>
                  Gestionar
                </Button>
              </div>
              <VariantsTable variants={product.variants} minStock={product.min_stock} loading={loading} />
            </div>
          )}

          {/* TAB: Movimientos */}
          {activeTab === 'movements' && (
            <MovementHistory productId={initialProduct.id} />
          )}

          {/* TAB: Ventas */}
          {activeTab === 'sales' && (
            <div className="space-y-5">
              <SalesChart productId={initialProduct.id} />
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-cream-100 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-luma-faint uppercase tracking-wide">Precio venta</p>
                  <p className="text-[17px] font-bold text-luma-text mt-1">{fmt(product.price)}</p>
                </div>
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-teal-600 uppercase tracking-wide">Margen</p>
                  <p className="text-[17px] font-bold text-teal-700 mt-1">{margin.toFixed(1)}%</p>
                </div>
                <div className="bg-cream-100 rounded-xl p-4 text-center">
                  <p className="text-[10px] text-luma-faint uppercase tracking-wide">Stock actual</p>
                  <p className={`text-[17px] font-bold mt-1 ${totalStock === 0 ? 'text-red-500' : 'text-luma-text'}`}>{totalStock} ud.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-luma-border flex-shrink-0 bg-cream-50 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" icon={Box} onClick={() => { onMovement(product); onClose() }}>
              Registrar movimiento
            </Button>
            <Button variant="outline" size="sm" icon={Tag} onClick={() => { onVariants(product); onClose() }}>
              Variantes
            </Button>
          </div>
          <Button variant="teal" size="sm" icon={Edit2} onClick={() => { onEdit(product); onClose() }}>
            Editar producto
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
