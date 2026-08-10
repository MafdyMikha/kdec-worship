import { Bell, User, ChevronDown, LogOut, UserPlus, Sun, Moon } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.jsx'
import { useLang } from '../../lib/i18n.jsx'
import { Avatar } from '../ui'
import { KDEC_LOGO } from '../../assets/kdecLogo.js'
import { format } from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('kdec_theme')
    return saved ? saved === 'dark' : false
  })
  useEffect(() => {
    dark ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark')
    localStorage.setItem('kdec_theme', dark ? 'dark' : 'light')
  }, [dark])
  return [dark, () => setDark(d => !d)]
}

export default function Header({ title }) {
  const { currentUser, logout, announcements } = useStore()
  const { lang, setLang, t } = useLang()
  const navigate     = useNavigate()
  const [open, setOpen]   = useState(false)
  const [dark, toggleDark] = useDarkMode()
  const ref  = useRef(null)
  const isAdmin = currentUser?.isAdmin || currentUser?.is_admin
  const isAr    = lang === 'ar'

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleLogout = async () => { setOpen(false); await logout(); navigate('/') }

  const dateStr = isAr
    ? format(new Date(), 'EEEE، d MMMM', { locale: arLocale })
    : format(new Date(), 'EEE, MMM d')

  return (
    <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-3 md:px-6 flex-shrink-0 gap-2 z-20">
      {/* Page title */}
      <h1 className="font-display font-semibold text-slate-800 text-base md:text-lg truncate flex-1">
        {title}
      </h1>

      <div className="flex items-center gap-1 flex-shrink-0">

        {/* Date — desktop only */}
        <span className="text-xs text-slate-400 hidden lg:block mr-1">{dateStr}</span>

        {/* Language toggle */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setLang('ar')}
            aria-pressed={lang === 'ar'}
            aria-label="العربية"
            className={`px-2 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all select-none ${lang === 'ar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            AR
          </button>
          <button
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
            aria-label="English"
            className={`px-2 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all select-none ${lang === 'en' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            EN
          </button>
        </div>

        {/* Dark mode — hidden on smallest screens */}
        <button
          onClick={toggleDark}
          aria-label={dark ? (isAr ? 'تفعيل الوضع النهاري' : 'Use light mode') : (isAr ? 'تفعيل الوضع الليلي' : 'Use dark mode')}
          className="hidden sm:flex p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-all">
          {dark ? <Sun size={17}/> : <Moon size={17}/>}
        </button>

        {/* Bell — shows badge count */}
        <button
          onClick={() => navigate('/announcements')}
          aria-label={`${t('announcements')}${announcements.length > 0 ? ` (${announcements.length})` : ''}`}
          className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
          <Bell size={17}/>
          {announcements.length > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold">
              {announcements.length > 9 ? '9+' : announcements.length}
            </span>
          )}
        </button>

        {/* User menu */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            aria-label={isAr ? 'قائمة المستخدم' : 'User menu'}
            aria-expanded={open}
            className="flex items-center gap-1.5 px-1.5 py-1.5 hover:bg-slate-100 rounded-xl cursor-pointer">
            <Avatar name={currentUser?.name || currentUser?.email} size="sm"/>
            {/* Name — hidden on small screens */}
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-slate-700 leading-tight max-w-[90px] truncate">
                {currentUser?.name || (isAr ? 'مستخدم' : 'User')}
              </div>
              <div className="text-[10px] text-slate-400 leading-tight">
                {isAdmin ? (isAr ? 'مسؤول' : 'Admin') : (isAr ? 'عضو' : 'Member')}
              </div>
            </div>
            <ChevronDown size={13} className={`text-slate-400 transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`}/>
          </button>

          {open && (
            <div role="menu" className={`absolute ${isAr ? 'left-0' : 'right-0'} top-full mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 animate-scale-in`}>
              {/* User info */}
              <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                <div className="text-sm font-semibold text-slate-700" dir="auto">{currentUser?.name}</div>
                <div className="text-xs text-slate-400 truncate">{currentUser?.email}</div>
              </div>

              {/* Dark mode toggle — visible in menu on all sizes */}
              <button
                onClick={() => { toggleDark(); setOpen(false) }}
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

              {isAdmin && (
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
      </div>
    </header>
  )
}
