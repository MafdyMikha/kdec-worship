import Sidebar from './Sidebar'
import Header from './Header'
import { useStore } from '../../store/useStore.jsx'
import { useLang } from '../../lib/i18n.jsx'
import { Notifications } from '../ui'
import { useLocation } from 'react-router-dom'

export default function Layout({ children }) {
  const { notifications, currentUser } = useStore()
  const { t, isAr } = useLang()
  const { pathname } = useLocation()
  const isAdmin = currentUser?.isAdmin || currentUser?.is_admin

  const PAGE_KEYS = {
    '/':            isAdmin ? 'dashboard' : 'home',
    '/dashboard':   'dashboard',
    '/home':        'home',
    '/services':    'services',
    '/songs':       'songs',
    '/people':      'people',
    '/schedule':    'schedule',
    '/reports':     'reports',
    '/announcements':'announcements',
    '/settings':    'settings',
    '/profile':     'profile',
    '/invitations': 'invitations',
    '/attendance':  'attendance',
    '/events':      'events',
  }

  const base  = Object.keys(PAGE_KEYS).find(k => pathname === k || (k !== '/' && k !== '/home' && pathname.startsWith(k)))
  const key   = PAGE_KEYS[base] || 'dashboard'
  const title = t(key)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50" dir={isAr ? 'rtl' : 'ltr'}>
      <Sidebar/>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title}/>
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 animate-fade-in">{children}</div>
        </main>
      </div>
      <Notifications items={notifications}/>
    </div>
  )
}
