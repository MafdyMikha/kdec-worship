import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'
import { useStore } from '../../store/useStore.jsx'
import { useLang } from '../../lib/i18n.jsx'
import { useLocation } from 'react-router-dom'

export default function Layout({ children }) {
  const { currentUser } = useStore()
  const { t, isAr } = useLang()
  const { pathname } = useLocation()
  const isAdmin = currentUser?.isAdmin || currentUser?.is_admin

  const PAGE_KEYS = {
    '/':             isAdmin ? 'dashboard' : 'home',
    '/dashboard':    'dashboard',
    '/home':         'home',
    '/services':     'services',
    '/songs':        'songs',
    '/people':       'people',
    '/schedule':     'schedule',
    '/reports':      'reports',
    '/announcements':'announcements',
    '/settings':     'settings',
    '/profile':      'profile',
    '/invitations':  'invitations',
    '/attendance':   'attendance',
    '/checkin':      'attendance',
    '/events':       'events',
    '/requests':     'requests',
    '/whatsapp':     'whatsappBulk',
  }

  const base  = Object.keys(PAGE_KEYS).find(k => pathname === k || (k !== '/' && k !== '/home' && pathname.startsWith(k)))
  const key   = PAGE_KEYS[base] || 'dashboard'
  const title = t(key)

  return (
    <div className="flex h-screen h-dvh overflow-hidden bg-slate-50" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Sidebar — desktop only */}
      <Sidebar/>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header title={title}/>

        {/* Page content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-3 md:p-6 pb-24 md:pb-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav/>

    </div>
  )
}
