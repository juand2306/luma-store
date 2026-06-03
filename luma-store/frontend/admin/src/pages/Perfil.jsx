import { useAuth } from '../store/authContext'
import { User, Mail, Shield } from 'lucide-react'

const ROLE_LABELS = {
  owner:  'Propietario',
  admin:  'Administrador',
  seller: 'Vendedor',
  viewer: 'Visualizador',
}

export default function Perfil() {
  const { user } = useAuth()

  const initials = user?.first_name
    ? `${user.first_name[0]}${user.last_name?.[0] || ''}`.toUpperCase()
    : user?.username?.[0]?.toUpperCase() || 'U'

  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : user?.username

  return (
    <div className="space-y-5 animate-fade-up max-w-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-50 rounded-2xl flex items-center justify-center flex-shrink-0">
          <User size={20} className="text-teal-600" />
        </div>
        <div>
          <h1 className="page-title">Mi perfil</h1>
          <p className="text-[13px] text-luma-muted mt-0.5">Información de tu cuenta</p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-4 pb-5 border-b border-luma-border">
          <div className="w-14 h-14 gradient-teal rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-[18px] font-semibold text-luma-text">{displayName}</p>
            <p className="text-[13px] text-luma-muted capitalize mt-0.5">
              {ROLE_LABELS[user?.role] || user?.role}
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cream-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <User size={14} className="text-luma-faint" />
            </div>
            <div>
              <p className="text-[11px] text-luma-faint uppercase tracking-wide font-semibold">Usuario</p>
              <p className="text-[13px] text-luma-text">{user?.username}</p>
            </div>
          </div>

          {user?.email && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-cream-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail size={14} className="text-luma-faint" />
              </div>
              <div>
                <p className="text-[11px] text-luma-faint uppercase tracking-wide font-semibold">Correo</p>
                <p className="text-[13px] text-luma-text">{user.email}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cream-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield size={14} className="text-luma-faint" />
            </div>
            <div>
              <p className="text-[11px] text-luma-faint uppercase tracking-wide font-semibold">Rol</p>
              <p className="text-[13px] text-luma-text capitalize">{ROLE_LABELS[user?.role] || user?.role}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
