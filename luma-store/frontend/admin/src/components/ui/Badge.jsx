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

// ─── Status badge based on entity status ──────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    // Productos / Variantes
    active:      { label: 'Activo',      variant: 'green' },
    inactive:    { label: 'Inactivo',    variant: 'gray'  },
    out:         { label: 'Agotado',     variant: 'red'   },
    in_stock:    { label: 'En stock',    variant: 'teal'  },
    low:         { label: 'Bajo',        variant: 'amber' },
    // Pedidos / Órdenes
    new:         { label: 'Nuevo',       variant: 'teal'  },
    pending:     { label: 'Pendiente',   variant: 'amber' },
    confirmed:   { label: 'Confirmado',  variant: 'green' },
    preparing:   { label: 'Preparando',  variant: 'amber' },
    processing:  { label: 'En proceso',  variant: 'teal'  },
    ready:       { label: 'Listo',       variant: 'green' },
    shipped:     { label: 'Enviado',     variant: 'teal'  },
    delivered:   { label: 'Entregado',   variant: 'green' },
    cancelled:   { label: 'Cancelado',   variant: 'red'   },
    // Caja
    open:        { label: 'Abierta',     variant: 'teal'  },
    closed:      { label: 'Cerrada',     variant: 'gray'  },
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
