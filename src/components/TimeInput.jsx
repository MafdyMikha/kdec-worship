import { timeParts, time24 } from '../lib/time.js'
import { useLang } from '../lib/i18n.jsx'

export default function TimeInput({ value, onChange, id, disabled, required, 'aria-label': label, ...props }) {
  const { isAr } = useLang()
  const parts = timeParts(value)
  const update = (field, next) => {
    const updated = { hour:'12', minute:'00', period:'AM', ...parts, [field]:next }
    onChange?.({ target:{ value:time24(updated.hour, updated.minute, updated.period), name:props.name } })
  }
  return <div dir="ltr" className="flex items-center gap-2 min-w-0">
    {['hour','minute','period'].map((field, index) => <select
      key={field} id={index === 0 ? id : `${id}-${field}`} disabled={disabled} required={required}
      aria-label={`${label || (isAr ? 'الوقت' : 'Time')} — ${field === 'period' ? 'AM/PM' : field === 'hour' ? (isAr ? 'الساعة' : 'Hour') : (isAr ? 'الدقيقة' : 'Minute')}`}
      aria-invalid={props['aria-invalid']} aria-describedby={props['aria-describedby']}
      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
      value={parts?.[field] || ''} onChange={event => update(field,event.target.value)}>
      <option value="" disabled>{field === 'period' ? 'AM/PM' : '—'}</option>
      {(field === 'hour' ? Array.from({ length:12 },(_,i)=>String(i+1)) : field === 'minute' ? Array.from({length:60},(_,i)=>String(i).padStart(2,'0')) : ['AM','PM']).map(option=><option key={option} value={option}>{option}</option>)}
    </select>)}
    {!required && value && !disabled && <button type="button" aria-label={isAr ? 'مسح الوقت' : `Clear ${label || 'time'}`} onClick={()=>onChange?.({target:{value:''}})} className="px-2 text-slate-500">×</button>}
  </div>
}
