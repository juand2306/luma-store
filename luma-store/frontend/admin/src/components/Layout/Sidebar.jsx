import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/authContext'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Package, ShoppingCart, CreditCard,
  Users, BarChart2, Settings, LogOut, ChevronRight,
  FileDown, Store, Zap, ShoppingBag,
} from 'lucide-react'
import { downloadFile } from '../../utils/downloadFile'
import { getStoreConfig } from '../../api/services'

// roles: qué roles pueden ver este ítem. Si no se define = todos los autenticados
const NAV_ITEMS = [
  { to: '/',               icon: LayoutDashboard, label: 'Dashboard',     exact: true },
  { to: '/inventario',     icon: Package,         label: 'Inventario',    roles: ['owner','admin'] },
  { to: '/caja',           icon: CreditCard,      label: 'Caja',          roles: ['owner','admin'] },
  { to: '/ventas',         icon: ShoppingCart,    label: 'Ventas',        roles: ['owner','admin'] },
  { to: '/ventas-rapidas', icon: Zap,             label: 'Venta Rápida',  roles: ['owner','admin','seller'] },
  { to: '/pedidos',        icon: Store,           label: 'Pedidos',       roles: ['owner','admin'] },
  { to: '/compras',        icon: ShoppingBag,     label: 'Compras',       roles: ['owner','admin'] },
  { to: '/clientes',       icon: Users,           label: 'Clientes',      roles: ['owner','admin'] },
  { to: '/reportes',       icon: BarChart2,       label: 'Reportes',      roles: ['owner','admin','viewer'] },
  { to: '/configuracion',  icon: Settings,        label: 'Configuración', roles: ['owner'] },
]

function NavItem({ item, onClick }) {
  const location = useLocation()
  const isActive = item.exact
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to)

  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={`nav-item group ${isActive ? 'nav-item-active' : ''}`}
    >
      <item.icon
        size={17}
        className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-110
          ${isActive ? 'text-teal-500' : 'text-luma-faint'}`}
      />
      <span className="text-[13px] font-medium">{item.label}</span>
      {isActive && (
        <ChevronRight size={12} className="ml-auto text-teal-400 opacity-60" />
      )}
    </NavLink>
  )
}

export default function Sidebar({ mobileOpen, onClose }) {
  const { user, logout } = useAuth()
  const [exporting, setExporting] = useState(false)
  const [storeInfo, setStoreInfo] = useState({ name: 'LUMA', logo: null })

  useEffect(() => {
    getStoreConfig()
      .then(r => setStoreInfo({ name: r.data.name || 'LUMA', logo: r.data.logo || null }))
      .catch(() => {})
  }, [])

  const handleExport = async () => {
    setExporting(true)
    try {
      const filename = `reporte-ventas-${new Date().toISOString().split('T')[0]}.xlsx`
      await downloadFile('/api/v1/reports/export/sales/', { file_format: 'xlsx', days: 30 }, filename)
      toast.success('Reporte descargado')
    } catch (err) {
      console.error('[Export error]', err)
      const msg = err?.status
        ? `HTTP ${err.status}: ${err.message}`
        : String(err?.message || err)
      toast.error(msg, { duration: 8000 })
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand */}
        <div className="px-5 pt-6 pb-4 border-b border-luma-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-cream-200">
              {storeInfo.logo ? (
                <img
                  src={storeInfo.logo}
                  alt={storeInfo.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full gradient-teal flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {storeInfo.name?.[0]?.toUpperCase() || 'L'}
                  </span>
                </div>
              )}
            </div>
            <div>
              <p className="text-[13px] font-bold text-luma-text tracking-tight leading-none">{storeInfo.name}</p>
              <p className="text-[10px] text-luma-faint mt-0.5 leading-none">Admin Console</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="section-label px-3 mb-3">Menú principal</p>
          {NAV_ITEMS
            .filter(item => !item.roles || item.roles.includes(user?.role))
            .map((item) => (
              <NavItem key={item.to} item={item} onClick={onClose} />
            ))}
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-4 space-y-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-teal w-full flex items-center justify-center gap-2 text-xs py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {exporting
              ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <FileDown size={14} />}
            <span>{exporting ? 'Generando...' : 'Generar Reporte'}</span>
          </button>

          {/* User info */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-cream-200 cursor-pointer group transition-colors">
            <div className="w-7 h-7 gradient-teal rounded-lg flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {user?.first_name?.[0] || user?.username?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-luma-text truncate leading-none">
                {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
              </p>
              <p className="text-[10px] text-luma-faint mt-0.5 leading-none capitalize">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-luma-faint hover:text-red-500 p-1"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
