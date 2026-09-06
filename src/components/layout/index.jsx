import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'
import { useStore } from '../../store/useStore.jsx'
import { useLang } from '../../lib/i18n.jsx'
import { useLocation } from 'react-router-dom'
import { isAdminUser } from '../../lib/permissions.js'

export default function Layout({ children }) {
  const { currentUser } = useStore()
  const { t, isAr } = useLang()
  const { pathname } = useLocation()
  const isAdmin=isAdminUser(currentUser)

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
    '/admin/settings':'adminControl',
  }

  const base  = Object.keys(PAGE_KEYS).find(k => pathname === k || (k !== '/' && k !== '/home' && pathname.startsWith(k)))
  const key   = PAGE_KEYS[base] || 'dashboard'
  const title = t(key)
  const introductions = {
    '/services': isAr ? 'مساحة للاستعداد والتخطيط والخدمة معًا.' : 'A space to prepare, plan, and serve together.',
    '/songs': isAr ? 'ترانيم نحملها معنا في العبادة.' : 'The songs we carry into worship.',
    '/people': isAr ? 'مواهب متعددة. فريق واحد.' : 'Many gifts. One team.',
    '/schedule': isAr ? 'خطط الفريق القادمة، في مكان واحد.' : 'Your team’s plans, together in one place.',
    '/profile': isAr ? 'نبذة عنك وعن خدمتك.' : 'A little about you, and how you serve.',
  }

  return (
    <div className="worship-app flex h-screen h-dvh overflow-hidden bg-slate-50" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Sidebar — desktop only */}
      <Sidebar/>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header title={title}/>

        {/* Page content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto">
          <div className="worship-content p-4 md:p-8 pb-24 md:pb-8 animate-fade-in">
            {introductions[pathname] && <div className="worship-page-heading"><div><h1>{title}</h1><p>{introductions[pathname]}</p></div></div>}
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav/>

    </div>
  )
}
