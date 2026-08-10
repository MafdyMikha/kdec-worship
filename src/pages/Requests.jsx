import { useState } from 'react'
import { Check, ClipboardList, UserRoundCheck, X } from 'lucide-react'

import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { canManageWorship } from '../lib/permissions.js'
import { Badge, Btn, Card, EmptyState, Select, Tabs } from '../components/ui'

const STATUS_COLOR = {
  pending:'yellow', approved:'green', rejected:'red', cancelled:'slate',
  open:'yellow', filled:'green',
}
const STATUS_LABEL = {
  pending:['انتظار','Pending'], approved:['عذر مقبول','Excused'], rejected:['غياب غير معذور','Unexcused'],
  cancelled:['ملغي','Cancelled'], open:['مفتوح','Open'], filled:['تم توفير بديل','Filled'],
}
const statusLabel = (status, isAr) => STATUS_LABEL[status]?.[isAr?0:1] || status

function SubstituteRequestCard({ request, people, services, currentUser, canManage, onFill, onCancel, isAr }) {
  const [substituteId, setSubstituteId] = useState(request.substitute_id || '')
  const service = services.find(item => item.id===request.service_id)
  const requester = people.find(item => item.id===request.requester_id)
  const candidates = people.filter(person => {
    const roles = person.roles?.length ? person.roles : person.role ? [person.role] : []
    return person.status==='active' && person.id!==request.requester_id && roles.includes(request.role) && !service?.team.some(member => member.personId===person.id)
  })
  const canCancel = request.status==='open' && (canManage || request.requester_id===currentUser.id)

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-800" dir="auto">{service?.title || (isAr?'خدمة غير متاحة':'Unavailable service')}</h3>
          <p className="mt-1 text-sm text-slate-500" dir="auto">{requester?.name || '—'} · {request.role}</p>
          {request.note && <p className="mt-2 text-sm text-slate-600" dir="auto">{request.note}</p>}
        </div>
        <Badge color={STATUS_COLOR[request.status]||'slate'} size="xs">{statusLabel(request.status,isAr)}</Badge>
      </div>
      {canManage && request.status==='open' && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
          <Select label={isAr?'اختر البديل':'Choose substitute'} value={substituteId} onChange={event=>setSubstituteId(event.target.value)}>
            <option value="">{isAr?'اختر عضواً...':'Select a member...'}</option>
            {candidates.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}
          </Select>
          <Btn size="sm" disabled={!substituteId} onClick={()=>onFill(request.id,substituteId)} icon={<UserRoundCheck size={14}/>}>{isAr?'تعيين':'Assign'}</Btn>
        </div>
      )}
      {canCancel && <Btn variant="secondary" size="xs" onClick={()=>onCancel(request.id)} icon={<X size={13}/>}>{isAr?'إلغاء الطلب':'Cancel request'}</Btn>}
    </Card>
  )
}

export default function Requests() {
  const { isAr } = useLang()
  const {
    currentUser, people, services, excuseRequests, substituteRequests,
    reviewExcuse, cancelExcuse, fillSubstituteRequest, cancelSubstituteRequest,
  } = useStore()
  const [tab, setTab] = useState('excuses')
  const canManage = canManageWorship(currentUser)
  const visibleExcuses = excuseRequests.filter(request => canManage || request.person_id===currentUser.id)
  const visibleSubstitutes = substituteRequests.filter(request => (
    canManage || request.requester_id===currentUser.id || request.substitute_id===currentUser.id
  ))

  return (
    <div className="max-w-4xl space-y-5 animate-fade-in">
      <Tabs active={tab} onChange={setTab} tabs={[
        { value:'excuses', label:isAr?'الأعذار':'Excuses', count:visibleExcuses.filter(item=>item.status==='pending').length },
        { value:'substitutes', label:isAr?'طلبات البديل':'Substitutes', count:visibleSubstitutes.filter(item=>item.status==='open').length },
      ]}/>

      {tab==='excuses' && (
        <div className="space-y-3">
          {visibleExcuses.length===0 ? <EmptyState icon={<ClipboardList size={26}/>} title={isAr?'لا توجد أعذار':'No excuse requests'}/> : visibleExcuses.map(request => {
            const service = services.find(item => item.id===request.service_id)
            const person = people.find(item => item.id===request.person_id)
            return (
              <Card key={request.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-800" dir="auto">{service?.title || (isAr?'خدمة غير متاحة':'Unavailable service')}</h3>
                    <p className="mt-1 text-sm text-slate-500" dir="auto">{person?.name || '—'}</p>
                    <p className="mt-2 text-sm text-slate-700" dir="auto">{request.reason}</p>
                  </div>
                  <Badge color={STATUS_COLOR[request.status]||'slate'} size="xs">{statusLabel(request.status,isAr)}</Badge>
                </div>
                {canManage && request.status==='pending' && (
                  <div className="mt-3 flex gap-2">
                    <Btn size="xs" variant="success" onClick={()=>reviewExcuse(request.id,'approved')} icon={<Check size={13}/>}>{isAr?'قبول':'Approve'}</Btn>
                    <Btn size="xs" variant="danger" onClick={()=>reviewExcuse(request.id,'rejected')} icon={<X size={13}/>}>{isAr?'رفض':'Reject'}</Btn>
                  </div>
                )}
                {request.person_id===currentUser.id && request.status==='pending' && (
                  <div className="mt-3">
                    <Btn size="xs" variant="secondary" onClick={()=>cancelExcuse(request.id)} icon={<X size={13}/>}>{isAr?'إلغاء العذر':'Cancel excuse'}</Btn>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {tab==='substitutes' && (
        <div className="space-y-3">
          {visibleSubstitutes.length===0 ? <EmptyState icon={<UserRoundCheck size={26}/>} title={isAr?'لا توجد طلبات بديل':'No substitute requests'}/> : visibleSubstitutes.map(request => (
            <SubstituteRequestCard key={request.id} request={request} people={people} services={services} currentUser={currentUser}
              canManage={canManage} onFill={fillSubstituteRequest} onCancel={cancelSubstituteRequest} isAr={isAr}/>
          ))}
        </div>
      )}
    </div>
  )
}
