import { useState } from 'react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, Input, Btn } from './ui'

export default function ServicePreparation({ service, canEdit }) {
  const { updateService } = useStore()
  const { isAr } = useLang()
  const [soundcheck, setSoundcheck] = useState(service.soundcheckTime || '')
  const [enabled, setEnabled] = useState(Boolean(service.practice?.enabled))
  const [date, setDate] = useState(service.practice?.date || service.date)
  const [time, setTime] = useState(service.practice?.time || '18:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const result = await updateService(service.id, {
        soundcheckTime:soundcheck || null,
        practice:enabled ? { ...service.practice, enabled:true, date, time } : { enabled:false },
      })
      if (result?.error) setError(result.error)
    } catch {
      setError(isAr ? 'تعذر الحفظ. حاول مرة أخرى.' : 'Could not save. Please try again.')
    } finally { setSaving(false) }
  }
  return <Card className="p-4 space-y-3">
    <h3 className="font-semibold">{isAr ? 'تجهيز اجتماع هذا الأسبوع' : 'Prepare this meeting'}</h3>
    <p className="text-sm text-slate-500">{isAr ? 'الفريق والساوند تشيك والبروفة تخص هذا الموعد فقط.' : 'Team, soundcheck and rehearsal details apply only to this occurrence.'}</p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Input label={isAr ? 'وقت الساوند تشيك' : 'Soundcheck time'} type="time" value={soundcheck} disabled={!canEdit || saving} onChange={event => setSoundcheck(event.target.value)}/>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={!canEdit || saving} onChange={event => setEnabled(event.target.checked)}/>{isAr ? 'توجد بروفة' : 'Has rehearsal'}</label>
    </div>
    {enabled && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Input label={isAr ? 'تاريخ البروفة' : 'Rehearsal date'} type="date" required value={date} disabled={!canEdit || saving} onChange={event => setDate(event.target.value)}/>
      <Input label={isAr ? 'وقت البروفة' : 'Rehearsal time'} type="time" required value={time} disabled={!canEdit || saving} onChange={event => setTime(event.target.value)}/>
    </div>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {canEdit && <Btn onClick={save} disabled={saving || (enabled && (!date || !time))}>{saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ التجهيزات' : 'Save preparation')}</Btn>}
  </Card>
}
