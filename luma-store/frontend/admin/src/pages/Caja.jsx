import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  CreditCard, Plus, Lock, Unlock, ArrowUpCircle, ArrowDownCircle,
  TrendingUp, TrendingDown, RefreshCw, ChevronDown, AlertCircle
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { PageLoader, EmptyState } from '../components/ui/Misc'
import { StatusBadge } from '../components/ui/Badge'
import * as svc from '../api/services'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`

// ── Movement row ─────────────────────────────────────────────────────────────
function MovRow({ mov }) {
  const isIncome = mov.type === 'income'
  const isRefund = mov.type === 'refund'
  return (
    <tr>
      <td>
        <div className="flex items-center gap-2">
          {isIncome
            ? <ArrowUpCircle size={14} className="text-teal-500 flex-shrink-0" />
            : isRefund
            ? <ArrowDownCircle size={14} className="text-amber-500 flex-shrink-0" />
            : <ArrowDownCircle size={14} className="text-red-400 flex-shrink-0" />}
          <span className="text-[12px]">{mov.description || '—'}</span>
        </div>
      </td>
      <td>
        <span className="text-[10px] uppercase tracking-wide bg-cream-200 px-2 py-0.5 rounded">
          {mov.payment_method}
        </span>
      </td>
      <td className={`font-semibold text-[13px] ${isIncome ? 'text-teal-600' : 'text-red-500'}`}>
        {isIncome ? '+' : '-'}{fmt(mov.amount)}
      </td>
      <td className="text-[11px] text-luma-faint">
        {new Date(mov.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
      </td>
      <td className="text-[11px] text-luma-muted">{mov.created_by_name || '—'}</td>
    </tr>
  )
}

export default function Caja() {
  const [session,  setSession]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [history,  setHistory]  = useState([])

  // Modals
  const [openModal,    setOpenModal]    = useState(false)
  const [closeModal,   setCloseModal]   = useState(false)
  const [movModal,     setMovModal]     = useState(false)

  // Open session form
  const [openAmount, setOpenAmount] = useState('')

  // Close session form
  const [countedAmount, setCountedAmount] = useState('')
  const [closeNote,     setCloseNote]     = useState('')

  // Manual movement form
  const [mov, setMov] = useState({ type: 'expense', amount: '', description: '', payment_method: 'cash' })

  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await svc.getSessions({ date: today })
      const sessions = data?.results ?? data
      if (sessions?.length > 0) {
        const { data: sess } = await svc.getSession(sessions[0].id)
        setSession(sess)
      } else {
        setSession(null)
      }
      // History (last 10 sessions)
      const { data: hist } = await svc.getSessions({ status: 'closed' })
      setHistory((hist?.results ?? hist ?? []).slice(0, 10))
    } catch { toast.error('Error cargando caja') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleOpen = async () => {
    if (!openAmount) { toast.error('Ingresa el monto de apertura'); return }
    setSaving(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      await svc.openSession({ date: today, opening_amount: openAmount })
      toast.success('¡Caja abierta!')
      setOpenModal(false)
      setOpenAmount('')
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al abrir caja')
    } finally { setSaving(false) }
  }

  const handleClose = async () => {
    if (!countedAmount) { toast.error('Ingresa el monto contado'); return }
    setSaving(true)
    try {
      await svc.closeSession(session.id, { counted_amount: countedAmount, note: closeNote })
      toast.success('Caja cerrada exitosamente')
      setCloseModal(false)
      setCountedAmount('')
      setCloseNote('')
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al cerrar caja')
    } finally { setSaving(false) }
  }

  const handleMovement = async () => {
    if (!mov.amount || !mov.description) {
      toast.error('Completa el monto y la descripción')
      return
    }
    setSaving(true)
    try {
      await svc.createCashMovement({ ...mov, session: session.id, amount: mov.amount })
      toast.success('Movimiento registrado')
      setMovModal(false)
      setMov({ type: 'expense', amount: '', description: '', payment_method: 'cash' })
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error')
    } finally { setSaving(false) }
  }

  if (loading) return <PageLoader />

  const isOpen = session?.status === 'open'

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="page-title">Caja</h2>
          <p className="text-[13px] text-luma-muted mt-0.5">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          {!session && (
            <Button variant="teal" icon={Unlock} onClick={() => setOpenModal(true)}>
              Abrir caja
            </Button>
          )}
          {isOpen && (
            <>
              <Button variant="outline" icon={Plus} onClick={() => setMovModal(true)}>
                Movimiento
              </Button>
              <Button variant="danger" icon={Lock} onClick={() => setCloseModal(true)}>
                Cerrar caja
              </Button>
            </>
          )}
          <button onClick={load} className="btn-ghost" title="Actualizar">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* No session */}
      {!session && (
        <div className="card">
          <EmptyState
            icon={CreditCard}
            title="Caja no abierta"
            description="Abre la caja para empezar a registrar ventas y movimientos del día."
            action={
              <Button variant="teal" icon={Unlock} onClick={() => setOpenModal(true)}>
                Abrir caja ahora
              </Button>
            }
          />
        </div>
      )}

      {/* Session active */}
      {session && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Saldo actual',   value: fmt(session.current_cash),    color: 'text-teal-600', bg: 'bg-teal-50' },
              { label: 'Total ingresos', value: fmt(session.total_income),    color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Total egresos',  value: fmt(session.total_expense),   color: 'text-red-500',  bg: 'bg-red-50' },
              { label: 'Devoluciones',   value: fmt(session.total_refund),    color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(k => (
              <div key={k.label} className={`card p-4 ${isOpen ? '' : 'opacity-75'}`}>
                <p className="section-label">{k.label}</p>
                <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                <div className={`mt-2 h-1.5 rounded-full ${k.bg}`} />
              </div>
            ))}
          </div>

          {/* Closed diff info */}
          {session.status === 'closed' && (
            <div className={`card p-4 flex items-center gap-3 border-l-4 ${
              Math.abs(session.difference) < 1000 ? 'border-teal-500' : 'border-amber-500'
            }`}>
              <AlertCircle size={18} className={Math.abs(session.difference) < 1000 ? 'text-teal-500' : 'text-amber-500'} />
              <div>
                <p className="text-[13px] font-semibold text-luma-text">Diferencia al cierre</p>
                <p className="text-[12px] text-luma-muted">
                  Contado: {fmt(session.counted_amount)} · Esperado: {fmt(session.closing_amount)} ·{' '}
                  <span className={Math.abs(session.difference) < 1 ? 'text-teal-600' : 'text-amber-600'}>
                    Diferencia: {fmt(Math.abs(session.difference))}
                    {session.difference > 0 ? ' (sobrante)' : session.difference < 0 ? ' (faltante)' : ' ✓'}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Movements table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-luma-border flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-luma-text">Movimientos del día</h3>
              <span className="text-[11px] text-luma-faint">{session.movements?.length || 0} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="luma-table">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Medio de pago</th>
                    <th>Monto</th>
                    <th>Hora</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {session.movements?.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-luma-faint text-[12px]">Sin movimientos aún</td></tr>
                  ) : (
                    session.movements?.map(m => <MovRow key={m.id} mov={m} />)
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-luma-border">
            <h3 className="text-[14px] font-semibold text-luma-text">Historial de cierres</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="luma-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Apertura</th>
                  <th>Contado</th>
                  <th>Esperado</th>
                  <th>Diferencia</th>
                  <th>Apertura por</th>
                  <th>Nota de cierre</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td className="font-medium">
                      <p>{new Date(h.date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })}</p>
                      {h.closed_at && (
                        <p className="text-[10px] text-luma-faint">
                          Cierre {new Date(h.closed_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </td>
                    <td>{fmt(h.opening_amount)}</td>
                    <td>{h.counted_amount ? fmt(h.counted_amount) : <span className="text-luma-faint">—</span>}</td>
                    <td>{fmt(h.closing_amount)}</td>
                    <td className={Number(h.difference) === 0 ? 'text-teal-600 font-semibold' : Number(h.difference) > 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                      {Number(h.difference) > 0 ? '+' : ''}{fmt(h.difference)}
                      <span className="text-[10px] ml-1 font-normal">
                        {Number(h.difference) > 0 ? '(sobrante)' : Number(h.difference) < 0 ? '(faltante)' : '(cuadrado)'}
                      </span>
                    </td>
                    <td className="text-[11px] text-luma-muted">{h.opened_by_name || '—'}</td>
                    <td className="text-[11px] text-luma-muted max-w-[140px] truncate" title={h.note}>
                      {h.note || <span className="text-luma-faint">—</span>}
                    </td>
                    <td><StatusBadge status={h.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Open modal ── */}
      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Abrir caja" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpenModal(false)}>Cancelar</Button>
            <Button variant="teal" loading={saving} onClick={handleOpen}>Abrir caja</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-[13px] text-luma-muted">Ingresa el monto físico con el que abres la caja hoy.</p>
          <Input
            label="Monto de apertura"
            type="number"
            placeholder="Ej: 200000"
            value={openAmount}
            onChange={e => setOpenAmount(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      {/* ── Close modal ── */}
      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Cerrar caja" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setCloseModal(false)}>Cancelar</Button>
            <Button variant="danger" loading={saving} onClick={handleClose}>Cerrar caja</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-cream-100 rounded-xl text-center">
            <p className="text-[11px] text-luma-faint">Saldo esperado en caja</p>
            <p className="text-2xl font-bold text-teal-600 mt-1">{fmt(session?.current_cash)}</p>
          </div>
          <Input
            label="Monto contado físicamente"
            type="number"
            placeholder="Lo que hay en el cajón"
            value={countedAmount}
            onChange={e => setCountedAmount(e.target.value)}
            hint={countedAmount && session ? `Diferencia: ${fmt(Number(countedAmount) - Number(session.current_cash))}` : ''}
            autoFocus
          />
          <div>
            <label className="text-[12px] font-semibold text-luma-text block mb-1.5">Nota de cierre</label>
            <textarea rows={2} className="input-base resize-none" placeholder="Observaciones..."
              value={closeNote} onChange={e => setCloseNote(e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* ── Manual movement modal ── */}
      <Modal open={movModal} onClose={() => setMovModal(false)} title="Registrar movimiento" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setMovModal(false)}>Cancelar</Button>
            <Button variant="teal" loading={saving} onClick={handleMovement}>Registrar</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select label="Tipo" value={mov.type} onChange={e => setMov(p => ({ ...p, type: e.target.value }))}>
            <option value="expense">Egreso / Gasto</option>
            <option value="income">Ingreso extra</option>
          </Select>
          <Input
            label="Monto"
            type="number"
            placeholder="0"
            value={mov.amount}
            onChange={e => setMov(p => ({ ...p, amount: e.target.value }))}
          />
          <Input
            label="Descripción *"
            placeholder="Ej: Compra de bolsas, Pago de servicio..."
            value={mov.description}
            onChange={e => setMov(p => ({ ...p, description: e.target.value }))}
          />
          <Select label="Medio de pago" value={mov.payment_method} onChange={e => setMov(p => ({ ...p, payment_method: e.target.value }))}>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="card">Tarjeta</option>
          </Select>
        </div>
      </Modal>
    </div>
  )
}
