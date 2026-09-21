import { useState } from 'react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, Input, Btn, Textarea } from './ui'
import { prepareRehearsal, rehearsalLocationUrl, rehearsalBeforeService } from '../lib/rehearsal.js'

export default function ServicePreparation({ service, canEdit, onSaved }) {
  const { updateService } = useStore()
  const { isAr } = useLang()
  const [soundcheck, setSoundcheck] = useState(service.soundcheckTime || '')
  const [enabled, setEnabled] = useState(Boolean(service.practice?.enabled))
  const [date, setDate] = useState(service.practice?.date || service.date)
  const [time, setTime] = useState(service.practice?.time || '18:00')
  const [location, setLocation] = useState(service.practice?.location || '')
  const [locationUrl, setLocationUrl] = useState(service.practice?.locationUrl || '')
  const [notes, setNotes] = useState(service.practice?.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const validSchedule = rehearsalBeforeService({ enabled, date, time }, service)
  const scheduleError = isAr ? 'يجب أن تبدأ البروفة قبل موعد الخدمة. في نفس اليوم، اختر وقتاً أسبق من وقت الخدمة.' : 'Rehearsal must start before the service. On the same day, choose an earlier time.'
  const save = async () => {
    if (!canEdit || saving) return
    if (!validSchedule) { setError(scheduleError); return }
    if (enabled && locationUrl.trim() && !rehearsalLocationUrl(locationUrl)) {
      setError(isAr ? 'أدخل رابط موقع صحيح يبدأ بـ https:// أو http://' : 'Enter a valid location link starting with https:// or http://.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await updateService(service.id, {
        soundcheckTime:soundcheck || null,
        practice:prepareRehearsal(service.practice, { enabled, date, time, location, locationUrl, notes }),
      })
      if (result?.error) setError(result.error)
      else if (result?.success) onSaved?.()
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
      <Input label={isAr ? 'تاريخ البروفة' : 'Rehearsal date'} type="date" max={service.date} required value={date} disabled={!canEdit || saving} onChange={event => setDate(event.target.value)}/>
      <Input label={isAr ? 'وقت البروفة' : 'Rehearsal time'} type="time" required value={time} disabled={!canEdit || saving} onChange={event => setTime(event.target.value)}/>
      <Input label={isAr ? 'مكان البروفة' : 'Rehearsal location'} value={location} dir="auto" placeholder={isAr ? 'اكتب المكان' : 'Type the location'} disabled={!canEdit || saving} onChange={event => setLocation(event.target.value)}/>
      <Input label={isAr ? 'رابط الموقع' : 'Location link'} type="url" dir="ltr" value={locationUrl} placeholder="https://maps.google.com/..." disabled={!canEdit || saving} onChange={event => setLocationUrl(event.target.value)}/>
      <div className="sm:col-span-2"><Textarea label={isAr ? 'ملاحظات البروفة' : 'Rehearsal notes'} dir="auto" value={notes} disabled={!canEdit || saving} onChange={event => setNotes(event.target.value)}/></div>
    </div>}
    {(!validSchedule || error) && <p role="alert" className="text-sm text-red-600">{!validSchedule ? scheduleError : error}</p>}
    {canEdit && <Btn onClick={save} disabled={saving || !validSchedule}>{saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ وعرض تفاصيل الخدمة' : 'Save & View Details')}</Btn>}
  </Card>
}
