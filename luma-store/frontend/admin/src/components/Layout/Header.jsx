import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Bell, Menu, X, Calendar, ShoppingBag, Package, Users, CheckCircle } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as svc from '../../api/services'

const PAGE_TITLES = {
  '/':                'Dashboard',
  '/inventario':      'Inventario',
  '/caja':            'Caja',
  '/ventas':          'Ventas',
  '/ventas-rapidas':  'Venta Rapida',
  '/pedidos':         'Pedidos',
  '/clientes':        'Clientes',
  '/reportes':        'Reportes',
  '/configuracion':   'Configuracion',
}

function formatDate() {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }).replace(/^\w/, c => c.toUpperCase())
}

// ── Notification bell panel ────────────────────────────────────────────────────
function NotificationPanel({ onClose }) {
  const navigate = useNavigate()
  const [orders,    setOrders]    = useState([])
  const [alerts,    setAlerts]    = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      svc.getOrders({ status: 'new', page_size: 5 }).catch(() => ({ data: [] })),
      svc.getProducts({ page_size: 100 }).catch(() => ({ data: [] })),
    ]).then(([oRes, pRes]) => {
      const ords = oRes.data?.results ?? oRes.data ?? []
      const prods = pRes.data?.results ?? pRes.data ?? []
      setOrders(Array.isArray(ords) ? ords.slice(0, 5) : [])
      // Alertas de stock bajo
      const stockAlerts = prods.filter(p => (p.total_stock ?? 0) <= (p.min_stock ?? 3) && p.status !== 'inactive')
      setAlerts(stockAlerts.slice(0, 5))
    }).finally(() => setLoading(false))
  }, [])

  const total = orders.length + alerts.length

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-card-md border border-luma-border z-50 overflow-hidden animate-scale-in">
      <div className="px-4 py-3 border-b border-luma-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-teal-500" />
          <span className="text-[13px] font-semibold text-luma-text">Notificaciones</span>
          {total > 0 && (
            <span className="bg-teal-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{total}</span>
          )}
        </div>
        <button onClick={onClose} className="text-luma-faint hover:text-luma-text p-1">
          <X size={13} />
        </button>
      </div>

      {loading ? (
        <div className="px-4 py-6 text-center text-[12px] text-luma-faint">Cargando...</div>
      ) : total === 0 ? (
        <div className="px-4 py-6 text-center">
          <CheckCircle size={24} className="mx-auto text-teal-400 mb-2" />
          <p className="text-[12px] text-luma-muted">Todo al dia</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          {orders.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1">
                <p className="section-label">Pedidos nuevos</p>
              </div>
              {orders.map(o => (
                <button
                  key={o.id}
                  onClick={() => { navigate('/pedidos'); onClose() }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-cream-100 transition-colors text-left"
                >
                  <ShoppingBag size={14} className="text-teal-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-luma-text">Pedido {o.number}</p>
                    <p className="text-[11px] text-luma-faint">{o.customer_name || 'Cliente'} · {o.items?.length || '?'} items</p>
                  </div>
                </button>
              ))}
            </>
          )}
          {alerts.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1 border-t border-luma-border">
                <p className="section-label">Alertas de stock</p>
              </div>
              {alerts.map(p => (
                <button
                  key={p.id}
                  onClick={() => { navigate('/inventario'); onClose() }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-cream-100 transition-colors text-left"
                >
                  <Package size={14} className={`mt-0.5 flex-shrink-0 ${(p.total_stock ?? 0) === 0 ? 'text-red-500' : 'text-amber-500'}`} />
                  <div>
                    <p className="text-[12px] font-semibold text-luma-text">{p.name}</p>
                    <p className="text-[11px] text-luma-faint">
                      Stock: {p.total_stock ?? 0} ud. · Minimo: {p.min_stock ?? 3} ud.
                    </p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-luma-border">
        <button
          onClick={() => { navigate('/pedidos'); onClose() }}
          className="text-[11px] text-teal-600 font-semibold hover:text-teal-700"
        >
          Ver todos los pedidos →
        </button>
      </div>
    </div>
  )
}

// ── Global search ─────────────────────────────────────────────────────────────
function GlobalSearch({ onClose }) {
  const navigate  = useNavigate()
  const inputRef  = useRef(null)
  const [q,       setQ]       = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await svc.getProducts({ search: q.trim(), page_size: 6 })
        setResults(data?.results ?? data ?? [])
      } catch {} finally { setLoading(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  const shortcuts = [
    { label: 'Inventario',    path: '/inventario',  icon: Package },
    { label: 'Pedidos',       path: '/pedidos',     icon: ShoppingBag },
    { label: 'Clientes',      path: '/clientes',    icon: Users },
  ]

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-card-md border border-luma-border z-50 overflow-hidden animate-scale-in">
      <div className="relative">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none" />
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar productos, pedidos..."
          className="w-full pl-10 pr-10 py-3.5 text-[13px] border-b border-luma-border outline-none bg-white"
        />
        <button onClick={onClose} className="absolute right-3 top-1/2 -translate-y-1/2 text-luma-faint hover:text-luma-text p-1">
          <X size={13} />
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {!q && (
          <div className="p-2">
            <p className="text-[10px] text-luma-faint px-2 pb-1 uppercase tracking-wide">Ir a...</p>
            {shortcuts.map(s => (
              <button
                key={s.path}
                onClick={() => { navigate(s.path); onClose() }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-cream-100 text-left"
              >
                <s.icon size={14} className="text-luma-faint" />
                <span className="text-[12px] font-medium text-luma-text">{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {q && loading && (
          <div className="px-4 py-4 text-center text-[12px] text-luma-faint">Buscando...</div>
        )}

        {q && !loading && results.length === 0 && (
          <div className="px-4 py-4 text-center text-[12px] text-luma-faint">Sin resultados para "{q}"</div>
        )}

        {q && results.length > 0 && results.map(p => (
          <button
            key={p.id}
            onClick={() => { navigate('/inventario'); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cream-100 transition-colors text-left border-b border-luma-border last:border-0"
          >
            <Package size={13} className="text-luma-faint flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-luma-text truncate">{p.name}</p>
              <p className="text-[10px] text-luma-faint">Stock: {p.total_stock ?? 0} · {p.category_name || 'Sin categoría'}</p>
            </div>
            <span className="text-[12px] font-bold text-teal-600 flex-shrink-0">${Number(p.price).toLocaleString('es-CO')}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main Header ───────────────────────────────────────────────────────────────
export default function Header({ onMenuToggle, mobileOpen }) {
  const location  = useLocation()
  const title     = PAGE_TITLES[location.pathname] || 'LUMA'
  const [panel,   setPanel]   = useState(null)   // null | 'search' | 'bell'
  const panelRef  = useRef(null)

  // Cerrar panel al hacer clic fuera
  useEffect(() => {
    if (!panel) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setPanel(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [panel])

  // Cerrar panel al cambiar de ruta
  useEffect(() => { setPanel(null) }, [location.pathname])

  return (
    <header className="h-[60px] px-4 md:px-6 flex items-center justify-between border-b border-luma-border bg-white/80 backdrop-blur-sm sticky top-0 z-30">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-xl text-luma-muted hover:bg-cream-200 hover:text-luma-text transition-colors"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <h1 className="text-[17px] font-semibold text-luma-text tracking-tight">{title}</h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1" ref={panelRef}>
        {/* Search */}
        <div className="relative">
          <button
            onClick={() => setPanel(panel === 'search' ? null : 'search')}
            className={`p-2 rounded-xl transition-colors ${
              panel === 'search'
                ? 'bg-teal-50 text-teal-600'
                : 'text-luma-muted hover:bg-cream-200 hover:text-luma-text'
            }`}
            title="Buscar"
          >
            <Search size={16} />
          </button>
          {panel === 'search' && <GlobalSearch onClose={() => setPanel(null)} />}
        </div>

        {/* Date */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-cream-100 rounded-xl mx-1">
          <Calendar size={12} className="text-luma-faint" />
          <span className="text-[11px] text-luma-muted font-medium">{formatDate()}</span>
        </div>

        {/* Bell */}
        <div className="relative">
          <button
            onClick={() => setPanel(panel === 'bell' ? null : 'bell')}
            className={`relative p-2 rounded-xl transition-colors ${
              panel === 'bell'
                ? 'bg-teal-50 text-teal-600'
                : 'text-luma-muted hover:bg-cream-200 hover:text-luma-text'
            }`}
            title="Notificaciones"
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-teal-500 rounded-full" />
          </button>
          {panel === 'bell' && <NotificationPanel onClose={() => setPanel(null)} />}
        </div>
      </div>
    </header>
  )
}
