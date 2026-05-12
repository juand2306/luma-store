import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { Zap, Search, ShoppingCart, Plus, Minus, CreditCard, CheckCircle, X, User, UserPlus, Star } from 'lucide-react'
import { useAuth } from '../store/authContext'
import { Link } from 'react-router-dom'
import * as svc from '../api/services'
import { usePaymentMethods } from '../hooks/usePaymentMethods'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`

// Iconos de respaldo por key
const METHOD_ICONS = {
  cash: '💵', transfer: '🏦', nequi: '🟣', daviplata: '🔴',
  debit: '💳', credit: '💳', other: '💰',
}

export default function VentaRapida() {
  const { user } = useAuth()
  const searchRef = useRef(null)
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [cart,     setCart]     = useState([])
  const [method,   setMethod]   = useState('cash')
  const [received, setReceived] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [done,     setDone]     = useState(null)
  const { enabledMethods } = usePaymentMethods()
  // Customer
  const [custQuery,   setCustQuery]   = useState('')
  const [custResults, setCustResults] = useState([])
  const [customer,    setCustomer]    = useState(null)
  const [showNewCust, setShowNewCust] = useState(false)
  const [newCustName,  setNewCustName]  = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [savingCust,   setSavingCust]   = useState(false)

  // Búsqueda de productos
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await svc.searchProductsForSale(query.trim())
        setResults(data ?? [])
      } catch { toast.error('Error buscando productos') }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  // Búsqueda de clientes
  useEffect(() => {
    if (!custQuery.trim()) { setCustResults([]); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await svc.getCustomers({ search: custQuery.trim() })
        setCustResults(data?.results ?? data ?? [])
      } catch {}
    }, 350)
    return () => clearTimeout(t)
  }, [custQuery])

  const addToCart = (variant) => {
    setCart(prev => {
      const ex = prev.find(i => i.variant.id === variant.id)
      if (ex) return prev.map(i => i.variant.id === variant.id
        ? { ...i, quantity: Math.min(i.quantity + 1, variant.stock) } : i)
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

  const subtotal = cart.reduce((s, i) =>
    s + (Number(i.variant.effective_price) || Number(i.variant.product_price) || 0) * i.quantity, 0)
  const change = method === 'cash' && received ? Number(received) - subtotal : null

  const handleCreateCustomer = async () => {
    if (!newCustName.trim()) { toast.error('El nombre es obligatorio'); return }
    setSavingCust(true)
    try {
      const { data } = await svc.createCustomer({ name: newCustName.trim(), phone: newCustPhone.trim() })
      setCustomer({ id: data.id, name: data.name, points: data.points })
      setShowNewCust(false); setNewCustName(''); setNewCustPhone('')
      toast.success(`Cliente "${data.name}" creado`)
    } catch { toast.error('Error creando cliente') }
    finally { setSavingCust(false) }
  }

  const handleSell = async () => {
    if (!cart.length) { toast.error('Agrega al menos un producto'); return }
    if (method === 'cash' && received && Number(received) < subtotal) {
      toast.error('Efectivo insuficiente'); return
    }
    setSaving(true)
    try {
      const { data } = await svc.createSale({
        items: cart.map(i => ({ variant_id: i.variant.id, quantity: i.quantity })),
        payment_method: method,
        cash_received: method === 'cash' && received ? received : undefined,
        customer: customer?.id || undefined,
      })
      const pts = data.points_earned
      toast.success(pts > 0
        ? `¡Venta ${data.number} registrada! +${pts} pts`
        : `¡Venta ${data.number} registrada!`)
      setDone(data)
      setCart([])
      setReceived('')
      setCustomer(null)
      setTimeout(() => setDone(null), 6000)
    } catch (e) {
      const resp = e.response?.data
      if (typeof resp?.detail === 'string' && resp.detail.includes('caja')) {
        toast.error('No hay caja abierta hoy. Ve al módulo Caja para abrirla.')
        return
      }
      const msg = typeof resp === 'string' ? resp
        : Object.values(resp || {}).flat()[0] || 'Error al registrar'
      toast.error(String(msg))
    } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen bg-[#F0EDE7] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-luma-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 gradient-teal rounded-xl flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-luma-text">Venta Rápida</p>
            <p className="text-[10px] text-luma-faint">{user?.first_name || user?.username}</p>
          </div>
        </div>
        <Link to="/" className="text-[12px] text-luma-muted hover:text-teal-600 transition-colors">
          Panel →
        </Link>
      </header>

      {/* Success flash */}
      {done && (
        <div className="bg-teal-500 text-white px-4 py-3 flex items-center gap-3 animate-fade-up">
          <CheckCircle size={18} />
          <div>
            <p className="font-semibold text-[13px]">¡Venta {done.number} registrada!</p>
            <p className="text-[11px] text-white/80">Total: {fmt(done.total)}</p>
          </div>
        </div>
      )}

      <div className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-4">

        {/* Búsqueda de producto */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
          <input
            ref={searchRef}
            className="input-base py-4 text-[14px] rounded-2xl !pl-11"
            placeholder="Buscar producto por nombre o SKU..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-luma-faint hover:text-luma-text z-10"
            >
              <X size={14} />
            </button>
          )}
          {results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-card-md border border-luma-border z-20 max-h-64 overflow-y-auto">
              {results.map(v => (
                <button
                  key={v.id}
                  onClick={() => addToCart(v)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-cream-100 transition-colors border-b border-luma-border last:border-0"
                >
                  <div>
                    <p className="font-semibold text-[13px] text-luma-text">{v.product_name}</p>
                    <p className="text-[11px] text-luma-faint">
                      {[v.size && `T: ${v.size}`, v.color].filter(Boolean).join(' · ')} · {v.stock} ud.
                    </p>
                  </div>
                  <p className="font-bold text-teal-600 text-[14px] flex-shrink-0 ml-4">
                    {fmt(v.effective_price || v.product_price)}
                  </p>
                </button>
              ))}
            </div>
          )}
          {query.length > 1 && results.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-card-md border border-luma-border z-20 px-5 py-4 text-[13px] text-luma-faint">
              Sin resultados para "{query}"
            </div>
          )}
        </div>

        {/* Carrito */}
        {cart.length === 0 ? (
          <div className="card py-16 text-center">
            <ShoppingCart size={40} className="text-luma-faint mx-auto mb-3 opacity-50" />
            <p className="text-luma-muted text-[13px]">Busca y agrega productos al carrito</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map(({ variant: v, quantity }) => (
              <div key={v.id} className="card p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[14px] text-luma-text truncate">{v.product_name}</p>
                  <p className="text-[11px] text-luma-faint">
                    {[v.size && `T:${v.size}`, v.color].filter(Boolean).join(' / ')}
                    <span className="ml-2">{v.stock} en stock</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQty(v.id, quantity - 1)}
                    disabled={quantity <= 1}
                    className="w-10 h-10 rounded-xl border border-luma-border bg-cream-100 flex items-center justify-center hover:bg-cream-200 disabled:opacity-40 transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center font-bold text-[15px]">{quantity}</span>
                  <button
                    onClick={() => updateQty(v.id, quantity + 1)}
                    disabled={quantity >= v.stock}
                    className="w-10 h-10 rounded-xl border border-luma-border bg-cream-100 flex items-center justify-center hover:bg-cream-200 disabled:opacity-40 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[14px] text-teal-600">
                    {fmt((Number(v.effective_price) || Number(v.product_price)) * quantity)}
                  </p>
                  <button onClick={() => removeFromCart(v.id)} className="text-[11px] text-red-400 hover:text-red-600 mt-0.5">
                    Quitar
                  </button>
                </div>
              </div>
            ))}
            {/* Total */}
            <div className="flex justify-between items-center px-4 py-3 bg-teal-50 border border-teal-200 rounded-2xl">
              <span className="font-bold text-[15px] text-teal-900">Total</span>
              <span className="font-bold text-[18px] text-teal-700">{fmt(subtotal)}</span>
            </div>
          </div>
        )}

        {cart.length > 0 && (
          <div className="card p-5 space-y-4">
            {/* Cliente opcional */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-semibold text-luma-text">
                  Cliente <span className="text-luma-faint font-normal">(opcional)</span>
                </p>
                {!customer && !showNewCust && (
                  <button
                    onClick={() => setShowNewCust(true)}
                    className="flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-700 font-semibold"
                  >
                    <UserPlus size={12} /> Crear nuevo
                  </button>
                )}
              </div>

              {showNewCust ? (
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-teal-700">Nuevo cliente</p>
                  <input className="input-base text-[13px]" placeholder="Nombre *"
                    value={newCustName} onChange={e => setNewCustName(e.target.value)} autoFocus />
                  <input className="input-base text-[13px]" placeholder="Teléfono (opcional)"
                    value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateCustomer} disabled={savingCust}
                      className="flex-1 py-2 gradient-teal text-white text-[12px] font-semibold rounded-xl disabled:opacity-60"
                    >
                      {savingCust ? 'Creando...' : 'Crear y seleccionar'}
                    </button>
                    <button onClick={() => setShowNewCust(false)}
                      className="px-3 py-2 border border-luma-border rounded-xl text-[12px] text-luma-muted hover:bg-cream-100">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : customer ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-teal-50 border border-teal-200 rounded-xl">
                  <User size={13} className="text-teal-500" />
                  <div className="flex-1">
                    <span className="text-[13px] font-semibold">{customer.name}</span>
                    {customer.points > 0 && (
                      <span className="ml-2 text-[11px] text-teal-600">
                        <Star size={10} className="inline mb-0.5" /> {customer.points} pts
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
                    value={custQuery}
                    onChange={e => setCustQuery(e.target.value)}
                    autoComplete="off"
                  />
                  {custResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-luma-border rounded-xl shadow-card-md z-20 max-h-40 overflow-y-auto">
                      {custResults.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setCustomer({ id: c.id, name: c.name, points: c.points }); setCustQuery(''); setCustResults([]) }}
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
              <p className="text-[12px] font-semibold text-luma-text mb-2">Método de pago</p>
              <div className="grid grid-cols-3 gap-2">
                {enabledMethods.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setMethod(key)}
                    className={`py-3 rounded-xl text-[12px] font-semibold transition-all border
                      ${method === key
                        ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                        : 'bg-cream-100 text-luma-text border-luma-border hover:bg-cream-200'}`}
                  >
                    <span className="block text-lg mb-0.5">{METHOD_ICONS[key] || '💰'}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Efectivo recibido */}
            {method === 'cash' && (
              <div>
                <label className="text-[12px] font-semibold text-luma-text block mb-1.5">Efectivo recibido</label>
                <input
                  type="number"
                  placeholder={String(subtotal)}
                  value={received}
                  onChange={e => setReceived(e.target.value)}
                  className="input-base text-[15px] py-3"
                />
                {change !== null && change >= 0 && (
                  <p className="text-teal-600 font-bold text-[14px] mt-2">Vuelto: {fmt(change)}</p>
                )}
                {change !== null && change < 0 && (
                  <p className="text-red-500 text-[13px] mt-2">Efectivo insuficiente</p>
                )}
              </div>
            )}

            {/* Botón confirmar */}
            <button
              onClick={handleSell}
              disabled={saving}
              className="w-full py-4 gradient-teal text-white font-bold text-[15px] rounded-2xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 transition-all active:scale-[0.98]"
            >
              <CreditCard size={18} />
              {saving ? 'Procesando...' : `Confirmar venta · ${fmt(subtotal)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
