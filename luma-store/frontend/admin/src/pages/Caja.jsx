import { useState, useEffect, useCallback, useRef } from 'react'
import { usePaymentMethods } from '../hooks/usePaymentMethods'
import toast from 'react-hot-toast'
import {
  CreditCard, Plus, Lock, Unlock, ArrowUpCircle, ArrowDownCircle,
  RefreshCw, AlertCircle, ChevronDown, Bot, Info,
  Clock, CheckCircle2,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { PageLoader, EmptyState } from '../components/ui/Misc'
import { StatusBadge } from '../components/ui/Badge'
import * as svc from '../api/services'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`

// Obtiene la fecha local como string YYYY-MM-DD
function localDateString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Movement row ──────────────────────────────────────────────────────────────
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

// ── History detail modal ──────────────────────────────────────────────────────
function HistoryDetailModal({ open, onClose, sessionId }) {
  const [detail,  setDetail]  = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && sessionId) {
      setLoading(true)
      svc.getSession(sessionId)
        .then(({ data }) => setDetail(data))
        .catch(() => toast.error('Error cargando detalle'))
        .finally(() => setLoading(false))
    } else {
      setDetail(null)
    }
  }, [open, sessionId])

  const dateLabel = detail
    ? new Date(detail.date + 'T00:00:00').toLocaleDateString('es-CO', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
      })
    : ''

  const hasDifference = detail && detail.difference !== null && detail.difference !== undefined

  return (
    <Modal open={open} onClose={onClose} title={`Detalle — ${dateLabel}`} size="lg">
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw size={22} className="animate-spin text-luma-faint" />
        </div>
      ) : detail ? (
        <div className="space-y-5">

          {/* Auto-close banner */}
          {detail.auto_closed && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <Bot size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold text-amber-800">Sesión cerrada automáticamente</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  El sistema cerró esta caja a las 23:59 del{' '}
                  {new Date(detail.date + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long' })}{' '}
                  porque no fue cerrada manualmente. No se realizó conteo físico.
                </p>
                {detail.note && (
                  <p className="text-[11px] text-amber-600 mt-1 italic">{detail.note}</p>
                )}
              </div>
            </div>
          )}

          {/* Session info row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-cream-100 rounded-xl">
            {[
              { label: 'Abierta por',  value: detail.opened_by_name || '—',
                sub: detail.opened_at ? new Date(detail.opened_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : null },
              { label: 'Cerrada por',
                value: detail.auto_closed ? 'Sistema' : (detail.closed_by_name || '—'),
                isSystem: detail.auto_closed,
                sub: detail.closed_at ? new Date(detail.closed_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : null },
              { label: 'Monto apertura', value: fmt(detail.opening_amount), sub: null },
              { label: 'Estado', value: null, badge: detail.status, autoClose: detail.auto_closed },
            ].map(item => (
              <div key={item.label}>
                <p className="section-label mb-0.5">{item.label}</p>
                {item.badge
                  ? <div className="flex flex-col gap-1">
                      <StatusBadge status={item.badge} />
                      {item.autoClose && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-md w-fit">
                          Auto-cerrada
                        </span>
                      )}
                    </div>
                  : <p className={`text-[13px] font-semibold ${item.isSystem ? 'text-amber-600 flex items-center gap-1' : 'text-luma-text'}`}>
                      {item.isSystem && <Bot size={12} />}
                      {item.value}
                    </p>
                }
                {item.sub && <p className="text-[11px] text-luma-faint">{item.sub}</p>}
              </div>
            ))}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total ingresos', value: fmt(detail.total_income),  color: 'text-teal-600' },
              { label: 'Total egresos',  value: fmt(detail.total_expense), color: 'text-red-500' },
              { label: 'Devoluciones',   value: fmt(detail.total_refund),  color: 'text-amber-600' },
              { label: 'Saldo calculado', value: fmt(detail.current_cash), color: 'text-luma-text' },
            ].map(k => (
              <div key={k.label} className="card p-3">
                <p className="section-label">{k.label}</p>
                <p className={`text-[17px] font-bold mt-1 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Difference banner — only when there was a physical count */}
          {hasDifference ? (
            <div className={`p-3 rounded-xl flex items-start gap-3 border-l-4 ${
              Math.abs(Number(detail.difference)) < 1
                ? 'border-teal-500 bg-teal-50'
                : Number(detail.difference) > 0
                ? 'border-green-500 bg-green-50'
                : 'border-amber-500 bg-amber-50'
            }`}>
              <AlertCircle size={15} className={`mt-0.5 flex-shrink-0 ${
                Math.abs(Number(detail.difference)) < 1 ? 'text-teal-500'
                : Number(detail.difference) > 0 ? 'text-green-500' : 'text-amber-500'
              }`} />
              <div>
                <p className="text-[12px] font-semibold text-luma-text">
                  Esperado: {fmt(detail.closing_amount)} &nbsp;·&nbsp;
                  Contado: {fmt(detail.counted_amount)} &nbsp;·&nbsp;
                  Diferencia:&nbsp;
                  <span className={
                    Math.abs(Number(detail.difference)) < 1 ? 'text-teal-600'
                    : Number(detail.difference) > 0 ? 'text-green-600' : 'text-red-500'
                  }>
                    {fmt(Math.abs(detail.difference))}
                    {Number(detail.difference) > 0 ? ' (sobrante)' : Number(detail.difference) < 0 ? ' (faltante)' : ' ✓'}
                  </span>
                </p>
                {detail.note && !detail.auto_closed && (
                  <p className="text-[11px] text-luma-muted mt-0.5">📝 {detail.note}</p>
                )}
              </div>
            </div>
          ) : (
            /* Auto-closed: no physical count */
            <div className="p-3 rounded-xl flex items-start gap-3 border-l-4 border-amber-400 bg-amber-50">
              <Info size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[12px] text-amber-800">
                <strong>Saldo calculado por sistema: {fmt(detail.closing_amount)}</strong>
                <br />
                No hubo conteo físico — la sesión fue cerrada automáticamente.
              </p>
            </div>
          )}

          {/* Movements */}
          <div>
            <p className="text-[13px] font-semibold text-luma-text mb-3">
              Movimientos
              <span className="ml-2 text-[11px] text-luma-faint font-normal">
                ({detail.movements?.length || 0} registros)
              </span>
            </p>
            {!detail.movements?.length ? (
              <p className="text-center text-luma-faint py-6 text-[12px]">Sin movimientos registrados</p>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-luma-border">
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
                    {detail.movements.map(m => <MovRow key={m.id} mov={m} />)}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      ) : null}
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Caja() {
  const [session,  setSession]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [history,  setHistory]  = useState([])
  const { methods } = usePaymentMethods()

  // Modals
  const [openModal,    setOpenModal]    = useState(false)
  const [closeModal,   setCloseModal]   = useState(false)
  const [movModal,     setMovModal]     = useState(false)
  const [histDetailId, setHistDetailId] = useState(null)

  // History pagination
  const [showAllHistory, setShowAllHistory] = useState(false)

  // Open session form
  const [openAmount, setOpenAmount] = useState('')

  // Close session form
  const [countedAmount, setCountedAmount] = useState('')
  const [closeNote,     setCloseNote]     = useState('')

  // Manual movement form
  const [mov, setMov] = useState({ type: 'expense', amount: '', description: '', payment_method: 'cash' })

  const [saving, setSaving] = useState(false)

  // Track the date when page was last loaded (for midnight detection)
  const lastLoadedDate = useRef(localDateString())

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      // 1. Auto-cerrar sesiones de días anteriores
      const { data: staleData } = await svc.checkStaleSessions()
      if (staleData.auto_closed_count > 0) {
        const count = staleData.auto_closed_count
        toast(
          `🔒 ${count} sesión${count > 1 ? 'es' : ''} de día${count > 1 ? 's' : ''} anterior${count > 1 ? 'es' : ''} ${count > 1 ? 'fueron cerradas' : 'fue cerrada'} automáticamente`,
          {
            duration: 6000,
            style: { background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' },
          }
        )
      }

      // 2. Sesión de hoy
      const today = localDateString()
      const { data: listData } = await svc.getSessions({ date: today })
      const sessions = listData?.results ?? listData
      if (sessions?.length > 0) {
        const { data: sess } = await svc.getSession(sessions[0].id)
        setSession(sess)
      } else {
        setSession(null)
      }

      // 3. Historial completo (todas las cerradas — page_size=200 para no paginar)
      const { data: hist } = await svc.getSessions({ status: 'closed', page_size: 200 })
      const histList = hist?.results ?? hist ?? []
      setHistory(histList)
      lastLoadedDate.current = today
    } catch {
      toast.error('Error cargando caja')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Midnight detection ───────────────────────────────────────────────────────
  useEffect(() => {
    // Timer cada minuto: si el día cambió desde la última carga, recargar
    const interval = setInterval(() => {
      const today = localDateString()
      if (today !== lastLoadedDate.current) {
        // Cruzamos medianoche — recargar silenciosamente (sin spinner)
        load(true)
      }
    }, 60_000) // cada 60 segundos

    // Visibility change: el usuario vuelve a la pestaña después de un tiempo
    const handleVisibility = () => {
      if (!document.hidden) {
        const today = localDateString()
        if (today !== lastLoadedDate.current) {
          load(true)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [load])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleOpen = async () => {
    if (!openAmount) { toast.error('Ingresa el monto de apertura'); return }
    setSaving(true)
    try {
      const today = localDateString()
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
      toast.success('✅ Caja cerrada exitosamente')
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
      await svc.createCashMovement({ ...mov, session: session.id })
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
          <button onClick={() => load()} className="btn-ghost" title="Actualizar">
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
              { label: 'Saldo actual',   value: fmt(session.current_cash),  color: 'text-teal-600',  bg: 'bg-teal-50' },
              { label: 'Total ingresos', value: fmt(session.total_income),  color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Total egresos',  value: fmt(session.total_expense), color: 'text-red-500',   bg: 'bg-red-50' },
              { label: 'Devoluciones',   value: fmt(session.total_refund),  color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(k => (
              <div key={k.label} className={`card p-4 ${isOpen ? '' : 'opacity-75'}`}>
                <p className="section-label">{k.label}</p>
                <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                <div className={`mt-2 h-1.5 rounded-full ${k.bg}`} />
              </div>
            ))}
          </div>

          {/* Closed diff info */}
          {session.status === 'closed' && !session.auto_closed && (
            <div className={`card p-4 flex items-center gap-3 border-l-4 ${
              Math.abs(session.difference ?? 0) < 1000 ? 'border-teal-500' : 'border-amber-500'
            }`}>
              <AlertCircle size={18} className={Math.abs(session.difference ?? 0) < 1000 ? 'text-teal-500' : 'text-amber-500'} />
              <div>
                <p className="text-[13px] font-semibold text-luma-text">Diferencia al cierre</p>
                <p className="text-[12px] text-luma-muted">
                  Contado: {fmt(session.counted_amount)} · Esperado: {fmt(session.closing_amount)} ·{' '}
                  <span className={Math.abs(session.difference ?? 0) < 1 ? 'text-teal-600' : 'text-amber-600'}>
                    Diferencia: {fmt(Math.abs(session.difference ?? 0))}
                    {(session.difference ?? 0) > 0 ? ' (sobrante)' : (session.difference ?? 0) < 0 ? ' (faltante)' : ' ✓'}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Auto-closed info banner */}
          {session.auto_closed && (
            <div className="card p-4 flex items-center gap-3 border-l-4 border-amber-400">
              <Bot size={18} className="text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-amber-800">Sesión cerrada automáticamente</p>
                <p className="text-[12px] text-amber-700">
                  El sistema cerró esta caja a las 23:59 porque no fue cerrada manualmente.
                  El saldo calculado es {fmt(session.closing_amount)}.
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
          <div className="px-5 py-4 border-b border-luma-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-semibold text-luma-text">Historial de cierres</h3>
              {history.some(h => h.auto_closed) && (
                <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <Bot size={10} /> Incluye cierres automáticos
                </span>
              )}
            </div>
            <span className="text-[11px] text-luma-faint">
              {history.length} cierre{history.length !== 1 ? 's' : ''} · Haz clic en una fila para ver el detalle
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="luma-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Apertura</th>
                  <th>Contado</th>
                  <th>Calculado</th>
                  <th>Diferencia</th>
                  <th>Abierta por</th>
                  <th>Cerrada por</th>
                  <th>Nota</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {(showAllHistory ? history : history.slice(0, 10)).map(h => (
                  <tr
                    key={h.id}
                    className={`cursor-pointer hover:bg-cream-100 transition-colors ${h.auto_closed ? 'bg-amber-50/40' : ''}`}
                    onClick={() => setHistDetailId(h.id)}
                    title="Ver detalle completo"
                  >
                    <td className="font-medium">
                      <p>{new Date(h.date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })}</p>
                      {h.closed_at && (
                        <p className="text-[10px] text-luma-faint flex items-center gap-0.5">
                          <Clock size={9} />
                          {new Date(h.closed_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </td>
                    <td>{fmt(h.opening_amount)}</td>
                    <td>
                      {h.counted_amount != null
                        ? fmt(h.counted_amount)
                        : <span className="text-luma-faint text-[11px]">—</span>}
                    </td>
                    <td>{fmt(h.closing_amount)}</td>
                    <td>
                      {h.difference != null ? (
                        <span className={
                          Math.abs(Number(h.difference)) < 1 ? 'text-teal-600 font-semibold'
                          : Number(h.difference) > 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'
                        }>
                          {Number(h.difference) > 0 ? '+' : ''}{fmt(h.difference)}
                          <span className="text-[10px] ml-1 font-normal">
                            {Math.abs(Number(h.difference)) < 1 ? '(cuadrado)' : Number(h.difference) > 0 ? '(sobrante)' : '(faltante)'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-600 flex items-center gap-1">
                          <Bot size={10} /> N/A
                        </span>
                      )}
                    </td>
                    <td className="text-[11px] text-luma-muted">{h.opened_by_name || '—'}</td>
                    <td className="text-[11px] text-luma-muted">
                      {h.auto_closed ? (
                        <span className="text-amber-600 flex items-center gap-1">
                          <Bot size={11} /> Sistema
                        </span>
                      ) : (h.closed_by_name || '—')}
                    </td>
                    <td className="text-[11px] text-luma-muted max-w-[120px] truncate" title={h.note}>
                      {h.note || <span className="text-luma-faint">—</span>}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={h.status} />
                        {h.auto_closed && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 w-fit">
                            <Bot size={9} /> Auto
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Ver más / Ver menos */}
          {history.length > 10 && (
            <div className="px-5 py-3 border-t border-luma-border flex justify-center">
              <button
                onClick={() => setShowAllHistory(p => !p)}
                className="text-[12px] text-teal-600 font-semibold hover:underline flex items-center gap-1"
              >
                <ChevronDown size={14} className={`transition-transform ${showAllHistory ? 'rotate-180' : ''}`} />
                {showAllHistory ? 'Ver menos' : `Ver todos (${history.length})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── History detail modal ── */}
      <HistoryDetailModal
        open={!!histDetailId}
        onClose={() => setHistDetailId(null)}
        sessionId={histDetailId}
      />

      {/* ── Open modal ── */}
      <Modal open={openModal} onClose={() => setOpenModal(false)} title="Abrir caja" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpenModal(false)}>Cancelar</Button>
            <Button variant="teal" loading={saving} onClick={handleOpen} icon={Unlock}>Abrir caja</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-[13px] text-luma-muted">
            Ingresa el monto físico con el que abres la caja hoy. Este valor se usará como saldo inicial del día.
          </p>
          <Input
            label="Monto de apertura"
            type="number"
            placeholder="Ej: 200000"
            value={openAmount}
            onChange={e => setOpenAmount(e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-2 p-3 bg-teal-50 rounded-xl">
            <CheckCircle2 size={14} className="text-teal-500 flex-shrink-0" />
            <p className="text-[11px] text-teal-700">
              La caja se cerrará automáticamente a las 23:59 si no la cierras manualmente.
            </p>
          </div>
        </div>
      </Modal>

      {/* ── Close modal ── */}
      <Modal open={closeModal} onClose={() => setCloseModal(false)} title="Cerrar caja" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setCloseModal(false)}>Cancelar</Button>
            <Button variant="danger" loading={saving} onClick={handleClose} icon={Lock}>Cerrar caja</Button>
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
            hint={countedAmount && session
              ? (() => {
                  const diff = Number(countedAmount) - Number(session.current_cash)
                  return `Diferencia: ${diff >= 0 ? '+' : ''}${fmt(diff)}`
                })()
              : ''}
            autoFocus
          />
          <div>
            <label className="text-[12px] font-semibold text-luma-text block mb-1.5">Nota de cierre</label>
            <textarea rows={2} className="input-base resize-none" placeholder="Observaciones opcionales..."
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
          <Select label="Medio de pago" value={mov.payment_method}
            onChange={e => setMov(p => ({ ...p, payment_method: e.target.value }))}>
            {methods.length > 0
              ? methods.map(({ key, label }) => <option key={key} value={key}>{label}</option>)
              : <>
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                </>
            }
          </Select>
        </div>
      </Modal>
    </div>
  )
}
