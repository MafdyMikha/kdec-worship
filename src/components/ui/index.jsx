import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../lib/i18n.jsx'

// Button
export function Btn({ children, onClick, variant = 'primary', size = 'md', className = '', disabled, type = 'button', icon, ...props }) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95'
  const variants = {
    primary:   'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm',
    ghost:     'text-slate-600 hover:bg-slate-100 hover:text-slate-800',
    danger:    'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    success:   'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    outline:   'border border-indigo-200 text-indigo-700 hover:bg-indigo-50',
  }
  const sizes = {
    xs: 'px-2.5 py-1.5 text-xs min-h-[32px]',
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-4 py-2.5 text-sm min-h-[40px]',
    lg: 'px-5 py-3 text-base min-h-[48px]',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} {...props}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  )
}

// Badge
export function Badge({ children, color = 'slate', size = 'sm', className='' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    pink: 'bg-pink-100 text-pink-700',
  }
  const sizes = { xs: 'px-1.5 py-0.5 text-xs', sm: 'px-2 py-0.5 text-xs', md: 'px-2.5 py-1 text-sm' }
  return <span className={`inline-flex items-center font-medium rounded-full ${colors[color]} ${sizes[size]} ${className}`}>{children}</span>
}

// Avatar
export function Avatar({ name, size = 'md', color }) {
  const initials = name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
  const colors = ['bg-indigo-500', 'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-pink-500', 'bg-cyan-500']
  const bg = color || colors[name?.charCodeAt(0) % colors.length] || colors[0]
  const sizes = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base', xl: 'w-14 h-14 text-lg' }
  return <div className={`${bg} ${sizes[size]} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>{initials}</div>
}

// Modal
export function Modal({ open, onClose, title, children, size = 'md', footer }) {
  const { t } = useLang()
  const titleId = useId()
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const previousFocus = document.activeElement
    const appRoot = document.getElementById('root')
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (appRoot) {
      appRoot.inert = true
      appRoot.setAttribute('aria-hidden', 'true')
    }

    const dialog = dialogRef.current
    const firstFocusable = dialog?.querySelector(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    )
    ;(firstFocusable || dialog)?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      if (appRoot) {
        appRoot.inert = false
        appRoot.removeAttribute('aria-hidden')
      }
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [open])

  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )].filter(element => element instanceof HTMLElement && element.offsetParent !== null)
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${sizes[size]} bg-white sm:rounded-2xl rounded-t-2xl shadow-modal animate-slide-up sm:animate-scale-in max-h-[92vh] flex flex-col`}>
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full"/>
        </div>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex-shrink-0">
          <h2 id={titleId} className="text-base sm:text-lg font-display font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} aria-label={t('close')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">{children}</div>
        {footer && <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex-shrink-0 flex justify-end gap-2 sm:gap-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// Form components
export function Label({ children, required, htmlFor }) {
  return <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 mb-1.5">{children}{required && <span className="text-red-500 ms-1" aria-hidden="true">*</span>}</label>
}

export function Input({ label, required, error, className = '', ...props }) {
  const generatedId = useId()
  const id = props.id || generatedId
  const errorId = `${id}-error`
  return (
    <div className={className}>
      {label && <Label htmlFor={id} required={required}>{label}</Label>}
      <input id={id} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : props['aria-describedby']} className={`w-full px-3.5 py-2.5 border rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${error ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'}`} {...props} />
      {error && <p id={errorId} className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  )
}

export function Select({ label, required, error, children, className = '', ...props }) {
  const generatedId = useId()
  const id = props.id || generatedId
  const errorId = `${id}-error`
  return (
    <div className={className}>
      {label && <Label htmlFor={id} required={required}>{label}</Label>}
      <select id={id} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : props['aria-describedby']} className={`w-full px-3.5 py-2.5 border rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none bg-white ${error ? 'border-red-300' : 'border-slate-200 hover:border-slate-300'}`} {...props}>
        {children}
      </select>
      {error && <p id={errorId} className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  )
}

export function Textarea({ label, required, error, className = '', ...props }) {
  const generatedId = useId()
  const id = props.id || generatedId
  const errorId = `${id}-error`
  return (
    <div className={className}>
      {label && <Label htmlFor={id} required={required}>{label}</Label>}
      <textarea id={id} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : props['aria-describedby']} className={`w-full px-3.5 py-2.5 border rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none ${error ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'}`} rows={3} {...props} />
      {error && <p id={errorId} className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  )
}

// Card
export function Card({ children, className = '', onClick, hover = false }) {
  const handleKeyDown = onClick
    ? event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick(event)
        }
      }
    : undefined
  return (
    <div onClick={onClick} onKeyDown={handleKeyDown} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      className={`bg-white rounded-xl border border-slate-200/80 shadow-card ${hover || onClick ? 'hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer' : ''} transition-all ${className}`}>
      {children}
    </div>
  )
}

// Empty state
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-4">{icon}</div>
      <h3 className="font-display font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs mb-5">{description}</p>
      {action}
    </div>
  )
}

// Search input
export function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        aria-label={placeholder}
        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white placeholder:text-slate-400 hover:border-slate-300 transition-all" />
    </div>
  )
}

// Status indicator
export function StatusDot({ status }) {
  const map = { confirmed: 'bg-emerald-500', pending: 'bg-amber-400', declined: 'bg-red-500', active: 'bg-emerald-500', inactive: 'bg-slate-300' }
  return <span className={`inline-block w-2 h-2 rounded-full ${map[status] || 'bg-slate-300'}`} />
}

// Notification toast
export function Notifications({ items }) {
  const icons = { success: <CheckCircle size={16} className="text-emerald-500" />, error: <AlertCircle size={16} className="text-red-500" />, info: <Info size={16} className="text-blue-500" />, warning: <AlertTriangle size={16} className="text-amber-500" /> }
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" aria-live="polite" aria-atomic="true">
      {items.map(n => (
        <div key={n.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-modal border border-slate-100 animate-slide-up min-w-64">
          {icons[n.type] || icons.success}
          <span className="text-sm font-medium text-slate-700">{n.msg}</span>
        </div>
      ))}
    </div>
  )
}

// Tabs
export function Tabs({ tabs, active, onChange }) {
  const onKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const buttons = [...event.currentTarget.querySelectorAll('[role="tab"]')]
    const currentIndex = buttons.indexOf(document.activeElement)
    if (currentIndex < 0) return
    event.preventDefault()
    let nextIndex = currentIndex
    if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = buttons.length - 1
    else if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % buttons.length
    else nextIndex = (currentIndex - 1 + buttons.length) % buttons.length
    buttons[nextIndex].focus()
    buttons[nextIndex].click()
  }
  return (
    <div className="max-w-full overflow-x-auto">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-max min-w-full sm:min-w-0" role="tablist" onKeyDown={onKeyDown}>
        {tabs.map(tab => (
          <button key={tab.value} role="tab" aria-selected={active === tab.value} tabIndex={active === tab.value ? 0 : -1} onClick={() => onChange(tab.value)}
            className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-all ${active === tab.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab.label}
            {tab.count !== undefined && <span className={`ms-1.5 px-1.5 py-0.5 rounded-full text-xs ${active === tab.value ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>{tab.count}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// Stat card
export function StatCard({ label, value, icon, trend, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>{icon}</div>
        {trend && <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{trend > 0 ? '+' : ''}{trend}%</span>}
      </div>
      <div className="text-2xl font-display font-bold text-slate-800 mb-0.5">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </Card>
  )
}

// Confirm dialog
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, confirmVariant='danger' }) {
  const { t } = useLang()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) { setPending(false); setError('') }
  }, [open])
  const handleConfirm = async () => {
    if (pending) return
    setPending(true)
    setError('')
    try {
      const result = await onConfirm()
      if (result?.error) setError(result.error)
      else onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The action could not be completed.')
    } finally {
      setPending(false)
    }
  }
  return (
    <Modal open={open} onClose={pending ? () => {} : onClose} title={title} size="sm"
      footer={<><Btn variant="secondary" onClick={onClose} disabled={pending}>{t('cancel')}</Btn><Btn variant={confirmVariant} onClick={handleConfirm} disabled={pending}>{pending ? '…' : (confirmLabel||t('delete'))}</Btn></>}>
      <p className="text-slate-600 text-sm">{message}</p>
      {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
    </Modal>
  )
}
