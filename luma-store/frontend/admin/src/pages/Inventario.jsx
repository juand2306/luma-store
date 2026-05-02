import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Plus, Search, Filter, RefreshCw,
  Package, AlertTriangle, MoreHorizontal,
  Edit2, Trash2, Eye, EyeOff, Tag, Box, TrendingDown, ShoppingBag,
  Upload, Copy, PowerOff, Zap, X, ChevronDown
} from 'lucide-react'
import api from '../api/client'

import { Button } from '../components/ui/Button'
import { Badge, StatusBadge, CategoryBadge } from '../components/ui/Badge'
import { Input, Select } from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { PageLoader, SkeletonRow, EmptyState, ProgressBar, ConfirmDialog } from '../components/ui/Misc'
import * as svc from '../api/services'
import ProductForm from '../components/inventory/ProductForm'
import ProductDetailModal from '../components/inventory/ProductDetailModal'
import VariantManager from '../components/inventory/VariantManager'
import StockMovementForm from '../components/inventory/StockMovementForm'
import CsvImportModal from '../components/inventory/CsvImportModal'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n).toLocaleString('es-CO')}`

// ── Stock level color ─────────────────────────────────────────────────────────
function stockLevel(stock, min) {
  if (stock === 0)        return { level: 'out', label: 'Agotado', cls: 'text-red-500' }
  if (stock <= min)       return { level: 'low', label: 'Bajo',    cls: 'text-amber-500' }
  return                         { level: '',    label: 'En stock',cls: 'text-teal-600' }
}

// ── Product Row ───────────────────────────────────────────────────────────────
function ProductRow({ product, categories, onView, onEdit, onVariants, onMovement, onToggleVisible, onToggleStatus, onDuplicate, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const sl = stockLevel(product.total_stock, product.min_stock || 3)
  const catName = categories.find(c => c.id === product.category)?.name || '—'
  const closeMenu = () => setMenuOpen(false)

  return (
    <tr
      className={`group cursor-pointer transition-colors ${product.status === 'inactive' ? 'opacity-60 bg-cream-100/60' : ''}`}
      onClick={() => onView(product)}
    >
      {/* Producto */}
      <td>
        <div className="flex items-center gap-3">
          {product.main_image ? (
            <img src={product.main_image} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-luma-border" />
          ) : (
            <div className="w-10 h-10 bg-cream-200 rounded-xl flex items-center justify-center flex-shrink-0">
              <Package size={14} className="text-luma-faint" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-luma-text truncate max-w-[180px]">{product.name}</p>
            <p className="text-[11px] text-luma-faint font-mono">{product.sku_base}</p>
          </div>
        </div>
      </td>

      {/* Categoría */}
      <td><CategoryBadge>{catName}</CategoryBadge></td>

      {/* Variantes activas */}
      <td className="text-center">
        <span className="text-[13px] font-semibold text-luma-text">{product.active_variants_count ?? '—'}</span>
      </td>

      {/* Stock */}
      <td className="w-32">
        <div>
          <span className={`text-[13px] font-semibold ${sl.cls}`}>{product.total_stock} ud.</span>
          <ProgressBar value={product.total_stock} max={Math.max(product.total_stock, (product.min_stock || 3) * 5)} className="mt-1" />
        </div>
      </td>

      {/* Precio */}
      <td className="font-semibold text-[13px]">{fmt(product.price)}</td>

      {/* Estado */}
      <td><StatusBadge status={product.status} /></td>

      {/* Visible en portal */}
      <td className="text-center">
        {product.is_visible
          ? <Eye size={14} className="text-teal-500 mx-auto" title="Visible" />
          : <EyeOff size={14} className="text-luma-faint mx-auto" title="Oculto" />}
      </td>

      {/* Acciones */}
      <td onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onView(product)} className="p-1.5 rounded-lg hover:bg-cream-200 text-luma-muted hover:text-teal-600 transition-colors" title="Ver detalle">
            <Eye size={13} />
          </button>
          <button onClick={() => onEdit(product)} className="p-1.5 rounded-lg hover:bg-cream-200 text-luma-muted hover:text-teal-600 transition-colors" title="Editar">
            <Edit2 size={13} />
          </button>
          <button onClick={() => onVariants(product)} className="p-1.5 rounded-lg hover:bg-cream-200 text-luma-muted hover:text-teal-600 transition-colors" title="Variantes">
            <Tag size={13} />
          </button>
          <button onClick={() => onMovement(product)} className="p-1.5 rounded-lg hover:bg-cream-200 text-luma-muted hover:text-teal-600 transition-colors" title="Registrar movimiento">
            <Box size={13} />
          </button>
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 rounded-lg hover:bg-cream-200 text-luma-muted transition-colors">
              <MoreHorizontal size={13} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 w-52 bg-white border border-luma-border rounded-xl shadow-card-md z-20 py-1 animate-scale-in">
                <button onClick={() => { onToggleVisible(product); closeMenu() }}
                  className="w-full text-left px-4 py-2 text-[12px] hover:bg-cream-100 text-luma-text flex items-center gap-2">
                  {product.is_visible ? <EyeOff size={12} /> : <Eye size={12} />}
                  {product.is_visible ? 'Ocultar en tienda' : 'Publicar en tienda'}
                </button>
                <button onClick={() => { onToggleStatus(product); closeMenu() }}
                  className="w-full text-left px-4 py-2 text-[12px] hover:bg-cream-100 text-luma-text flex items-center gap-2">
                  {product.status === 'inactive' ? <Zap size={12} className="text-teal-500" /> : <PowerOff size={12} className="text-amber-500" />}
                  {product.status === 'inactive' ? 'Activar producto' : 'Desactivar producto'}
                </button>
                <button onClick={() => { onDuplicate(product); closeMenu() }}
                  className="w-full text-left px-4 py-2 text-[12px] hover:bg-cream-100 text-luma-text flex items-center gap-2">
                  <Copy size={12} /> Duplicar producto
                </button>
                <hr className="my-1 border-luma-border" />
                <button onClick={() => { onDelete(product); closeMenu() }}
                  className="w-full text-left px-4 py-2 text-[12px] hover:bg-red-50 text-red-600 flex items-center gap-2">
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Inventario() {
  const location = useLocation()

  const [products,   setProducts]   = useState([])
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,        setSearch]        = useState('')
  const [filterCat,     setFilterCat]     = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')
  const [filterVisible, setFilterVisible] = useState('') // '' | 'visible' | 'hidden'
  const [filterLowStock,setFilterLowStock]= useState(false)
  const [page,          setPage]          = useState(1)
  const PAGE_SIZE = 20

  const [editProduct,      setEditProduct]      = useState(null)  // null=closed, {}=new, product=edit
  const [detailProduct,    setDetailProduct]    = useState(null)  // vista detalle
  const [variantProduct,   setVariantProduct]   = useState(null)
  const [movementProduct,  setMovementProduct]  = useState(null)
  const [confirmDelete,    setConfirmDelete]     = useState(null)
  const [showCatModal,     setShowCatModal]      = useState(false)
  const [showCsvModal,     setShowCsvModal]      = useState(false)
  const [activeTab,        setActiveTab]         = useState('catalog') // catalog | alerts | prediction

  // Auto-open product detail when navigating from Dashboard stock alerts
  useEffect(() => {
    const openId = location.state?.openProductId
    if (!openId) return
    window.history.replaceState({}, '')
    svc.getProduct(openId)
      .then(({ data }) => setDetailProduct(data))
      .catch(() => {})
  }, [location.state?.openProductId])

  // KPIs
  const totalValue   = products.reduce((s, p) => s + p.total_stock * Number(p.price), 0)
  const bestSeller   = [...products].sort((a, b) => b.total_stock - a.total_stock)[0]
  const outOfStock   = products.filter(p => p.status === 'out').length
  const lowStock     = products.filter(p => p.total_stock > 0 && p.total_stock <= (p.min_stock || 3)).length

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [prodRes, catRes] = await Promise.all([
        svc.getProducts({ search, category: filterCat, status: filterStatus }),
        svc.getCategories(),
      ])
      const prods = prodRes.data?.results ?? prodRes.data
      setProducts(Array.isArray(prods) ? prods : [])
      const cats = catRes.data?.results ?? catRes.data
      setCategories(Array.isArray(cats) ? cats : [])
    } catch {
      toast.error('Error cargando el inventario')
    } finally {
      setLoading(false)
    }
  }, [search, filterCat, filterStatus])

  useEffect(() => { load() }, [load])

  // Filter client-side for instant feedback
  const filtered = useMemo(() => {
    let list = products
    if (search)         list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku_base?.includes(search.toUpperCase()))
    if (filterCat)      list = list.filter(p => String(p.category) === String(filterCat))
    if (filterStatus)   list = list.filter(p => p.status === filterStatus)
    if (filterVisible === 'visible') list = list.filter(p => p.is_visible)
    if (filterVisible === 'hidden')  list = list.filter(p => !p.is_visible)
    if (filterLowStock) list = list.filter(p => p.total_stock <= (p.min_stock || 3))
    return list
  }, [products, search, filterCat, filterStatus, filterVisible, filterLowStock])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const handleSaveProduct = (savedProduct, wasEdit) => {
    toast.success(wasEdit ? 'Producto actualizado' : 'Producto creado')
    setEditProduct(null)
    load()
  }

  // Fetch full product detail before opening edit form.
  // The list uses ProductListSerializer (no `images` field) while
  // ProductSerializer (used by detail modal) includes them.
  const handleEditProduct = async (product) => {
    if (product.images !== undefined) {
      // Already has full data (came from detail modal)
      setEditProduct(product)
      return
    }
    try {
      const { data } = await svc.getProduct(product.id)
      setEditProduct(data)
    } catch {
      // Fallback: open without images rather than blocking the user
      setEditProduct(product)
      toast.error('No se pudieron cargar las imágenes del producto')
    }
  }

  const handleToggleVisible = async (product) => {
    try {
      await svc.updateProduct(product.id, { is_visible: !product.is_visible })
      toast.success(product.is_visible ? 'Ocultado en tienda' : 'Publicado en tienda')
      load()
    } catch {
      toast.error('Error')
    }
  }

  const handleToggleStatus = async (product) => {
    const newStatus = product.status === 'inactive' ? 'active' : 'inactive'
    try {
      await svc.updateProduct(product.id, { status: newStatus })
      toast.success(newStatus === 'active' ? 'Producto activado' : 'Producto desactivado')
      load()
    } catch { toast.error('Error al cambiar estado') }
  }

  const handleDuplicate = async (product) => {
    try {
      const { data } = await svc.createProduct({
        name:        `${product.name} (copia)`,
        description: product.description,
        category:    product.category,
        price:       product.price,
        cost:        product.cost,
        min_stock:   product.min_stock,
        status:      'inactive',
        is_visible:  false,
        is_featured: false,
      })
      toast.success(`"${data.name}" duplicado como borrador`)
      load()
    } catch { toast.error('Error al duplicar') }
  }


  const handleDelete = async () => {
    try {
      await svc.deleteProduct(confirmDelete.id)
      toast.success('Producto desactivado')
      setConfirmDelete(null)
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'No se puede eliminar')
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="page-title">Catálogo</h2>
          <p className="text-[13px] text-luma-muted mt-0.5">
            {filtered.length} productos · {products.reduce((s,p) => s + p.total_stock, 0)} unidades en total
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" icon={Filter} onClick={() => setShowCatModal(true)}>
            Categorías
          </Button>
          <Button variant="outline" size="sm" icon={Upload} onClick={() => setShowCsvModal(true)}>
            Importar CSV
          </Button>
          <Button variant="teal" size="sm" icon={Plus} onClick={() => setEditProduct({})}>
            Nuevo producto
          </Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-cream-100 rounded-2xl w-fit">
        {[
          { key: 'catalog',    label: 'Catálogo' },
          { key: 'movements',  label: 'Movimientos' },
          { key: 'alerts',     label: `Alertas${(outOfStock + lowStock) > 0 ? ` (${outOfStock + lowStock})` : ''}` },
          { key: 'prediction', label: 'Reabastecimiento' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-[12px] font-semibold rounded-xl transition-all ${
              activeTab === t.key
                ? 'bg-white text-teal-600 shadow-sm'
                : 'text-luma-muted hover:text-luma-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* KPI Strip ─ siempre visible */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Mejor vendido',
            value: bestSeller?.name || '—',
            sub: bestSeller ? `${bestSeller.total_stock} ud. en stock` : '',
            color: 'text-teal-600'
          },
          {
            label: 'Valor del inventario',
            value: `$${(totalValue/1000).toFixed(1)}k`,
            sub: 'Valorado a precio de venta',
            color: 'text-luma-text'
          },
          {
            label: 'Agotados',
            value: outOfStock,
            sub: `${lowStock} con stock bajo`,
            color: outOfStock > 0 ? 'text-red-500' : 'text-teal-600'
          },
          {
            label: 'Categorías activas',
            value: categories.filter(c => c.is_active !== false).length,
            sub: 'Total de categorías',
            color: 'text-luma-text'
          },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <p className="section-label">{kpi.label}</p>
            <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            {kpi.sub && <p className="text-[11px] text-luma-faint mt-0.5">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── TAB: Catálogo ── */}
      {activeTab === 'catalog' && (
        <>
          {/* Filters (6.1) */}
          <div className="card p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none" />
              <input type="text" placeholder="Buscar por nombre o SKU..." value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="input-base" style={{ paddingLeft: '2.25rem' }} />
            </div>
            <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1) }}
              className="input-base w-full sm:w-40">
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
              className="input-base w-full sm:w-36">
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="out">Agotado</option>
              <option value="inactive">Inactivo</option>
            </select>
            <select value={filterVisible} onChange={e => { setFilterVisible(e.target.value); setPage(1) }}
              className="input-base w-full sm:w-36">
              <option value="">Visibilidad</option>
              <option value="visible">Visible en catálogo</option>
              <option value="hidden">Ocultos</option>
            </select>
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border border-luma-border hover:bg-cream-100 transition-colors flex-shrink-0">
              <input type="checkbox" checked={filterLowStock}
                onChange={e => { setFilterLowStock(e.target.checked); setPage(1) }}
                className="accent-teal-600" />
              <span className="text-[12px] text-luma-muted whitespace-nowrap">Stock bajo</span>
            </label>
            <button onClick={load} className="btn-ghost flex-shrink-0" title="Actualizar"><RefreshCw size={15} /></button>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="luma-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th className="text-center">Variantes</th>
                    <th>Stock</th>
                    <th>Precio</th>
                    <th>Estado</th>
                    <th className="text-center">Visible</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <EmptyState
                          icon={Package}
                          title="Sin productos"
                          description='Crea tu primer producto con el botón "Nuevo producto"'
                          action={
                            <Button variant="teal" size="sm" icon={Plus} onClick={() => setEditProduct({})}>
                              Nuevo producto
                            </Button>
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    paginated.map(p => (
                      <ProductRow
                        key={p.id}
                        product={p}
                        categories={categories}
                        onView={setDetailProduct}
                        onEdit={handleEditProduct}
                        onVariants={setVariantProduct}
                        onMovement={setMovementProduct}
                        onToggleVisible={handleToggleVisible}
                        onToggleStatus={handleToggleStatus}
                        onDuplicate={handleDuplicate}
                        onDelete={setConfirmDelete}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-luma-border flex items-center justify-between">
                <span className="text-[12px] text-luma-muted">
                  Mostrando {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} de {filtered.length}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p-1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-[12px] rounded-lg border border-luma-border hover:bg-cream-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p+1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-[12px] rounded-lg border border-luma-border hover:bg-cream-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB: Movimientos ── */}
      {activeTab === 'movements' && <MovimientosPanel />}

      {/* ── TAB: Alertas de Stock (5.4) ── */}
      {activeTab === 'alerts' && (
        <StockAlertsPanel
          onNavigateToProduct={(productId) => {
            // Switch to catalog tab and open detail for that product
            setActiveTab('catalog')
            const found = products.find(p => p.id === productId)
            if (found) setDetailProduct(found)
          }}
        />
      )}

      {/* ── TAB: Predicción Reabastecimiento (5.5) ── */}
      {activeTab === 'prediction' && (
        <RestockPredictionPanel
          products={products}
        />
      )}

      {/* ── Modals ── */}
      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          categories={categories}
          onEdit={(p) => { setEditProduct(p); setDetailProduct(null) }}
          onVariants={(p) => { setVariantProduct(p); setDetailProduct(null) }}
          onMovement={(p) => { setMovementProduct(p); setDetailProduct(null) }}
          onClose={() => setDetailProduct(null)}
        />
      )}

      {editProduct !== null && (
        <ProductForm
          product={editProduct?.id ? editProduct : null}
          categories={categories}
          onSave={handleSaveProduct}
          onClose={() => setEditProduct(null)}
        />
      )}

      {variantProduct && (
        <VariantManager
          product={variantProduct}
          onClose={() => { setVariantProduct(null); load() }}
        />
      )}

      {movementProduct && (
        <StockMovementForm
          product={movementProduct}
          onClose={() => { setMovementProduct(null); load() }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="¿Eliminar producto?"
        description={`¿Estás seguro de que deseas eliminar "${confirmDelete?.name}"? Esta acción desactivará el producto y sus variantes.`}
        confirmLabel="Sí, eliminar"
        danger
      />

      <CategoryModal
        open={showCatModal}
        onClose={() => { setShowCatModal(false); load() }}
      />

      {showCsvModal && (
        <CsvImportModal
          onClose={() => setShowCsvModal(false)}
          onImported={() => { setShowCsvModal(false); load() }}
        />
      )}
    </div>
  )
}

// ── Urgency helpers ────────────────────────────────────────────────────────────
function urgencyLabel(urgency) {
  if (urgency === 'out')      return { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',      txt: 'AGOTADO' }
  if (urgency === 'critical') return { bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700', txt: 'CRÍTICO' }
  return                             { bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',  txt: 'STOCK BAJO' }
}

// ── Panel: Alertas de Stock (5.4) ─────────────────────────────────────────────
// Fetches variant-level alerts from dashboard endpoint so each row shows
// product name, variant (size/color), current stock, min stock, urgency color.
function StockAlertsPanel({ onNavigateToProduct }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/reports/dashboard/')
      .then(({ data }) => setAlerts(data.stock_alerts || []))
      .catch(() => toast.error('Error cargando alertas de stock'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-[12px] text-luma-muted mt-3">Cargando alertas...</p>
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Package size={28} className="text-teal-500" />
        </div>
        <p className="text-[15px] font-semibold text-luma-text">Todo el inventario está bien</p>
        <p className="text-[12px] text-luma-muted mt-1">No hay variantes con stock bajo en este momento</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-500" />
        <p className="text-[14px] font-semibold text-luma-text">
          {alerts.length} variante{alerts.length !== 1 ? 's' : ''} con alerta de stock
        </p>
      </div>
      <div className="card overflow-hidden">
        <div className="divide-y divide-luma-border">
          {alerts.map(a => {
            const ug = urgencyLabel(a.urgency)
            return (
              <div
                key={a.variant_id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-cream-50 cursor-pointer transition-colors"
                onClick={() => onNavigateToProduct(a.product_id)}
              >
                {/* Urgency bar */}
                <div className={`w-2 h-10 rounded-full flex-shrink-0 ${ug.bar}`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-luma-text truncate">{a.product_name}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${ug.badge}`}>
                      {ug.txt}
                    </span>
                    <span className="text-[11px] text-luma-muted">
                      T: <strong>{a.size || '—'}</strong> · Color: <strong>{a.color || '—'}</strong>
                    </span>
                    <span className="text-[11px] text-luma-muted">
                      Stock: <strong>{a.current_stock}</strong> ud. · Mín: {a.min_stock} ud.
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Purchase Order Modal (5.5) ────────────────────────────────────────────────
function PurchaseOrderModal({ product, onClose }) {
  const [qty, setQty]   = useState(10)
  const [note, setNote] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    toast.success(`Orden de compra registrada para "${product.name}" (${qty} ud.)`)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Crear Orden de Compra" size="sm">
      <div className="space-y-4">
        <div className="p-3 bg-cream-100 rounded-xl">
          <p className="text-[12px] font-semibold text-luma-text">{product.name}</p>
          <p className="text-[11px] text-luma-muted mt-0.5">
            Stock actual: {product.total_stock} ud. · Ritmo: {product.dailyRate} ud/día
          </p>
          <p className={`text-[11px] font-semibold mt-1 ${
            product.daysLeft <= 3 ? 'text-red-600' : product.daysLeft <= 7 ? 'text-orange-600' : 'text-amber-600'
          }`}>
            Se estima agotamiento en {product.daysLeft} días
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[12px] font-medium text-luma-text mb-1">Cantidad a solicitar</label>
            <input
              type="number" min="1" value={qty}
              onChange={e => setQty(Number(e.target.value))}
              className="input-base w-full" required
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-luma-text mb-1">Nota (opcional)</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              className="input-base w-full h-20 resize-none"
              placeholder="Ej: Urgente, contactar proveedor..."
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-[12px] rounded-xl border border-luma-border text-luma-muted hover:bg-cream-100 transition-colors">
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2 text-[12px] rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold transition-colors flex items-center justify-center gap-1.5">
              <ShoppingBag size={12} /> Crear orden
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

// ── Panel: Predicción Reabastecimiento (5.5) ──────────────────────────────────
function RestockPredictionPanel({ products }) {
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading]         = useState(true)
  const [purchaseOrder, setPurchaseOrder] = useState(null)

  useEffect(() => {
    async function calc() {
      setLoading(true)
      try {
        const now = new Date()
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
        const preds = await Promise.all(
          products.filter(p => p.total_stock > 0 && p.status !== 'inactive').map(async (p) => {
            try {
              const { data } = await svc.getMovements({ 'variant__product': p.id, type: 'sale', page_size: 100 })
              const movs = data?.results ?? data ?? []
              const unitsSold = movs
                .filter(m => new Date(m.created_at) >= thirtyDaysAgo)
                .reduce((s, m) => s + Math.abs(m.quantity), 0)
              const dailyRate = unitsSold / 30
              if (dailyRate <= 0) return null
              const daysLeft = Math.floor(p.total_stock / dailyRate)
              if (daysLeft > 10) return null  // Solo < 10 días según spec 5.5
              return { ...p, daysLeft, dailyRate: dailyRate.toFixed(1), unitsSold }
            } catch { return null }
          })
        )
        setPredictions(preds.filter(Boolean).sort((a, b) => a.daysLeft - b.daysLeft))
      } finally { setLoading(false) }
    }
    calc()
  }, [products])

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-[12px] text-luma-muted mt-3">Calculando predicciones de stock...</p>
      </div>
    )
  }

  if (predictions.length === 0) {
    return (
      <div className="card p-12 text-center">
        <TrendingDown size={32} className="mx-auto text-luma-faint mb-3" />
        <p className="text-[15px] font-semibold text-luma-text">No hay predicciones urgentes</p>
        <p className="text-[12px] text-luma-muted mt-1">
          Ningún producto está en riesgo de agotarse en los próximos 10 días según el ritmo de ventas
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingDown size={16} className="text-amber-500" />
          <p className="text-[14px] font-semibold text-luma-text">
            {predictions.length} producto{predictions.length !== 1 ? 's' : ''} con riesgo de agotamiento
          </p>
          <span className="text-[11px] text-luma-faint">basado en ventas del último mes</span>
        </div>
        <div className="card overflow-hidden">
          <div className="divide-y divide-luma-border">
            {predictions.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-cream-50 transition-colors">
                {p.main_image ? (
                  <img src={p.main_image} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-luma-border" />
                ) : (
                  <div className="w-10 h-10 bg-cream-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Package size={14} className="text-luma-faint" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-luma-text truncate">{p.name}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className={`text-[11px] font-bold ${
                      p.daysLeft <= 3 ? 'text-red-600' : p.daysLeft <= 7 ? 'text-orange-600' : 'text-amber-600'
                    }`}>
                      Se estima agotamiento en {p.daysLeft} días
                    </span>
                    <span className="text-[11px] text-luma-faint">
                      {p.dailyRate} ud/día · {p.total_stock} ud. en stock
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setPurchaseOrder(p)}
                  className="flex-shrink-0 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                >
                  <ShoppingBag size={11} />
                  Crear orden de compra
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      {purchaseOrder && (
        <PurchaseOrderModal product={purchaseOrder} onClose={() => setPurchaseOrder(null)} />
      )}
    </>
  )
}


// ── MOV type config ───────────────────────────────────────────────────────────
const MOV_TYPE_LABELS = {
  entry:    { label: 'Entrada',          cls: 'bg-teal-50 text-teal-700' },
  sale:     { label: 'Venta',            cls: 'bg-blue-50 text-blue-700' },
  return:   { label: 'Devolución',       cls: 'bg-amber-50 text-amber-700' },
  swap_in:  { label: 'Cambio — Entrada', cls: 'bg-purple-50 text-purple-700' },
  swap_out: { label: 'Cambio — Salida',  cls: 'bg-orange-50 text-orange-700' },
  adjust:   { label: 'Ajuste manual',    cls: 'bg-gray-100 text-gray-700' },
}

// ── Panel: Movimientos de Stock con filtros ───────────────────────────────────
function MovimientosPanel() {
  const [movements, setMovements] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [count,     setCount]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [filterType,     setFilterType]     = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo,   setFilterDateTo]   = useState('')
  const [filterSearch,   setFilterSearch]   = useState('')
  const PAGE_SZ = 30

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: PAGE_SZ }
      if (filterType)     params.type      = filterType
      if (filterDateFrom) params.date_from = filterDateFrom
      if (filterDateTo)   params.date_to   = filterDateTo
      if (filterSearch)   params.search    = filterSearch
      const { data } = await svc.getMovements(params)
      const rows = data?.results ?? data ?? []
      setMovements(Array.isArray(rows) ? rows : [])
      setCount(data?.count ?? (Array.isArray(rows) ? rows.length : 0))
    } catch { toast.error('Error cargando movimientos') }
    finally  { setLoading(false) }
  }, [page, filterType, filterDateFrom, filterDateTo, filterSearch])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(count / PAGE_SZ)

  const clearFilters = () => {
    setFilterType('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterSearch('')
    setPage(1)
  }

  const hasFilters = filterType || filterDateFrom || filterDateTo || filterSearch

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          {/* Buscar por producto */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por producto o nota..."
              value={filterSearch}
              onChange={e => { setFilterSearch(e.target.value); setPage(1) }}
              className="input-base"
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>
          {/* Tipo de movimiento */}
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1) }}
            className="input-base w-full sm:w-48"
          >
            <option value="">Todos los tipos</option>
            {Object.entries(MOV_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {/* Fecha desde */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-luma-faint whitespace-nowrap">Desde</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => { setFilterDateFrom(e.target.value); setPage(1) }}
              className="input-base w-36"
            />
          </div>
          {/* Fecha hasta */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-luma-faint whitespace-nowrap">Hasta</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => { setFilterDateTo(e.target.value); setPage(1) }}
              className="input-base w-36"
            />
          </div>
          {/* Acciones */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="btn-ghost text-[12px] flex-shrink-0 text-red-500 hover:text-red-600"
            >
              Limpiar filtros
            </button>
          )}
          <button onClick={load} className="btn-ghost flex-shrink-0" title="Actualizar">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-luma-border flex items-center justify-between">
          <span className="text-[13px] font-semibold text-luma-text">Historial de movimientos</span>
          <span className="text-[11px] text-luma-faint">{count} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="luma-table">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Tipo</th>
                <th>Producto / Variante</th>
                <th className="text-right">Cantidad</th>
                <th>Usuario</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <EmptyState
                      icon={Box}
                      title="Sin movimientos"
                      description={hasFilters ? 'No hay resultados con los filtros actuales' : 'Aún no se han registrado movimientos de stock'}
                    />
                  </td>
                </tr>
              ) : (
                movements.map(m => {
                  const mt = MOV_TYPE_LABELS[m.type] || { label: m.type, cls: 'bg-cream-100 text-luma-muted' }
                  return (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap">
                        <p className="text-[12px] font-medium text-luma-text">
                          {new Date(m.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-[10px] text-luma-faint">
                          {new Date(m.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                      <td>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${mt.cls}`}>
                          {mt.label}
                        </span>
                      </td>
                      <td className="max-w-[220px]">
                        <p className="text-[12px] font-medium text-luma-text truncate">{m.variant_display}</p>
                      </td>
                      <td className="text-right">
                        <span className={`text-[13px] font-bold ${m.quantity > 0 ? 'text-teal-600' : 'text-red-500'}`}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </span>
                      </td>
                      <td className="text-[11px] text-luma-muted whitespace-nowrap">
                        {m.created_by_name || <span className="text-luma-faint">—</span>}
                      </td>
                      <td className="text-[11px] text-luma-faint max-w-[160px] truncate">
                        {m.note || '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-luma-border flex items-center justify-between">
            <span className="text-[12px] text-luma-muted">
              Página {page} de {totalPages} · {count} movimientos
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-[12px] rounded-lg border border-luma-border hover:bg-cream-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-[12px] rounded-lg border border-luma-border hover:bg-cream-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Category Manager Modal ────────────────────────────────────────────────────
function CategoryModal({ open, onClose }) {
  const [cats, setCats]       = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [editId, setEditId]   = useState(null)
  const [editName, setEditName] = useState('')
  const [newName, setNewName]   = useState('')
  const [newParent, setNewParent] = useState('')   // '' = raíz, id = subcategoría

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await svc.getCategories()
      setCats(data?.results ?? data ?? [])
    } finally { setLoading(false) }
  }

  useEffect(() => { if (open) load() }, [open])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await svc.createCategory({
        name:   newName.trim(),
        parent: newParent || null,
        order:  cats.length + 1,
      })
      setNewName('')
      toast.success(newParent ? 'Subcategoría creada' : 'Categoría creada')
      load()
    } catch (e) {
      toast.error(e.response?.data?.name?.[0] || 'Error al crear')
    } finally { setSaving(false) }
  }

  const handleEdit = async (id) => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await svc.updateCategory(id, { name: editName.trim() })
      setEditId(null)
      toast.success('Nombre actualizado')
      load()
    } catch { toast.error('Error al actualizar') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta categoría? Esta acción no se puede deshacer.')) return
    try {
      await svc.deleteCategory(id)
      toast.success('Categoría eliminada')
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'No se puede eliminar')
    }
  }

  const rootCats = cats.filter(c => !c.parent)

  return (
    <Modal open={open} onClose={onClose} title="Gestión de Categorías" size="md">
      <div className="space-y-5">
        {/* ── Crear nueva ── */}
        <div className="bg-cream-50 border border-luma-border rounded-xl p-4 space-y-3">
          <p className="text-[12px] font-semibold text-luma-text">Crear nueva</p>
          <div className="flex gap-2 flex-wrap">
            <select
              value={newParent}
              onChange={e => setNewParent(e.target.value)}
              className="input-base w-full sm:w-48"
            >
              <option value="">— Categoría principal —</option>
              {rootCats.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder={newParent ? 'Nombre de subcategoría...' : 'Nombre de categoría...'}
              className="input-base flex-1 min-w-[160px]"
            />
            <Button variant="teal" size="sm" loading={saving} onClick={handleCreate} icon={Plus}>
              Crear
            </Button>
          </div>
          {newParent && (
            <p className="text-[11px] text-teal-600">
              Se creará como subcategoría de: <strong>{cats.find(c => String(c.id) === String(newParent))?.name}</strong>
            </p>
          )}
        </div>

        {/* ── Lista ── */}
        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : rootCats.length === 0 ? (
          <p className="text-[12px] text-luma-faint text-center py-4">Sin categorías. Crea la primera arriba.</p>
        ) : (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {rootCats.map(cat => (
              <div key={cat.id} className="border border-luma-border rounded-xl overflow-hidden">
                {/* Categoría raíz */}
                <div className="flex items-center gap-3 px-4 py-3 bg-cream-50 group">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500 flex-shrink-0" />
                  {editId === cat.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  handleEdit(cat.id)
                        if (e.key === 'Escape') setEditId(null)
                      }}
                      className="input-base flex-1 py-1 text-[13px]"
                    />
                  ) : (
                    <span className="text-[13px] font-semibold text-luma-text flex-1">{cat.name}</span>
                  )}
                  {cat.subcategories?.length > 0 && (
                    <span className="text-[10px] text-luma-faint bg-cream-200 px-1.5 py-0.5 rounded-md flex-shrink-0">
                      {cat.subcategories.length} sub
                    </span>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {editId === cat.id ? (
                      <>
                        <button onClick={() => handleEdit(cat.id)}
                          disabled={saving}
                          className="px-2 py-1 rounded-lg bg-teal-500 text-white text-[10px] font-bold disabled:opacity-60">
                          ✓ Guardar
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="p-1.5 rounded-lg hover:bg-cream-200 text-luma-faint">
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditId(cat.id); setEditName(cat.name) }}
                          className="p-1.5 rounded-lg hover:bg-cream-200 text-luma-muted hover:text-teal-600 transition-colors">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={() => handleDelete(cat.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-luma-faint hover:text-red-500 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Subcategorías */}
                {cat.subcategories?.filter(s => s.is_active !== false).map(sub => (
                  <div key={sub.id} className="flex items-center gap-3 px-4 py-2.5 pl-9 border-t border-luma-border group hover:bg-cream-50/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-luma-faint flex-shrink-0" />
                    {editId === sub.id ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  handleEdit(sub.id)
                          if (e.key === 'Escape') setEditId(null)
                        }}
                        className="input-base flex-1 py-1 text-[12px]"
                      />
                    ) : (
                      <span className="text-[12px] text-luma-muted flex-1">{sub.name}</span>
                    )}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {editId === sub.id ? (
                        <>
                          <button onClick={() => handleEdit(sub.id)}
                            disabled={saving}
                            className="px-2 py-1 rounded-lg bg-teal-500 text-white text-[10px] font-bold disabled:opacity-60">
                            ✓ Guardar
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="p-1.5 rounded-lg hover:bg-cream-200 text-luma-faint">
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditId(sub.id); setEditName(sub.name) }}
                            className="p-1.5 rounded-lg hover:bg-cream-200 text-luma-muted hover:text-teal-600 transition-colors">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => handleDelete(sub.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-luma-faint hover:text-red-500 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
