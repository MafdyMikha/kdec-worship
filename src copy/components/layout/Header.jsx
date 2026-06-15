import { Bell, User, ChevronDown, LogOut, UserPlus, Sun, Moon } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.jsx'
import { useLang } from '../../lib/i18n.jsx'
import { Avatar } from '../ui'
import { KDEC_LOGO } from '../../assets/kdecLogo.js'
import { format } from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'

// ── Tiny dark-mode hook ───────────────────────────────────
function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('kdec_theme')
    return saved ? saved === 'dark' : false
  })

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('kdec_theme', dark ? 'dark' : 'light')
  }, [dark])

  return [dark, () => setDark(d => !d)]
}

export default function Header({ title }) {
  const { currentUser, logout, announcements } = useStore()
  const { lang, setLang, t } = useLang()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [dark, toggleDark] = useDarkMode()
  const ref = useRef(null)
  const isAdmin = currentUser?.isAdmin || currentUser?.is_admin
  const isAr = lang === 'ar'

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleLogout = async () => { setOpen(false); await logout(); navigate('/') }

  const dateStr = isAr
    ? format(new Date(), 'EEEE، d MMMM yyyy', { locale: arLocale })
    : format(new Date(), 'EEE, MMM d, yyyy')

  return (
    <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-6 flex-shrink-0 gap-3">
      <h1 className="font-display font-semibold text-slate-800 text-lg truncate">{title}</h1>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-xs text-slate-400 hidden md:block mr-1">{dateStr}</span>

        {/* ── Language toggle ── */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setLang('ar')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all select-none ${lang === 'ar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            AR
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold cursor-pointer transition-all select-none ${lang === 'en' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            EN
          </button>
        </div>

        {/* ── Dark mode toggle ── */}
        <button
          onClick={toggleDark}
          title={dark ? (isAr ? 'الوضع النهاري' : 'Light Mode') : (isAr ? 'الوضع الليلي' : 'Dark Mode')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-all">
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Bell */}
        <button onClick={() => navigate('/announcements')}
          className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
          <Bell size={17}/>
          {announcements.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full"/>}
        </button>

        {/* Logo */}
        <div className="w-7 h-7 hidden sm:flex">
          <img src={KDEC_LOGO} alt="KDEC" className="w-full h-full object-contain"/>
        </div>

        {/* User menu */}
        <div className="relative" ref={ref}>
          <button onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded-xl cursor-pointer">
            <Avatar name={currentUser?.name || currentUser?.email} size="sm"/>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-slate-700 leading-tight">{currentUser?.name || (isAr ? 'مستخدم' : 'User')}</div>
              <div className="text-xs text-slate-400 leading-tight">
                {currentUser?.role || (isAdmin ? (isAr ? 'مسؤول' : 'Admin') : (isAr ? 'عضو' : 'Member'))}
              </div>
            </div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}/>
          </button>

          {open && (
            <div className={`absolute ${isAr ? 'left-0' : 'right-0'} top-full mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 animate-scale-in`}>
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <div className="text-xs font-semibold text-slate-700">{currentUser?.name}</div>
                <div className="text-xs text-slate-400 truncate">{currentUser?.email}</div>
              </div>
              <button onClick={() => { navigate('/profile'); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                <User size={15} className="text-slate-400"/>
                {t('profile')}
              </button>
              {isAdmin && (
                <button onClick={() => { navigate('/invitations'); setOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <UserPlus size={15} className="text-slate-400"/>
                  {t('invitations')}
                </button>
              )}
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button onClick={handleLogout}
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
