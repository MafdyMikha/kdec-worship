import { useState, useEffect } from 'react'
import { Save, Eye, EyeOff, Check, Calendar, Shield, Lock, Clock, Plus, X } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, Btn, Badge, Avatar, Tabs } from '../components/ui'
import { KDEC_LOGO } from '../assets/kdecLogo.js'

const DAYS_CONFIG = [
  { key:'sun' }, { key:'mon' }, { key:'tue' },
  { key:'wed' }, { key:'thu' }, { key:'fri' }, { key:'sat' },
]

export default function Profile() {
  const { isAr, t, lang } = useLang()
  const { currentUser, people, services, updateProfile, updatePersonAvailability } = useStore()
  const person = people.find(p => p.id === currentUser?.id) || {}

  const [tab,      setTab]      = useState('profile')
  const [saved,    setSaved]    = useState(false)
  const [form,     setForm]     = useState({
    name:         person.name || currentUser?.name || '',
    email:        currentUser?.email || '',
    phone:        person.phone || '',
    whatsapp:     person.whatsapp || '',
    notes:        person.notes || '',
    availability: person.availability || {},
    timeSlots:    person.timeSlots || [],
  })
  const [passForm,   setPassForm]   = useState({ newPass:'', confirm:'' })
  const [showPass,   setShowPass]   = useState(false)
  const [passError,  setPassError]  = useState('')
  const [availSaved, setAvailSaved] = useState(false)
  const [addingSlot, setAddingSlot] = useState(false)
  const [slotForm,   setSlotForm]   = useState({ day:'sun', from:'09:00', to:'12:00', label:'' })

  useEffect(() => {
    const p = people.find(pp => pp.id === currentUser?.id)
    if (p) setForm(f => ({...f, name:p.name||f.name, phone:p.phone||f.phone, whatsapp:p.whatsapp||f.whatsapp, notes:p.notes||f.notes, availability:p.availability||f.availability, timeSlots:p.timeSlots||f.timeSlots}))
  }, [people, currentUser?.id])

  const isAdmin    = currentUser?.isAdmin || currentUser?.is_admin
  const myServices = services.filter(s => s.team.find(tm => tm.personId === currentUser?.id))
  const confirmed  = myServices.filter(s => s.team.find(tm => tm.personId===currentUser?.id && tm.status==='confirmed')).length
  const availDays  = DAYS_CONFIG.filter(d => form.availability?.[d.key])

  const handleSave = async () => {
    await updateProfile(form)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveAvail = async () => {
    await updatePersonAvailability(currentUser.id, form.availability)
    await updateProfile({...form})
    setAvailSaved(true); setTimeout(() => setAvailSaved(false), 2000)
  }

  const handlePassword = async () => {
    setPassError('')
    if (passForm.newPass.length < 6) {
      setPassError(isAr ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters')
      return
    }
    if (passForm.newPass !== passForm.confirm) {
      setPassError(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match')
      return
    }
    await updateProfile({...form, newPassword: passForm.newPass})
    setPassForm({newPass:'', confirm:''})
  }

  const addSlot = () => {
    setForm(f => ({...f, timeSlots:[...(f.timeSlots||[]), {...slotForm, id:Date.now()}]}))
    setAddingSlot(false); setSlotForm({day:'sun', from:'09:00', to:'12:00', label:''})
  }

  // Position labels
  const POSITION_LABEL = { Admin: isAr?'مسؤول':'Admin', Leader: isAr?'قائد':'Leader', Volunteer: isAr?'متطوع':'Volunteer', Member: isAr?'عضو':'Member' }
  const STATUS_LABEL   = { active: isAr?'نشط':'Active', inactive: isAr?'غير نشط':'Inactive', 'on-leave': isAr?'إجازة':'On Leave' }
  const STATUS_CONF    = { confirmed: isAr?'مؤكد':'Confirmed', pending: isAr?'انتظار':'Pending', declined: isAr?'معتذر':'Declined' }
  const STATUS_COLOR   = { confirmed:'green', pending:'yellow', declined:'red' }

  const PROFILE_TABS = [
    { label: t('myInfo'),       value: 'profile'      },
    { label: t('weeklyAvail'),  value: 'availability' },
    { label: t('security'),     value: 'security'     },
    { label: t('myServices'),   value: 'services'     },
  ]

  return (
    <div className="max-w-2xl space-y-5 animate-fade-in">

      {/* Profile header */}
      <Card className="p-6">
        <div className="flex items-start gap-5">
          <div className="relative">
            <Avatar name={person.name || currentUser?.name} size="xl"/>
            {isAdmin && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center"><Shield size={12} className="text-white"/></div>}
          </div>
          <div className="flex-1">
            {/* Name always in Latin */}
            <h2 className="font-display font-bold text-xl text-slate-800" dir="ltr">{person.name || currentUser?.name}</h2>
            <p className="text-slate-500 text-sm">
              {((Array.isArray(person.roles) && person.roles.length>0) ? person.roles : (person.role?[person.role]:[])).join(' · ')} · {POSITION_LABEL[person.position] || person.position || POSITION_LABEL.Member}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge color={person.status==='active' ? 'green' : 'slate'} size="sm">
                {STATUS_LABEL[person.status] || person.status}
              </Badge>
              {isAdmin && <Badge color="indigo" size="sm">{isAr ? 'مسؤول' : 'Admin'}</Badge>}
            </div>
            <div className="flex gap-5 mt-3 text-sm">
              <div><strong className="text-slate-700">{myServices.length}</strong> <span className="text-slate-400">{isAr?'خدمة':'services'}</span></div>
              <div><strong className="text-slate-700">{confirmed}</strong> <span className="text-slate-400">{isAr?'مؤكدة':'confirmed'}</span></div>
            </div>
          </div>
          <img src={KDEC_LOGO} alt="" className="w-10 h-10 object-contain opacity-20 flex-shrink-0"/>
        </div>
      </Card>

      <Tabs tabs={PROFILE_TABS} active={tab} onChange={setTab}/>

      {/* Info tab */}
      {tab==='profile' && (
        <Card className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('fullName')} <span className="text-xs text-slate-400">({isAr?'بالأحرف اللاتينية':'Latin characters'})</span>
              </label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} dir="ltr"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('email')}</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email:e.target.value}))} dir="ltr"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('phone')}</label>
              <input value={form.phone} onChange={e => setForm(f => ({...f, phone:e.target.value}))} placeholder="+20 100 000 0000" dir="ltr"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-emerald-500"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                {t('whatsapp')}
              </label>
              <input value={form.whatsapp} onChange={e => setForm(f => ({...f, whatsapp:e.target.value}))} placeholder="+20 100 000 0000" dir="ltr"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 hover:border-slate-300"/>
              <p className="text-xs text-slate-400 mt-1">{isAr?'يُستخدم لإشعارات الخدمات':'Used for service notifications'}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('notes')}</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))}
              placeholder={isAr?'عن نفسك...':'About yourself...'} dir="auto"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none hover:border-slate-300" rows={3}/>
          </div>
          <Btn onClick={handleSave} icon={saved ? <Check size={15}/> : <Save size={15}/>}>
            {saved ? (isAr?'✓ تم الحفظ':'✓ Saved') : t('saveChanges')}
          </Btn>
        </Card>
      )}

      {/* Availability tab */}
      {tab==='availability' && (
        <Card className="p-4 md:p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600"><Calendar size={18}/></div>
            <div>
              <h3 className="font-display font-semibold text-slate-800">{t('weeklyAvail')}</h3>
              <p className="text-xs text-slate-400">{isAr?'الأيام التي تكون فيها متاحاً للخدمة':'Days you are available to serve'}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {DAYS_CONFIG.map(day => {
              const on = !!form.availability?.[day.key]
              return (
                <button key={day.key} type="button"
                  onClick={() => setForm(f => ({...f, availability:{...f.availability,[day.key]:!on}}))}
                  className={`flex flex-col items-center gap-0.5 w-16 py-3 rounded-xl border cursor-pointer transition-all select-none ${on?'bg-indigo-600 border-indigo-600 text-white shadow-sm':'border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50'}`}>
                  <span className="text-xs font-bold">{t(day.key).slice(0,1)}</span>
                  <span className="text-xs">{t(day.key)}</span>
                  {on && <Check size={10}/>}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-slate-400">
            {isAr?'متاح:':'Available:'} {availDays.length > 0 ? availDays.map(d => t(d.key)).join(isAr?'، ':' · ') : (isAr?'لم يتم التحديد':'None selected')}
          </p>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-slate-400"/>
              <h4 className="text-sm font-semibold text-slate-700">{t('weeklyAvail')}</h4>
              <span className="text-xs text-slate-400">({t('optional')})</span>
            </div>
            <div className="space-y-2 mb-3">
              {(form.timeSlots||[]).map(s => (
                <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
                  <Clock size={12} className="text-indigo-500 flex-shrink-0"/>
                  <span className="text-sm text-indigo-700 font-medium">{t(s.day)}</span>
                  <span className="text-sm text-indigo-500" dir="ltr">{s.from} – {s.to}</span>
                  {s.label && <span className="text-xs text-indigo-400 italic">{s.label}</span>}
                  <button onClick={() => setForm(f=>({...f,timeSlots:(f.timeSlots||[]).filter(ts=>ts.id!==s.id)}))} className="ms-auto text-indigo-300 hover:text-red-400 cursor-pointer"><X size={12}/></button>
                </div>
              ))}
            </div>
            {addingSlot ? (
              <div className="border border-indigo-200 rounded-xl p-3 space-y-2 bg-indigo-50/40">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{isAr?'اليوم':'Day'}</label>
                    <select value={slotForm.day} onChange={e=>setSlotForm(f=>({...f,day:e.target.value}))}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {DAYS_CONFIG.map(d => <option key={d.key} value={d.key}>{t(d.key)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{isAr?'من':'From'}</label>
                    <input type="time" value={slotForm.from} onChange={e=>setSlotForm(f=>({...f,from:e.target.value}))}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{isAr?'إلى':'To'}</label>
                    <input type="time" value={slotForm.to} onChange={e=>setSlotForm(f=>({...f,to:e.target.value}))}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                  </div>
                </div>
                <input value={slotForm.label} onChange={e=>setSlotForm(f=>({...f,label:e.target.value}))}
                  placeholder={isAr?'وصف (اختياري)':'Label (optional)'}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                <div className="flex gap-2">
                  <button onClick={addSlot} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg cursor-pointer hover:bg-indigo-700">{t('add')}</button>
                  <button onClick={() => setAddingSlot(false)} className="px-3 py-1.5 text-slate-500 text-xs cursor-pointer hover:text-slate-700">{t('cancel')}</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingSlot(true)} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium">
                <Plus size={14}/> {t('addTimeSlot')}
              </button>
            )}
          </div>
          <Btn onClick={handleSaveAvail} icon={availSaved ? <Check size={15}/> : <Save size={15}/>}>
            {availSaved ? (isAr?'✓ تم الحفظ':'✓ Saved') : t('saveChanges')}
          </Btn>
        </Card>
      )}

      {/* Security tab */}
      {tab==='security' && (
        <Card className="p-4 md:p-6 space-y-4">
          <h3 className="font-semibold text-slate-700">{t('changePassword')}</h3>
          {passError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-600">{passError}</div>}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('newPassword')}</label>
            <input type={showPass?'text':'password'} value={passForm.newPass} onChange={e=>setPassForm(f=>({...f,newPass:e.target.value}))}
              placeholder={isAr?'6 أحرف على الأقل':'At least 6 characters'}
              className="w-full px-3.5 py-2.5 pe-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
            <button onClick={() => setShowPass(!showPass)} className="absolute end-3 bottom-2.5 text-slate-400 cursor-pointer">
              {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('confirmPassword')}</label>
            <input type="password" value={passForm.confirm} onChange={e=>setPassForm(f=>({...f,confirm:e.target.value}))}
              placeholder={isAr?'أعد كتابة كلمة المرور':'Re-enter password'}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
          </div>
          <Btn onClick={handlePassword} icon={<Lock size={14}/>}>{t('updatePassword')}</Btn>
          <div className="pt-4 border-t border-slate-100 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">{t('email')}</span><span className="text-slate-700" dir="ltr">{currentUser?.email}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">{t('role')}</span><Badge color={isAdmin?'indigo':'slate'} size="xs">{isAdmin?(isAr?'مسؤول':'Admin'):(isAr?'عضو':'Member')}</Badge></div>
          </div>
        </Card>
      )}

      {/* Services tab */}
      {tab==='services' && (
        <div className="space-y-3">
          {myServices.length===0 && (
            <Card className="p-8 text-center">
              <Calendar size={28} className="text-slate-300 mx-auto mb-2"/>
              <p className="text-slate-500 text-sm">{t('noServices')}</p>
            </Card>
          )}
          {[...myServices].sort((a,b)=>b.date>a.date?1:-1).map(svc => {
            const me = svc.team.find(tm => tm.personId === currentUser?.id)
            return (
              <Card key={svc.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 text-sm">{svc.title}</h3>
                    <p className="text-xs text-slate-500">{svc.date} · {svc.time} · <strong>{me?.role}</strong></p>
                    {svc.practice?.enabled && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>
                        {isAr?'بروفة':'Practice'}: {svc.practice.date} {isAr?'الساعة':'at'} {svc.practice.time}
                      </div>
                    )}
                  </div>
                  <Badge color={STATUS_COLOR[me?.status]||'slate'} size="sm">{STATUS_CONF[me?.status]||me?.status}</Badge>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
