import { forwardRef } from 'react'

export const Input = forwardRef(function Input(
  { label, error, icon: Icon, hint, className = '', ...props },
  ref
) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-[12px] font-semibold text-luma-text">{label}</label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10">
            <Icon size={14} />
          </div>
        )}
        <input
          ref={ref}
          style={Icon ? { paddingLeft: '2.25rem' } : undefined}
          className={`input-base ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : ''}`}
          {...props}
        />
      </div>
      {hint && !error && <p className="text-[11px] text-luma-faint">{hint}</p>}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  )
})

export const Select = forwardRef(function Select(
  { label, error, children, className = '', ...props },
  ref
) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-[12px] font-semibold text-luma-text">{label}</label>}
      <select
        ref={ref}
        className={`input-base appearance-none cursor-pointer ${error ? 'border-red-400' : ''}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  )
})

export const Textarea = forwardRef(function Textarea(
  { label, error, className = '', ...props },
  ref
) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-[12px] font-semibold text-luma-text">{label}</label>}
      <textarea
        ref={ref}
        rows={3}
        className={`input-base resize-none ${error ? 'border-red-400' : ''}`}
        {...props}
      />
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  )
})

export default Input
