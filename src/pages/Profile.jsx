import { useState, useEffect } from 'react'
import { Save, Eye, EyeOff, Check, Calendar, Shield, Lock, Clock, Plus, X } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, Btn, Badge, Avatar, Tabs } from '../components/ui'
import { KDEC_LOGO } from '../assets/kdecLogo.js'
import { ACCESS_LEVEL_LABELS, isAdminUser } from '../lib/permissions.js'

const DAYS_CONFIG = [
  { key:'sun' }, { key:'mon' }, { key:'tue' },
  { key:'wed' }, { key:'thu' }, { key:'fri' }, { key:'sat' },
]
const EMPTY_PERSON = Object.freeze({})

export default function Profile() {
  const { isAr, t } = useLang()
  const { currentUser, people, services, updateProfile, updatePassword, isDemoMode } = useStore()
  const person = people.find(p => p.id === currentUser?.id) || EMPTY_PERSON

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
  const [passSaved,  setPassSaved]  = useState(false)
  const [savingPass, setSavingPass] = useState(false)
  const [availSaved, setAvailSaved] = useState(false)
  const [saveError,  setSaveError]  = useState('')
  const [saving,     setSaving]     = useState(false)
  const [addingSlot, setAddingSlot] = useState(false)
  const [slotForm,   setSlotForm]   = useState({ day:'sun', from:'09:00', to:'12:00', label:'' })
  const [slotError,  setSlotError]  = useState('')

  useEffect(() => {
    if (!person.id || !currentUser) return
    setForm({
      name: person.name ?? currentUser.name ?? '',
      email: currentUser.email ?? person.email ?? '',
      phone: person.phone ?? '',
      whatsapp: person.whatsapp ?? '',
      notes: person.notes ?? '',
      availability: person.availability ?? {},
      timeSlots: person.timeSlots ?? [],
    })
  }, [currentUser, person])

  const isAdmin=isAdminUser(currentUser)
  const myServices = services.filter(s => s.team.find(tm => tm.personId === currentUser?.id))
  const confirmed  = myServices.filter(s => s.team.find(tm => tm.personId===currentUser?.id && tm.status==='confirmed')).length
  const availDays  = DAYS_CONFIG.filter(d => form.availability?.[d.key])

  const handleSave = async () => {
    if (!form.name.trim()) {
      setSaveError(isAr ? 'الاسم مطلوب' : 'Name is required')
      return
    }
    setSaving(true)
    setSaveError('')
    setSaved(false)
    try {
      const result = await updateProfile(form)
      if (result?.error) throw new Error(result.error)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (isAr ? 'تعذر حفظ الملف الشخصي' : 'Could not save your profile'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAvail = async () => {
    setSaving(true)
    setSaveError('')
    setAvailSaved(false)
    try {
      const result = await updateProfile(form)
      if (result?.error) throw new Error(result.error)
      setAvailSaved(true)
      setTimeout(() => setAvailSaved(false), 2000)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (isAr ? 'تعذر حفظ التوفر' : 'Could not save availability'))
    } finally {
      setSaving(false)
    }
  }

  const handlePassword = async () => {
    setPassError('')
    setPassSaved(false)
    if (isDemoMode) {
      setPassError(isAr ? 'تغيير كلمة المرور غير متاح في وضع العرض التجريبي' : 'Password changes are not available in demo mode')
      return
    }
    if (passForm.newPass.length < 6) {
      setPassError(isAr ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters')
      return
    }
    if (passForm.newPass !== passForm.confirm) {
      setPassError(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match')
      return
    }
    setSavingPass(true)
    try {
      const result = await updatePassword(passForm.newPass)
      if (result?.error) throw new Error(result.error)
      setPassForm({newPass:'', confirm:''})
      setPassSaved(true)
    } catch (error) {
      setPassError(error instanceof Error ? error.message : (isAr ? 'تعذر تحديث كلمة المرور' : 'Could not update password'))
    } finally {
      setSavingPass(false)
    }
  }

  const addSlot = () => {
    setSlotError('')
    if (!slotForm.from || !slotForm.to || slotForm.to <= slotForm.from) {
      setSlotError(isAr ? 'يجب أن يكون وقت الانتهاء بعد وقت البدء' : 'End time must be after start time')
      return
    }
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
        <div className="flex items-start gap-4 sm:gap-5">
          <div className="relative">
            <Avatar name={person.name || currentUser?.name} size="xl"/>
            {isAdmin && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center"><Shield size={12} aria-hidden="true" className="text-white"/></div>}
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold text-xl text-slate-800" dir="auto">{person.name || currentUser?.name}</h2>
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
          <img src={KDEC_LOGO} alt="" className="hidden sm:block w-10 h-10 object-contain opacity-20 flex-shrink-0"/>
        </div>
      </Card>

      <Tabs tabs={PROFILE_TABS} active={tab} onChange={setTab}/>

      {saveError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* Info tab */}
      {tab==='profile' && (
        <Card className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-name" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('fullName')}
              </label>
              <input id="profile-name" name="name" value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} dir="auto" autoComplete="name" required
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
            </div>
            <div>
              <label htmlFor="profile-email" className="block text-sm font-medium text-slate-700 mb-1.5">{t('email')}</label>
              <input id="profile-email" name="email" type="email" value={form.email} dir="ltr" autoComplete="email" readOnly aria-describedby="profile-email-help"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 text-sm"/>
              <p id="profile-email-help" className="mt-1 text-xs text-slate-500">
                {isAr?'تواصل مع المسؤول لتغيير بريد تسجيل الدخول.':'Contact an administrator to change the sign-in email.'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-phone" className="block text-sm font-medium text-slate-700 mb-1.5">{t('phone')}</label>
              <input id="profile-phone" name="phone" type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone:e.target.value}))} placeholder="+20 100 000 0000" dir="ltr" autoComplete="tel" inputMode="tel"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
            </div>
            <div>
              <label htmlFor="profile-whatsapp" className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="text-emerald-500"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                {t('whatsapp')}
              </label>
              <input id="profile-whatsapp" name="whatsapp" type="tel" value={form.whatsapp} onChange={e => setForm(f => ({...f, whatsapp:e.target.value}))} placeholder="+20 100 000 0000" dir="ltr" inputMode="tel" aria-describedby="profile-whatsapp-help"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 hover:border-slate-300"/>
              <p id="profile-whatsapp-help" className="text-xs text-slate-500 mt-1">{isAr?'يُستخدم لإشعارات الخدمات':'Used for service notifications'}</p>
            </div>
          </div>
          <div>
            <label htmlFor="profile-notes" className="block text-sm font-medium text-slate-700 mb-1.5">{t('notes')}</label>
            <textarea id="profile-notes" name="notes" value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))}
              placeholder={isAr?'عن نفسك...':'About yourself...'} dir="auto"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none hover:border-slate-300" rows={3}/>
          </div>
          <Btn onClick={handleSave} disabled={saving || !form.name.trim()} icon={saved ? <Check size={15}/> : <Save size={15}/>}>
            <span aria-live="polite">{saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : saved ? (isAr?'✓ تم الحفظ':'✓ Saved') : t('saveChanges')}</span>
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
          <fieldset>
            <legend className="sr-only">{t('availableDays')}</legend>
            <div className="flex gap-2 flex-wrap">
              {DAYS_CONFIG.map(day => {
                const on = !!form.availability?.[day.key]
                return (
                  <button key={day.key} type="button" aria-pressed={on}
                    onClick={() => setForm(f => ({...f, availability:{...f.availability,[day.key]:!on}}))}
                    className={`flex flex-col items-center gap-0.5 w-16 py-3 rounded-xl border cursor-pointer transition-all select-none ${on?'bg-indigo-600 border-indigo-600 text-white shadow-sm':'border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50'}`}>
                    <span className="text-xs font-bold" aria-hidden="true">{t(day.key).slice(0,1)}</span>
                    <span className="text-xs">{t(day.key)}</span>
                    {on && <Check size={10} aria-hidden="true"/>}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <p className="text-xs text-slate-500">
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
                <div key={s.id} className="flex items-center gap-2 flex-wrap px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
                  <Clock size={12} className="text-indigo-500 flex-shrink-0"/>
                  <span className="text-sm text-indigo-700 font-medium">{t(s.day)}</span>
                  <span className="text-sm text-indigo-500" dir="ltr">{s.from} – {s.to}</span>
                  {s.label && <span className="text-xs text-indigo-400 italic">{s.label}</span>}
                  <button type="button" onClick={() => setForm(f=>({...f,timeSlots:(f.timeSlots||[]).filter(ts=>ts.id!==s.id)}))}
                    aria-label={isAr ? `حذف الفترة ${t(s.day)} ${s.from} إلى ${s.to}` : `Remove ${t(s.day)} ${s.from} to ${s.to} time slot`}
                    className="ms-auto w-8 h-8 inline-flex items-center justify-center text-indigo-500 hover:text-red-600 cursor-pointer rounded-lg hover:bg-white"><X size={14} aria-hidden="true"/></button>
                </div>
              ))}
            </div>
            {addingSlot ? (
              <div className="border border-indigo-200 rounded-xl p-3 space-y-2 bg-indigo-50/40">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="slot-day" className="block text-xs text-slate-500 mb-1">{isAr?'اليوم':'Day'}</label>
                    <select id="slot-day" value={slotForm.day} onChange={e=>setSlotForm(f=>({...f,day:e.target.value}))}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {DAYS_CONFIG.map(d => <option key={d.key} value={d.key}>{t(d.key)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="slot-from" className="block text-xs text-slate-500 mb-1">{isAr?'من':'From'}</label>
                    <input id="slot-from" type="time" value={slotForm.from} onChange={e=>setSlotForm(f=>({...f,from:e.target.value}))}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                  </div>
                  <div>
                    <label htmlFor="slot-to" className="block text-xs text-slate-500 mb-1">{isAr?'إلى':'To'}</label>
                    <input id="slot-to" type="time" value={slotForm.to} onChange={e=>setSlotForm(f=>({...f,to:e.target.value}))}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                  </div>
                </div>
                <label htmlFor="slot-label" className="sr-only">{isAr ? 'وصف الفترة' : 'Time slot label'}</label>
                <input id="slot-label" value={slotForm.label} onChange={e=>setSlotForm(f=>({...f,label:e.target.value}))}
                  placeholder={isAr?'وصف (اختياري)':'Label (optional)'}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                {slotError && <p role="alert" className="text-xs text-red-600">{slotError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={addSlot} className="min-h-9 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg cursor-pointer hover:bg-indigo-700">{t('add')}</button>
                  <button type="button" onClick={() => { setAddingSlot(false); setSlotError('') }} className="min-h-9 px-3 py-1.5 text-slate-500 text-xs cursor-pointer hover:text-slate-700">{t('cancel')}</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingSlot(true)} className="min-h-10 flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium">
                <Plus size={14} aria-hidden="true"/> {t('addTimeSlot')}
              </button>
            )}
          </div>
          <Btn onClick={handleSaveAvail} disabled={saving} icon={availSaved ? <Check size={15}/> : <Save size={15}/>}>
            <span aria-live="polite">{saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : availSaved ? (isAr?'✓ تم الحفظ':'✓ Saved') : t('saveChanges')}</span>
          </Btn>
        </Card>
      )}

      {/* Security tab */}
      {tab==='security' && (
        <Card className="p-4 md:p-6 space-y-4">
          <h3 className="font-semibold text-slate-700">{t('changePassword')}</h3>
          {passError && <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">{passError}</div>}
          {passSaved && <div role="status" className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm text-emerald-700">{isAr ? 'تم تحديث كلمة المرور' : 'Password updated'}</div>}
          <div className="relative">
            <label htmlFor="profile-new-password" className="block text-sm font-medium text-slate-700 mb-1.5">{t('newPassword')}</label>
            <input id="profile-new-password" name="new-password" type={showPass?'text':'password'} value={passForm.newPass}
              onChange={e=>{ setPassForm(f=>({...f,newPass:e.target.value})); setPassError(''); setPassSaved(false) }}
              placeholder={isAr?'6 أحرف على الأقل':'At least 6 characters'} minLength={6} autoComplete="new-password" dir="ltr"
              className="w-full px-3.5 py-2.5 pe-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
            <button type="button" onClick={() => setShowPass(!showPass)} aria-pressed={showPass}
              aria-label={showPass ? (isAr ? 'إخفاء كلمة المرور' : 'Hide password') : (isAr ? 'إظهار كلمة المرور' : 'Show password')}
              className="absolute end-1 bottom-0.5 w-10 h-10 inline-flex items-center justify-center text-slate-500 hover:text-slate-700 cursor-pointer rounded-lg">
              {showPass ? <EyeOff size={16} aria-hidden="true"/> : <Eye size={16} aria-hidden="true"/>}
            </button>
          </div>
          <div>
            <label htmlFor="profile-confirm-password" className="block text-sm font-medium text-slate-700 mb-1.5">{t('confirmPassword')}</label>
            <input id="profile-confirm-password" name="confirm-password" type="password" value={passForm.confirm}
              onChange={e=>{ setPassForm(f=>({...f,confirm:e.target.value})); setPassError(''); setPassSaved(false) }}
              placeholder={isAr?'أعد كتابة كلمة المرور':'Re-enter password'} minLength={6} autoComplete="new-password" dir="ltr"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
          </div>
          <Btn onClick={handlePassword} disabled={savingPass || !passForm.newPass || !passForm.confirm} icon={<Lock size={14}/>}>
            {savingPass ? (isAr ? 'جارٍ التحديث...' : 'Updating...') : t('updatePassword')}
          </Btn>
          <div className="pt-4 border-t border-slate-100 space-y-2 text-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1"><span className="text-slate-500">{t('email')}</span><span className="text-slate-700 break-all" dir="ltr">{currentUser?.email}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">{isAr?'صلاحية النظام':'System access'}</span><Badge color={isAdmin?'indigo':'slate'} size="xs">{ACCESS_LEVEL_LABELS[currentUser?.accessLevel||'member']?.[isAr?'ar':'en']}</Badge></div>
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
