import { useState, useMemo } from 'react'
import { Plus, Edit2, Trash2, Mail, Phone, Users, UserPlus, Grid3X3, List, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, Btn, Badge, Avatar, SearchInput, Modal, Input, Select, Textarea, Tabs, EmptyState, ConfirmDialog, StatusDot } from '../components/ui'

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

// ── Person Card ─────────────────────────────────────────────
function PersonCard({ person, isAdmin, onEdit, onDelete, t, isAr }) {
  const phone    = person.whatsapp || person.phone
  const availDays = DAYS_CONFIG.filter(d => person.availability?.[d.key])
  return (
    <Card className="p-4 group hover:shadow-md transition-all">
      <div className="flex items-start gap-3 mb-3">
        <Avatar name={person.name} size="md"/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Name always Latin/English */}
            <span className="font-semibold text-slate-800 truncate" dir="ltr">{person.name}</span>
            <StatusDot status={person.status}/>
          </div>
          <div className="text-xs text-slate-400">{person.position || t('member') || 'Member'}</div>
        </div>
        {isAdmin && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(person)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"><Edit2 size={13}/></button>
            <button onClick={() => onDelete(person.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded cursor-pointer"><Trash2 size={13}/></button>
          </div>
        )}
      </div>
      <Badge color={ROLE_COLOR[person.role] || 'slate'} size="sm">{person.role || '—'}</Badge>
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
    </Card>
  )
}

// ── Role Group View ─────────────────────────────────────────
function ByRoleView({ people, isAdmin, onEdit, onDelete, t, isAr, ROLES }) {
  const grouped = useMemo(() => {
    const map = {}
    ROLES.forEach(r => { map[r] = people.filter(p => p.role === r) })
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
                <PersonCard key={p.id} person={p} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} t={t} isAr={isAr}/>
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
  const POSITION_LABEL = {
    Leader: isAr ? 'قائد' : 'Leader',
    Member: isAr ? 'عضو' : 'Member',
    Volunteer: isAr ? 'متطوع' : 'Volunteer',
    Admin: isAr ? 'مسؤول' : 'Admin',
  }
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
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('name')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('role')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('position')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('phone')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('email')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('active')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {people.map((p, i) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={p.name} size="xs"/>
                      {/* Name always Latin */}
                      <span className="font-medium text-slate-800" dir="ltr">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge color={ROLE_COLOR[p.role] || 'slate'} size="xs">{p.role || '—'}</Badge></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{POSITION_LABEL[p.position] || p.position || '—'}</td>
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
function AvailabilityView({ people, t, isAr }) {
  const DAYS = DAYS_CONFIG.map(d => ({ ...d, label: t(d.key) }))
  const active = people.filter(p => p.status === 'active')

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 sticky left-0 bg-slate-50">{t('name')}</th>
              {DAYS.map(d => (
                <th key={d.key} className="px-3 py-3 text-center text-xs font-semibold text-slate-500">{d.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {active.map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 sticky left-0 bg-white">
                  <div className="flex items-center gap-2">
                    <Avatar name={p.name} size="xs"/>
                    <span className="text-sm font-medium text-slate-700 whitespace-nowrap" dir="ltr">{p.name}</span>
                  </div>
                </td>
                {DAYS.map(d => (
                  <td key={d.key} className="px-3 py-3 text-center">
                    {p.availability?.[d.key]
                      ? <span className="inline-flex w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full items-center justify-center text-xs">✓</span>
                      : <span className="inline-flex w-6 h-6 bg-slate-100 rounded-full items-center justify-center text-xs text-slate-300">—</span>}
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

// ── Edit Form ───────────────────────────────────────────────
function EditForm({ value, onChange, ROLES, POSITIONS, t, isAr }) {
  const POSITION_LABEL = {
    Leader: isAr ? 'قائد' : 'Leader',
    Member: isAr ? 'عضو' : 'Member',
    Volunteer: isAr ? 'متطوع' : 'Volunteer',
    Admin: isAr ? 'مسؤول' : 'Admin',
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t('fullName')} <span className="text-red-500">*</span>
          </label>
          <input value={value.name || ''} onChange={e => onChange({ ...value, name: e.target.value })}
            placeholder="John Mikhail" dir="ltr"
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
          <p className="text-xs text-slate-400 mt-1">{isAr ? 'الاسم بالأحرف اللاتينية' : 'Latin characters preferred'}</p>
        </div>
        <Input label={t('email')} type="email" placeholder="john@kdec.org"
          value={value.email || ''} onChange={e => onChange({ ...value, email: e.target.value })}/>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('phone')}</label>
          <input value={value.phone || ''} onChange={e => onChange({ ...value, phone: e.target.value })}
            placeholder="+20 100 000 0000" dir="ltr"
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('whatsapp')}</label>
          <input value={value.whatsapp || ''} onChange={e => onChange({ ...value, whatsapp: e.target.value })}
            placeholder="+20 100 000 0000" dir="ltr"
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 hover:border-slate-300"/>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select label={t('role')} value={value.role || ''} onChange={e => onChange({ ...value, role: e.target.value })}>
          <option value="">{isAr ? 'اختر الدور...' : 'Select role...'}</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Select label={t('position')} value={value.position || 'Member'} onChange={e => onChange({ ...value, position: e.target.value })}>
          {POSITIONS.map(p => <option key={p} value={p}>{POSITION_LABEL[p] || p}</option>)}
        </Select>
      </div>
      <Select label={t('active')} value={value.status || 'active'} onChange={e => onChange({ ...value, status: e.target.value })}>
        <option value="active">{t('active')}</option>
        <option value="inactive">{t('inactive')}</option>
        <option value="on-leave">{t('onLeave')}</option>
      </Select>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">{t('availableDays')}</label>
        <div className="flex gap-2 flex-wrap">
          {DAYS_CONFIG.map(d => {
            const on = !!value.availability?.[d.key]
            return (
              <button key={d.key} type="button"
                onClick={() => onChange({ ...value, availability: { ...value.availability, [d.key]: !on } })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                {t(d.key)}
              </button>
            )
          })}
        </div>
      </div>
      <Textarea label={t('notes')} placeholder={isAr ? 'أي ملاحظات...' : 'Any notes...'} value={value.notes || ''} onChange={e => onChange({ ...value, notes: e.target.value })}/>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────
const blank = { name:'', email:'', phone:'', whatsapp:'', role:'', position:'Member', status:'active', notes:'', availability:{} }

export default function People() {
  const { people, updatePerson, deletePerson, currentUser, ROLES, POSITIONS } = useStore()
  const { isAr, t } = useLang()
  const navigate = useNavigate()
  const isAdmin  = currentUser?.isAdmin || currentUser?.is_admin

  const [search,       setSearch]       = useState('')
  const [filterRole,   setFilterRole]   = useState('all')
  const [viewMode,     setViewMode]     = useState('grid')  // grid | list (for All tab)
  const [subTab,       setSubTab]       = useState('all')   // all | byRole | roster | availability
  const [statusFilter, setStatusFilter] = useState('active')
  const [showForm,     setShowForm]     = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [form,         setForm]         = useState(blank)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const allFiltered = useMemo(() => {
    const q = search.toLowerCase()
    return people.filter(p => {
      const matchQ      = !q || p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.role?.toLowerCase().includes(q)
      const matchRole   = filterRole === 'all' || p.role === filterRole
      const matchStatus = statusFilter === 'all' || p.status === statusFilter
      return matchQ && matchRole && matchStatus
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'en'))
  }, [people, search, filterRole, statusFilter])

  const activeCount   = people.filter(p => p.status === 'active').length
  const inactiveCount = people.filter(p => p.status === 'inactive').length

  const openEdit = (p) => { setEditing(p.id); setForm({ ...p }); setShowForm(true) }

  const handleSave = () => {
    if (!form.name || !editing) return
    updatePerson(editing, form)
    setShowForm(false); setEditing(null); setForm(blank)
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
      <div className="grid grid-cols-3 gap-4">
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
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {SUB_TABS.map(tab => (
            <button key={tab.value} onClick={() => setSubTab(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                subTab === tab.value
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
        {isAdmin && (
          <Btn onClick={() => navigate('/invitations')} icon={<UserPlus size={16}/>}>{t('inviteMember')}</Btn>
        )}
      </div>

      {/* Filters bar (shown for All and ByRole tabs) */}
      {(subTab === 'all' || subTab === 'byRole') && (
        <div className="flex items-center gap-3 flex-wrap">
          <SearchInput value={search} onChange={setSearch}
            placeholder={isAr ? 'ابحث في الأعضاء...' : 'Search members...'} className="w-60"/>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">{t('allRoles')}</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="active">{t('active')}</option>
            <option value="inactive">{t('inactive')}</option>
            <option value="on-leave">{t('onLeave')}</option>
            <option value="all">{t('all')}</option>
          </select>
          {subTab === 'all' && (
            <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg ml-auto">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded cursor-pointer transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><Grid3X3 size={15}/></button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded cursor-pointer transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><List size={15}/></button>
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
                <PersonCard key={p.id} person={p} isAdmin={isAdmin} onEdit={openEdit} onDelete={setDeleteTarget} t={t} isAr={isAr}/>
              ))}
            </div>
          ) : (
            <RosterView people={allFiltered} t={t} isAr={isAr}/>
          )}
        </>
      )}

      {/* BY ROLE */}
      {subTab === 'byRole' && (
        <ByRoleView people={allFiltered} isAdmin={isAdmin} onEdit={openEdit} onDelete={setDeleteTarget} t={t} isAr={isAr} ROLES={ROLES}/>
      )}

      {/* ROSTER — printable */}
      {subTab === 'roster' && (
        <RosterView people={people.filter(p => p.status === 'active')} t={t} isAr={isAr}/>
      )}

      {/* AVAILABILITY */}
      {subTab === 'availability' && (
        <AvailabilityView people={people} t={t} isAr={isAr}/>
      )}

      {/* Edit modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }}
        title={t('edit')} size="lg"
        footer={<>
          <Btn variant="secondary" onClick={() => setShowForm(false)}>{t('cancel')}</Btn>
          <Btn onClick={handleSave}>{t('saveChanges')}</Btn>
        </>}>
        <EditForm value={form} onChange={setForm} ROLES={ROLES} POSITIONS={POSITIONS} t={t} isAr={isAr}/>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => { deletePerson(deleteTarget); setDeleteTarget(null) }}
        title={isAr ? 'تعطيل العضو' : 'Deactivate Member'}
        message={isAr ? 'سيتم تغيير حالة العضو إلى غير نشط.' : 'Member status will be set to inactive.'}/>
    </div>
  )
}
