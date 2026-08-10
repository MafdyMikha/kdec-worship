import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Music2, Users, QrCode,
  MessageSquare, Home, BarChart3, Megaphone, Settings, User,
  ChevronUp, X, ClipboardList
} from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../../store/useStore.jsx'
import { useLang } from '../../lib/i18n.jsx'
import { Badge } from '../ui'
import { canManageWorship, isAdminUser } from '../../lib/permissions.js'

const WaIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

export default function MobileNav() {
  const { currentUser, announcements } = useStore()
  const { t, isAr } = useLang()
  const isAdmin = isAdminUser(currentUser)
  const isManager = canManageWorship(currentUser)
  const [moreOpen, setMoreOpen] = useState(false)

  // 4 primary tabs always visible + "More" button
  const adminPrimary = [
    { to: '/',           icon: <LayoutDashboard size={22}/>, label: t('dashboard')    },
    { to: '/services',   icon: <Calendar size={22}/>,        label: t('services')     },
    { to: '/songs',      icon: <Music2 size={22}/>,          label: t('songs')        },
    { to: '/people',     icon: <Users size={22}/>,           label: t('people')       },
  ]

  const memberPrimary = [
    { to: '/',           icon: <Home size={22}/>,            label: t('home')         },
    { to: '/schedule',   icon: <Calendar size={22}/>,        label: t('schedule')     },
    { to: '/songs',      icon: <Music2 size={22}/>,          label: t('songs')        },
    { to: '/attendance', icon: <QrCode size={22}/>,          label: t('checkIn')      },
  ]

  const managerPrimary = [
    { to: '/',           icon: <Home size={22}/>,     label: t('home')     },
    { to: '/services',   icon: <Calendar size={22}/>, label: t('services') },
    { to: '/songs',      icon: <Music2 size={22}/>,   label: t('songs')    },
    { to: '/schedule',   icon: <Calendar size={22}/>, label: t('schedule') },
  ]

  const adminMore = [
    { to: '/schedule',      icon: <Calendar size={20}/>,     label: t('schedule')      },
    { to: '/attendance',    icon: <QrCode size={20}/>,       label: t('attendance')    },
    { to: '/events',        icon: <Megaphone size={20}/>,    label: t('events')        },
    { to: '/requests',      icon: <ClipboardList size={20}/>,label: t('requests')      },
    { to: '/whatsapp',      icon: <WaIcon/>,                 label: t('whatsappBulk') },
    { to: '/reports',       icon: <BarChart3 size={20}/>,    label: t('reports')       },
    { to: '/announcements', icon: <MessageSquare size={20}/>,label: t('announcements'), badge: announcements.length },
    { to: '/invitations',   icon: <Users size={20}/>,        label: t('invitations')   },
    { to: '/profile',       icon: <User size={20}/>,         label: t('profile')       },
    { to: '/settings',      icon: <Settings size={20}/>,     label: t('settings')      },
  ]

  const memberMore = [
    { to: '/events',        icon: <Megaphone size={20}/>,    label: t('events')        },
    { to: '/requests',      icon: <ClipboardList size={20}/>,label: t('requests')      },
    { to: '/announcements', icon: <MessageSquare size={20}/>,label: t('announcements'), badge: announcements.length },
    { to: '/profile',       icon: <User size={20}/>,         label: t('profile')       },
    { to: '/settings',      icon: <Settings size={20}/>,     label: t('settings')      },
  ]

  const managerMore = [
    { to: '/attendance', icon: <QrCode size={20}/>, label: t('checkIn') },
    ...memberMore,
  ]

  const primary = isAdmin ? adminPrimary : isManager ? managerPrimary : memberPrimary
  const more    = isAdmin ? adminMore    : isManager ? managerMore : memberMore

  return (
    <>
      {/* More drawer overlay */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
          <div
            className={`absolute bottom-16 ${isAr ? 'left-2 right-2' : 'left-2 right-2'} bg-white rounded-2xl shadow-2xl p-4 z-50`}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-700">
                {isAr ? 'المزيد' : 'More'}
              </span>
              <button onClick={() => setMoreOpen(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer">
                <span className="sr-only">{isAr ? 'إغلاق' : 'Close'}</span>
                <X size={16}/>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {more.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'
                    }`}>
                  <div className="relative">
                    {item.icon}
                    {item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar — mobile only */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 safe-bottom">
        <div className="flex items-center">
          {primary.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-2.5 cursor-pointer transition-all ${
                  isActive ? 'text-indigo-600' : 'text-slate-400'
                }`}>
              {item.icon}
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            aria-expanded={moreOpen}
            aria-label={isAr ? 'المزيد' : 'More'}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 cursor-pointer transition-all ${moreOpen ? 'text-indigo-600' : 'text-slate-400'}`}>
            <ChevronUp size={22} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`}/>
            <span className="text-[10px] font-medium leading-none">
              {isAr ? 'المزيد' : 'More'}
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
