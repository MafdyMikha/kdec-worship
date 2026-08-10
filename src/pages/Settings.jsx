import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, Download, Shield, Globe, Database, LogOut } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { isAdminUser } from '../lib/permissions.js'
import { Card, Btn, Badge, Input, Select } from '../components/ui'

function Section({ title, icon, children }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">{icon}</div>
        <h2 className="font-display font-semibold text-slate-800">{title}</h2>
      </div>
      {children}
    </Card>
  )
}

function OrganizationForm({ settings, onSave, isAr, t }) {
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }
  return (
    <div className="space-y-4">
      <Input label={isAr?'اسم الكنيسة بالعربي':'Church Name (Arabic)'} value={form.orgNameAr||''} dir="rtl"
        onChange={event=>setForm(current=>({...current,orgNameAr:event.target.value}))}/>
      <Input label={isAr?'اسم الكنيسة بالإنجليزي':'Church Name (English)'} value={form.orgNameEn||''}
        onChange={event=>setForm(current=>({...current,orgNameEn:event.target.value}))}/>
      <Select label={t('defaultService')} value={form.defaultService||'Sunday Service'}
        onChange={event=>setForm(current=>({...current,defaultService:event.target.value}))}>
        <option value="Sunday Service">{isAr?'خدمة أحد':'Sunday Service'}</option>
        <option value="Prayer Night">{isAr?'ليلة صلاة':'Prayer Night'}</option>
        <option value="Special Event">{isAr?'فعالية خاصة':'Special Event'}</option>
      </Select>
      <Select label={t('timezone')} value={form.timezone||'Africa/Cairo'}
        onChange={event=>setForm(current=>({...current,timezone:event.target.value}))}>
        <option value="Africa/Cairo">Africa/Cairo {isAr?'— القاهرة':'— Cairo'}</option>
        <option value="UTC">UTC</option>
        <option value="America/New_York">America/New_York</option>
      </Select>
      <Btn onClick={save} disabled={saving||!form.orgNameAr?.trim()||!form.orgNameEn?.trim()} icon={<Save size={14}/>}>
        {saving?(isAr?'جاري الحفظ...':'Saving...'):t('saveChanges')}
      </Btn>
    </div>
  )
}

export default function Settings() {
  const { isAr, t, lang } = useLang()
  const {
    people, songs, services, announcements, events, eventResponses, attendanceSessions, attendanceRecords,
    invitations, excuseRequests, substituteRequests,
    organizationSettings, updateOrganizationSettings, toast, logout, currentUser, isDemoMode,
  } = useStore()
  const navigate = useNavigate()
  const isAdmin = isAdminUser(currentUser)
  const handleExport = () => {
    if (!isAdmin) return
    const data = {
      people, songs, services, announcements, events, eventResponses,
      attendanceSessions, attendanceRecords, invitations, excuseRequests, substituteRequests,
      organizationSettings, exportedAt:new Date().toISOString(), version:'2.0',
    }
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href=url; anchor.download=`kdec-worship-backup-${new Date().toISOString().split('T')[0]}.json`; anchor.click()
    URL.revokeObjectURL(url)
    toast(isAr?'تم تصدير النسخة الاحتياطية':'Backup exported successfully')
  }

  const handleSignOut = async () => { await logout(); navigate('/') }
  const stats = isAr
    ? [['أعضاء',people.length],['ترانيم',songs.length],['خدمات',services.length],['فعاليات',events.length]]
    : [['Members',people.length],['Songs',songs.length],['Services',services.length],['Events',events.length]]

  return (
    <div className="max-w-2xl space-y-5 animate-fade-in">
      {isAdmin&&(
        <Section title={t('orgSettings')} icon={<Shield size={18}/>}>
          <OrganizationForm key={`${organizationSettings.orgNameAr}-${organizationSettings.timezone}`} settings={organizationSettings}
            onSave={updateOrganizationSettings} isAr={isAr} t={t}/>
        </Section>
      )}

      <Section title={t('language')} icon={<Globe size={18}/>}>
        <p className="text-sm text-slate-600 mb-3">
          {isAr?'استخدم زر AR/EN في الأعلى للتبديل بين العربية والإنجليزية.':'Use the AR/EN control in the header to switch between Arabic and English.'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-xl border ${lang==='ar'?'bg-indigo-50 border-indigo-200':'bg-slate-50 border-slate-100'}`} dir="rtl">
            <div className="font-semibold text-slate-700">عربي {lang==='ar'&&'✓'}</div>
          </div>
          <div className={`p-3 rounded-xl border ${lang==='en'?'bg-indigo-50 border-indigo-200':'bg-slate-50 border-slate-100'}`}>
            <div className="font-semibold text-slate-700">English {lang==='en'&&'✓'}</div>
          </div>
        </div>
      </Section>

      {isAdmin&&(
        <Section title={t('dataBackup')} icon={<Database size={18}/>}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center mb-4">
            {stats.map(([label,value])=><div key={label} className="bg-slate-50 rounded-xl p-3"><div className="text-xl font-display font-bold text-indigo-600">{value}</div><div className="text-xs text-slate-500">{label}</div></div>)}
          </div>
          <Btn variant="secondary" onClick={handleExport} icon={<Download size={14}/>}>{t('exportBackup')}</Btn>
          <p className="mt-3 text-xs text-slate-500">
            {isDemoMode?(isAr?'هذه نسخة من بيانات العرض المخزنة في هذا المتصفح.':'This exports demo data stored in this browser.'):(isAr?'هذا تصدير يدوي للبيانات التي يمكن لحسابك الإداري قراءتها.':'This is a manual export of data available to your administrator account.')}
          </p>
        </Section>
      )}

      <Section title={t('aboutPlatform')} icon={<Globe size={18}/>}>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex justify-between gap-4"><span className="text-slate-500">{isAr?'المنصة':'Platform'}</span><span>KDEC Worship</span></div>
          <div className="flex justify-between gap-4"><span className="text-slate-500">{t('version')}</span><Badge color="indigo" size="xs">2.0.0</Badge></div>
          <div className="flex justify-between gap-4"><span className="text-slate-500">{t('database')}</span><span>{isDemoMode?'Browser demo data':'Supabase PostgreSQL'}</span></div>
          <div className="flex justify-between gap-4"><span className="text-slate-500">{t('currentUser')}</span><span className="text-indigo-600 break-all text-end">{currentUser?.email}</span></div>
        </div>
      </Section>

      <Card className="p-5 flex items-center justify-between gap-4">
        <div><div className="font-medium text-slate-700">{t('signOut')}</div><div className="text-sm text-slate-500">{currentUser?.name}</div></div>
        <Btn variant="secondary" onClick={handleSignOut} icon={<LogOut size={14}/>}>{t('signOut')}</Btn>
      </Card>
    </div>
  )
}
