// ─── Badge (status pills) ─────────────────────────────────────────────────────
export function Badge({ variant = 'gray', dot = false, children }) {
  const variants = {
    teal:  'badge-teal',
    green: 'badge-green',
    amber: 'badge-amber',
    red:   'badge-red',
    gray:  'badge-gray',
  }
  return (
    <span className={variants[variant] || 'badge-gray'}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${
        variant === 'teal' || variant === 'green'  ? 'bg-teal-500' :
        variant === 'amber' ? 'bg-amber-500' :
        variant === 'red'   ? 'bg-red-500' : 'bg-luma-faint'
      }`} />}
      {children}
    </span>
  )
}

// ─── Status badge based on product/variant status ─────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    active:   { label: 'Activo',   variant: 'green' },
    inactive: { label: 'Inactivo', variant: 'gray' },
    out:      { label: 'Agotado',  variant: 'red' },
    in_stock: { label: 'En stock', variant: 'teal' },
    low:      { label: 'Bajo',     variant: 'amber' },
    open:     { label: 'Abierta',  variant: 'teal' },
    closed:   { label: 'Cerrada',  variant: 'gray' },
    new:      { label: 'Nuevo',    variant: 'teal' },
    confirmed:{ label: 'Confirmado',variant:'green'},
    cancelled:{ label: 'Cancelado',variant: 'red' },
  }
  const cfg = map[status] || { label: status, variant: 'gray' }
  return <Badge variant={cfg.variant} dot>{cfg.label}</Badge>
}

// ─── Category pill ────────────────────────────────────────────────────────────
export function CategoryBadge({ children }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-cream-200 text-luma-muted text-[10px] font-semibold tracking-wide uppercase">
      {children}
    </span>
  )
}
