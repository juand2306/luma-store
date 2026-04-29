import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/authContext'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Lock, User, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate   = useNavigate()

  const [form, setForm]     = useState({ username: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) {
      setError('Ingresa tu usuario y contraseña.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await login(form.username, form.password)
      navigate('/', { replace: true })
    } catch {
      setError('Credenciales incorrectas. Verifica tu usuario y contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-luma p-4"
      style={{ background: 'var(--bg)' }}>
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-teal-100 rounded-full mix-blend-multiply opacity-40 animate-pulse-soft" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-cream-300 rounded-full mix-blend-multiply opacity-60 animate-pulse-soft" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-sm animate-fade-up relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 gradient-teal rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-card-md">
            <span className="text-white font-bold text-2xl">L</span>
          </div>
          <h1 className="text-[24px] font-bold text-luma-text tracking-tight">LUMA Store</h1>
          <p className="text-sm text-luma-muted mt-1">Panel de Administración</p>
        </div>

        {/* Card */}
        <div className="card p-7 space-y-5">
          <div>
            <h2 className="text-[16px] font-semibold text-luma-text">Bienvenido</h2>
            <p className="text-[13px] text-luma-muted mt-0.5">Inicia sesión para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Usuario"
              name="username"
              type="text"
              placeholder="tu.usuario"
              icon={User}
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
              autoFocus
            />

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-luma-text">Contraseña</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none">
                  <Lock size={14} />
                </div>
                <input
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  style={{ paddingLeft: '2.25rem', paddingRight: '2.5rem' }}
                  className="input-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-luma-faint hover:text-luma-muted transition-colors"
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 animate-fade-in">
                <p className="text-[12px] text-red-600">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="teal"
              size="md"
              loading={loading}
              className="w-full justify-center mt-2"
            >
              {loading ? 'Entrando...' : 'Iniciar sesión'}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-luma-faint mt-6">
          LUMA Store System · v1.0
        </p>
      </div>
    </div>
  )
}
