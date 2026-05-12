import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import toast from 'react-hot-toast'
import {
  Plus, Search, ShoppingCart, RefreshCw, X, Minus,
  User, FileText, Star, UserPlus, Link2, RotateCcw
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { PageLoader, EmptyState, Pagination } from '../components/ui/Misc'
import * as svc from '../api/services'
import { usePaymentMethods } from '../hooks/usePaymentMethods'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`

// ── Fila de venta en historial ────────────────────────────────────────────────
function SaleRow({ sale, onView, labelsMap = {} }) {
  return (
    <tr className="cursor-pointer hover:bg-cream-50 transition-colors" onClick={() => onView(sale)}>
      <td>
        <p className="font-mono text-[12px] font-semibold text-teal-600">{sale.number}</p>
        <p className="text-[10px] text-luma-faint">
          {new Date(sale.created_at).toLocaleString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
        </p>
      </td>
      <td className="hidden sm:table-cell">
        <p className="text-[12px]">{sale.customer_name || <span className="text-luma-faint italic">Sin cliente</span>}</p>
      </td>
      <td className="hidden md:table-cell">
        <span className="text-[10px] uppercase tracking-wide bg-cream-200 px-2 py-0.5 rounded font-semibold">
          {labelsMap[sale.payment_method] || sale.payment_method}
        </span>
      </td>
      <td className="font-bold text-[13px] text-teal-700">{fmt(sale.total)}</td>
      <td className="hidden lg:table-cell text-[11px] text-luma-muted">{sale.sold_by_name || '—'}</td>
    </tr>
  )
}

// ── Búsqueda de variante reutilizable ─────────────────────────────────────────
function VariantSearch({ query, onQueryChange, results, onSelect, selected, onClear, placeholder }) {
  return (
    <div className="relative">
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-teal-50 border border-teal-200 rounded-xl">
          <div className="flex-1">
            <p className="text-[13px] font-semibold">{selected.product_name}</p>
            <p className="text-[11px] text-luma-faint">
              {[selected.size && `T:${selected.size}`, selected.color].filter(Boolean).join(' / ')}
              {' '}· {fmt(selected.effective_price || selected.product_price)}
            </p>
          </div>
          <button onClick={onClear} className="text-luma-faint hover:text-red-500"><X size={13} /></button>
        </div>
      ) : (
        <>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
          <input
            className="input-base !pl-9"
            placeholder={placeholder}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            autoComplete="off"
          />
          {results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-luma-border rounded-xl shadow-card-md z-30 max-h-44 overflow-y-auto">
              {results.map(v => (
                <button
                  key={v.id}
                  onClick={() => onSelect(v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-cream-100 text-left text-[12px] border-b border-luma-border last:border-0"
                >
                  <div>
                    <span className="font-semibold">{v.product_name}</span>
                    {(v.size || v.color) && (
                      <span className="text-luma-faint ml-2">
                        {[v.size && `T:${v.size}`, v.color].filter(Boolean).join(' / ')}
                      </span>
                    )}
                    <span className="text-luma-faint ml-2">({v.stock} stock)</span>
                  </div>
                  <span className="font-bold text-teal-600 ml-4">{fmt(v.effective_price || v.product_price)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Modal: Devolución / Cambio ────────────────────────────────────────────────
function ReturnModal({ onSaved, onClose }) {
  const [type,       setType]       = useState('return')
  const [retQuery,   setRetQuery]   = useState('')
  const [retResults, setRetResults] = useState([])
  const [retVariant, setRetVariant] = useState(null)
  const [retQty,     setRetQty]     = useState(1)
  const [retPrice,   setRetPrice]   = useState('')
  const [swpQuery,   setSwpQuery]   = useState('')
  const [swpResults, setSwpResults] = useState([])
  const [swpVariant, setSwpVariant] = useState(null)
  const [swpQty,     setSwpQty]     = useState(1)
  const [swpPrice,   setSwpPrice]   = useState('')
  const [reason,     setReason]     = useState('')
  const [note,       setNote]       = useState('')
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    if (!retQuery.trim()) { setRetResults([]); return }
    const t = setTimeout(async () => {
      try { const { data } = await svc.searchProductsForSale(retQuery.trim()); setRetResults(data ?? []) } catch {}
    }, 350)
    return () => clearTimeout(t)
  }, [retQuery])

  useEffect(() => {
    if (!swpQuery.trim()) { setSwpResults([]); return }
    const t = setTimeout(async () => {
      try { const { data } = await svc.searchProductsForSale(swpQuery.trim()); setSwpResults(data ?? []) } catch {}
    }, 350)
    return () => clearTimeout(t)
  }, [swpQuery])

  const handleSubmit = async () => {
    if (!retVariant)                    { toast.error('Selecciona el producto a devolver'); return }
    if (!retPrice)                      { toast.error('Ingresa el precio de devolución'); return }
    if (!reason)                        { toast.error('Selecciona la razón de la devolución'); return }
    if (type === 'swap' && !swpVariant) { toast.error('Selecciona el producto de reemplazo'); return }
    setSaving(true)
    try {
      const payload = {
        type,
        returned_variant: retVariant.id,
        returned_quantity: retQty,
        returned_price: retPrice,
        reason,
        note,
      }
      if (type === 'swap') {
        payload.swapped_variant  = swpVariant.id
        payload.swapped_quantity = swpQty
        if (swpPrice) payload.swapped_price = swpPrice
      }
      await svc.createReturn(payload)
      toast.success(type === 'swap' ? 'Cambio registrado ✓' : 'Devolución registrada ✓')
      onSaved()
      onClose()
    } catch (e) {
      const resp = e.response?.data
      const msg = typeof resp === 'string' ? resp
        : Object.values(resp || {}).flat()[0] || 'Error al registrar'
      toast.error(String(msg))
    } finally { setSaving(false) }
  }

  const retDiff = type === 'swap' && swpVariant && swpPrice && retPrice
    ? (Number(swpPrice) * swpQty) - (Number(retPrice) * retQty)
    : null

  return (
    <Modal open onClose={onClose} title="Devolución / Cambio" size="md"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="teal" loading={saving} onClick={handleSubmit} icon={RotateCcw}>
            {type === 'swap' ? 'Registrar cambio' : 'Registrar devolución'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Tipo */}
        <div>
          <label className="text-[12px] font-semibold text-luma-text mb-1.5 block">Tipo</label>
          <div className="grid grid-cols-2 gap-2">
            {[['return', 'Devolución'], ['swap', 'Cambio de prenda']].map(([val, label]) => (
              <button key={val} onClick={() => setType(val)}
                className={`py-2.5 rounded-xl text-[12px] font-semibold transition-all border
                  ${type === val ? 'bg-teal-500 text-white border-teal-500' : 'bg-cream-100 text-luma-text border-luma-border hover:bg-cream-200'}`}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Producto devuelto */}
        <div>
          <label className="text-[12px] font-semibold text-luma-text mb-1.5 block">Producto que devuelve el cliente</label>
          <VariantSearch
            query={retQuery} onQueryChange={setRetQuery}
            results={retResults} onSelect={v => { setRetVariant(v); setRetResults([]); setRetPrice(String(v.effective_price || v.product_price || '')) }}
            selected={retVariant} onClear={() => { setRetVariant(null); setRetQuery(''); setRetPrice('') }}
            placeholder="Buscar producto devuelto..."
          />
        </div>

        {retVariant && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-semibold text-luma-text mb-1.5 block">Cantidad</label>
              <input type="number" min="1" className="input-base" value={retQty}
                onChange={e => setRetQty(Math.max(1, Number(e.target.value)))} />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-luma-text mb-1.5 block">Precio unitario</label>
              <input type="number" className="input-base" value={retPrice}
                onChange={e => setRetPrice(e.target.value)} placeholder="0" />
            </div>
          </div>
        )}

        {/* Producto de reemplazo (solo en cambio) */}
        {type === 'swap' && (
          <div>
            <label className="text-[12px] font-semibold text-luma-text mb-1.5 block">Producto de reemplazo</label>
            <VariantSearch
              query={swpQuery} onQueryChange={setSwpQuery}
              results={swpResults} onSelect={v => { setSwpVariant(v); setSwpResults([]); setSwpPrice(String(v.effective_price || v.product_price || '')) }}
              selected={swpVariant} onClear={() => { setSwpVariant(null); setSwpQuery(''); setSwpPrice('') }}
              placeholder="Buscar producto de cambio..."
            />
            {swpVariant && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-[12px] font-semibold text-luma-text mb-1.5 block">Cantidad</label>
                  <input type="number" min="1" className="input-base" value={swpQty}
                    onChange={e => setSwpQty(Math.max(1, Number(e.target.value)))} />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-luma-text mb-1.5 block">Precio unitario</label>
                  <input type="number" className="input-base" value={swpPrice}
                    onChange={e => setSwpPrice(e.target.value)} placeholder="Precio del producto" />
                </div>
              </div>
            )}
            {retDiff !== null && (
              <div className={`mt-2 px-3 py-2 rounded-xl text-[12px] font-semibold ${retDiff > 0 ? 'bg-teal-50 text-teal-700' : retDiff < 0 ? 'bg-amber-50 text-amber-700' : 'bg-cream-100 text-luma-muted'}`}>
                {retDiff > 0 ? `Cliente paga diferencia: ${fmt(retDiff)}`
                  : retDiff < 0 ? `Tienda devuelve diferencia: ${fmt(Math.abs(retDiff))}`
                  : 'Sin diferencia de precio'}
              </div>
            )}
          </div>
        )}

        {/* Razón */}
        <div>
          <label className="text-[12px] font-semibold text-luma-text mb-1.5 block">
            Razón <span className="text-red-400">*</span>
          </label>
          <select className="input-base" value={reason} onChange={e => setReason(e.target.value)}>
            <option value="">Seleccionar razón...</option>
            <option value="size">Talla incorrecta</option>
            <option value="damaged">Prenda dañada / defecto</option>
            <option value="order">Encargo no aceptado</option>
            <option value="other">Otro</option>
          </select>
        </div>
        <div>
          <label className="text-[12px] font-semibold text-luma-text mb-1.5 block">
            Nota interna <span className="text-luma-faint font-normal">(opcional)</span>
          </label>
          <textarea className="input-base resize-none" rows={2} placeholder="Observaciones adicionales..."
            value={note} onChange={e => setNote(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}

// ── Modal: Nueva venta ────────────────────────────────────────────────────────
function NewSaleModal({ onSaved, onClose }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [cart,    setCart]    = useState([])
  const [method,  setMethod]  = useState('cash')
  const [received, setReceived] = useState('')
  const [note,    setNote]    = useState('')
  const [customer, setCustomer] = useState(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [saving,  setSaving]  = useState(false)
  const [noCash,  setNoCash]  = useState(false)
  // Inline customer creation
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustName, setNewCustName]   = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [savingCust, setSavingCust]     = useState(false)
  const searchRef = useRef(null)
  const { enabledMethods } = usePaymentMethods()

  // ── Búsqueda optimizada de productos (endpoint POS) ─────────────────────────
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await svc.searchProductsForSale(query.trim())
        setResults(data ?? [])
      } catch { toast.error('Error buscando productos') }
    }, 350)
    return () => clearTimeout(t)
  }, [query])

  // ── Búsqueda de clientes ──────────────────────────────────────────────────
  useEffect(() => {
    if (!customerQuery.trim()) { setCustomerResults([]); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await svc.getCustomers({ search: customerQuery.trim() })
        setCustomerResults(data?.results ?? data ?? [])
      } catch {}
    }, 400)
    return () => clearTimeout(t)
  }, [customerQuery])

  const addToCart = (variant) => {
    setCart(prev => {
      const key = variant.id
      const ex  = prev.find(i => i.variant.id === key)
      if (ex) return prev.map(i => i.variant.id === key
        ? { ...i, quantity: Math.min(i.quantity + 1, i.variant.stock) } : i)
      return [...prev, { variant, quantity: 1 }]
    })
    setQuery('')
    setResults([])
    searchRef.current?.focus()
  }

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.variant.id !== id))
  const updateQty = (id, qty) => setCart(prev =>
    prev.map(i => i.variant.id === id ? { ...i, quantity: Math.max(1, Math.min(qty, i.variant.stock)) } : i)
  )

  const subtotal = cart.reduce((s, i) => {
    const price = Number(i.variant.effective_price) || Number(i.variant.product_price) || 0
    return s + price * i.quantity
  }, 0)
  const change = method === 'cash' && received ? Number(received) - subtotal : null

  const handleCreateCustomer = async () => {
    if (!newCustName.trim()) { toast.error('El nombre es obligatorio'); return }
    setSavingCust(true)
    try {
      const { data } = await svc.createCustomer({ name: newCustName.trim(), phone: newCustPhone.trim() })
      setCustomer({ id: data.id, name: data.name, points: data.points })
      setShowNewCustomer(false)
      setNewCustName(''); setNewCustPhone('')
      toast.success(`Cliente "${data.name}" creado y seleccionado`)
    } catch { toast.error('Error creando cliente') }
    finally { setSavingCust(false) }
  }

  const handleSubmit = async () => {
    if (!cart.length) { toast.error('Agrega al menos un producto'); return }
    if (method === 'cash' && received && Number(received) < subtotal) {
      toast.error('El efectivo recibido es menor al total'); return
    }
    setSaving(true)
    try {
      const payload = {
        items: cart.map(i => ({ variant_id: i.variant.id, quantity: i.quantity })),
        payment_method: method,
        note,
        customer: customer?.id || undefined,
        cash_received: method === 'cash' && received ? received : undefined,
      }
      const { data } = await svc.createSale(payload)
      const pts = data.points_earned
      toast.success(pts > 0
        ? `Venta registrada · +${pts} puntos para ${customer?.name || 'cliente'}`
        : 'Venta registrada ✓')
      onSaved()
      onClose()
    } catch (e) {
      const resp = e.response?.data
      if (typeof resp?.detail === 'string' && resp.detail.includes('caja')) {
        setNoCash(true); return
      }
      const msg = typeof resp === 'string' ? resp
        : Object.values(resp || {}).flat()[0] || 'Error al registrar venta'
      toast.error(String(msg))
    } finally { setSaving(false) }
  }

  return (
    <>
      <Modal open onClose={onClose} title="Nueva venta" size="lg"
        footer={
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-3">
            <div>
              {change !== null && change >= 0 && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2">
                  <p className="text-[12px] text-teal-600 font-semibold">
                    Vuelto: <span className="text-[15px]">{fmt(change)}</span>
                  </p>
                </div>
              )}
              {change !== null && change < 0 && (
                <p className="text-[12px] text-red-500 font-medium">Efectivo insuficiente</p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button variant="teal" loading={saving} onClick={handleSubmit} icon={ShoppingCart}>
                <span className="hidden sm:inline">Registrar venta · </span>{fmt(subtotal)}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Advertencia caja cerrada */}
          {noCash && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12px] text-amber-700">
              No hay caja abierta hoy. Ve al modulo Caja y abre la sesion del dia antes de registrar ventas.
            </div>
          )}

          {/* Buscador de productos */}
          <div>
            <label className="text-[12px] font-semibold text-luma-text mb-1.5 block">
              Buscar producto
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
              <input
                ref={searchRef}
                className="input-base !pl-9"
                placeholder="Nombre, SKU o referencia..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
                autoComplete="off"
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); setResults([]) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-luma-faint hover:text-luma-text"
                >
                  <X size={13} />
                </button>
              )}
              {/* Resultados */}
              {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-luma-border rounded-xl shadow-card-md z-30 max-h-52 overflow-y-auto">
                  {results.map(v => (
                    <button
                      key={v.id}
                      onClick={() => addToCart(v)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-cream-100 text-left text-[12px] transition-colors border-b border-luma-border last:border-0"
                    >
                      <div>
                        <span className="font-semibold text-luma-text">{v.product_name}</span>
                        {(v.size || v.color) && (
                          <span className="text-luma-faint ml-2">
                            {[v.size && `T:${v.size}`, v.color].filter(Boolean).join(' / ')}
                          </span>
                        )}
                        <span className="text-luma-faint ml-2">({v.stock} en stock)</span>
                      </div>
                      <span className="font-bold text-teal-600 flex-shrink-0 ml-4">
                        {fmt(v.effective_price || v.product_price)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {query.length > 1 && results.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-luma-border rounded-xl shadow-card-md z-30 px-4 py-3 text-[12px] text-luma-faint">
                  Sin resultados para "{query}"
                </div>
              )}
            </div>
          </div>

          {/* Carrito */}
          {cart.length === 0 ? (
            <div className="py-8 text-center text-luma-faint text-[12px] bg-cream-100 rounded-xl">
              <ShoppingCart size={24} className="mx-auto mb-2 opacity-40" />
              Busca y agrega productos a la venta
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map(({ variant: v, quantity }) => {
                const price = Number(v.effective_price) || Number(v.product_price) || 0
                return (
                  <div key={v.id} className="flex items-center gap-3 p-3 bg-cream-100 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate">{v.product_name}</p>
                      {(v.size || v.color) && (
                        <p className="text-[11px] text-luma-faint">
                          {[v.size && `T:${v.size}`, v.color].filter(Boolean).join(' / ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQty(v.id, quantity - 1)}
                        disabled={quantity <= 1}
                        className="w-7 h-7 rounded-lg border border-luma-border bg-white flex items-center justify-center hover:bg-cream-200 disabled:opacity-40 transition-colors"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="w-7 text-center text-[13px] font-bold">{quantity}</span>
                      <button
                        onClick={() => updateQty(v.id, quantity + 1)}
                        disabled={quantity >= v.stock}
                        className="w-7 h-7 rounded-lg border border-luma-border bg-white flex items-center justify-center hover:bg-cream-200 disabled:opacity-40 transition-colors"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                    <p className="font-bold text-[13px] w-24 text-right text-teal-700">
                      {fmt(price * quantity)}
                    </p>
                    <button
                      onClick={() => removeFromCart(v.id)}
                      className="text-luma-faint hover:text-red-500 transition-colors p-1"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )
              })}
              <div className="flex justify-between items-center px-3 py-3 bg-teal-50 border border-teal-200 rounded-xl">
                <span className="text-[13px] font-bold text-teal-900">Total</span>
                <span className="text-[16px] font-bold text-teal-700">{fmt(subtotal)}</span>
              </div>
            </div>
          )}

          {/* Cliente (opcional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-semibold text-luma-text">
                Cliente <span className="text-luma-faint font-normal">(opcional)</span>
              </label>
              {!customer && !showNewCustomer && (
                <button
                  onClick={() => setShowNewCustomer(true)}
                  className="flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-700 font-semibold"
                >
                  <UserPlus size={12} /> Crear nuevo
                </button>
              )}
            </div>

            {showNewCustomer ? (
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 space-y-2">
                <p className="text-[11px] font-semibold text-teal-700">Nuevo cliente</p>
                <input
                  className="input-base text-[12px]"
                  placeholder="Nombre *"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  autoFocus
                />
                <input
                  className="input-base text-[12px]"
                  placeholder="Teléfono (opcional)"
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="teal" size="sm" loading={savingCust} onClick={handleCreateCustomer}>Crear y seleccionar</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowNewCustomer(false)}>Cancelar</Button>
                </div>
              </div>
            ) : customer ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-teal-50 border border-teal-200 rounded-xl">
                <User size={13} className="text-teal-500 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-[13px] font-semibold">{customer.name}</span>
                  {customer.points > 0 && (
                    <span className="ml-2 text-[11px] text-teal-600">
                      <Star size={10} className="inline mb-0.5" /> {customer.points} pts disponibles
                    </span>
                  )}
                </div>
                <button onClick={() => setCustomer(null)} className="text-luma-faint hover:text-red-500">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
                <input
                  className="input-base !pl-9"
                  placeholder="Buscar cliente por nombre o teléfono..."
                  value={customerQuery}
                  onChange={e => setCustomerQuery(e.target.value)}
                  autoComplete="off"
                />
                {customerResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-luma-border rounded-xl shadow-card-md z-20 max-h-40 overflow-y-auto">
                    {customerResults.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setCustomer({ id: c.id, name: c.name, points: c.points }); setCustomerQuery(''); setCustomerResults([]) }}
                        className="w-full text-left px-4 py-2.5 hover:bg-cream-100 text-[12px] border-b border-luma-border last:border-0"
                      >
                        <span className="font-semibold">{c.name}</span>
                        {c.phone && <span className="text-luma-faint ml-2">{c.phone}</span>}
                        <span className="text-teal-500 ml-2 text-[10px]"><Star size={9} className="inline" /> {c.points || 0} pts</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Método de pago */}
          <div>
            <label className="text-[12px] font-semibold text-luma-text mb-1.5 block">Método de pago</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {enabledMethods.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setMethod(key)}
                  className={`py-2.5 rounded-xl text-[12px] font-semibold transition-all border
                    ${method === key
                      ? 'bg-teal-500 text-white border-teal-500'
                      : 'bg-cream-100 text-luma-text border-luma-border hover:bg-cream-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Efectivo recibido */}
          {method === 'cash' && (
            <div>
              <label className="text-[12px] font-semibold text-luma-text mb-1.5 block">Efectivo recibido</label>
              <input
                type="number"
                className="input-base"
                placeholder={String(subtotal)}
                value={received}
                onChange={e => setReceived(e.target.value)}
              />
            </div>
          )}

          {/* Nota */}
          <div>
            <label className="text-[12px] font-semibold text-luma-text mb-1.5 block">
              Nota <span className="text-luma-faint font-normal">(opcional)</span>
            </label>
            <textarea
              className="input-base resize-none"
              rows={2}
              placeholder="Observaciones de la venta..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </>
  )
}

// ── Modal: Detalle de venta ───────────────────────────────────────────────────
function SaleDetailModal({ sale, onClose, labelsMap = {} }) {
  return (
    <Modal open onClose={onClose} title={`Venta ${sale.number}`} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
          {[
            ['Fecha',    new Date(sale.created_at).toLocaleString('es-CO')],
            ['Vendedor', sale.sold_by_name || '—'],
            ['Cliente',  sale.customer_name || 'Sin cliente'],
            ['Pago',     labelsMap[sale.payment_method] || sale.payment_method],
          ].map(([k, v]) => (
            <div key={k} className="bg-cream-100 rounded-xl p-3">
              <p className="text-luma-faint text-[10px] uppercase tracking-wide">{k}</p>
              <p className="font-semibold mt-0.5">{v}</p>
            </div>
          ))}
        </div>
        {sale.note && (
          <div className="bg-cream-100 rounded-xl p-3 text-[12px]">
            <p className="text-luma-faint text-[10px] uppercase tracking-wide mb-0.5">Nota</p>
            <p>{sale.note}</p>
          </div>
        )}
        <div>
          <p className="section-label mb-2">Items</p>
          {(sale.items || []).map(item => (
            <div key={item.id} className="flex justify-between py-2 border-b border-luma-border text-[12px] last:border-0">
              <div>
                <span className="font-medium">{item.variant_display || item.product_name}</span>
                <span className="text-luma-faint ml-2">x{item.quantity}</span>
              </div>
              <span className="font-bold">{fmt(item.subtotal)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1 pt-1">
          {sale.discount > 0 && (
            <div className="flex justify-between text-[12px] text-teal-600">
              <span>Descuento (puntos)</span>
              <span>-{fmt(sale.discount)}</span>
            </div>
          )}
          {sale.cash_received && (
            <div className="flex justify-between text-[12px] text-luma-muted">
              <span>Recibido</span>
              <span>{fmt(sale.cash_received)}</span>
            </div>
          )}
          {sale.cash_change > 0 && (
            <div className="flex justify-between text-[12px] text-luma-muted">
              <span>Vuelto</span>
              <span>{fmt(sale.cash_change)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 font-bold text-[15px] border-t border-luma-border">
            <span>Total</span>
            <span className="text-teal-600">{fmt(sale.total)}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
const PAGE_SIZE_VENTAS = 50

export default function Ventas() {
  const [sales,       setSales]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [page,        setPage]        = useState(1)
  const [totalCount,  setTotalCount]  = useState(0)
  const [stats,       setStats]       = useState({ total_revenue: 0, avg_ticket: 0, count: 0 })
  const [inputSearch, setInputSearch] = useState('')  // valor inmediato del input
  const [search,      setSearch]      = useState('')  // valor debounced (dispara API)
  const [filter,      setFilter]      = useState('')
  const [soldBy,      setSoldBy]      = useState('')
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [sellers,     setSellers]     = useState([])
  const [newModal,    setNewModal]    = useState(false)
  const [viewSale,    setViewSale]    = useState(null)
  const [returnModal, setReturnModal] = useState(false)
  const { methods, labelsMap } = usePaymentMethods()

  // Debounce: espera 350 ms tras dejar de tipear antes de disparar la API
  useEffect(() => {
    const t = setTimeout(() => setSearch(inputSearch), 350)
    return () => clearTimeout(t)
  }, [inputSearch])

  // Cargar lista de vendedores (para filtro)
  useEffect(() => {
    svc.getUsers()
      .then(({ data }) => setSellers(data?.results ?? data ?? []))
      .catch(() => {})
  }, [])

  // Params compartidos para load y loadStats
  const filterParams = useMemo(() => {
    const p = {}
    if (search)   p.search         = search
    if (filter)   p.payment_method = filter
    if (soldBy)   p.sold_by        = soldBy
    if (dateFrom) p.from_date      = dateFrom
    if (dateTo)   p.to_date        = dateTo
    return p
  }, [search, filter, soldBy, dateFrom, dateTo])

  // load(p) — carga la página p con los filtros actuales
  const load = useCallback(async (p = 1) => {
    setPage(p)
    setLoading(true)
    try {
      const { data } = await svc.getSales({ ...filterParams, page: p, page_size: PAGE_SIZE_VENTAS })
      setSales(data?.results ?? data ?? [])
      setTotalCount(data?.count ?? 0)
    } catch { toast.error('Error cargando ventas') }
    finally { setLoading(false) }
  }, [filterParams])

  // loadStats — KPIs agregados del servidor (reflejan TODOS los registros con los filtros)
  const loadStats = useCallback(async () => {
    try {
      const { data } = await svc.getSalesStats(filterParams)
      setStats(data)
    } catch {}
  }, [filterParams])

  useEffect(() => { load(1)    }, [load])
  useEffect(() => { loadStats() }, [loadStats])

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="page-title">Ventas</h2>
          <p className="text-[13px] text-luma-muted mt-0.5">{totalCount.toLocaleString('es-CO')} registros</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={RotateCcw} onClick={() => setReturnModal(true)}>
            <span className="hidden sm:inline">Devolución</span>
          </Button>
          <Button variant="teal" icon={Plus} onClick={() => setNewModal(true)}>
            <span className="hidden sm:inline">Nueva venta</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
          <button onClick={() => { load(1); loadStats() }} className="btn-ghost" title="Actualizar">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* KPI Strip — valores reales del servidor (incluyen todos los registros, no solo la página) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="section-label">Total ingresos</p>
          <p className="text-xl font-bold text-teal-600 mt-1">{fmt(stats.total_revenue)}</p>
        </div>
        <div className="card p-4">
          <p className="section-label">N de transacciones</p>
          <p className="text-xl font-bold text-luma-text mt-1">{stats.count.toLocaleString('es-CO')}</p>
        </div>
        <div className="card p-4">
          <p className="section-label">Ticket promedio</p>
          <p className="text-xl font-bold text-luma-text mt-1">{fmt(stats.avg_ticket)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
          <input
            value={inputSearch}
            onChange={e => setInputSearch(e.target.value)}
            placeholder="Buscar por número o cliente..."
            className="input-base !pl-9"
          />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="input-base w-full sm:w-40">
          <option value="">Todos los métodos</option>
          {methods.map(({ key, label }) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        {sellers.length > 0 && (
          <select value={soldBy} onChange={e => setSoldBy(e.target.value)} className="input-base w-full sm:w-40">
            <option value="">Todos los vendedores</option>
            {sellers.map(u => (
              <option key={u.id} value={u.id}>
                {u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username}
              </option>
            ))}
          </select>
        )}
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-base w-full sm:w-36" title="Desde" />
        <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className="input-base w-full sm:w-36" title="Hasta" />
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {sales.length === 0 && !loading ? (
          <EmptyState
            icon={ShoppingCart}
            title="Sin ventas"
            description='Registra la primera venta con el boton "Nueva venta"'
            action={<Button variant="teal" icon={Plus} size="sm" onClick={() => setNewModal(true)}>Nueva venta</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="luma-table">
                <thead>
                  <tr>
                    <th>Numero</th>
                    <th className="hidden sm:table-cell">Cliente</th>
                    <th className="hidden md:table-cell">Metodo pago</th>
                    <th>Total</th>
                    <th className="hidden lg:table-cell">Vendedor</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => <SaleRow key={s.id} sale={s} onView={setViewSale} labelsMap={labelsMap} />)}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-luma-border">
              <Pagination
                page={page}
                totalCount={totalCount}
                pageSize={PAGE_SIZE_VENTAS}
                onPageChange={load}
              />
            </div>
          </>
        )}
      </div>

      {returnModal && <ReturnModal onSaved={() => { load(1); loadStats() }} onClose={() => setReturnModal(false)} />}
      {newModal && <NewSaleModal onSaved={() => { load(1); loadStats() }} onClose={() => setNewModal(false)} />}
      {viewSale && <SaleDetailModal sale={viewSale} onClose={() => setViewSale(null)} labelsMap={labelsMap} />}
    </div>
  )
}
