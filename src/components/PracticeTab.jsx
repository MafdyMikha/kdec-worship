import { useState } from 'react'
import { Dumbbell, Plus, Check, X, Clock, MapPin, Edit2, Save, AlertCircle, Trash2, CheckCircle, HelpCircle } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, Btn, Badge, Avatar, Textarea, Input } from '../components/ui'
import { format, parseISO } from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'

export default function PracticeTab({ service, canEdit=false }) {
  const { people, setPractice, updatePracticeAttendance } = useStore()
  const { isAr, t } = useLang()
  const practice = service.practice
  const [editing, setEditing] = useState(canEdit && !practice?.enabled)
  const [form, setForm] = useState({
    date:     practice?.date     || '',
    time:     practice?.time     || '18:00',
    location: practice?.location || (isAr ? 'قاعة الكنيسة' : 'Church Hall'),
    notes:    practice?.notes    || '',
  })

  const locale = isAr ? arLocale : undefined

  const STATUSES = {
    attending: { label: isAr ? 'حضور' : 'Attending', bg:'bg-emerald-50 border-emerald-300 text-emerald-700', icon:<CheckCircle size={12}/> },
    absent:    { label: isAr ? 'غياب' : 'Absent',    bg:'bg-red-50 border-red-300 text-red-700',             icon:<X size={12}/> },
    maybe:     { label: isAr ? 'ربما' : 'Maybe',      bg:'bg-amber-50 border-amber-300 text-amber-700',       icon:<HelpCircle size={12}/> },
  }

  const team = (service.team||[]).map(tm=>{
    const person  = tm.person || people.find(p=>p.id===tm.personId)
    const pid     = tm.personId || tm.person?.id || ''
    const pStatus = practice?.attendance?.find(a=>a.personId===pid)?.status || 'pending'
    return {...tm, personId:pid, person, practiceStatus:pStatus}
  }).filter(tm=>tm.person)

  const attending = team.filter(tm=>tm.practiceStatus==='attending').length
  const absent    = team.filter(tm=>tm.practiceStatus==='absent').length
  const pending   = team.filter(tm=>tm.practiceStatus==='pending').length

  const save = async () => {
    if (!form.date) return
    const result = await setPractice(service.id, {...form, enabled:true, attendance:practice?.attendance||[]})
    if (!result?.error) setEditing(false)
  }
  const remove = async () => {
    const result = await setPractice(service.id, {enabled:false})
    if (!result?.error) {
      setForm({date:'',time:'18:00',location:isAr?'قاعة الكنيسة':'Church Hall',notes:''})
      setEditing(true)
    }
  }

  if (!practice?.enabled && !editing) return (
    <Card className="p-10 text-center">
      <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Dumbbell size={28} className="text-emerald-500"/>
      </div>
      <h3 className="font-display font-semibold text-slate-700 mb-1">{t('noPractice')}</h3>
      <p className="text-sm text-slate-500 mb-5">
        {isAr ? 'أضف جلسة بروفة لمتابعة الحضور بشكل منفصل.' : 'Add a practice session to track attendance separately.'}
      </p>
      {canEdit&&<Btn onClick={()=>setEditing(true)} icon={<Plus size={16}/>}>{t('schedulePractice')}</Btn>}
    </Card>
  )

  return (
    <div className="space-y-4">
      {editing && canEdit ? (
        <Card className="p-5 border-2 border-emerald-200">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <Dumbbell size={16}/>
            </div>
            <h3 className="font-display font-semibold text-slate-800">
              {practice?.enabled ? t('editPractice') : t('schedulePractice')}
            </h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={t('date')} required type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
              <Input label={t('time')} type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))}/>
            </div>
            <Input label={t('location')} value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))}
              placeholder={isAr?'قاعة الكنيسة، غرفة التدريب...':'Church hall, rehearsal room...'}/>
            <Textarea label={t('practiceNotes')} value={form.notes}
              onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
              placeholder={isAr ? 'محاور البروفة، الترانيم المطلوبة...' : 'Focus areas, songs to rehearse...'} rows={3}/>
            <div className="flex gap-2">
              <Btn onClick={save} disabled={!form.date} icon={<Save size={14}/>}>
                {practice?.enabled ? t('saveChanges') : t('schedulePractice')}
              </Btn>
              {practice?.enabled && <Btn variant="ghost" onClick={()=>setEditing(false)}>{t('cancel')}</Btn>}
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-5 border-l-4 border-l-emerald-400">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <Dumbbell size={18}/>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display font-semibold text-slate-800">{t('practice')}</h3>
                    <Badge color="green" size="xs">{isAr ? 'مجدولة' : 'Scheduled'}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock size={13} className="text-slate-400"/>
                      {practice.date ? format(parseISO(practice.date), isAr ? 'EEEE، d MMMM' : 'EEE, MMM d', {locale}) : '—'} {isAr ? 'الساعة' : 'at'} {practice.time}
                    </span>
                    {practice.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-slate-400"/>{practice.location}
                      </span>
                    )}
                  </div>
                  {practice.notes && <p className="text-sm text-slate-500 mt-1.5 italic">📝 {practice.notes}</p>}
                  {team.length > 0 && (
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 text-sm">
                      <span className="text-emerald-600"><CheckCircle size={13} className="inline mr-1"/>{attending} {isAr?'حضور':'attending'}</span>
                      {absent>0 && <span className="text-red-500"><X size={13} className="inline mr-1"/>{absent} {isAr?'غياب':'absent'}</span>}
                      {pending>0 && <span className="text-slate-400"><Clock size={13} className="inline mr-1"/>{pending} {isAr?'لم يرد':'pending'}</span>}
                    </div>
                  )}
                </div>
              </div>
              {canEdit&&<div className="flex gap-1 flex-shrink-0">
                <button onClick={()=>{setForm({date:practice.date||'',time:practice.time||'18:00',location:practice.location||'',notes:practice.notes||''});setEditing(true)}}
                  aria-label={isAr?'تعديل البروفة':'Edit practice'}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer">
                  <Edit2 size={15}/>
                </button>
                <button onClick={remove} aria-label={isAr?'إزالة البروفة':'Remove practice'} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer">
                  <Trash2 size={15}/>
                </button>
              </div>}
            </div>
            {team.length > 0 && (
              <div className="mt-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{width:`${(attending/team.length)*100}%`}}/>
              </div>
            )}
          </Card>

          {team.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('attendanceRecord')}</p>
              {team.map(m=>(
                <Card key={m.personId} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.person?.name} size="sm"/>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 text-sm">{m.person?.name}</div>
                      <div className="text-xs text-slate-400">{m.role}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {canEdit ? Object.entries(STATUSES).map(([st,cfg])=>(
                        <button key={st} onClick={()=>updatePracticeAttendance(service.id,m.personId,st)}
                          aria-pressed={m.practiceStatus===st} aria-label={cfg.label}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all select-none ${m.practiceStatus===st?cfg.bg:'border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50'}`}>
                          {cfg.icon}<span className="hidden sm:inline">{cfg.label}</span>
                        </button>
                      )) : <Badge color={m.practiceStatus==='attending'?'green':m.practiceStatus==='absent'?'red':m.practiceStatus==='maybe'?'yellow':'slate'} size="xs">{STATUSES[m.practiceStatus]?.label||(isAr?'لم يرد':'Pending')}</Badge>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {team.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              <AlertCircle size={14}/>
              {isAr ? 'أضف أعضاء للفريق لمتابعة حضور البروفة.' : 'Add team members to track practice attendance.'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
