import { useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { Users, Plus, Search, Star, RefreshCw, ShoppingBag, SlidersHorizontal, X, TrendingUp } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { PageLoader, EmptyState, Pagination, SkeletonRow } from '../components/ui/Misc'
import { Badge } from '../components/ui/Badge'
import * as svc from '../api/services'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`

const SEGMENT_MAP = {
  new:      { label: 'Nuevo',     color: 'teal' },
  frequent: { label: 'Frecuente', color: 'green' },
  regular:  { label: 'Regular',   color: 'amber' },
  inactive: { label: 'Inactivo',  color: 'gray' },
}

function CustomerRow({ customer, onView }) {
  const seg = SEGMENT_MAP[customer.segment] || { label: customer.segment, color: 'gray' }
  return (
    <tr className="cursor-pointer" onClick={() => onView(customer)}>
      <td>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 gradient-teal rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {customer.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-[13px] font-semibold">{customer.name}</p>
            {customer.phone && <p className="text-[11px] text-luma-faint">{customer.phone}</p>}
          </div>
        </div>
      </td>
      <td><Badge variant={seg.color} dot>{seg.label}</Badge></td>
      <td className="text-[13px] font-semibold">{customer.purchase_count || 0}</td>
      <td className="text-[13px] font-semibold">{fmt(customer.total_purchases)}</td>
      <td>
        <div className="flex items-center gap-1">
          <Star size={11} className="text-amber-400" />
          <span className="text-[12px] font-semibold">{customer.points || 0}</span>
        </div>
      </td>
    </tr>
  )
}

function CustomerMobileCard({ customer, onView }) {
  const seg = SEGMENT_MAP[customer.segment] || { label: customer.segment, color: 'gray' }
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-cream-50 transition-colors border-b border-luma-border last:border-0"
      onClick={() => onView(customer)}
    >
      <div className="w-9 h-9 gradient-teal rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {customer.name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-semibold text-luma-text truncate">{customer.name}</p>
          <Badge variant={seg.color} dot>{seg.label}</Badge>
        </div>
        {customer.phone && <p className="text-[11px] text-luma-faint mt-0.5">{customer.phone}</p>}
        <div className="flex items-center gap-2.5 mt-0.5">
          <span className="text-[10px] text-luma-faint">{customer.purchase_count || 0} compras</span>
          {(customer.points || 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
              <Star size={9} /> {customer.points} pts
            </span>
          )}
        </div>
      </div>
      <p className="text-[13px] font-bold text-teal-600 flex-shrink-0">{fmt(customer.total_purchases)}</p>
    </div>
  )
}

function CustomerForm({ customer, onSave, onClose }) {
  const isEdit = !!customer?.id
  const [form, setForm] = useState({ name: '', phone: '', email: '', note: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEdit) setForm({
      name:  customer.name  || '',
      phone: customer.phone || '',
      email: customer.email || '',
      note:  customer.note  || '',
    })
  }, [customer, isEdit])

  const handleSave = async () => {
    if (!form.name) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)
    await onSave(form, isEdit ? customer.id : null)
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Editar cliente' : 'Nuevo cliente'} size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="teal" loading={saving} onClick={handleSave}>
            {isEdit ? 'Guardar' : 'Crear cliente'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Nombre *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre completo" autoFocus />
        <Input label="Teléfono" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="3001234567" />
        <Input label="Email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="cliente@email.com" />
        <div>
          <label className="text-[12px] font-semibold text-luma-text block mb-1.5">Nota</label>
          <textarea rows={2} className="input-base resize-none" placeholder="Preferencias, talla habitual..."
            value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
        </div>
      </div>
    </Modal>
  )
}

function ViewCustomerModal({ customer, onEdit, onClose }) {
  const [sales,   setSales]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    svc.getSales({ customer: customer.id, page_size: 5 })
      .then(({ data }) => setSales(data?.results ?? data ?? []))
      .catch(() => setSales([]))
      .finally(() => setLoading(false))
  }, [customer.id])

  return (
    <Modal open onClose={onClose} title={customer.name} size="md"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onEdit(customer)}>Editar cliente</Button>
          <Button variant="teal" onClick={onClose}>Cerrar</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          {[
            ['Teléfono',      customer.phone || '—'],
            ['Email',         customer.email || '—'],
            ['Compras',       customer.purchase_count || 0],
            ['Total gastado', fmt(customer.total_purchases)],
            ['Segmento',      customer.segment_display || customer.segment],
          ].map(([k, v]) => (
            <div key={k} className="bg-cream-100 rounded-xl p-3">
              <p className="text-luma-faint text-[10px] uppercase tracking-wide">{k}</p>
              <p className="font-semibold mt-0.5">{v}</p>
            </div>
          ))}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
            <p className="text-teal-600 text-[10px] uppercase tracking-wide">Puntos acumulados</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Star size={13} className="text-amber-400" />
              <p className="font-bold text-teal-700">{customer.points || 0} pts</p>
            </div>
          </div>
        </div>

        {/* Nota */}
        {customer.note && (
          <div className="bg-cream-100 rounded-xl p-3">
            <p className="text-[10px] text-luma-faint uppercase tracking-wide mb-0.5">Nota</p>
            <p className="text-[12px]">{customer.note}</p>
          </div>
        )}

        {/* Últimas compras */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag size={13} className="text-luma-faint" />
            <p className="section-label">Últimas compras</p>
          </div>
          {loading ? (
            <p className="text-[12px] text-luma-faint py-2">Cargando historial...</p>
          ) : sales.length === 0 ? (
            <p className="text-[12px] text-luma-faint py-2">Sin compras registradas aún.</p>
          ) : (
            <div className="space-y-1.5">
              {sales.map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2.5 bg-cream-100 rounded-xl">
                  <div>
                    <p className="text-[12px] font-semibold text-luma-text">{s.number}</p>
                    <p className="text-[10px] text-luma-faint">
                      {new Date(s.created_at).toLocaleDateString('es-CO')} · {s.payment_method_display || s.payment_method}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold text-teal-600">{fmt(s.total)}</p>
                    {(s.points_earned || 0) > 0 && (
                      <p className="text-[10px] text-amber-500">+{s.points_earned} pts</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default function Clientes() {
  const PAGE_SIZE_CLIENTES = 50

  const [customers,    setCustomers]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [hasLoaded,    setHasLoaded]    = useState(false)
  const [page,         setPage]         = useState(1)
  const [totalCount,   setTotalCount]   = useState(0)
  const [stats,        setStats]        = useState({ total_count: 0, total_revenue: 0, total_points: 0 })
  const [inputSearch,  setInputSearch]  = useState('')  // valor del input (inmediato)
  const [search,       setSearch]       = useState('')  // valor debounced (dispara API)
  const [segment,      setSegment]      = useState('')
  const [sortBy,       setSortBy]       = useState('')
  const [formData,     setFormData]     = useState(null)
  const [viewCustomer, setViewCustomer] = useState(null)

  // Debounce: solo dispara load() 350 ms después de que el usuario deja de tipear
  useEffect(() => {
    const t = setTimeout(() => setSearch(inputSearch), 350)
    return () => clearTimeout(t)
  }, [inputSearch])

  // Params compartidos entre load y otras llamadas
  const filterParams = useMemo(() => {
    const p = {}
    if (search)  p.search   = search
    if (segment) p.segment  = segment
    if (sortBy)  p.order_by = sortBy
    return p
  }, [search, segment, sortBy])

  const load = useCallback(async (p = 1) => {
    setPage(p)
    setLoading(true)
    try {
      const params = { ...filterParams, page: p, page_size: PAGE_SIZE_CLIENTES }
      const { data } = await svc.getCustomers(params)
      setCustomers(data?.results ?? data ?? [])
      setTotalCount(data?.count ?? 0)
    } catch { toast.error('Error cargando clientes') }
    finally { setLoading(false); setHasLoaded(true) }
  }, [filterParams])

  // loadStats — totales globales (sin filtros) para el panel de KPIs
  const loadStats = useCallback(async () => {
    try {
      const { data } = await svc.getCustomerStats()
      setStats(data)
    } catch {}
  }, [])

  useEffect(() => { load(1)    }, [load])
  useEffect(() => { loadStats() }, [loadStats])

  const handleSave = async (form, id) => {
    try {
      if (id) {
        await svc.updateCustomer(id, form)
        toast.success('Cliente actualizado')
      } else {
        await svc.createCustomer(form)
        toast.success('Cliente creado')
      }
      setFormData(null)
      load(1)
      loadStats()
    } catch (e) {
      toast.error(Object.values(e.response?.data || {}).flat()[0] || 'Error')
    }
  }

  const hasActiveFilters = inputSearch || segment || sortBy
  const avgTicket = stats.total_count > 0
    ? Math.round(stats.total_revenue / stats.total_count)
    : 0

  return (
    <div className="space-y-4 animate-fade-up">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-50 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Users size={20} className="text-teal-600" />
          </div>
          <div>
            <h1 className="page-title">Clientes</h1>
            <p className="text-[13px] text-luma-muted mt-0.5">
              {stats.total_count.toLocaleString('es-CO')} clientes registrados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          <button
            onClick={() => { load(1); loadStats() }}
            className={`btn-ghost p-2 ${loading ? 'animate-spin text-teal-500' : ''}`}
            title="Actualizar"
            disabled={loading}
          >
            <RefreshCw size={15} />
          </button>
          <Button variant="teal" icon={Plus} size="sm" onClick={() => setFormData({})}>
            <span className="hidden sm:inline">Nuevo cliente</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total */}
        <div className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-all duration-200">
          <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Users size={17} className="text-teal-500" />
          </div>
          <div>
            <p className="section-label">Total clientes</p>
            <p className="text-[22px] font-bold text-teal-600 leading-tight mt-0.5">
              {stats.total_count.toLocaleString('es-CO')}
            </p>
          </div>
        </div>
        {/* Ingresos */}
        <div className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-all duration-200">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp size={17} className="text-green-500" />
          </div>
          <div className="min-w-0">
            <p className="section-label">Ingresos totales</p>
            <p className="text-[15px] font-bold text-green-600 leading-tight mt-0.5 truncate">
              {fmt(stats.total_revenue)}
            </p>
          </div>
        </div>
        {/* Ticket promedio */}
        <div className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-all duration-200">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShoppingBag size={17} className="text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="section-label">Ticket promedio</p>
            <p className="text-[15px] font-bold text-blue-600 leading-tight mt-0.5 truncate">
              {avgTicket > 0 ? fmt(avgTicket) : '—'}
            </p>
          </div>
        </div>
        {/* Puntos */}
        <div className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-all duration-200">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Star size={17} className="text-amber-500" />
          </div>
          <div>
            <p className="section-label">Puntos activos</p>
            <p className="text-[22px] font-bold text-amber-600 leading-tight mt-0.5">
              {stats.total_points.toLocaleString('es-CO')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Barra de filtros ── */}
      <div className="card p-4 space-y-3">
        {/* Row 1: búsqueda */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
          <input
            value={inputSearch}
            onChange={e => setInputSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email..."
            className="input-base w-full !pl-9"
          />
        </div>
        {/* Row 2: selects */}
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
          <div className="relative">
            <SlidersHorizontal size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
            <select
              value={segment}
              onChange={e => setSegment(e.target.value)}
              className="input-base !pl-9 w-full sm:w-44 appearance-none"
            >
              <option value="">Todos los segmentos</option>
              <option value="new">Nuevo</option>
              <option value="frequent">Frecuente</option>
              <option value="regular">Regular</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
          <div className="relative">
            <SlidersHorizontal size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="input-base !pl-9 w-full sm:w-44 appearance-none"
            >
              <option value="">Ordenar: recientes</option>
              <option value="name">Nombre A→Z</option>
              <option value="purchases">Más compras</option>
              <option value="spent">Mayor gasto</option>
              <option value="points">Más puntos</option>
              <option value="recent">Última compra</option>
            </select>
          </div>
        </div>

        {/* Chips de filtros activos */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-luma-border">
            <span className="text-[11px] text-luma-faint">Filtros:</span>
            {segment && (
              <button
                onClick={() => setSegment('')}
                className="inline-flex items-center gap-1 text-[11px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-lg hover:bg-teal-100 transition-colors"
              >
                {segment === 'new' ? 'Nuevo'
                  : segment === 'frequent' ? 'Frecuente'
                  : segment === 'regular' ? 'Regular'
                  : 'Inactivo'}
                <X size={10} />
              </button>
            )}
            {sortBy && (
              <button
                onClick={() => setSortBy('')}
                className="inline-flex items-center gap-1 text-[11px] bg-cream-100 text-luma-muted border border-luma-border px-2 py-0.5 rounded-lg hover:bg-cream-200 transition-colors"
              >
                Orden: {sortBy === 'name' ? 'A→Z'
                  : sortBy === 'purchases' ? 'Más compras'
                  : sortBy === 'spent' ? 'Mayor gasto'
                  : sortBy === 'points' ? 'Más puntos'
                  : 'Última compra'}
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
              onClick={() => { setInputSearch(''); setSegment(''); setSortBy('') }}
              className="text-[11px] text-luma-faint hover:text-red-500 transition-colors ml-auto"
            >
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      {/* ── Tabla ── */}
      {loading && !hasLoaded ? <PageLoader /> : null}
      <div className="card overflow-hidden">
        {customers.length === 0 && hasLoaded ? (
          <EmptyState
            icon={Users}
            title="Sin clientes"
            description={hasActiveFilters ? 'No hay clientes con los filtros actuales.' : 'Registra el primer cliente.'}
            action={
              hasActiveFilters
                ? (
                  <button
                    onClick={() => { setInputSearch(''); setSegment(''); setSortBy('') }}
                    className="text-[12px] text-teal-600 hover:underline"
                  >
                    Limpiar filtros
                  </button>
                )
                : <Button variant="teal" icon={Plus} size="sm" onClick={() => setFormData({})}>Nuevo cliente</Button>
            }
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className={`sm:hidden divide-y divide-luma-border ${loading ? 'opacity-50' : ''}`}>
              {loading && !hasLoaded
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
                      <div className="w-9 h-9 bg-cream-200 rounded-xl flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-cream-200 rounded w-32" />
                        <div className="h-2.5 bg-cream-100 rounded w-20" />
                      </div>
                    </div>
                  ))
                : customers.map(c => (
                    <CustomerMobileCard key={c.id} customer={c} onView={(c) => { setViewCustomer(c); setFormData(null) }} />
                  ))
              }
            </div>
            {/* Desktop table */}
            <div className={`hidden sm:block overflow-x-auto ${loading ? 'opacity-50' : ''}`}>
              <table className="luma-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Segmento</th>
                    <th>Compras</th>
                    <th>Gasto total</th>
                    <th>Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                    : customers.map(c => (
                        <CustomerRow key={c.id} customer={c} onView={(c) => { setViewCustomer(c); setFormData(null) }} />
                      ))
                  }
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Pagination
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE_CLIENTES}
        onPageChange={load}
      />

      {formData !== null && (
        <CustomerForm customer={formData?.id ? formData : null} onSave={handleSave} onClose={() => setFormData(null)} />
      )}

      {viewCustomer && (
        <ViewCustomerModal customer={viewCustomer} onEdit={(c) => { setFormData(c); setViewCustomer(null) }} onClose={() => setViewCustomer(null)} />
      )}
    </div>
  )
}
