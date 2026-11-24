import { Bell, User, LogOut, UserPlus, Sun, Moon, Settings } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.jsx'
import { useLang } from '../../lib/i18n.jsx'
import { Avatar } from '../ui'
import BrandLogo from '../BrandLogo.jsx'
import { format } from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'
import { ACCESS_LEVEL_LABELS, hasPermission } from '../../lib/permissions.js'

function useDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    dark ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    localStorage.setItem('kdec_theme', dark ? 'dark' : 'light')
  }, [dark])
  return [dark, () => setDark(d => !d)]
}

function HeaderDate() {
  const { isAr } = useLang()
  const dateStr = isAr
    ? format(new Date(), 'EEEE، d MMMM', { locale: arLocale })
    : format(new Date(), 'EEE, MMM d')
  return <p className="dashboard-greeting-date">{dateStr}</p>
}

function HeaderControls({ dark, toggleDark }) {
  const { announcements, quarterly } = useStore()
  const { lang, setLang, t, isAr } = useLang()
  const navigate = useNavigate()
  const unreadSchedule = quarterly.inbox.filter(item => !item.readAt).length

  return <>
    {/* Language toggle */}
    <div className="header-language-switch flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
      <button
        onClick={() => setLang('ar')}
        aria-pressed={lang === 'ar'}
        aria-label="العربية"
        className={`px-2 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all select-none ${lang === 'ar' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
        AR
      </button>
      <button
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
        aria-label="English"
        className={`px-2 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all select-none ${lang === 'en' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
        EN
      </button>
    </div>

    <button
      onClick={toggleDark}
      aria-label={dark ? (isAr ? 'تفعيل الوضع النهاري' : 'Use light mode') : (isAr ? 'تفعيل الوضع الليلي' : 'Use dark mode')}
      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-all">
      {dark ? <Sun size={17}/> : <Moon size={17}/>}
    </button>

    {/* Bell — shows badge count */}
    <button
      onClick={() => navigate(unreadSchedule ? '/schedule' : '/announcements')}
      aria-label={unreadSchedule ? `${isAr?'إشعارات الجدول':'Schedule notifications'} (${unreadSchedule})` : t('announcements')}
      className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
      <Bell size={17}/>
      {(unreadSchedule || announcements.length) > 0 && (
        <span className="header-notification-badge absolute top-1 end-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold">
          {(unreadSchedule || announcements.length) > 9 ? '9+' : (unreadSchedule || announcements.length)}
        </span>
      )}
    </button>
  </>
}

function AccountMenu({ dark, toggleDark }) {
  const { currentUser, logout } = useStore()
  const { isAr, t } = useLang()
  const navigate     = useNavigate()
  const [open, setOpen]   = useState(false)
  const ref = useRef(null)
  const triggerRef = useRef(null)
  const canManageInvitations=hasPermission(currentUser,'invitations.manage')

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleLogout = async () => { setOpen(false); await logout(); navigate('/') }

  return (
    <div className="relative" ref={ref}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          setOpen(false)
          triggerRef.current?.focus()
        }
      }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        aria-label={isAr ? 'قائمة المستخدم' : 'User menu'}
        aria-expanded={open}
        className="dashboard-account-trigger">
        <span className="dashboard-avatar" aria-hidden="true">
          <Avatar name={currentUser?.name || currentUser?.email} size="lg"/>
          {currentUser?.avatar_url && <img key={currentUser.avatar_url} src={currentUser.avatar_url} alt=""
            onError={event => { event.currentTarget.hidden = true }}/>}
        </span>
      </button>

      {open && (
        <div className={`absolute end-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-1.5 z-50 animate-scale-in`}>
          {/* User info */}
          <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
            <div className="text-sm font-semibold text-slate-700" dir="auto">{currentUser?.name}</div>
            <div className="text-xs text-slate-500">{ACCESS_LEVEL_LABELS[currentUser?.accessLevel || 'member']?.[isAr ? 'ar' : 'en']}</div>
            <div className="text-xs text-slate-400 truncate">{currentUser?.email}</div>
          </div>

          {/* Dark mode toggle — visible in menu on all sizes */}
          <button
            onClick={() => { toggleDark(); setOpen(false); triggerRef.current?.focus() }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
            {dark ? <Sun size={15} className="text-amber-500"/> : <Moon size={15} className="text-slate-400"/>}
            {dark ? (isAr ? 'الوضع النهاري' : 'Light Mode') : (isAr ? 'الوضع الليلي' : 'Dark Mode')}
          </button>

          <button
            onClick={() => { navigate('/profile'); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
            <User size={15} className="text-slate-400"/>
            {t('profile')}
          </button>

          <button onClick={() => { navigate('/settings'); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Settings size={15} className="text-slate-400"/>{t('settings')}
          </button>

          {canManageInvitations && (
            <button
              onClick={() => { navigate('/invitations'); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
              <UserPlus size={15} className="text-slate-400"/>
              {t('invitations')}
            </button>
          )}

          <div className="border-t border-slate-100 mt-1 pt-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer">
              <LogOut size={15}/>
              {t('signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Header({ children }) {
  const [dark, toggleDark] = useDarkMode()
  const { isAr } = useLang()

  return (
    <header className="dashboard-greeting">
      <div className="worship-heading-identity">
        <BrandLogo compact className="worship-mobile-tower"/>
        <div>
          <HeaderDate/>
          {children}
        </div>
      </div>
      <div className="dashboard-utilities" role="group" aria-label={isAr ? 'أدوات التنقل' : 'Page utilities'}>
        <HeaderControls dark={dark} toggleDark={toggleDark}/>
        <AccountMenu dark={dark} toggleDark={toggleDark}/>
      </div>
    </header>
  )
}
