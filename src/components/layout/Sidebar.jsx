import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Calendar, Music2, Users, MessageSquare, BarChart3, BookOpen, ChevronLeft, ChevronRight, Settings, UserPlus, QrCode, Megaphone, Home, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../../store/useStore.jsx'
import { useLang } from '../../lib/i18n.jsx'
import { KDEC_LOGO } from '../../assets/kdecLogo.js'
import { Badge } from '../ui'

const WaIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { currentUser, announcements } = useStore()
  const { t, isAr } = useLang()
  const isAdmin = currentUser?.isAdmin || currentUser?.is_admin

  const adminNav = [
    { to:'/',              icon:<LayoutDashboard size={20}/>, key:'dashboard'    },
    { to:'/services',      icon:<Calendar size={20}/>,        key:'services'     },
    { to:'/songs',         icon:<Music2 size={20}/>,          key:'songs'        },
    { to:'/people',        icon:<Users size={20}/>,           key:'people'       },
    { to:'/schedule',      icon:<BookOpen size={20}/>,        key:'schedule'     },
    { to:'/attendance',    icon:<QrCode size={20}/>,          key:'attendance'   },
    { to:'/events',        icon:<Megaphone size={20}/>,       key:'events'       },
    { to:'/whatsapp',      icon:<WaIcon/>,                    key:'whatsappBulk' },
    { to:'/reports',       icon:<BarChart3 size={20}/>,       key:'reports'      },
    { to:'/announcements', icon:<MessageSquare size={20}/>,   key:'announcements', badge: announcements.length },
  ]

  const memberNav = [
    { to:'/',              icon:<Home size={20}/>,            key:'home'         },
    { to:'/dashboard',     icon:<LayoutDashboard size={20}/>, key:'dashboard'    },
    { to:'/schedule',      icon:<Calendar size={20}/>,        key:'schedule'     },
    { to:'/songs',         icon:<Music2 size={20}/>,          key:'songs'        },
    { to:'/attendance',    icon:<QrCode size={20}/>,          key:'checkIn'      },
    { to:'/events',        icon:<Megaphone size={20}/>,       key:'events'       },
    { to:'/announcements', icon:<MessageSquare size={20}/>,   key:'announcements', badge: announcements.length },
  ]

  const nav = isAdmin ? adminNav : memberNav

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-60'} flex-shrink-0 bg-slate-900 flex-col transition-all duration-300 relative hidden md:flex`}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-slate-800 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center flex-shrink-0 p-1 shadow-lg">
          <img src={KDEC_LOGO} alt="KDEC" className="w-full h-full object-contain"/>
        </div>
        {!collapsed && (
          <div>
            <div className="text-white font-display font-bold text-sm leading-tight">KDEC Worship</div>
            <div className="text-slate-400 text-xs">
              {isAdmin ? t('adminPlatform') : t('teamPlatform')}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto" style={{ scrollbarWidth:'none' }}>
        {nav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/' || item.to === '/dashboard'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}>
            <span className="flex-shrink-0">{item.icon}</span>
            {!collapsed && <span className="flex-1">{t(item.key)}</span>}
            {!collapsed && item.badge > 0 && <Badge color="indigo" size="xs">{item.badge}</Badge>}
          </NavLink>
        ))}

        {/* Invitations — admin only */}
        {isAdmin && (
          <NavLink to="/invitations"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}>
            <UserPlus size={20}/>
            {!collapsed && <span>{t('invitations')}</span>}
          </NavLink>
        )}
      </nav>

      {/* Settings */}
      <div className="px-2 py-3 border-t border-slate-800">
        <NavLink to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}>
          <Settings size={20}/>
          {!collapsed && <span>{t('settings')}</span>}
        </NavLink>
      </div>

      {/* Collapse toggle */}
      <button onClick={() => setCollapsed(!collapsed)}
        className={`absolute top-20 w-6 h-6 bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-slate-300 hover:bg-slate-600 cursor-pointer shadow-lg z-10 transition-all ${isAr ? '-left-3' : '-right-3'}`}>
        {(collapsed ? isAr : !collapsed) ? <ChevronLeft size={12}/> : <ChevronRight size={12}/>}
      </button>
    </aside>
  )
}
