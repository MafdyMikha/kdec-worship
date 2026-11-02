import { Fragment, useId } from 'react'
import { TIME_FIELDS, timeParts, updateTimePart } from '../lib/time.js'
import { useLang } from '../lib/i18n.jsx'

export default function TimeInput({ value, onChange, id, disabled, required, 'aria-label': label, ...props }) {
  const { isAr } = useLang()
  const generatedId = useId()
  const baseId = id || generatedId
  const parts = timeParts(value)
  const labels = { hour:isAr ? 'الساعة' : 'Hour', minute:isAr ? 'الدقيقة' : 'Minute', period:isAr ? 'الفترة' : 'AM/PM' }
  const update = (field, next) => {
    onChange?.({ target:{ value:updateTimePart(value, field, next), name:props.name } })
  }
  return <div dir="ltr" role="group" aria-label={label || (isAr ? 'الوقت' : 'Time')} className="time-input flex items-end gap-1.5 min-w-0">
    {TIME_FIELDS.map(({ key:field, options }, index) => {
      const fieldId = index === 0 ? baseId : `${baseId}-${field}`
      return <Fragment key={field}>
        {field === 'minute' && <span aria-hidden="true" className="py-2.5 text-slate-500">:</span>}
        <div className="min-w-0 flex-1">
          <label htmlFor={fieldId} dir="auto" className="block mb-1 text-xs font-medium text-slate-500">{labels[field]}</label>
          <select id={fieldId} dir="ltr" disabled={disabled} required={required}
            aria-label={`${label || (isAr ? 'الوقت' : 'Time')} — ${labels[field]}`}
            aria-invalid={props['aria-invalid']} aria-describedby={props['aria-describedby']}
            className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            value={parts?.[field] || ''} onChange={event => update(field,event.target.value)}>
            <option value="" disabled>—</option>
            {options.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </Fragment>
    })}
    {!required && value && !disabled && <button type="button" aria-label={isAr ? `مسح ${label || 'الوقت'}` : `Clear ${label || 'time'}`} onClick={()=>onChange?.({target:{value:'',name:props.name}})} className="px-1 py-2.5 text-slate-500">×</button>}
  </div>
}
