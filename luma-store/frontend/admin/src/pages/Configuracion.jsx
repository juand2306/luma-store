import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Settings, Store, MessageCircle, Users, Star, Save,
  Plus, Pencil, Trash2, Eye, EyeOff, User, ChevronDown
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { PageLoader } from '../components/ui/Misc'
import * as svc from '../api/services'

function Tab({ id, active, label, icon: Icon, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-4 py-2.5 text-[12px] font-semibold rounded-xl transition-all
        ${active ? 'bg-teal-500 text-white shadow-sm' : 'text-luma-muted hover:bg-cream-200 hover:text-luma-text'}`}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

// ── Sección: Información de la Tienda ────────────────────────────────────────
function StoreSection({ config, onSave }) {
  const [form, setForm] = useState(config || {})
  const [saving, setSaving] = useState(false)

  useEffect(() => { setForm(config || {}) }, [config])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(form)
      toast.success('Configuración guardada ✓')
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="section-label mb-1 block">Nombre de la tienda</label>
          <Input value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="Ej: LUMA Store" />
        </div>
        <div>
          <label className="section-label mb-1 block">WhatsApp (con código de país)</label>
          <Input value={form.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} placeholder="Ej: 573001234567" />
        </div>
        <div>
          <label className="section-label mb-1 block">Color primario de marca</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={form.primary_color || '#0D8585'}
              onChange={e => set('primary_color', e.target.value)}
              className="w-12 h-10 rounded-xl border border-luma-border cursor-pointer"
            />
            <Input value={form.primary_color || ''} onChange={e => set('primary_color', e.target.value)} placeholder="#0D8585" />
          </div>
        </div>
        <div>
          <label className="section-label mb-1 block">Dirección / Ubicación</label>
          <Input value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="Ej: Cll 10 # 5-30" />
        </div>
        <div className="sm:col-span-2">
          <label className="section-label mb-1 block">Horario de atención</label>
          <Input value={form.schedule || ''} onChange={e => set('schedule', e.target.value)} placeholder="Lun–Sáb 9am–7pm" />
        </div>
        <div className="sm:col-span-2">
          <label className="section-label mb-1 block">Texto del banner del portal</label>
          <Input value={form.banner_text || ''} onChange={e => set('banner_text', e.target.value)} placeholder="Ej: Nueva colección disponible" maxLength={300} />
        </div>
        <div className="sm:col-span-2">
          <label className="section-label mb-1 block">Política de devoluciones</label>
          <Textarea value={form.return_policy || ''} onChange={e => set('return_policy', e.target.value)} rows={3} placeholder="Describe la política de devoluciones de la tienda..." />
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="teal" icon={Save} loading={saving} onClick={handleSave}>
          Guardar configuración
        </Button>
      </div>
    </div>
  )
}

// ── Sección: Mensajes de WhatsApp ──────────────────────────────────────────
const WA_STATES = [
  { key: 'msg_in_progress', label: 'En gestión' },
  { key: 'msg_confirmed',   label: 'Confirmado' },
  { key: 'msg_preparing',   label: 'En preparación' },
  { key: 'msg_shipped',     label: 'Enviado' },
  { key: 'msg_delivered',   label: 'Entregado' },
  { key: 'msg_cancelled',   label: 'Cancelado' },
]

const WA_VARS = ['{nombre_cliente}', '{numero_pedido}', '{productos}', '{total}', '{estado}']

function WhatsAppSection({ config, onSave }) {
  const [form, setForm]   = useState(config || {})
  const [saving, setSaving] = useState(false)
  const [open, setOpen]   = useState(WA_STATES[0].key)

  useEffect(() => { setForm(config || {}) }, [config])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(form)
      toast.success('Plantillas guardadas ✓')
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-luma-muted">
        Personaliza el mensaje que se envía al cliente al actualizar el estado de su pedido.
        Variables disponibles:
        {' '}{WA_VARS.map(v => (
          <code key={v} className="bg-cream-200 px-1 rounded text-teal-600 text-[11px] mx-0.5">{v}</code>
        ))}
      </p>
      <div className="space-y-2">
        {WA_STATES.map(s => (
          <div key={s.key} className="card overflow-hidden">
            <button
              onClick={() => setOpen(open === s.key ? null : s.key)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-cream-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageCircle size={14} className="text-teal-500" />
                <span className="text-[13px] font-semibold">{s.label}</span>
              </div>
              <ChevronDown size={14} className={`transition-transform ${open === s.key ? 'rotate-180' : ''}`} />
            </button>
            {open === s.key && (
              <div className="px-4 pb-4">
                <Textarea
                  value={form[s.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [s.key]: e.target.value }))}
                  rows={4}
                  placeholder={`Hola {nombre_cliente}, tu pedido {numero_pedido} está ${s.label.toLowerCase()}...`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button variant="teal" icon={Save} loading={saving} onClick={handleSave}>
          Guardar plantillas
        </Button>
      </div>
    </div>
  )
}

// ── Sección: Fidelización ────────────────────────────────────────────────────
function LoyaltySection({ config, onSave }) {
  const [loyalty, setLoyalty]  = useState(null)
  const [loading, setLoading]  = useState(true)
  const [saving,  setSaving]   = useState(false)

  useEffect(() => {
    svc.getLoyaltyConfig()
      .then(({ data }) => setLoyalty(data))
      .catch(() => setLoyalty({ is_enabled: false, points_per_amount: 1000, value_per_point: 50, min_points_redeem: 100 }))
      .finally(() => setLoading(false))
  }, [])

  const set = (k, v) => setLoyalty(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await svc.updateLoyaltyConfig(loyalty)
      toast.success('Fidelización actualizada ✓')
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="py-8 text-center text-luma-faint text-[12px]">Cargando...</div>

  return (
    <div className="space-y-5">
      {/* Toggle principal */}
      <div className="card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-luma-text">Sistema de puntos</p>
          <p className="text-[12px] text-luma-muted mt-0.5">Activa para que los clientes acumulen y canjeen puntos en cada compra</p>
        </div>
        <button
          onClick={() => set('is_enabled', !loyalty.is_enabled)}
          className={`toggle-track ${loyalty.is_enabled ? 'on' : 'off'}`}
          role="switch"
          aria-checked={loyalty.is_enabled}
          style={{ flexShrink: 0 }}
        >
          <span className="toggle-thumb" />
        </button>
      </div>

      {loyalty.is_enabled && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="section-label mb-1 block">Pesos por punto</label>
            <Input type="number" value={loyalty.points_per_amount} onChange={e => set('points_per_amount', e.target.value)} placeholder="1000" />
            <p className="text-[10px] text-luma-faint mt-1">Cada X pesos = 1 punto</p>
          </div>
          <div>
            <label className="section-label mb-1 block">Valor por punto ($)</label>
            <Input type="number" value={loyalty.value_per_point} onChange={e => set('value_per_point', e.target.value)} placeholder="50" />
            <p className="text-[10px] text-luma-faint mt-1">Cada punto descuenta X pesos</p>
          </div>
          <div>
            <label className="section-label mb-1 block">Mínimo para canjear</label>
            <Input type="number" value={loyalty.min_points_redeem} onChange={e => set('min_points_redeem', e.target.value)} placeholder="100" />
            <p className="text-[10px] text-luma-faint mt-1">Puntos mínimos para redimir</p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="teal" icon={Save} loading={saving} onClick={handleSave}>
          Guardar fidelización
        </Button>
      </div>
    </div>
  )
}

// ── Sección: Usuarios del equipo ─────────────────────────────────────────────
const ROLE_LABELS = { owner: 'Dueño', admin: 'Admin', seller: 'Vendedor', viewer: 'Visor' }

function UsersSection() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)  // 'new' | user object
  const [form,    setForm]    = useState({ username: '', first_name: '', last_name: '', email: '', role: 'seller', password: '' })
  const [saving,  setSaving]  = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await svc.getUsers()
      setUsers(data?.results ?? data ?? [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setForm({ username: '', first_name: '', last_name: '', email: '', role: 'seller', password: '' })
    setModal('new')
  }

  const openEdit = (u) => { setForm({ ...u, password: '' }); setModal(u) }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'new') {
        await svc.createUser(form)
        toast.success('Usuario creado ✓')
      } else {
        const patch = { ...form }
        if (!patch.password) delete patch.password
        await svc.updateUser(modal.id, patch)
        toast.success('Usuario actualizado ✓')
      }
      setModal(null)
      load()
    } catch (e) {
      toast.error(Object.values(e.response?.data || {}).flat()[0] || 'Error')
    } finally { setSaving(false) }
  }

  const handleDeactivate = async (u) => {
    try {
      await svc.updateUser(u.id, { is_active: !u.is_active })
      toast.success(u.is_active ? 'Usuario desactivado' : 'Usuario activado')
      load()
    } catch { toast.error('Error') }
  }

  if (loading) return <div className="py-8 text-center text-luma-faint">Cargando...</div>

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] text-luma-muted">{users.length} usuario(s) del equipo</p>
        <Button variant="teal" size="sm" icon={Plus} onClick={openNew}>Nuevo usuario</Button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-luma-border bg-cream-100">
              <th className="text-left px-4 py-3 section-label">Usuario</th>
              <th className="text-left px-4 py-3 section-label">Rol</th>
              <th className="text-left px-4 py-3 section-label">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-luma-border last:border-0 hover:bg-cream-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-semibold">{u.first_name} {u.last_name} <span className="text-luma-faint">(@{u.username})</span></p>
                  <p className="text-luma-faint">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`badge text-[10px] ${u.role === 'owner' ? 'badge-teal' : 'badge-default'}`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${u.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                  {u.is_active ? 'Activo' : 'Inactivo'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(u)} className="icon-btn" title="Editar"><Pencil size={13} /></button>
                    <button onClick={() => handleDeactivate(u)} className="icon-btn" title={u.is_active ? 'Desactivar' : 'Activar'}>
                      {u.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          open
          onClose={() => setModal(null)}
          title={modal === 'new' ? 'Nuevo usuario' : 'Editar usuario'}
          size="sm"
          footer={<Button variant="teal" loading={saving} onClick={handleSave}>Guardar</Button>}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="section-label mb-1 block">Nombre</label>
                <Input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} placeholder="Juan" />
              </div>
              <div>
                <label className="section-label mb-1 block">Apellido</label>
                <Input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Díaz" />
              </div>
            </div>
            <div>
              <label className="section-label mb-1 block">Usuario</label>
              <Input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="juandiaz" />
            </div>
            <div>
              <label className="section-label mb-1 block">Email</label>
              <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="juan@tienda.com" />
            </div>
            <div>
              <label className="section-label mb-1 block">Rol</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="input-base">
                <option value="admin">Administrador</option>
                <option value="seller">Vendedor</option>
                <option value="viewer">Visor</option>
                <option value="owner">Dueño</option>
              </select>
            </div>
            <div>
              <label className="section-label mb-1 block">
                Contraseña {modal !== 'new' && <span className="text-luma-faint">(dejar vacío para no cambiar)</span>}
              </label>
              <div className="relative">
                <Input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-luma-faint">
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'store',   label: 'Tienda',    icon: Store },
  { id: 'whatsapp',label: 'WhatsApp',  icon: MessageCircle },
  { id: 'loyalty', label: 'Fidelización', icon: Star },
  { id: 'users',   label: 'Usuarios',  icon: Users },
]

export default function Configuracion() {
  const [tab,    setTab]    = useState('store')
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    svc.getStoreConfig()
      .then(({ data }) => setConfig(data))
      .catch(() => setConfig({}))
      .finally(() => setLoading(false))
  }, [])

  const saveConfig = async (data) => {
    const { data: saved } = await svc.updateStoreConfig(data)
    setConfig(saved)
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h2 className="page-title">Configuración</h2>
        <p className="text-[13px] text-luma-muted mt-0.5">Personaliza el sistema y administra tu equipo</p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => <Tab key={t.id} {...t} active={tab === t.id} onClick={setTab} />)}
      </div>

      <div className="card p-6">
        {tab === 'store'    && <StoreSection    config={config} onSave={saveConfig} />}
        {tab === 'whatsapp' && <WhatsAppSection config={config} onSave={saveConfig} />}
        {tab === 'loyalty'  && <LoyaltySection  config={config} onSave={saveConfig} />}
        {tab === 'users'    && <UsersSection />}
      </div>
    </div>
  )
}
