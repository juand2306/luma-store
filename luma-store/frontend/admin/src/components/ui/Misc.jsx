// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md', color = 'teal' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8', xl: 'w-12 h-12' }
  const colors = { teal: 'border-teal-500', white: 'border-white', gray: 'border-luma-muted' }
  return (
    <div className={`${sizes[size]} border-2 ${colors[color]} border-t-transparent rounded-full animate-spin`} />
  )
}

// ─── Page Loading ─────────────────────────────────────────────────────────────
export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────
export function SkeletonRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className={`skeleton h-3 rounded ${i === 0 ? 'w-32' : 'w-16'}`} />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card p-5 space-y-3 ${className}`}>
      <div className="skeleton h-3 w-20 rounded" />
      <div className="skeleton h-7 w-32 rounded" />
      <div className="skeleton h-3 w-24 rounded" />
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {Icon && (
        <div className="w-12 h-12 bg-cream-200 rounded-2xl flex items-center justify-center">
          <Icon size={20} className="text-luma-faint" />
        </div>
      )}
      <div>
        <p className="text-[14px] font-semibold text-luma-text">{title}</p>
        {description && <p className="text-[12px] text-luma-faint mt-1">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export function ProgressBar({ value, max, className = '' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const level = pct === 0 ? 'out' : pct < 20 ? 'low' : ''
  return (
    <div className={`progress-bar ${className}`}>
      <div
        className={`progress-bar-fill ${level}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─── Toast notification ───────────────────────────────────────────────────────
export function Toast({ message, type = 'success', onClose }) {
  const colors = {
    success: 'text-teal-600',
    error:   'text-red-600',
    warning: 'text-amber-600',
  }
  return (
    <div className="toast flex items-center gap-3">
      <span className={`text-sm font-medium ${colors[type]}`}>{message}</span>
      <button onClick={onClose} className="text-luma-faint hover:text-luma-text">✕</button>
    </div>
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
/**
 * Diálogo de confirmación para acciones destructivas.
 * Uso: <ConfirmDialog open title="¿Eliminar?" description="..." onConfirm={fn} onCancel={fn} danger />
 */
export function ConfirmDialog({
  open, title, description,
  onConfirm, onCancel,
  confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  danger = false,
  loading = false,
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-up">
        <h3 className="text-[15px] font-bold text-luma-text mb-2">{title}</h3>
        {description && (
          <p className="text-[13px] text-luma-muted mb-5">{description}</p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="btn-ghost px-5 py-2.5 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 disabled:opacity-60
              ${danger ? 'bg-red-500 hover:bg-red-600 text-white' : 'btn-teal'}`}
          >
            {loading && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Alert Banner (inline error/warning) ─────────────────────────────────────
export function AlertBanner({ type = 'error', children, className = '' }) {
  const styles = {
    error:   'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    info:    'bg-blue-50 border-blue-200 text-blue-700',
    success: 'bg-teal-50 border-teal-200 text-teal-700',
  }
  const icons = { error: '⚠️', warning: '⚠️', info: 'ℹ️', success: '✓' }
  return (
    <div className={`border rounded-xl px-4 py-3 text-[12px] font-medium flex items-start gap-2 ${styles[type]} ${className}`}>
      <span className="flex-shrink-0 mt-0.5">{icons[type]}</span>
      <span>{children}</span>
    </div>
  )
}

