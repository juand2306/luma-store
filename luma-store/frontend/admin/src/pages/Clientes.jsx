import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Users, Plus, Search, Star, RefreshCw, ShoppingBag } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { PageLoader, EmptyState } from '../components/ui/Misc'
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
  const [customers, setCustomers] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [formData,  setFormData]  = useState(null) // null=closed, {}=new, customer=edit
  const [viewCustomer, setViewCustomer] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await svc.getCustomers({ search: search || undefined })
      setCustomers(data?.results ?? data ?? [])
    } catch { toast.error('Error cargando clientes') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

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
      load()
    } catch (e) {
      toast.error(Object.values(e.response?.data || {}).flat()[0] || 'Error')
    }
  }

  const totalRevenue = customers.reduce((s, c) => s + (c.total_purchases || 0), 0)
  const totalPoints  = customers.reduce((s, c) => s + (c.points || 0), 0)

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Clientes</h2>
          <p className="text-[13px] text-luma-muted">{customers.length} clientes registrados</p>
        </div>
        <Button variant="teal" icon={Plus} onClick={() => setFormData({})}>
          Nuevo cliente
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total clientes',   value: customers.length },
          { label: 'Frecuentes',       value: customers.filter(c => c.segment === 'frequent').length },
          { label: 'Ingresos totales', value: `$${(totalRevenue/1000).toFixed(1)}k` },
          { label: 'Puntos activos',   value: totalPoints },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <p className="section-label">{k.label}</p>
            <p className="text-xl font-bold text-luma-text mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card p-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono..."
            className="input-base pl-9" />
        </div>
        <button onClick={load} className="btn-ghost"><RefreshCw size={15} /></button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {customers.length === 0 ? (
          <EmptyState icon={Users} title="Sin clientes" description="Registra el primer cliente." action={<Button variant="teal" icon={Plus} size="sm" onClick={() => setFormData({})}>Nuevo cliente</Button>} />
        ) : (
          <div className="overflow-x-auto">
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
                {customers.map(c => (
                  <CustomerRow key={c.id} customer={c} onView={(c) => { setViewCustomer(c); setFormData(null) }} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formData !== null && (
        <CustomerForm customer={formData?.id ? formData : null} onSave={handleSave} onClose={() => setFormData(null)} />
      )}

      {viewCustomer && (
        <ViewCustomerModal customer={viewCustomer} onEdit={(c) => { setFormData(c); setViewCustomer(null) }} onClose={() => setViewCustomer(null)} />
      )}
    </div>
  )
}
