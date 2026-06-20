import { useState } from 'react'
import { Save, Download, Shield, Bell, Globe, Database, LogOut } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, Btn, Badge } from '../components/ui'
import { useNavigate } from 'react-router-dom'

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

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-50 last:border-0">
      <div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        {description && <div className="text-xs text-slate-400 mt-0.5">{description}</div>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${checked?'bg-indigo-600':'bg-slate-200'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked?'translate-x-6':'translate-x-1'}`}/>
      </button>
    </div>
  )
}

export default function Settings() {
  const { isAr, t, lang } = useLang()
  const { people, songs, services, announcements, toast, logout, currentUser } = useStore()
  const navigate = useNavigate()
  const [orgName,   setOrgName]   = useState('كنيسة قصر الدوبارة الإنجيلية')
  const [orgNameEn, setOrgNameEn] = useState('Kasr El Doubara Evangelical Church')
  const [notifs, setNotifs] = useState({ reminders:true, newSongs:true, teamChanges:false, events:true })
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    toast(isAr ? 'تم حفظ الإعدادات' : 'Settings saved')
    setTimeout(()=>setSaved(false), 2000)
  }

  const handleExport = () => {
    const data = { people, songs, services, announcements, exportedAt: new Date().toISOString(), version:'2.0' }
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `kdec-worship-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click(); URL.revokeObjectURL(url)
    toast(isAr ? 'تم تصدير النسخة الاحتياطية' : 'Backup exported successfully')
  }

  const handleSignOut = async () => { await logout(); navigate('/') }

  const STATS = isAr
    ? [['أعضاء',people.length],['ترانيم',songs.length],['خدمات',services.length],['إعلانات',announcements.length]]
    : [['Members',people.length],['Songs',songs.length],['Services',services.length],['Posts',announcements.length]]

  return (
    <div className="max-w-2xl space-y-5 animate-fade-in">

      {/* Organization */}
      <Section title={t('orgSettings')} icon={<Shield size={18}/>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {isAr ? 'اسم الكنيسة بالعربي' : 'Church Name (Arabic)'}
            </label>
            <input value={orgName} onChange={e=>setOrgName(e.target.value)} dir="rtl"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {isAr ? 'اسم الكنيسة بالإنجليزي' : 'Church Name (English)'}
            </label>
            <input value={orgNameEn} onChange={e=>setOrgNameEn(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('defaultService')}</label>
            <select className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {isAr
                ? <><option>خدمة أحد</option><option>ليلة صلاة</option><option>فعالية خاصة</option></>
                : <><option>Sunday Service</option><option>Prayer Night</option><option>Special Event</option></>}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('timezone')}</label>
            <select className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="Africa/Cairo">Africa/Cairo (GMT+2){isAr?' — القاهرة':' — Cairo'}</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
            </select>
          </div>
          <Btn onClick={handleSave} icon={<Save size={14}/>}>
            {saved ? (isAr?'✓ تم الحفظ':'✓ Saved') : t('saveChanges')}
          </Btn>
        </div>
      </Section>

      {/* Notifications */}
      <Section title={t('notifications')} icon={<Bell size={18}/>}>
        <div>
          <Toggle checked={notifs.reminders}   onChange={v=>setNotifs(n=>({...n,reminders:v}))}
            label={isAr?'تذكيرات واتساب للفريق':'WhatsApp reminders for team'}
            description={isAr?'إرسال تذكيرات للأعضاء قبل الخدمات':'Send reminders to members before services'}/>
          <Toggle checked={notifs.newSongs}    onChange={v=>setNotifs(n=>({...n,newSongs:v}))}
            label={isAr?'تنبيهات الترانيم الجديدة':'New song notifications'}
            description={isAr?'إشعار الفريق عند إضافة ترانيم لقائمة خدمة':'Notify team when songs are added to a setlist'}/>
          <Toggle checked={notifs.teamChanges} onChange={v=>setNotifs(n=>({...n,teamChanges:v}))}
            label={isAr?'تحديثات تأكيد الحضور':'Attendance confirmation updates'}
            description={isAr?'إشعار المسؤول عند تأكيد أو اعتذار عضو':'Notify admin when a member confirms or declines'}/>
          <Toggle checked={notifs.events}      onChange={v=>setNotifs(n=>({...n,events:v}))}
            label={isAr?'تذكيرات الفعاليات':'Event reminders'}
            description={isAr?'تذكير الأعضاء للرد على دعوات الفعاليات':'Remind members to RSVP to events'}/>
        </div>
      </Section>

      {/* Language info */}
      <Section title={t('language')} icon={<Globe size={18}/>}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {isAr
              ? 'المنصة تدعم العربية والإنجليزية. استخدم زر AR/EN في الأعلى للتبديل.'
              : 'The platform supports both Arabic and English. Use the AR/EN toggle in the header to switch.'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl border ${lang==='ar'?'bg-indigo-50 border-indigo-200':'bg-slate-50 border-slate-100'}`} dir="rtl">
              <div className={`font-semibold mb-1 ${lang==='ar'?'text-indigo-700':'text-slate-600'}`}>عربي {lang==='ar'&&'✓'}</div>
              <div className={`text-xs ${lang==='ar'?'text-indigo-600':'text-slate-500'}`}>اللغة الأساسية</div>
            </div>
            <div className={`p-3 rounded-xl border ${lang==='en'?'bg-indigo-50 border-indigo-200':'bg-slate-50 border-slate-100'}`}>
              <div className={`font-semibold mb-1 ${lang==='en'?'text-indigo-700':'text-slate-600'}`}>English {lang==='en'&&'✓'}</div>
              <div className={`text-xs ${lang==='en'?'text-indigo-600':'text-slate-500'}`}>Secondary language</div>
            </div>
          </div>
        </div>
      </Section>

      {/* Data */}
      <Section title={t('dataBackup')} icon={<Database size={18}/>}>
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            {STATS.map(([l,v])=>(
              <div key={l} className="bg-slate-50 rounded-xl p-3">
                <div className="text-xl font-display font-bold text-indigo-600">{v}</div>
                <div className="text-xs text-slate-500">{l}</div>
              </div>
            ))}
          </div>
          <Btn variant="secondary" onClick={handleExport} icon={<Download size={14}/>}>{t('exportBackup')}</Btn>
          <p className="text-xs text-slate-500">
            {isAr
              ? 'البيانات محفوظة في Supabase PostgreSQL. النسخ اليومية متاحة في الخطة المدفوعة.'
              : 'Data stored in Supabase PostgreSQL. Daily backups available on the paid plan.'}
          </p>
        </div>
      </Section>

      {/* About */}
      <Section title={t('aboutPlatform')} icon={<Globe size={18}/>}>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex justify-between"><span className="text-slate-400">{isAr?'المنصة':'Platform'}</span><span>KDEC Worship</span></div>
          <div className="flex justify-between"><span className="text-slate-400">{t('version')}</span><Badge color="indigo" size="xs">2.0.0</Badge></div>
          <div className="flex justify-between"><span className="text-slate-400">{t('database')}</span><span>Supabase PostgreSQL</span></div>
          <div className="flex justify-between"><span className="text-slate-400">{t('currentUser')}</span><span className="text-indigo-600">{currentUser?.email}</span></div>
        </div>
      </Section>

      {/* Sign out */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-slate-700">{t('signOut')}</div>
            <div className="text-sm text-slate-400">{currentUser?.name}</div>
          </div>
          <Btn variant="secondary" onClick={handleSignOut} icon={<LogOut size={14}/>}>{t('signOut')}</Btn>
        </div>
      </Card>
    </div>
  )
}
