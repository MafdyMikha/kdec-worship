export function quarterBounds(year, quarter) {
  if (!Number.isInteger(+year) || +year < 2000 || +year > 2200 || ![1,2,3,4].includes(+quarter)) throw new Error('Invalid quarter')
  return { start:`${year}-${String((quarter-1)*3+1).padStart(2,'0')}-01`, end:quarter===4 ? `${+year+1}-01-01` : `${year}-${String(quarter*3+1).padStart(2,'0')}-01` }
}

export function quarterServices(services, year, quarter) {
  const {start,end}=quarterBounds(year,quarter)
  return services.filter(s=>s.date>=start&&s.date<end).sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
}

export function weightedCandidate(candidates, random=Math.random) {
  return candidates.map(candidate=>({candidate,score:-Math.log(Math.max(random(),1e-9))*(1+candidate.assignments+2*candidate.replacements)})).sort((a,b)=>a.score-b.score)[0]?.candidate || null
}

export const normalizeScheduleNotification = row => ({id:row.id,recipient:row.recipient,serviceId:row.service_id,kind:row.kind,createdAt:row.created_at,readAt:row.read_at})

export function normalizeQuarterly({quarters=[],slots=[],attempts=[],inbox=[],audit=[],ready=false}) {
  return {
    ready,
    quarters:quarters.map(row=>({startsOn:row.starts_on,publishedAt:row.published_at,publishedBy:row.published_by})),
    slots:slots.map(row=>({id:row.id,quarter:row.quarter,serviceId:row.service_id,roleId:row.role_id,role:row.role,leader:row.leader,personId:row.person_id,state:row.state,sourceAssignment:row.source_assignment,version:row.version})),
    attempts:attempts.map(row=>({id:row.id,slotId:row.slot_id,personId:row.person_id,state:row.state,replacement:row.replacement,createdAt:row.created_at})),
    inbox:inbox.map(normalizeScheduleNotification),
    audit:audit.map(row=>({id:row.id,slotId:row.slot_id,actor:row.actor,action:row.action,personId:row.person_id,createdAt:row.created_at})),
  }
}

// Each page uses a stable primary-key order. Return errors without partial data.
export async function loadScheduleRows(client, table) {
  const data=[]
  for(let offset=0;;offset+=500){
    const result=await client.from(table).select('*').order('id').range(offset,offset+499)
    if(result.error)return {data:null,error:result.error}
    data.push(...result.data)
    if(result.data.length<500)return {data,error:null}
  }
}

export const scheduleLabels = {
  en:{pending:'Pending response',confirmed:'Confirmed',declined:'Declined',vacant:'Unresolved vacancy',scheduled:'Scheduled',completed:'Completed',cancelled:'Cancelled',draft:'Draft',published:'Published',proposed:'Proposed',approved:'Approved',rejected:'Rejected',account_unavailable:'Account unavailable',assignment:'Quarter published: review your assignment',replacement_assignment:'Replacement approved: please respond',approval_required:'Replacement needs your approval',leader_required:'Super Admin: select a Worship Leader',no_candidate:'No eligible replacement found'},
  ar:{pending:'بانتظار الرد',confirmed:'مؤكد',declined:'معتذر',vacant:'مكان شاغر',scheduled:'مجدولة',completed:'مكتملة',cancelled:'ملغاة',draft:'مسودة',published:'منشور',proposed:'مقترح',approved:'معتمد',rejected:'مرفوض',account_unavailable:'الحساب غير متاح',assignment:'تم نشر الجدول: راجع تكليفك',replacement_assignment:'تم اعتمادك كبديل: يرجى الرد',approval_required:'بديل يحتاج موافقتك',leader_required:'المسؤول الأعلى: اختر قائد تسبيح',no_candidate:'لا يوجد بديل مناسب'},
}
