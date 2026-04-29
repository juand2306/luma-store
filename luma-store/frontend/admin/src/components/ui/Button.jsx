import { forwardRef } from 'react'

export const Button = forwardRef(function Button(
  { variant = 'teal', size = 'md', loading = false, icon: Icon, children, className = '', ...props },
  ref
) {
  const variants = {
    teal:    'btn-teal',
    outline: 'btn-outline',
    ghost:   'btn-ghost',
    danger:  'bg-red-500 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-red-600 active:scale-95 shadow-sm cursor-pointer',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-sm gap-2',
  }

  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center font-medium transition-all duration-200
        ${variants[variant]} ${sizes[size]} ${className}
        ${loading ? 'opacity-70 pointer-events-none' : ''}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 13 : 15} />
      ) : null}
      {children}
    </button>
  )
})

export default Button
