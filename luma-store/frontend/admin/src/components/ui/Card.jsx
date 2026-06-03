// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className = '', hover = false, onClick }) {
  return (
    <div
      className={`card p-4 md:p-5 ${hover ? 'cursor-pointer hover:shadow-card-md transition-shadow duration-300' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

// ─── KPI Stat Card ────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, change, icon: Icon, accent = false, chart, iconBg, iconColor }) {
  const hasChange       = change !== undefined && change !== null
  const isPositive      = hasChange && change >= 0
  const resolvedIconBg  = accent ? 'bg-white/20' : (iconBg  || 'bg-cream-200')
  const resolvedIconClr = accent ? 'text-white'  : (iconColor || 'text-luma-muted')
  return (
    <div className={`card p-5 flex flex-col gap-3 hover:shadow-card-md transition-all duration-300
      ${accent ? 'gradient-teal text-white border-0' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`section-label ${accent ? 'text-white/60' : ''}`}>{label}</p>
          <p className={`text-2xl font-bold mt-1 tracking-tight ${accent ? 'text-white' : 'text-luma-text'}`}>
            {value}
          </p>
          {sub && <p className={`text-xs mt-0.5 ${accent ? 'text-white/70' : 'text-luma-faint'}`}>{sub}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {Icon && (
            <div className={`p-2 rounded-xl ${resolvedIconBg}`}>
              <Icon size={16} className={resolvedIconClr} />
            </div>
          )}
          {hasChange && (
            <span className={`text-xs font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'} ${accent ? 'text-white/80' : ''}`}>
              {isPositive ? '+' : ''}{change}%
            </span>
          )}
        </div>
      </div>
      {chart && <div className="h-10">{chart}</div>}
    </div>
  )
}

export default Card
