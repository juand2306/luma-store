import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Search, Bell, Menu, X, Calendar, ShoppingBag, Package,
  Users, CheckCircle, LogOut, User, ChevronDown,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/authContext'
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
  '/perfil':          'Mi perfil',
}

const ROLE_LABELS = {
  owner:  'Propietario',
  admin:  'Administrador',
  seller: 'Vendedor',
  viewer: 'Visualizador',
}

function formatDate() {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }).replace(/^\w/, c => c.toUpperCase())
}

// ── Notification bell panel ────────────────────────────────────────────────────
function NotificationPanel({ onClose, onCountUpdate }) {
  const navigate = useNavigate()
  const [orders,    setOrders]    = useState([])
  const [alerts,    setAlerts]    = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      svc.getOrders({ status: 'new', page_size: 5 }).catch(() => ({ data: [] })),
      // Usar el filtro low_stock=true en lugar de volcar 100 productos
      svc.getProducts({ low_stock: 'true', page_size: 10 }).catch(() => ({ data: [] })),
    ]).then(([oRes, pRes]) => {
      const ords = oRes.data?.results ?? oRes.data ?? []
      const prods = pRes.data?.results ?? pRes.data ?? []
      setOrders(Array.isArray(ords) ? ords.slice(0, 5) : [])
      setAlerts(Array.isArray(prods) ? prods.slice(0, 5) : [])
    }).finally(() => setLoading(false))
  }, [])

  const total = orders.length + alerts.length

  // Propagar conteo actualizado al Header para que el badge sea preciso
  useEffect(() => {
    if (!loading) onCountUpdate?.(total)
  }, [loading, total, onCountUpdate])

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
                  onClick={() => { navigate('/inventario', { state: { openProductId: p.id } }); onClose() }}
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

// ── User dropdown menu ────────────────────────────────────────────────────────
function UserMenu({ user, onClose, onLogout }) {
  const navigate = useNavigate()

  const initials = user?.first_name
    ? `${user.first_name[0]}${user.last_name?.[0] || ''}`.toUpperCase()
    : user?.username?.[0]?.toUpperCase() || 'U'

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.username

  return (
    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-card-md border border-luma-border z-50 overflow-hidden animate-scale-in">
      {/* User info */}
      <div className="px-4 py-3 border-b border-luma-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 gradient-teal rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-luma-text truncate leading-tight">{displayName}</p>
            <p className="text-[11px] text-luma-faint mt-0.5 capitalize">{ROLE_LABELS[user?.role] || user?.role}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-1.5 space-y-0.5">
        <button
          onClick={() => { navigate('/perfil'); onClose() }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-cream-100 transition-colors text-left"
        >
          <User size={14} className="text-luma-faint flex-shrink-0" />
          <span className="text-[13px] text-luma-text">Mi perfil</span>
        </button>
        <button
          onClick={() => { onClose(); onLogout() }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors text-left"
        >
          <LogOut size={14} className="text-red-400 flex-shrink-0" />
          <span className="text-[13px] text-red-500">Cerrar sesión</span>
        </button>
      </div>
    </div>
  )
}

// ── Main Header ───────────────────────────────────────────────────────────────
export default function Header({ onMenuToggle, mobileOpen }) {
  const location  = useLocation()
  const title     = PAGE_TITLES[location.pathname] || 'LUMA'
  const { user, logout } = useAuth()
  const [panel,      setPanel]      = useState(null)   // null | 'search' | 'bell' | 'user'
  const [notifCount, setNotifCount] = useState(0)
  const panelRef  = useRef(null)

  // Polling ligero: cuenta pedidos nuevos + alertas de stock cada 90 s
  const fetchCount = useCallback(async () => {
    try {
      const [oRes, sRes] = await Promise.all([
        svc.getOrders({ status: 'new', page_size: 1 }).catch(() => ({ data: {} })),
        // Usar el endpoint de stats para obtener el conteo de stock bajo sin cargar productos
        svc.getProductStats({}).catch(() => ({ data: {} })),
      ])
      const newOrders = oRes.data?.count ?? (oRes.data?.results?.length ?? 0)
      const stats     = sRes.data || {}
      const alerts    = (stats.low_stock ?? 0) + (stats.out_of_stock ?? 0)
      setNotifCount(newOrders + alerts)
    } catch {}
  }, [])

  useEffect(() => {
    fetchCount()
    const id = setInterval(fetchCount, 90_000)
    return () => clearInterval(id)
  }, [fetchCount])

  const initials = user?.first_name
    ? `${user.first_name[0]}${user.last_name?.[0] || ''}`.toUpperCase()
    : user?.username?.[0]?.toUpperCase() || 'U'

  const shortName = user?.first_name || user?.username || ''

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
            {notifCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-teal-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none pointer-events-none">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            ) : (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-luma-border rounded-full" />
            )}
          </button>
          {panel === 'bell' && (
            <NotificationPanel
              onClose={() => setPanel(null)}
              onCountUpdate={setNotifCount}
            />
          )}
        </div>

        {/* User */}
        <div className="relative ml-1">
          <button
            onClick={() => setPanel(panel === 'user' ? null : 'user')}
            className={`flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-xl transition-colors ${
              panel === 'user'
                ? 'bg-teal-50'
                : 'hover:bg-cream-200'
            }`}
          >
            <div className="w-7 h-7 gradient-teal rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-[12px] font-semibold text-luma-text leading-none">{shortName}</p>
              <p className="text-[10px] text-luma-faint capitalize mt-0.5 leading-none">
                {ROLE_LABELS[user?.role] || user?.role}
              </p>
            </div>
            <ChevronDown size={12} className={`hidden md:block text-luma-faint transition-transform ${panel === 'user' ? 'rotate-180' : ''}`} />
          </button>
          {panel === 'user' && (
            <UserMenu user={user} onClose={() => setPanel(null)} onLogout={logout} />
          )}
        </div>
      </div>
    </header>
  )
}
