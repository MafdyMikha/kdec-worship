import { effectiveTolerance, validTolerance } from '../../lib/attendancePolicy.js'
import { useLang } from '../../lib/i18n.jsx'

export default function ToleranceEditor({ value, onChange, inheritedMinutes = 0, allowInherit = true, disabled = false }) {
  const { isAr } = useLang()
  const mode = value.lateToleranceMode || 'inherit'
  const minutes = value.lateToleranceMinutes ?? inheritedMinutes
  const effective = effectiveTolerance(value, { attendanceLateMinutes:inheritedMinutes })
  return <fieldset disabled={disabled} className="rounded-xl border border-slate-200 p-4 space-y-3 min-w-0">
    <legend className="px-1 text-sm font-semibold">{isAr?'سماح التأخير':'Late tolerance'}</legend>
    <label className="block text-sm space-y-1"><span>{isAr?'قاعدة التأخير':'Tolerance rule'}</span>
      <select className="w-full rounded-lg border border-slate-200 px-3 py-2" value={mode} onChange={e=>onChange({lateToleranceMode:e.target.value,lateToleranceMinutes:minutes})}>
        {allowInherit&&<option value="inherit">{isAr?`استخدام الافتراضي (${inheritedMinutes} دقيقة)`:`Use default (${inheritedMinutes} min)`}</option>}
        <option value="custom">{isAr?'قيمة خاصة بالدقائق':'Custom minutes'}</option>
        <option value="none">{isAr?'إلغاء السماح تمامًا (صفر دقيقة)':'Remove tolerance entirely (0 minutes)'}</option>
      </select>
    </label>
    {mode==='custom'&&<div className="flex items-center gap-2">
      <button type="button" aria-label={isAr?'تقليل دقيقة':'Decrease by one minute'} disabled={!validTolerance(minutes)||Number(minutes)===0} onClick={()=>onChange({lateToleranceMode:mode,lateToleranceMinutes:Number(minutes)-1})} className="min-w-11 min-h-11 rounded-lg border border-slate-200 disabled:opacity-40">−</button>
      <label className="min-w-0 flex-1"><span className="sr-only">{isAr?'دقائق السماح':'Tolerance minutes'}</span><input className="w-full min-h-11 rounded-lg border border-slate-200 px-3 text-center" type="number" min="0" max="2147483647" step="1" value={minutes} onChange={e=>onChange({lateToleranceMode:mode,lateToleranceMinutes:e.target.value})}/></label>
      <button type="button" aria-label={isAr?'زيادة دقيقة':'Increase by one minute'} disabled={!validTolerance(minutes)||Number(minutes)>=2147483647} onClick={()=>onChange({lateToleranceMode:mode,lateToleranceMinutes:Number(minutes)+1})} className="min-w-11 min-h-11 rounded-lg border border-slate-200 disabled:opacity-40">+</button>
    </div>}
    <p className="text-xs text-slate-500">{isAr?`السماح الفعلي: ${Number.isFinite(effective)?effective:'—'} دقيقة. بعد الموعد + السماح يُسجل الوصول متأخرًا. إلغاء السماح يعني أن التأخير يبدأ بعد الموعد مباشرة.`:`Effective tolerance: ${Number.isFinite(effective)?effective:'—'} min. Arrival after the start time plus tolerance is late. Removing tolerance means late marking starts immediately after the scheduled start.`}</p>
  </fieldset>
}
