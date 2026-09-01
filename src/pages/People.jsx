import { useState, useMemo } from 'react'
import { Edit2, Trash2, Mail, Phone, Users, UserPlus, Grid3X3, List, Printer, Check, History, Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, Btn, Badge, Avatar, SearchInput, Modal, Input, Select, Textarea, Tabs, EmptyState, ConfirmDialog, StatusDot } from '../components/ui'
import { buildAttendanceReport, downloadAttendanceReport, formatAttendanceTimestamp } from '../lib/attendanceReport.js'
import { getAccessLevelLabel, hasPermission } from '../lib/permissions.js'

const ROLE_COLOR = {
  'Worship Leader':'indigo','Music Director':'purple','Pianist/Keys':'blue',
  'Acoustic Guitar':'green','Electric Guitar':'green','Bass Guitar':'teal',
  'Drummer':'orange','Vocalist':'pink','Sound Engineer':'slate',
  'Projection':'slate','AUX Instrument':'amber','Camera':'red',
}

const DAYS_CONFIG = [
  { key:'sun' }, { key:'mon' }, { key:'tue' },
  { key:'wed' }, { key:'thu' }, { key:'fri' }, { key:'sat' },
]

// A person may have `roles` (array, new) or just `role` (string, legacy) — always normalize to an array
const getRoles = (person) =>
  (Array.isArray(person?.roles) && person.roles.length > 0)
    ? person.roles
    : (person?.role ? [person.role] : [])

// ── Person Card ─────────────────────────────────────────────
function PersonCard({ person, isAdmin, currentUserId, onEdit, onDelete, onAttendance, t, isAr }) {
  const phone     = person.whatsapp || person.phone
  const availDays = DAYS_CONFIG.filter(d => person.availability?.[d.key])
  const roles     = getRoles(person)
  const accessLabel = getAccessLevelLabel(person, isAr ? 'ar' : 'en')

  return (
    <Card className="p-4 group hover:shadow-md transition-all">
      <div className="flex items-start gap-3 mb-3">
        <Avatar name={person.name} size="md"/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 truncate" dir="auto">{person.name}</span>
            <span aria-hidden="true"><StatusDot status={person.status}/></span>
            <span className="sr-only">{person.status === 'active' ? t('active') : person.status === 'inactive' ? t('inactive') : t('onLeave')}</span>
          </div>
          <div className="text-xs font-medium text-slate-500">{accessLabel}</div>
        </div>
        {isAdmin && (
          <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
            <button type="button" onClick={() => onEdit(person)} aria-label={`${t('edit')} ${person.name}`}
              className="w-9 h-9 inline-flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"><Edit2 size={14} aria-hidden="true"/></button>
            {person.id!==currentUserId && <button type="button" onClick={() => onDelete(person.id)} aria-label={`${t('delete')} ${person.name}`}
              className="w-9 h-9 inline-flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"><Trash2 size={14} aria-hidden="true"/></button>}
          </div>
        )}
      </div>

      {/* Multiple role badges */}
      <div className="flex flex-wrap gap-1">
        {roles.length > 0
          ? roles.map(r => <Badge key={r} color={ROLE_COLOR[r] || 'slate'} size="sm">{r}</Badge>)
          : <Badge color="slate" size="sm">—</Badge>}
      </div>

      <div className="mt-3 space-y-1">
        {person.email && <div className="flex items-center gap-2 text-xs text-slate-500"><Mail size={11}/><span className="truncate">{person.email}</span></div>}
        {phone && <div className="flex items-center gap-2 text-xs text-slate-500" dir="ltr"><Phone size={11}/>{phone}</div>}
      </div>
      {availDays.length > 0 && (
        <div className="flex gap-1 mt-3 pt-3 border-t border-slate-100 flex-wrap">
          {availDays.map(d => (
            <span key={d.key} className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700">{t(d.key)}</span>
          ))}
        </div>
      )}
      {isAdmin && (
        <button type="button" onClick={() => onAttendance(person)} aria-label={`${isAr?'سجل حضور':'Attendance history'} ${person.name}`}
          className="mt-3 w-full min-h-9 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-50 text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer transition-colors">
          <History size={14} aria-hidden="true"/>{isAr?'سجل الحضور':'Attendance history'}
        </button>
      )}
    </Card>
  )
}

// ── Role Group View — a person appears under EVERY role they hold ──
function ByRoleView({ people, isAdmin, currentUserId, onEdit, onDelete, onAttendance, t, isAr, ROLES }) {
  const grouped = useMemo(() => {
    const map = {}
    ROLES.forEach(r => { map[r] = people.filter(p => getRoles(p).includes(r)) })
    return map
  }, [people, ROLES])

  return (
    <div className="space-y-6">
      {ROLES.map(role => {
        const members = grouped[role] || []
        if (members.length === 0) return null
        return (
          <div key={role}>
            <div className="flex items-center gap-3 mb-3">
              <Badge color={ROLE_COLOR[role] || 'slate'}>{role}</Badge>
              <span className="text-sm text-slate-400">{members.length} {t('membersLabel')}</span>
              <div className="flex-1 h-px bg-slate-100"/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {members.map(p => (
                <PersonCard key={p.id} person={p} isAdmin={isAdmin} currentUserId={currentUserId} onEdit={onEdit} onDelete={onDelete} onAttendance={onAttendance} t={t} isAr={isAr}/>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Roster (Printable Table) ────────────────────────────────
function RosterView({ people, t, isAr }) {
  const STATUS_LABEL = {
    active:    isAr ? 'نشط' : 'Active',
    inactive:  isAr ? 'غير نشط' : 'Inactive',
    'on-leave':isAr ? 'إجازة' : 'On Leave',
  }
  return (
    <div>
      <div className="flex justify-end mb-4">
        <Btn variant="secondary" size="sm" onClick={() => window.print()} icon={<Printer size={14}/>}>{t('print')}</Btn>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <caption className="sr-only">{isAr ? 'قائمة أعضاء فريق التسبيح' : 'Worship team member roster'}</caption>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('name')}</th>
                <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('role')}</th>
                <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wider">{isAr ? 'صلاحية النظام' : 'System access'}</th>
                <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('phone')}</th>
                <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('email')}</th>
                <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('active')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {people.map((p, i) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={p.name} size="xs"/>
                      <span className="font-medium text-slate-800" dir="auto">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {getRoles(p).map(r => <Badge key={r} color={ROLE_COLOR[r] || 'slate'} size="xs">{r}</Badge>)}
                      {getRoles(p).length === 0 && '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{getAccessLevelLabel(p, isAr ? 'ar' : 'en')}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs" dir="ltr">{p.whatsapp || p.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-[150px]">{p.email || '—'}</td>
                  <td className="px-4 py-3"><StatusDot status={p.status}/> <span className="text-xs text-slate-500">{STATUS_LABEL[p.status] || p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
          {people.length} {t('membersLabel')} · KDEC Worship Platform
        </div>
      </Card>
    </div>
  )
}

// ── Availability Grid View ──────────────────────────────────
function AvailabilityView({ people, t }) {
  const DAYS = DAYS_CONFIG.map(d => ({ ...d, label: t(d.key) }))
  const active = people.filter(p => p.status === 'active')

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <caption className="sr-only">{t('availabilityView')}</caption>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 sticky start-0 z-10 bg-slate-50">{t('name')}</th>
              {DAYS.map(d => (
                <th key={d.key} scope="col" className="px-3 py-3 text-center text-xs font-semibold text-slate-500">{d.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {active.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <th scope="row" className="px-4 py-3 sticky start-0 z-10 bg-white text-start">
                  <div className="flex items-center gap-2">
                    <Avatar name={p.name} size="xs"/>
                    <span className="text-sm font-medium text-slate-700 whitespace-nowrap" dir="auto">{p.name}</span>
                  </div>
                </th>
                {DAYS.map(d => (
                  <td key={d.key} className="px-3 py-3 text-center">
                    {p.availability?.[d.key]
                      ? <span aria-label={`${d.label}: ${t('active')}`} className="inline-flex w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full items-center justify-center text-xs">✓</span>
                      : <span aria-label={`${d.label}: —`} className="inline-flex w-6 h-6 bg-slate-100 rounded-full items-center justify-center text-xs text-slate-500">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Multi-select role picker (pill grid, same pattern as availability days) ──
function RolesPicker({ selected,onChange,ROLES,isAr,primaryRole,onPrimaryChange }) {
  const toggle = (role) => {
    const has = selected.includes(role)
    onChange(has ? selected.filter(r => r !== role) : [...selected, role])
  }
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-slate-700 mb-2">
        {isAr ? 'الأدوار' : 'Roles'} <span className="text-red-500">*</span>
        <span className="text-xs text-slate-400 font-normal ms-1.5">
          ({isAr ? 'يمكن اختيار أكثر من دور' : 'select one or more'})
        </span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {ROLES.map(role => {
          const on = selected.includes(role)
          return (
            <button key={role} type="button" onClick={() => toggle(role)} aria-pressed={on}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all select-none ${
                on
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
              }`}>
              {on && <Check size={11}/>}
              {role}
            </button>
          )
        })}
      </div>
      {selected.length === 0 && (
        <p className="text-xs text-amber-700 mt-1.5" role="alert">{isAr ? 'اختر دوراً واحداً على الأقل' : 'Select at least one role'}</p>
      )}
      {selected.length>0&&<Select className="mt-3" label={isAr?'الدور الأساسي':'Primary role'} value={primaryRole||selected[0]} onChange={event=>onPrimaryChange(event.target.value)}>{selected.map(role=><option key={role} value={role}>{role}</option>)}</Select>}
    </fieldset>
  )
}

// ── Edit Form ───────────────────────────────────────────────
function EditForm({ value,onChange,ROLES,t,isAr,protectAuthorization=false,canAssignAdmin=false,worshipRoles=[] }) {
  const POSITION_LABEL = {
    super_admin:isAr?'مسؤول أعلى':'Super Admin',admin:isAr?'مسؤول':'Admin',leader:isAr?'قائد':'Leader',member:isAr?'عضو':'Member',
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label={t('fullName')} required value={value.name || ''} onChange={e => onChange({ ...value, name: e.target.value })}
          placeholder={isAr ? 'الاسم الكامل' : 'Full name'} dir="auto" autoComplete="name"/>
        <Input label={t('email')} type="email" value={value.email || ''} readOnly
          title={isAr?'يُدار بريد تسجيل الدخول من Supabase Authentication':'Sign-in email is managed in Supabase Authentication'} dir="ltr" className="bg-slate-50 text-slate-500"/>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label={t('phone')} type="tel" value={value.phone || ''} onChange={e => onChange({ ...value, phone: e.target.value })}
          placeholder="+20 100 000 0000" dir="ltr" autoComplete="tel" inputMode="tel"/>
        <Input label={t('whatsapp')} type="tel" value={value.whatsapp || ''} onChange={e => onChange({ ...value, whatsapp: e.target.value })}
          placeholder="+20 100 000 0000" dir="ltr" inputMode="tel"/>
      </div>

      {/* Multi-select roles */}
      <RolesPicker selected={value.roles||[]} onChange={roles=>onChange({...value,roles,primaryRole:roles.includes(value.primaryRole)?value.primaryRole:(roles[0]||''),primaryRoleId:roles.includes(value.primaryRole)?value.primaryRoleId:(worshipRoles.find(role=>role.name===roles[0])?.id||'')})} ROLES={ROLES} isAr={isAr} primaryRole={value.primaryRole||value.role} onPrimaryChange={primaryRole=>onChange({...value,primaryRole,primaryRoleId:worshipRoles.find(role=>role.name===primaryRole)?.id||''})}/>

      <Select label={isAr?'صلاحية النظام':'System access'} value={value.accessLevel||'member'} disabled={protectAuthorization}
        title={protectAuthorization ? (isAr?'لا يمكنك تغيير صلاحيات حسابك أثناء تسجيل الدخول':'You cannot change your signed-in authorization') : undefined}
        onChange={e=>onChange({...value,accessLevel:e.target.value})}>
        {(canAssignAdmin?['super_admin','admin','leader','member']:['leader','member']).map(level=><option key={level} value={level}>{POSITION_LABEL[level]}</option>)}
      </Select>
      <Select label={t('active')} value={value.status || 'active'} disabled={protectAuthorization}
        title={protectAuthorization ? (isAr?'لا يمكنك تعطيل حسابك أثناء تسجيل الدخول':'You cannot deactivate your signed-in account') : undefined}
        onChange={e => onChange({ ...value, status: e.target.value })}>
        <option value="active">{t('active')}</option>
        <option value="inactive">{t('inactive')}</option>
        <option value="on-leave">{t('onLeave')}</option>
      </Select>
      <fieldset>
        <legend className="block text-sm font-medium text-slate-700 mb-2">{t('availableDays')}</legend>
        <div className="flex gap-2 flex-wrap">
          {DAYS_CONFIG.map(d => {
            const on = !!value.availability?.[d.key]
            return (
              <button key={d.key} type="button" aria-pressed={on}
                onClick={() => onChange({ ...value, availability: { ...value.availability, [d.key]: !on } })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                {t(d.key)}
              </button>
            )
          })}
        </div>
      </fieldset>
      <Textarea label={t('notes')} placeholder={isAr ? 'أي ملاحظات...' : 'Any notes...'} value={value.notes || ''} onChange={e => onChange({ ...value, notes: e.target.value })}/>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────
const blank={name:'',email:'',phone:'',whatsapp:'',roles:[],primaryRole:'',primaryRoleId:'',accessLevel:'member',status:'active',notes:'',availability:{}}

export default function People() {
  const {people,updatePerson,deletePerson,currentUser,ROLES,worshipRoles,attendanceSessions,attendanceRecords,organizationSettings}=useStore()
  const { isAr, t } = useLang()
  const navigate = useNavigate()
  const isAdmin=hasPermission(currentUser,'users.edit')

  const [search,       setSearch]       = useState('')
  const [filterRole,   setFilterRole]   = useState('all')
  const [viewMode,     setViewMode]     = useState('grid')  // grid | list (for All tab)
  const [subTab,       setSubTab]       = useState('all')   // all | byRole | roster | availability
  const [statusFilter, setStatusFilter] = useState('active')
  const [showForm,     setShowForm]     = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [form,         setForm]         = useState(blank)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [historyPerson, setHistoryPerson] = useState(null)

  const allFiltered = useMemo(() => {
    const q = search.toLowerCase()
    return people.filter(p => {
      const roles       = getRoles(p)
      const matchQ      = !q || p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || roles.some(r => r.toLowerCase().includes(q))
      const matchRole   = filterRole === 'all' || roles.includes(filterRole)
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchQ && matchRole && matchStatus
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'en'))
  }, [people, search, filterRole, statusFilter])

  const activeCount   = people.filter(p => p.status === 'active').length
  const inactiveCount = people.filter(p => p.status === 'inactive').length
  const attendanceReport = buildAttendanceReport({
    sessions:attendanceSessions,
    recordsBySession:attendanceRecords,
    people,
    timezone:organizationSettings.timezone,
    lateMinutes:organizationSettings.attendanceLateMinutes,
  })
  const personHistory = historyPerson
    ? attendanceReport.rows.filter(row => String(row.personId) === String(historyPerson.id))
    : []
  const personSummary = historyPerson
    ? attendanceReport.summaries.find(summary => String(summary.person.id) === String(historyPerson.id))
    : null
  const exportPersonHistory = () => {
    if (!historyPerson || personHistory.length === 0) return
    downloadAttendanceReport({ rows:personHistory, summaries:personSummary ? [personSummary] : [] }, {
      isAr,
      timezone:organizationSettings.timezone,
      filename:`kdec-${(historyPerson.name || 'member').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-attendance`,
    })
  }

  const openEdit=p=>{setEditing(p.id);setForm({...p,roles:getRoles(p),primaryRole:p.primaryRole||p.role,accessLevel:p.accessLevel||'member'});setShowForm(true)}
  const closeEdit = () => { setShowForm(false); setEditing(null); setForm(blank) }

  const handleSave = async () => {
    if (!form.name?.trim() || !editing) return
    if (!form.roles || form.roles.length === 0) return
    if (editing===currentUser?.id && form.status!=='active') return
    const result = await updatePerson(editing, { ...form, name: form.name.trim() })
    if (!result?.error) closeEdit()
  }

  const SUB_TABS = [
    { label: t('all'),          value: 'all'          },
    { label: t('byRole'),       value: 'byRole'        },
    { label: t('roster'),       value: 'roster'        },
    { label: t('availabilityView'), value: 'availability' },
  ]

  return (
    <div className="max-w-7xl space-y-5 animate-fade-in">

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t('totalMembers'),  value: people.length,        color: 'bg-indigo-50 text-indigo-700'  },
          { label: t('activeMembers'), value: activeCount,           color: 'bg-emerald-50 text-emerald-700'},
          { label: t('inactive'),      value: inactiveCount,         color: 'bg-slate-50 text-slate-600'   },
        ].map(({ label, value, color }) => (
          <Card key={label} className={`p-4 ${color} border-0`}>
            <div className="text-2xl font-display font-bold">{value}</div>
            <div className="text-xs font-medium mt-0.5 opacity-80">{label}</div>
          </Card>
        ))}
      </div>

      {/* Sub-page tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0 max-w-full">
          <Tabs tabs={SUB_TABS} active={subTab} onChange={setSubTab}/>
        </div>
        {isAdmin && (
          <Btn onClick={() => navigate('/invitations')} icon={<UserPlus size={16}/>}>{t('inviteMember')}</Btn>
        )}
      </div>

      {/* Filters bar (shown for All and ByRole tabs) */}
      {(subTab === 'all' || subTab === 'byRole') && (
        <div className="flex items-center gap-3 flex-wrap">
          <SearchInput value={search} onChange={setSearch}
            placeholder={isAr ? 'ابحث في الأعضاء...' : 'Search members...'} className="w-full sm:w-60"/>
          <label htmlFor="people-role-filter" className="sr-only">{t('allRoles')}</label>
          <select id="people-role-filter" value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="w-full sm:w-auto px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">{t('allRoles')}</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <label htmlFor="people-status-filter" className="sr-only">{isAr ? 'تصفية حسب الحالة' : 'Filter by status'}</label>
          <select id="people-status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="active">{t('active')}</option>
            <option value="inactive">{t('inactive')}</option>
            <option value="on-leave">{t('onLeave')}</option>
            <option value="all">{t('all')}</option>
          </select>
          {subTab === 'all' && (
            <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg sm:ms-auto" role="group" aria-label={isAr ? 'طريقة العرض' : 'View mode'}>
              <button type="button" onClick={() => setViewMode('grid')} aria-pressed={viewMode === 'grid'}
                aria-label={isAr ? 'عرض شبكي' : 'Grid view'}
                className={`w-9 h-9 inline-flex items-center justify-center rounded cursor-pointer transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}><Grid3X3 size={15} aria-hidden="true"/></button>
              <button type="button" onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'}
                aria-label={isAr ? 'عرض قائمة' : 'List view'}
                className={`w-9 h-9 inline-flex items-center justify-center rounded cursor-pointer transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}><List size={15} aria-hidden="true"/></button>
            </div>
          )}
        </div>
      )}

      {/* ── Sub-page content ── */}

      {/* ALL — grid or list */}
      {subTab === 'all' && (
        <>
          {allFiltered.length === 0 ? (
            <EmptyState icon={<Users size={28}/>} title={t('noPeople')}
              action={isAdmin && <Btn onClick={() => navigate('/invitations')} icon={<UserPlus size={16}/>}>{t('inviteMember')}</Btn>}/>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allFiltered.map(p => (
                <PersonCard key={p.id} person={p} isAdmin={isAdmin} currentUserId={currentUser?.id} onEdit={openEdit} onDelete={setDeleteTarget} onAttendance={setHistoryPerson} t={t} isAr={isAr}/>
              ))}
            </div>
          ) : (
            <RosterView people={allFiltered} t={t} isAr={isAr}/>
          )}
        </>
      )}

      {/* BY ROLE */}
      {subTab === 'byRole' && (
        <ByRoleView people={allFiltered} isAdmin={isAdmin} currentUserId={currentUser?.id} onEdit={openEdit} onDelete={setDeleteTarget} onAttendance={setHistoryPerson} t={t} isAr={isAr} ROLES={ROLES}/>
      )}

      {/* ROSTER — printable */}
      {subTab === 'roster' && (
        <RosterView people={people.filter(p => p.status === 'active')} t={t} isAr={isAr}/>
      )}

      {/* AVAILABILITY */}
      {subTab === 'availability' && (
        <AvailabilityView people={people} t={t}/>
      )}

      {/* Edit modal */}
      <Modal open={showForm} onClose={closeEdit}
        title={t('edit')} size="lg"
        footer={<>
          <Btn variant="secondary" onClick={closeEdit}>{t('cancel')}</Btn>
          <Btn onClick={handleSave} disabled={!form.name?.trim() || !form.roles || form.roles.length === 0}>{t('saveChanges')}</Btn>
        </>}>
        <EditForm value={form} onChange={setForm} ROLES={ROLES} t={t} isAr={isAr} worshipRoles={worshipRoles}
          canAssignAdmin={currentUser?.accessLevel==='super_admin'} protectAuthorization={editing===currentUser?.id&&isAdmin}/>
      </Modal>

      <Modal open={isAdmin && !!historyPerson} onClose={()=>setHistoryPerson(null)}
        title={`${isAr?'سجل حضور':'Attendance History'} — ${historyPerson?.name || ''}`} size="xl"
        footer={<Btn onClick={exportPersonHistory} disabled={personHistory.length === 0} icon={<Download size={16}/>}>{isAr?'تصدير Excel':'Export Excel'}</Btn>}>
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              [isAr?'إجمالي الحضور':'Total', personSummary?.records || 0, 'text-indigo-600'],
              [isAr?'مبكر':'Early', personSummary?.early || 0, 'text-blue-600'],
              [isAr?'في الموعد':'On time', personSummary?.onTime || 0, 'text-emerald-600'],
              [isAr?'متأخر':'Late', personSummary?.late || 0, 'text-red-600'],
            ].map(([label, value, color]) => <div key={label} className="rounded-xl bg-slate-50 p-3 text-center"><div className={`text-xl font-bold ${color}`}>{value}</div><div className="text-xs text-slate-500 mt-1">{label}</div></div>)}
          </div>
          {personHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">{isAr?'لا يوجد سجل حضور لهذا العضو بعد':'No attendance history for this member yet'}</div>
          ) : (
            <div className="space-y-3">
              {personHistory.map(row => <Card key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800" dir="auto">{row.sessionName}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{row.sessionType} · {row.date}</div>
                  </div>
                  <div className="text-xs text-slate-500 sm:text-end">
                    <div>{isAr?'الدخول':'Check in'}: {formatAttendanceTimestamp(row.checkInAt, organizationSettings.timezone, isAr)}</div>
                    <div>{isAr?'الخروج':'Check out'}: {formatAttendanceTimestamp(row.checkOutAt, organizationSettings.timezone, isAr)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {row.arrival === 'early' && <Badge color="blue" size="xs">{isAr?'وصول مبكر':'Early arrival'}</Badge>}
                  {row.arrival === 'on_time' && <Badge color="green" size="xs">{isAr?'في الموعد':'On time'}</Badge>}
                  {row.arrival === 'late' && <Badge color="red" size="xs">{isAr?'وصول متأخر':'Late arrival'}</Badge>}
                  {row.departure === 'early' && <Badge color="yellow" size="xs">{isAr?'خروج مبكر':'Early checkout'}</Badge>}
                  {row.departure === 'normal' && <Badge color="green" size="xs">{isAr?'خروج طبيعي':'Normal checkout'}</Badge>}
                </div>
              </Card>)}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={async() => { const result=await deletePerson(deleteTarget); if(!result?.error)setDeleteTarget(null); return result }}
        title={isAr ? 'تعطيل العضو' : 'Deactivate Member'}
        message={isAr ? 'سيتم تغيير حالة العضو إلى غير نشط.' : 'Member status will be set to inactive.'}/>
    </div>
  )
}
