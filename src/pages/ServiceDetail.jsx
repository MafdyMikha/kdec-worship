import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Users, Edit2, Check, X, Save, Repeat, RefreshCw, AlertCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { canManageWorship } from '../lib/permissions.js'
import { Btn, Badge, Avatar, Modal, Select, Textarea, Card, StatusDot, ConfirmDialog } from '../components/ui'
import WhatsAppNotify from '../components/WhatsAppNotify'
import PracticeTab from '../components/PracticeTab'
import SetlistTab from '../components/SetlistTab'

export default function ServiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {services,people,currentUser,updateService,deleteService,deleteRecurringService,generateMoreOccurrences,addTeamMember,updateTeamMemberStatus,removeTeamMember,requestSubstitute,ROLES,worshipRoles}=useStore()
  const { t, isAr } = useLang()

  const [tab,             setTab]            = useState('setlist')
  const [showAddPerson,   setShowAddPerson]  = useState(false)
  const [selectedPerson,  setSelectedPerson] = useState('')
  const [selectedRole,    setSelectedRole]   = useState(ROLES[0])
  const [editingNotes,    setEditingNotes]   = useState(false)
  const [notesVal,        setNotesVal]       = useState('')
  const [confirmDelete,   setConfirmDelete]  = useState(false)
  const [deleteScope,     setDeleteScope]    = useState('this')
  const [showDeleteScope, setShowDeleteScope]= useState(false)
  const [subModal,        setSubModal]       = useState(null)

  const canEdit  = canManageWorship(currentUser)
  const service  = services.find(s => s.id === id)

  if (!service) return (
    <div className="text-center py-16">
      <p className="text-slate-500">{isAr?'لا توجد خدمة بهذا المعرف':'Service not found'}</p>
      <Btn variant="ghost" onClick={() => navigate('/services')} className="mt-4">{isAr?'← العودة':'← Back'}</Btn>
    </div>
  )

  const teamMembers     = service.team.map(t => ({...t, person: t.person || people.find(p => p.id === t.personId)}))
  const teamRoleNames=[...new Set(teamMembers.map(member=>member.role).filter(Boolean))].sort((a,b)=>{
    const order=name=>worshipRoles.find(role=>role.name===name)?.displayOrder??9999
    return order(a)-order(b)||a.localeCompare(b)
  })
  const availablePeople = people.filter(p => p.status==='active' && !service.team.find(t => t.personId===p.id))
  const confirmed       = service.team.filter(t => t.status==='confirmed').length
  const pending         = service.team.filter(t => t.status==='pending').length

  const STATUS_LABEL = isAr
    ? { confirmed:'مؤكد', pending:'انتظار', declined:'معتذر' }
    : { confirmed:'Confirmed', pending:'Pending', declined:'Declined' }
  const STATUS_COLOR = { confirmed:'green', pending:'yellow', declined:'red' }
  const SVC_STATUS = isAr
    ? { scheduled:'مجدولة', completed:'مكتملة', cancelled:'ملغاة', draft:'مسودة' }
    : { scheduled:'Scheduled', completed:'Completed', cancelled:'Cancelled', draft:'Draft' }
  const SVC_STATUS_COLOR = { scheduled:'blue', completed:'green', cancelled:'red', draft:'slate' }

  const handleAddPerson = async () => {
    if (!selectedPerson) return
    const result = await addTeamMember(id, selectedPerson, selectedRole)
    if (!result?.error) { setShowAddPerson(false); setSelectedPerson(''); setSelectedRole(ROLES[0]) }
  }

  const getSubs = (role) => people.filter(p => {
    const roles = (Array.isArray(p.roles) && p.roles.length > 0) ? p.roles : (p.role ? [p.role] : [])
    return p.status === 'active' && roles.includes(role) && !service.team.find(t => t.personId === p.id)
  })

  const TABS = [
    { key:'setlist',  label: isAr?'قائمة الترانيم':'Setlist', count: service.setlist.length },
    { key:'team',     label: isAr?'الفريق':'Team',            count: service.team.length },
    { key:'practice', label: isAr?'البروفة':'Practice',       highlight: service.practice?.enabled },
    { key:'notes',    label: isAr?'ملاحظات':'Notes' },
  ]

  const DEL_SCOPES = isAr
    ? [
        { value:'this',            label:'هذه الخدمة فقط',     desc:'إلغاء هذا التكرار فقط'           },
        { value:'this_and_future', label:'هذه والقادمة',        desc:'إلغاء هذا وكل التكرارات القادمة' },
        { value:'all',             label:'كل السلسلة',          desc:'إلغاء جميع تكرارات هذه الخدمة'   },
      ]
    : [
        { value:'this',            label:'This service only',   desc:'Cancel just this occurrence'   },
        { value:'this_and_future', label:'This and following',  desc:'Cancel this and future ones'   },
        { value:'all',             label:'All in series',       desc:'Cancel every occurrence'       },
      ]

  return (
    <div className="max-w-5xl space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/services')} aria-label={isAr?'العودة للخدمات':'Back to services'} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer mt-1">
          <ArrowLeft size={18}/>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <Badge color="blue" size="xs">{service.type}</Badge>
            <Badge color={SVC_STATUS_COLOR[service.status]||'slate'} size="xs">{SVC_STATUS[service.status]||service.status}</Badge>
          </div>
          <h2 className="font-display font-bold text-xl text-slate-800">{service.title}</h2>
          <p className="text-sm text-slate-500">{format(parseISO(service.date),'EEEE, d MMMM yyyy')} · {service.time}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {canEdit && (
            <Btn variant="secondary" size="sm"
              onClick={() => service.recurrenceGroupId ? setShowDeleteScope(true) : setConfirmDelete(true)}
              icon={<Trash2 size={14}/>}>{isAr?'إلغاء':'Cancel'}</Btn>
          )}
          {canEdit&&<WhatsAppNotify service={service}/>}
        </div>
      </div>

      {/* Recurring banner */}
      {service.recurrenceGroupId && (() => {
        const group = services.filter(s=>s.recurrenceGroupId===service.recurrenceGroupId).sort((a,b)=>parseISO(a.date)-parseISO(b.date))
        const idx   = group.findIndex(s=>s.id===service.id)
        const prev  = group[idx-1]; const next = group[idx+1]
        return (
          <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <Repeat size={16} className="text-violet-500 flex-shrink-0"/>
            <div className="flex-1 text-sm text-violet-700">
              <span className="font-semibold">{isAr?'سلسلة متكررة':'Recurring series'}</span> · {isAr?'التكرار':'Occurrence'} {idx+1} {isAr?'من':'of'} {group.length}
              {prev&&<span className="mx-2 text-violet-400">← {format(parseISO(prev.date),'MMM d')}</span>}
              {next&&<span className="mx-2 text-violet-400">{format(parseISO(next.date),'MMM d')} →</span>}
            </div>
            <div className="flex items-center gap-2">
              {prev&&<button onClick={()=>navigate(`/services/${prev.id}`)} className="text-xs text-violet-600 hover:text-violet-800 font-medium cursor-pointer px-2 py-1 hover:bg-violet-100 rounded-lg">← {isAr?'السابق':'Prev'}</button>}
              {next&&<button onClick={()=>navigate(`/services/${next.id}`)} className="text-xs text-violet-600 hover:text-violet-800 font-medium cursor-pointer px-2 py-1 hover:bg-violet-100 rounded-lg">{isAr?'التالي':'Next'} →</button>}
              {canEdit&&<button onClick={()=>generateMoreOccurrences(service.recurrenceGroupId,4)}
                className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium cursor-pointer px-2 py-1 hover:bg-violet-100 rounded-lg border border-violet-200">
                <RefreshCw size={11}/> +4 {isAr?'تكرارات':'more'}
              </button>}
            </div>
          </div>
        )
      })()}

      {/* Notes banner */}
      {service.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <span>📌</span> {service.notes}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto" role="tablist" aria-label={isAr?'تفاصيل الخدمة':'Service details'}>
        {TABS.map(tabItem => (
          <button key={tabItem.key} role="tab" aria-selected={tab===tabItem.key} onClick={() => setTab(tabItem.key)}
            className={`flex items-center gap-1.5 pb-3 px-1 text-sm font-medium cursor-pointer transition-all border-b-2 -mb-px whitespace-nowrap mr-5 ${tab===tabItem.key?'border-indigo-600 text-indigo-600':'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {tabItem.label}
            {tabItem.count!==undefined&&<span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{tabItem.count}</span>}
            {tabItem.highlight&&<span className="w-2 h-2 rounded-full bg-emerald-400"/>}
          </button>
        ))}
      </div>

      {/* Setlist */}
      {tab==='setlist' && <SetlistTab key={service.id} service={service} canEdit={canEdit}/>}

      {/* Team */}
      {tab==='team' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-emerald-600 font-medium">{confirmed} {isAr?'مؤكد':'confirmed'}</span>
              {pending>0&&<span className="text-amber-500">{pending} {isAr?'انتظار':'pending'}</span>}
            </div>
            {canEdit&&<Btn size="sm" onClick={()=>setShowAddPerson(true)} icon={<Plus size={14}/>}>{isAr?'إضافة عضو':'Add Member'}</Btn>}
          </div>

          {teamRoleNames.map(role=>(
            <div key={role}>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">{role}</div>
              <div className="space-y-2">
                {teamMembers.filter(t=>t.role===role).map(({person,personId,status})=>{
                  const isMe = personId===currentUser?.id
                  const subs = getSubs(role)
                  return (
                    <Card key={personId} className="p-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={person?.name||'?'} size="sm"/>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 text-sm flex items-center gap-1.5">
                            {person?.name}
                            {isMe&&<span className="text-xs text-indigo-500 font-normal">({isAr?'أنت':'you'})</span>}
                          </div>
                          <div className="text-xs text-slate-400">{person?.email}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge color={STATUS_COLOR[status]||'slate'} size="xs">
                            <span className="flex items-center gap-1"><StatusDot status={status}/>{STATUS_LABEL[status]||status}</span>
                          </Badge>
                          <div className="flex gap-1">
                            {(canEdit||isMe)&&status!=='confirmed'&&(
                              <button onClick={()=>updateTeamMemberStatus(id,personId,'confirmed')} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded cursor-pointer" title={t('confirmed')}><Check size={14}/></button>
                            )}
                            {canEdit&&status!=='declined'&&(
                              <button onClick={()=>updateTeamMemberStatus(id,personId,'declined')} className="p-1.5 text-red-400 hover:bg-red-50 rounded cursor-pointer" title={t('declined')}><X size={14}/></button>
                            )}
                            {(isMe||canEdit)&&status==='confirmed'&&subs.length>0&&(
                              <button onClick={()=>setSubModal({personId,person,role,subs})} aria-label={t('findSub')} className="p-1.5 text-violet-500 hover:bg-violet-50 rounded cursor-pointer" title={t('findSub')}><Users size={14}/></button>
                            )}
                            {canEdit&&(
                              <button onClick={()=>removeTeamMember(id,personId)} aria-label={isAr?'إزالة العضو':'Remove member'} className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded cursor-pointer"><Trash2 size={14}/></button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}

          {teamMembers.length===0&&(
            <Card className="p-10 text-center">
              <Users size={32} className="text-slate-200 mx-auto mb-2"/>
              <p className="text-slate-500 text-sm mb-3">{isAr?'لا يوجد أعضاء في الفريق':'No team members assigned'}</p>
              {canEdit&&<Btn size="sm" onClick={()=>setShowAddPerson(true)} icon={<Plus size={14}/>}>{isAr?'إضافة عضو':'Add Member'}</Btn>}
            </Card>
          )}
        </div>
      )}

      {/* Practice */}
      {tab==='practice' && <PracticeTab key={service.id} service={service} canEdit={canEdit}/>}

      {/* Notes */}
      {tab==='notes' && (
        <Card className="p-5">
          {!editingNotes?(
            <div>
              <div className="flex justify-between mb-3">
                <h3 className="font-semibold text-slate-700">{isAr?'ملاحظات الخدمة':'Service Notes'}</h3>
                {canEdit&&<Btn variant="ghost" size="sm" onClick={()=>{setNotesVal(service.notes||'');setEditingNotes(true)}} icon={<Edit2 size={14}/>}>{t('edit')}</Btn>}
              </div>
              <p className="text-slate-600 text-sm leading-relaxed" dir="auto">{service.notes||(isAr?'لا توجد ملاحظات بعد.':'No notes yet.')}</p>
            </div>
          ):(
            <div className="space-y-3">
              <Textarea label={isAr?'الملاحظات':'Notes'} value={notesVal} onChange={e=>setNotesVal(e.target.value)} rows={6}/>
              <div className="flex gap-2">
                <Btn size="sm" onClick={async()=>{const result=await updateService(id,{notes:notesVal});if(!result?.error)setEditingNotes(false)}} icon={<Save size={14}/>}>{t('save')}</Btn>
                <Btn variant="ghost" size="sm" onClick={()=>setEditingNotes(false)}>{t('cancel')}</Btn>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Add person modal */}
      <Modal open={canEdit&&showAddPerson} onClose={()=>setShowAddPerson(false)}
        title={isAr?'إضافة عضو للفريق':'Add Team Member'} size="sm"
        footer={<><Btn variant="secondary" onClick={()=>setShowAddPerson(false)}>{t('cancel')}</Btn><Btn onClick={handleAddPerson} disabled={!selectedPerson}>{isAr?'إضافة':'Add'}</Btn></>}>
        <div className="space-y-4">
          <Select label={isAr?'العضو':'Person'} value={selectedPerson} onChange={e=>setSelectedPerson(e.target.value)}>
            <option value="">{isAr?'اختر عضواً...':'Select person...'}</option>
            {availablePeople.map(p=><option key={p.id} value={p.id}>{p.name} — {((Array.isArray(p.roles) && p.roles.length>0) ? p.roles : (p.role?[p.role]:[])).join(', ')}</option>)}
          </Select>
          <Select label={isAr?'الدور في هذه الخدمة':'Role for this service'} value={selectedRole} onChange={e=>setSelectedRole(e.target.value)}>
            {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
          </Select>
        </div>
      </Modal>

      {/* Substitute modal */}
      {subModal&&(
        <Modal open={!!subModal} onClose={()=>setSubModal(null)}
          title={isAr?'طلب بديل':'Request Substitute'} size="sm"
          footer={<><Btn variant="secondary" onClick={()=>setSubModal(null)}>{t('cancel')}</Btn>{!canEdit&&<Btn onClick={async()=>{const result=await requestSubstitute(id,subModal.role);if(!result?.error)setSubModal(null)}}>{isAr?'إرسال طلب عام':'Send General Request'}</Btn>}</>}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {isAr?'إيجاد بديل لـ':'Find substitute for'} <strong>{subModal.person?.name}</strong> {isAr?'في دور':'as'} <strong>{subModal.role}</strong>
            </p>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('availableSubs')}</p>
              {subModal.subs.length===0?(
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                  <AlertCircle size={14}/> {t('noSubs')}
                </div>
              ):subModal.subs.map(p=>(
                <div key={p.id} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <Avatar name={p.name} size="sm"/>
                  <div className="flex-1"><div className="text-sm font-medium text-slate-800">{p.name}</div><div className="text-xs text-slate-500">{((Array.isArray(p.roles) && p.roles.length>0) ? p.roles : (p.role?[p.role]:[])).join(', ')}</div></div>
                  <button onClick={async()=>{const result=canEdit
                    ? await addTeamMember(id,p.id,subModal.role)
                    : await requestSubstitute(id,subModal.role,`${isAr?'البديل المفضل':'Preferred substitute'}: ${p.name}`)
                    if(!result?.error)setSubModal(null)}}
                    className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-medium rounded-lg cursor-pointer hover:bg-emerald-800">
                    {canEdit?t('addAsSub'):(isAr?'طلب هذا البديل':'Request this substitute')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      <ConfirmDialog open={canEdit&&confirmDelete} onClose={()=>setConfirmDelete(false)}
        onConfirm={async()=>{const result=await deleteService(id);if(!result?.error)navigate('/services');return result}}
        title={isAr?'إلغاء الخدمة':'Cancel Service'}
        confirmLabel={isAr?'إلغاء الخدمة':'Cancel service'}
        message={isAr?`سيتم إلغاء "${service.title}" مع الحفاظ على سجلها.`:`Cancel "${service.title}" while preserving its history?`}/>

      {/* Recurring delete scope */}
      <Modal open={canEdit&&showDeleteScope} onClose={()=>setShowDeleteScope(false)}
        title={isAr?'إلغاء خدمة متكررة':'Cancel Recurring Service'} size="sm"
        footer={<>
          <Btn variant="secondary" onClick={()=>setShowDeleteScope(false)}>{t('cancel')}</Btn>
          <Btn variant="danger" onClick={async()=>{const result=await deleteRecurringService(id,deleteScope);if(!result?.error)navigate('/services')}}>{isAr?'إلغاء':'Cancel'}</Btn>
        </>}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">{isAr?'هذه الخدمة جزء من سلسلة متكررة.':'This service is part of a recurring series.'}</p>
          {DEL_SCOPES.map(opt=>(
            <label key={opt.value} className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${deleteScope===opt.value?'bg-red-50 border-red-300':'border-slate-200 hover:border-slate-300'}`}>
              <input type="radio" name="deleteScope" value={opt.value} checked={deleteScope===opt.value} onChange={()=>setDeleteScope(opt.value)} className="mt-0.5"/>
              <div><div className="text-sm font-medium text-slate-800">{opt.label}</div><div className="text-xs text-slate-400">{opt.desc}</div></div>
            </label>
          ))}
        </div>
      </Modal>
    </div>
  )
}
