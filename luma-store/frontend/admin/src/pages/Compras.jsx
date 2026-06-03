import { useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  ShoppingBag, RefreshCw, Plus, CheckCircle, Clock,
  AlertTriangle, Package, Search, ChevronRight, Truck, XCircle,
  SlidersHorizontal, X, Banknote, ArrowLeftRight, Smartphone,
  CircleDollarSign, CreditCard,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { PageLoader, ProgressBar, Pagination, ConfirmDialog } from '../components/ui/Misc'
import * as svc from '../api/services'
import { usePaymentMethods } from '../hooks/usePaymentMethods'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`

const PAGE_SIZE_COMPRAS = 50

const METHOD_ICONS = {
  cash:      Banknote,
  transfer:  ArrowLeftRight,
  nequi:     Smartphone,
  daviplata: Smartphone,
  debit:     CreditCard,
  credit:    CreditCard,
  other:     CircleDollarSign,
}

const STATUS_CONFIG = {
  pending:   { label: 'Pendiente',  className: 'bg-amber-100 text-amber-700',  icon: Clock },
  partial:   { label: 'Parcial',    className: 'bg-blue-100 text-blue-700',    icon: Truck },
  received:  { label: 'Recibida',   className: 'bg-teal-100 text-teal-700',    icon: CheckCircle },
  cancelled: { label: 'Cancelada',  className: 'bg-red-100 text-red-700',      icon: XCircle },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg ${cfg.className}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

// ── Modal crear OC ────────────────────────────────────────────────────────────
function CreateModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    variant:       initial?.variant_id  || '',
    product_name:  initial?.product_name || '',
    size:          initial?.size         || '',
    color:         initial?.color        || '',
    requested_qty: initial?.suggested_qty || 10,
    unit_cost:     '',
    note:          initial?.note         || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.product_name.trim()) return toast.error('El nombre del producto es requerido')
    if (form.requested_qty < 1)    return toast.error('La cantidad debe ser al menos 1')
    setSaving(true)
    try {
      const payload = {
        product_name:  form.product_name,
        size:          form.size,
        color:         form.color,
        requested_qty: Number(form.requested_qty),
        note:          form.note,
        ...(form.variant    && { variant:   Number(form.variant) }),
        ...(form.unit_cost  && { unit_cost: form.unit_cost }),
      }
      await onSave(payload)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Nueva Orden de Compra" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Producto */}
        <div className="p-3 bg-cream-100 rounded-xl space-y-3">
          <p className="text-[11px] font-semibold text-luma-muted uppercase">Producto</p>
          <div>
            <label className="block text-[12px] font-medium text-luma-text mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              value={form.product_name}
              onChange={e => set('product_name', e.target.value)}
              className="input-base w-full"
              placeholder="Ej: Camiseta Básica"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[12px] font-medium text-luma-text mb-1">Talla</label>
              <input
                value={form.size}
                onChange={e => set('size', e.target.value)}
                className="input-base w-full"
                placeholder="M, L, XL..."
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-luma-text mb-1">Color</label>
              <input
                value={form.color}
                onChange={e => set('color', e.target.value)}
                className="input-base w-full"
                placeholder="Negro, Blanco..."
              />
            </div>
          </div>
        </div>

        {/* Cantidades y costo */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-medium text-luma-text mb-1">
              Cantidad solicitada <span className="text-red-500">*</span>
            </label>
            <input
              type="number" min="1"
              value={form.requested_qty}
              onChange={e => set('requested_qty', e.target.value)}
              className="input-base w-full"
              required
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-luma-text mb-1">
              Costo unitario <span className="text-[10px] text-luma-faint">(opcional)</span>
            </label>
            <input
              type="number" min="0" step="0.01"
              value={form.unit_cost}
              onChange={e => set('unit_cost', e.target.value)}
              className="input-base w-full"
              placeholder="0"
            />
          </div>
        </div>

        {/* Nota */}
        <div>
          <label className="block text-[12px] font-medium text-luma-text mb-1">Nota</label>
          <textarea
            value={form.note}
            onChange={e => set('note', e.target.value)}
            className="input-base w-full h-16 resize-none"
            placeholder="Prioridad, proveedor, observaciones..."
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
    </Modal>
  )
}

// ── Modal editar OC ───────────────────────────────────────────────────────────
function EditModal({ purchase, onSave, onClose }) {
  const [form, setForm] = useState({
    requested_qty: purchase.requested_qty,
    unit_cost:     purchase.unit_cost || '',
    note:          purchase.note || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(purchase.id, {
        requested_qty: Number(form.requested_qty),
        unit_cost:     form.unit_cost || null,
        note:          form.note,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Editar ${purchase.number}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-cream-100 rounded-xl text-[12px]">
          <p className="font-semibold text-luma-text">{purchase.product_name}</p>
          <p className="text-luma-muted mt-0.5">
            T: {purchase.size || '—'} / {purchase.color || '—'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-medium text-luma-text mb-1">
              Cantidad solicitada
            </label>
            <input
              type="number" min={purchase.received_qty || 1}
              value={form.requested_qty}
              onChange={e => set('requested_qty', e.target.value)}
              className="input-base w-full"
              required
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-luma-text mb-1">
              Costo unitario
            </label>
            <input
              type="number" min="0" step="0.01"
              value={form.unit_cost}
              onChange={e => set('unit_cost', e.target.value)}
              className="input-base w-full"
              placeholder="0"
            />
          </div>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-luma-text mb-1">Nota</label>
          <textarea
            value={form.note}
            onChange={e => set('note', e.target.value)}
            className="input-base w-full h-16 resize-none"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="teal" size="sm" className="flex-1" loading={saving}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Modal recibir mercancía ───────────────────────────────────────────────────
function ReceiveModal({ purchase, onConfirm, onClose }) {
  const [qty, setQty]             = useState(purchase.pending_qty)
  const [paymentMethod, setPm]    = useState('cash')
  const [note, setNote]           = useState('')
  const [saving, setSaving]       = useState(false)
  const { enabledMethods }        = usePaymentMethods()
  const hasCost = Boolean(purchase.unit_cost)
  const totalCost = hasCost ? (Number(purchase.unit_cost) * qty) : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (qty < 1 || qty > purchase.pending_qty) return toast.error(`Máximo ${purchase.pending_qty} unidades pendientes`)
    setSaving(true)
    try {
      await onConfirm({
        qty_received:   qty,
        payment_method: hasCost ? paymentMethod : '',
        note,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Recibir Mercancía" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Resumen OC */}
        <div className="p-3 bg-cream-100 rounded-xl space-y-1.5">
          <p className="text-[12px] font-semibold text-luma-text">{purchase.product_name}</p>
          <p className="text-[11px] text-luma-muted">
            T: {purchase.size || '—'} / {purchase.color || '—'}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-2 text-center text-[11px]">
            <div>
              <p className="text-luma-faint">Solicitado</p>
              <p className="font-bold text-luma-text">{purchase.requested_qty}</p>
            </div>
            <div>
              <p className="text-luma-faint">Recibido</p>
              <p className="font-bold text-teal-600">{purchase.received_qty}</p>
            </div>
            <div>
              <p className="text-luma-faint">Pendiente</p>
              <p className="font-bold text-amber-600">{purchase.pending_qty}</p>
            </div>
          </div>
        </div>

        {/* Qué va a pasar */}
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 space-y-1">
          <p className="text-[12px] font-semibold text-teal-700 flex items-center gap-1.5">
            <Package size={13} /> Al confirmar la recepción:
          </p>
          <ul className="text-[11px] text-teal-600 space-y-1 pl-4 list-disc">
            <li>El <strong>stock</strong> de la variante se incrementará</li>
            {purchase.variant_id && <li>Se registrará un <strong>movimiento de entrada</strong> en inventario</li>}
            {hasCost && <li>Se registrará un <strong>egreso en caja</strong> (si está abierta)</li>}
          </ul>
        </div>

        {/* Cantidad */}
        <div>
          <label className="block text-[12px] font-medium text-luma-text mb-1">
            Cantidad a recibir <span className="text-red-500">*</span>
            <span className="text-luma-faint font-normal ml-1">(máx. {purchase.pending_qty})</span>
          </label>
          <input
            type="number" min="1" max={purchase.pending_qty}
            value={qty}
            onChange={e => setQty(Number(e.target.value))}
            className="input-base w-full"
            required
          />
        </div>

        {/* Método de pago — solo si tiene costo */}
        {hasCost && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[12px] font-medium text-luma-text">
                Método de pago al proveedor
              </label>
              {totalCost !== null && (
                <span className="text-[12px] font-bold text-luma-text">{fmt(totalCost)}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {enabledMethods.map(({ key, label }) => {
                const Icon = METHOD_ICONS[key] || CircleDollarSign
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPm(key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-medium transition-all ${
                      paymentMethod === key
                        ? 'border-teal-400 bg-teal-50 text-teal-700 shadow-sm'
                        : 'border-luma-border hover:border-teal-300 text-luma-muted'
                    }`}
                  >
                    <Icon size={13} className="flex-shrink-0" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Nota */}
        <div>
          <label className="block text-[12px] font-medium text-luma-text mb-1">
            Nota <span className="text-[10px] text-luma-faint">(opcional)</span>
          </label>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            className="input-base w-full"
            placeholder="Ej: Llega incompleto, revisión pendiente..."
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="teal" size="sm" className="flex-1" icon={Truck} loading={saving}>
            Confirmar recepción
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Modal detalle OC ──────────────────────────────────────────────────────────
function DetailModal({ purchase, onEdit, onReceive, onCancel, onDelete, onClose }) {
  const isPending   = purchase.status === 'pending'
  const isPartial   = purchase.status === 'partial'
  const isReceived  = purchase.status === 'received'
  const isCancelled = purchase.status === 'cancelled'
  const canReceive  = isPending || isPartial
  const canEdit     = isPending || isPartial
  const canCancel   = isPending || isPartial
  const canDelete   = isPending || isCancelled
  const progress    = purchase.requested_qty > 0
    ? Math.round((purchase.received_qty / purchase.requested_qty) * 100)
    : 0

  return (
    <Modal
      open onClose={onClose}
      title={`Orden ${purchase.number}`}
      size="md"
      footer={
        <div className="flex items-center gap-2 flex-wrap justify-end w-full">
          {canDelete && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 mr-auto" onClick={onDelete}>
              Eliminar
            </Button>
          )}
          {canCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancelar OC
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              Editar
            </Button>
          )}
          {canReceive && (
            <Button variant="teal" size="sm" icon={Truck} onClick={onReceive}>
              Recibir mercancía
            </Button>
          )}
          {isReceived && (
            <div className="flex items-center gap-2 text-[12px] text-teal-700 font-semibold">
              <CheckCircle size={14} /> Recibida completa
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Estado + progreso */}
        <div className="flex items-center justify-between">
          <StatusBadge status={purchase.status} />
          {(isPartial || isReceived) && (
            <span className="text-[12px] font-semibold text-luma-text">
              {purchase.received_qty} / {purchase.requested_qty} recibidas
            </span>
          )}
        </div>

        {(isPartial || isReceived) && (
          <ProgressBar value={purchase.received_qty} max={purchase.requested_qty} />
        )}

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Producto',    purchase.product_name],
            ['Talla',       purchase.size  || '—'],
            ['Color',       purchase.color || '—'],
            ['Solicitado',  `${purchase.requested_qty} ud.`],
            ['Recibido',    `${purchase.received_qty} ud.`],
            ['Pendiente',   `${purchase.pending_qty} ud.`],
            ...(purchase.unit_cost ? [['Costo unitario', fmt(purchase.unit_cost)]] : []),
            ...(purchase.current_stock !== null ? [['Stock actual', `${purchase.current_stock} ud.`]] : []),
          ].map(([k, v]) => (
            <div key={k} className="bg-cream-100 rounded-xl p-3">
              <p className="text-[10px] text-luma-faint uppercase">{k}</p>
              <p className="text-[12px] font-semibold text-luma-text mt-0.5">{v}</p>
            </div>
          ))}
        </div>

        {purchase.note && (
          <div className="bg-cream-100 rounded-xl p-3">
            <p className="text-[10px] text-luma-faint uppercase">Nota</p>
            <p className="text-[12px] mt-0.5">{purchase.note}</p>
          </div>
        )}

        {/* Metadatos */}
        <div className="text-[11px] text-luma-faint space-y-0.5 pt-1 border-t border-luma-border">
          {purchase.created_by_name && (
            <p>Creada por <span className="font-medium">{purchase.created_by_name}</span> · {new Date(purchase.created_at).toLocaleString('es-CO')}</p>
          )}
          {purchase.received_by_name && (
            <p>Recibida por <span className="font-medium">{purchase.received_by_name}</span> · {new Date(purchase.received_at).toLocaleString('es-CO')}</p>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ── Tarjeta de OC ─────────────────────────────────────────────────────────────
function PurchaseCard({ purchase, onClick }) {
  const progress   = purchase.requested_qty > 0
    ? Math.round((purchase.received_qty / purchase.requested_qty) * 100)
    : 0
  const isPending  = purchase.status === 'pending'
  const isPartial  = purchase.status === 'partial'
  const isReceived = purchase.status === 'received'

  return (
    <div
      onClick={onClick}
      className={`card p-4 hover:shadow-card-md transition-all duration-200 cursor-pointer group relative overflow-hidden
        ${isPending ? 'ring-1 ring-amber-300 bg-gradient-to-br from-amber-50/50 to-white' : ''}
        ${isPartial ? 'ring-1 ring-blue-200 bg-gradient-to-br from-blue-50/30 to-white' : ''}
        ${isReceived ? 'hover:bg-cream-50/40' : ''}`}
    >
      {/* Franja lateral por estado */}
      {isPending && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-l-xl" />}
      {isPartial  && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400  rounded-l-xl" />}
      {isReceived && <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-400  rounded-l-xl" />}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
              {purchase.number}
            </span>
            <StatusBadge status={purchase.status} />
          </div>
          <p className="text-[13px] font-semibold text-luma-text mt-2 truncate">{purchase.product_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {purchase.size && (
              <span className="text-[10px] bg-cream-200 text-luma-muted px-1.5 py-0.5 rounded font-medium">
                T: {purchase.size}
              </span>
            )}
            {purchase.color && (
              <span className="text-[10px] bg-cream-200 text-luma-muted px-1.5 py-0.5 rounded font-medium">
                {purchase.color}
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[15px] font-bold text-luma-text">{purchase.requested_qty} ud.</p>
          {purchase.unit_cost && (
            <p className="text-[11px] text-luma-faint mt-0.5">{fmt(purchase.unit_cost)}/u</p>
          )}
        </div>
      </div>

      {/* Barra de progreso para parcial y recibida */}
      {(isPartial || isReceived) && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-luma-faint mb-1.5">
            <span>Recibido: <span className="font-semibold text-luma-muted">{purchase.received_qty}</span></span>
            <span className={`font-semibold ${isReceived ? 'text-teal-600' : 'text-blue-600'}`}>{progress}%</span>
          </div>
          <ProgressBar value={purchase.received_qty} max={purchase.requested_qty} />
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-luma-border flex items-center justify-between">
        <p className="text-[10px] text-luma-faint">
          {new Date(purchase.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
        <ChevronRight size={13} className="text-luma-faint group-hover:text-teal-500 transition-colors" />
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Compras() {
  const [purchases,      setPurchases]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [hasLoaded,      setHasLoaded]      = useState(false)
  const [page,           setPage]           = useState(1)
  const [totalCount,     setTotalCount]     = useState(0)
  const [stats,          setStats]          = useState({ pending: 0, partial: 0, received: 0, cancelled: 0, pending_value: 0 })
  const [filter,         setFilter]         = useState('')
  const [inputSearch,    setInputSearch]    = useState('')
  const [search,         setSearch]         = useState('')
  const [selected,       setSelected]       = useState(null)
  const [showCreate,     setShowCreate]     = useState(false)
  const [showEdit,       setShowEdit]       = useState(false)
  const [showReceive,    setShowReceive]    = useState(false)
  const [confirmCancel,  setConfirmCancel]  = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)

  // Debounce: espera 350 ms tras dejar de tipear antes de disparar la API
  useEffect(() => {
    const t = setTimeout(() => setSearch(inputSearch), 350)
    return () => clearTimeout(t)
  }, [inputSearch])

  // Params compartidos entre load y loadStats
  const filterParams = useMemo(() => {
    const p = {}
    if (filter) p.status = filter
    if (search) p.search = search
    return p
  }, [filter, search])

  const load = useCallback(async (p = 1) => {
    setPage(p)
    setLoading(true)
    try {
      const params = { ...filterParams, page: p, page_size: PAGE_SIZE_COMPRAS }
      const { data } = await svc.getPurchaseOrders(params)
      setPurchases(data?.results ?? data ?? [])
      setTotalCount(data?.count ?? 0)
    } catch { toast.error('Error cargando órdenes de compra') }
    finally  { setLoading(false); setHasLoaded(true) }
  }, [filterParams])

  // loadStats — conteos globales (sin filtros de búsqueda), para el panel de KPIs
  const loadStats = useCallback(async () => {
    try {
      const { data } = await svc.getPurchaseOrderStats()
      setStats(data)
    } catch {}
  }, [])

  useEffect(() => { load(1) }, [load])
  useEffect(() => { loadStats() }, [loadStats])

  // ── Acciones ─────────────────────────────────────────────────────────────────
  const handleCreate = async (payload) => {
    try {
      await svc.createPurchaseOrder(payload)
      toast.success('Orden de compra creada')
      setShowCreate(false)
      load(1); loadStats()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al crear OC')
      throw err
    }
  }

  const handleEdit = async (id, payload) => {
    try {
      const { data } = await svc.updatePurchaseOrder(id, payload)
      toast.success('OC actualizada')
      setShowEdit(false)
      setSelected(data)
      load(1); loadStats()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al actualizar')
      throw err
    }
  }

  const handleReceive = async (payload) => {
    try {
      const { data } = await svc.receivePurchaseOrder(selected.id, payload)
      const isComplete = data.status === 'received'
      toast.success(isComplete ? 'Mercancía recibida — stock actualizado' : 'Recepción parcial registrada')
      setShowReceive(false)
      setSelected(data)
      load(1); loadStats()
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.response?.data?.qty_received || 'Error al registrar recepción')
      throw err
    }
  }

  const handleCancelConfirmed = async () => {
    setConfirmCancel(false)
    try {
      const { data } = await svc.cancelPurchaseOrder(selected.id)
      toast.success('OC cancelada')
      setSelected(data)
      load(1); loadStats()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al cancelar')
    }
  }

  const handleDeleteConfirmed = async () => {
    setConfirmDelete(false)
    try {
      await svc.deletePurchaseOrder(selected.id)
      toast.success('OC eliminada')
      setSelected(null)
      load(1); loadStats()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al eliminar')
    }
  }

  const hasActiveFilters = filter || inputSearch

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-up">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-50 rounded-2xl flex items-center justify-center flex-shrink-0">
            <ShoppingBag size={20} className="text-teal-600" />
          </div>
          <div>
            <h1 className="page-title">Compras</h1>
            <p className="text-[13px] text-luma-muted mt-0.5">
              {totalCount.toLocaleString('es-CO')} órdenes de compra
              {stats.pending > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-semibold">
                  <AlertTriangle size={11} />
                  {stats.pending} pendiente{stats.pending > 1 ? 's' : ''}
                </span>
              )}
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
          <Button variant="teal" size="sm" icon={Plus} onClick={() => setShowCreate(true)}>
            <span className="hidden sm:inline">Nueva OC</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Pendientes */}
        <div className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-all duration-200">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Clock size={17} className="text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="section-label">Pendientes</p>
            <p className="text-[22px] font-bold text-amber-600 leading-tight mt-0.5">{stats.pending}</p>
          </div>
          {stats.pending > 0 && (
            <span className="ml-auto w-2 h-2 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />
          )}
        </div>
        {/* Parciales */}
        <div className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-all duration-200">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Truck size={17} className="text-blue-500" />
          </div>
          <div>
            <p className="section-label">Parciales</p>
            <p className="text-[22px] font-bold text-blue-600 leading-tight mt-0.5">{stats.partial}</p>
          </div>
        </div>
        {/* Recibidas */}
        <div className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-all duration-200">
          <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircle size={17} className="text-teal-500" />
          </div>
          <div>
            <p className="section-label">Recibidas</p>
            <p className="text-[22px] font-bold text-teal-600 leading-tight mt-0.5">{stats.received}</p>
          </div>
        </div>
        {/* Valor pendiente */}
        <div className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-all duration-200">
          <div className="w-10 h-10 bg-cream-200 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShoppingBag size={17} className="text-luma-muted" />
          </div>
          <div className="min-w-0">
            <p className="section-label">Valor pendiente</p>
            <p className="text-[16px] font-bold text-luma-text leading-tight mt-0.5 truncate">
              {stats.pending_value > 0 ? fmt(stats.pending_value) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Barra de filtros ── */}
      <div className="card p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Búsqueda */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
            <input
              value={inputSearch}
              onChange={e => setInputSearch(e.target.value)}
              placeholder="Buscar por producto o número OC..."
              className="input-base w-full !pl-9"
            />
          </div>
          {/* Filtro por estado */}
          <div className="relative">
            <SlidersHorizontal size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="input-base !pl-9 w-full sm:w-48 appearance-none"
            >
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="partial">Parcial</option>
              <option value="received">Recibida</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>
        </div>

        {/* Chips de filtros activos */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-luma-border">
            <span className="text-[11px] text-luma-faint">Filtros:</span>
            {filter && (
              <button
                onClick={() => setFilter('')}
                className="inline-flex items-center gap-1 text-[11px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-lg hover:bg-teal-100 transition-colors"
              >
                {filter === 'pending' ? 'Pendiente'
                  : filter === 'partial'    ? 'Parcial'
                  : filter === 'received'   ? 'Recibida'
                  : 'Cancelada'}
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

      {/* ── Lista ── */}
      {loading && !hasLoaded ? <PageLoader /> : null}
      <div className={loading && hasLoaded ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
      {purchases.length === 0 ? (
        <div className="card py-14 text-center">
          <div className="w-14 h-14 bg-cream-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShoppingBag size={24} className="text-luma-faint" />
          </div>
          <p className="text-[15px] font-semibold text-luma-text">Sin órdenes de compra</p>
          <p className="text-[13px] text-luma-muted mt-1">
            {hasActiveFilters
              ? 'No hay OC con los filtros actuales'
              : 'Crea una OC desde aquí o desde el Dashboard al detectar stock bajo'}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {purchases.map(p => (
            <PurchaseCard key={p.id} purchase={p} onClick={() => setSelected(p)} />
          ))}
        </div>
      )}
      </div>

      <Pagination
        page={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE_COMPRAS}
        onPageChange={load}
      />

      {/* ── Modales ──────────────────────────────────────────────── */}
      {showCreate && (
        <CreateModal
          initial={null}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {selected && !showEdit && !showReceive && (
        <DetailModal
          purchase={selected}
          onClose={() => setSelected(null)}
          onEdit={() => setShowEdit(true)}
          onReceive={() => setShowReceive(true)}
          onCancel={() => setConfirmCancel(true)}
          onDelete={() => setConfirmDelete(true)}
        />
      )}

      {selected && showEdit && (
        <EditModal
          purchase={selected}
          onSave={handleEdit}
          onClose={() => setShowEdit(false)}
        />
      )}

      {selected && showReceive && (
        <ReceiveModal
          purchase={selected}
          onConfirm={handleReceive}
          onClose={() => setShowReceive(false)}
        />
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancelar orden de compra"
        description={`¿Cancelar la orden ${selected?.number}? Esta acción no se puede deshacer.`}
        confirmLabel="Cancelar OC"
        onConfirm={handleCancelConfirmed}
        onCancel={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar orden de compra"
        description={`¿Eliminar definitivamente la orden ${selected?.number}?`}
        confirmLabel="Eliminar"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
