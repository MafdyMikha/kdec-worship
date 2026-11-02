// Explicit database/read boundary for the ministry extension. Unknown JSON keys
// retain their names; all schema-owned multiword fields are mapped here.
const FIELDS={person_id:'personId',service_id:'serviceId',evaluator_id:'evaluatorId',criterion_id:'criterionId',name_ar:'nameAr',family_id:'familyId',display_order:'displayOrder',created_at:'createdAt',updated_at:'updatedAt',join_date:'joinDate',serving_status:'servingStatus',leader_quote:'leaderQuote',recorded_by:'recordedBy',sent_at:'sentAt',responded_at:'respondedAt',request_key:'requestKey',evaluation_id:'evaluationId'}
export function normalizeMinistryRow(row) {
  if(Array.isArray(row))return row.map(normalizeMinistryRow)
  if(!row||typeof row!=='object')return row
  return Object.fromEntries(Object.entries(row).map(([key,value])=>[FIELDS[key]||key,normalizeMinistryRow(value)]))
}
export function ministryPayload(rpc,data) {
  if(rpc==='ministry_save_member')return {person_id:data.personId,category:data.category,serving_status:data.servingStatus,leader_quote:data.leaderQuote||''}
  if(rpc==='ministry_save_criterion')return {id:data.id||null,name:data.name,name_ar:data.nameAr||'',audience:data.audience,minimum:Number(data.minimum),maximum:Number(data.maximum),weight:Number(data.weight),display_order:Number(data.displayOrder),active:data.active!==false}
  if(rpc==='ministry_save_rating')return {person_id:data.personId,service_id:data.serviceId||null,audience:data.audience,scores:data.scores.map(score=>({criterion_id:score.criterionId,value:Number(score.value)})),comment:data.comment||'',state:data.state||null,revision:data.revision??null}
  if(rpc==='ministry_save_guest')return {id:data.id||null,name:data.name,roles:data.roles,status:data.status||'active'}
  throw new Error('Unsupported ministry write.')
}

export async function loadReportAttendanceSessions(client) {
  const data=[]
  for(let offset=0;;offset+=500){
    const result=await client.rpc('get_report_attendance_sessions',{p_offset:offset})
    if(result.error)return {data:null,error:result.error}
    data.push(...result.data)
    if(result.data.length<500)return {data,error:null}
  }
}
