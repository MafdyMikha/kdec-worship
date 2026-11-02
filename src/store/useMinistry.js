import { zonedDateTimeToUtc } from '../lib/attendance.js'
import { ministryPayload, normalizeMinistryRow } from '../lib/ministryData.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { canEvaluate, validateCriterion, validateScores } from '../lib/ministry.js'
import { hasPermission, isSuperAdminUser } from '../lib/permissions.js'
import { normalizePlanningFields } from '../lib/planningCalendar.js'

const empty = () => ({access:[],members:[],guests:[],guestAssignments:[],criteria:[],ratings:[],evaluations:[],revisions:[],appearances:[],responses:[],tags:[],memberHistory:[]})
const tables={access:'ministry_access_roles',members:'ministry_members',guests:'ministry_guests',guestAssignments:'ministry_guest_assignments',criteria:'rating_criteria',ratings:'member_ratings',evaluations:'service_evaluations',revisions:'evaluation_revisions',appearances:'member_stage_appearances',responses:'assignment_response_history',tags:'song_tag_catalog',memberHistory:'ministry_member_history'}
const orderKeys={access:'person_id,role',members:'person_id',guestAssignments:'service_id,person_id',appearances:'service_id,person_id'}
async function readAll(key) {
  const rows=[]
  for(let offset=0;;offset+=500){
    let query=supabase.from(tables[key]).select('*')
    for(const column of (orderKeys[key]||'id').split(','))query=query.order(column)
    const result=await query.range(offset,offset+499)
    if(result.error)throw new Error(result.error.message)
    rows.push(...result.data)
    if(result.data.length<500)return rows.map(normalizeMinistryRow)
  }
}
const savedDemo=()=>{try{return {...empty(),...normalizeMinistryRow(JSON.parse(localStorage.getItem('kdec_ministry_v1')||'{}'))}}catch{return empty()}}

export function useMinistry({currentUser,setCurrentUser,isDemoMode,demoReady,people,services,setServices,songs,setSongs,loadAll}) {
  const [state,setState]=useState(empty)
  const [ready,setReady]=useState(false)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const generation=useRef(0)
  const userId=currentUser?.id
  const actor=useRef(currentUser)
  useEffect(()=>{actor.current=currentUser},[currentUser])

  const refresh=useCallback(async()=>{
    const sequence=++generation.current
    if(!userId || (isDemoMode&&!demoReady))return
    setLoading(true);setError('')
    try{
      let next
      if(isDemoMode)next=savedDemo()
      else{
        const access=await readAll('access')
        const user={...actor.current,ministryRoles:access.filter(row=>row.personId===userId).map(row=>row.role)}
        const keys=['members','guests','guestAssignments','tags','appearances','responses']
        if(hasPermission(user,'ratings.view')||hasPermission(user,'ratings.configure')||canEvaluate(user))keys.push('criteria')
        if(hasPermission(user,'ratings.view'))keys.push('ratings')
        if(canEvaluate(user))keys.push('evaluations','revisions')
        if(hasPermission(user,'reports.view'))keys.push('memberHistory')
        const results=await Promise.all(keys.map(async key=>[key,await readAll(key)]))
        next={...empty(),access,...Object.fromEntries(results)}
      }
      if(sequence!==generation.current)return
      setState({...next,_owner:userId});setReady(true)
      setCurrentUser(previous=>previous?.id===userId?{...previous,ministryRoles:next.access.filter(row=>row.personId===userId).map(row=>row.role)}:previous)
      return {success:true}
    }catch(caught){if(sequence===generation.current){setState(empty());setReady(false);setError(caught.message)}return {error:caught.message}}
    finally{if(sequence===generation.current)setLoading(false)}
  },[userId,isDemoMode,demoReady,setCurrentUser])
  useEffect(()=>{
    // Loading is external synchronization; generation guards account changes.
    const tracker=generation
    void refresh()
    return ()=>{tracker.current++}
  },[refresh])
  const visibleState=userId&&ready&&state._owner===userId?state:empty()

  const mutate=async(rpc,args,permission,update)=>{
    if(!userId||!hasPermission(actor.current,permission))return {error:'You do not have permission to make this change.'}
    if(!ready||state._owner!==userId)return {error:'Apply MIGRATION_ministry_insights.sql and refresh before editing.'}
    const sequence=generation.current,owner=userId
    try{
      if(isDemoMode){
        const next=update(savedDemo())
        localStorage.setItem('kdec_ministry_v1',JSON.stringify(next))
        if(sequence===generation.current&&actor.current?.id===owner)setState({...next,_owner:userId})
        return {success:true}
      }
      const result=await supabase.rpc(rpc,args.p_data?{p_data:ministryPayload(rpc,args.p_data)}:args)
      if(result.error)return {error:result.error.message}
      if(sequence!==generation.current||actor.current?.id!==owner)return {error:'Account changed. Reload to view the saved result.'}
      const refreshed=await refresh()
      if(refreshed?.error)return {error:`Saved, but reload failed: ${refreshed.error}`}
      return {success:true,data:result.data}
    }catch(caught){return {error:caught.message}}
  }
  const saveMember=data=>mutate('ministry_save_member',{p_data:data},'users.edit',old=>({...old,members:[...old.members.filter(row=>row.personId!==data.personId),{...data,updatedAt:new Date().toISOString()}],memberHistory:[...old.memberHistory,{id:crypto.randomUUID(),personId:data.personId,snapshot:data,actor:userId,createdAt:new Date().toISOString()}]}))
  const setRoles=(personId,roles)=>{
    if(!isSuperAdminUser(actor.current))return Promise.resolve({error:'Super Admin required.'})
    return mutate('ministry_set_roles',{p_person:personId,p_roles:roles},'roles.manage',old=>({...old,access:[...old.access.filter(row=>row.personId!==personId),...roles.map(role=>({personId:personId,role}))]}))
  }
  const saveCriterion=data=>{
    const invalid=validateCriterion(data)
    if(invalid)return Promise.resolve({error:invalid})
    return mutate('ministry_save_criterion',{p_data:data},'ratings.configure',old=>{
      const prior=old.criteria.find(row=>row.id===data.id)
      if(data.active!==false&&old.criteria.some(row=>row.active&&row.familyId!==prior?.familyId&&row.audience===data.audience&&row.name.trim().toLowerCase()===data.name.trim().toLowerCase()))throw new Error('A criterion with this name already exists.')
      const family=prior?.familyId||crypto.randomUUID()
      const version=Math.max(0,...old.criteria.filter(row=>row.familyId===family).map(row=>row.version))+1
      return {...old,criteria:[...old.criteria.map(row=>row.familyId===family?{...row,active:false}:row),{...data,id:crypto.randomUUID(),familyId:family,version,minimum:Number(data.minimum),maximum:Number(data.maximum),weight:Number(data.weight),displayOrder:Number(data.displayOrder),createdAt:new Date().toISOString()}]}
    })
  }
  const saveRating=data=>{
    const evaluation=Boolean(data.serviceId)
    const invalid=validateScores(data.scores,visibleState.criteria.filter(row=>row.active&&row.audience===data.audience))
    if(invalid)return Promise.resolve({error:invalid})
    if(!data.scores.length&&(!evaluation||data.state==='submitted'))return Promise.resolve({error:'Select at least one rating.'})
    if(evaluation&&(!services.some(row=>row.id===data.serviceId&&row.status==='completed')||!services.find(row=>row.id===data.serviceId)?.team.some(row=>row.personId===data.personId)&&!visibleState.guestAssignments.some(row=>row.serviceId===data.serviceId&&row.personId===data.personId)))return Promise.resolve({error:'Choose a participant in a completed service.'})
    return mutate('ministry_save_rating',{p_data:data},evaluation?'evaluations.manage':`ratings.${data.audience}`,old=>{
      const scores=data.scores.map(score=>({...old.criteria.find(row=>row.id===score.criterionId),...score,value:Number(score.value)}))
      const prior=old.evaluations.find(row=>row.serviceId===data.serviceId&&row.personId===data.personId&&row.evaluatorId===userId&&row.audience===data.audience)
      if(evaluation&&prior&&prior.revision!==data.revision)throw new Error('Evaluation changed. Reload before editing.')
      const saved={...data,id:prior?.id||crypto.randomUUID(),evaluatorId:userId,scores,revision:(prior?.revision||0)+1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}
      return evaluation?{...old,evaluations:[...old.evaluations.filter(row=>row.id!==saved.id),saved],revisions:[...old.revisions,{id:crypto.randomUUID(),evaluationId:saved.id,snapshot:saved,createdAt:saved.updatedAt}]}:{...old,ratings:[saved,...old.ratings]}
    })
  }
  const saveGuest=data=>{
    if(!data.name?.trim()||!data.roles?.length)return Promise.resolve({error:'Enter a guest name and at least one role.'})
    return mutate('ministry_save_guest',{p_data:data},'users.edit',old=>({...old,guests:[...old.guests.filter(row=>row.id!==data.id),{...data,id:data.id||crypto.randomUUID(),name:data.name.trim(),joinDate:old.guests.find(row=>row.id===data.id)?.joinDate||new Date().toISOString().slice(0,10)}]}))
  }
  const assignGuest=(serviceId,guestId,role,remove=false)=>mutate('ministry_assign_guest',{p_service:serviceId,p_guest:guestId,p_role:role,p_remove:remove},'schedules.manage',old=>{
    if(!services.some(service=>service.id===serviceId&&service.status!=='cancelled'))throw new Error('Choose an active service.')
    if(!remove&&!old.guests.some(guest=>guest.id===guestId&&guest.status==='active'&&guest.roles.includes(role)))throw new Error('Choose an active guest and matching role.')
    return {...old,guestAssignments:[...old.guestAssignments.filter(row=>row.serviceId!==serviceId||row.personId!==guestId),...(remove?[]:[{serviceId:serviceId,personId:guestId,role,status:'confirmed'}])]}
  })
  const recordStage=(serviceId,personId,played)=>{
    const ownLeader=services.find(row=>row.id===serviceId)?.team.some(row=>row.personId===userId&&(row.role==='Worship Leader'||row.roleDefinition?.scheduleLeaderRole)&&row.status==='confirmed')
    const permission=hasPermission(actor.current,'schedules.manage')?'schedules.manage':canEvaluate(actor.current)?'evaluations.manage':ownLeader?'services.view':'schedules.manage'
    if(!services.some(row=>row.id===serviceId&&row.status==='completed'))return Promise.resolve({error:'Choose a completed service.'})
    if(!services.find(row=>row.id===serviceId)?.team.some(row=>row.personId===personId)&&!visibleState.guestAssignments.some(row=>row.serviceId===serviceId&&row.personId===personId))return Promise.resolve({error:'Choose an assigned participant.'})
    return mutate('ministry_record_stage',{p_service:serviceId,p_person:personId,p_played:played},permission,old=>({...old,appearances:[...old.appearances.filter(row=>row.serviceId!==serviceId||row.personId!==personId),{serviceId:serviceId,personId:personId,played,recordedBy:userId,updatedAt:new Date().toISOString()}]}))
  }
  const completeService=async(serviceId)=>{
    const event=services.find(row=>row.id===serviceId)
    if(!event?.publishedAt||event.status!=='scheduled')return {error:'Publish this event before completing it.'}
    if(!event.endTime||zonedDateTimeToUtc(event.endDate||event.date,event.endTime)>new Date())return {error:'Complete this event after its scheduled end time.'}
    const permission=hasPermission(actor.current,'services.edit')?'services.edit':'schedules.manage'
    const result=await mutate('ministry_complete_service',{p_service:serviceId},permission,old=>old)
    if(!result.error){if(isDemoMode)setServices(previous=>previous.map(row=>row.id===serviceId?{...row,status:'completed'}:row));else{const refreshed=await loadAll();if(refreshed?.error)return refreshed}}
    return result
  }
  const finalizeSetlist=async(serviceId,finalized)=>{
    if(!services.some(row=>row.id===serviceId&&row.status==='completed'))return {error:'Choose a completed service.'}
    const result=await mutate('ministry_finalize_setlist',{p_service:serviceId,p_finalized:finalized},'services.edit',old=>old)
    if(!result.error){if(isDemoMode)setServices(previous=>previous.map(row=>row.id===serviceId?{...row,setlistFinalized:finalized}:row));else {const refreshed=await loadAll();if(refreshed?.error)return refreshed}}
    return result
  }
  const registerDemoTags=tags=>{
    if(!isDemoMode||!hasPermission(actor.current,'songs.manage'))return {error:'Song management permission required.'}
    try{
      const next=savedDemo(),canonical=[]
      for(const value of tags){
        let tag=next.tags.find(row=>row.name.toLowerCase()===value.toLowerCase())
        if(!tag){tag={id:crypto.randomUUID(),name:value,active:true};next.tags.push(tag)}
        canonical.push(tag.name)
      }
      localStorage.setItem('kdec_ministry_v1',JSON.stringify(next));setState({...next,_owner:userId})
      return {success:true,data:[...new Set(canonical)]}
    }catch(caught){return {error:caught.message}}
  }
  const manageTag=async(id,name,active=true)=>{
    const clean=name.trim()
    if(!clean||clean.length>80)return {error:'Enter a tag of 1–80 characters.'}
    const prior=visibleState.tags.find(tag=>tag.id===id)
    const result=await mutate('ministry_manage_tag',{p_id:id,p_name:clean,p_active:active},'songs.manage',old=>{
      const canonical=old.tags.find(tag=>tag.id!==id&&tag.name.toLowerCase()===clean.toLowerCase())
      if(!id&&canonical)throw new Error('A tag with this name already exists.')
      return {...old,tags:prior?old.tags.map(tag=>tag.id===id?{...tag,name:canonical?tag.name:clean,active:canonical?false:active}:tag):[...old.tags,{id:crypto.randomUUID(),name:clean,active}]}
    })
    if(!result.error){
      if(isDemoMode&&prior)setSongs(previous=>previous.map(song=>({...song,themes:[...new Set((song.themes||song.tags||[]).map(tag=>tag.toLowerCase()===prior.name.toLowerCase()?clean:tag))]})))
      else if(!isDemoMode){const refreshed=await loadAll();if(refreshed?.error)return refreshed}
    }
    return result
  }
  const bulkSchedule=async(rows)=>{
    if(!hasPermission(actor.current,'schedules.manage'))return {error:'Schedule management permission required.'}
    if(!ready||state._owner!==userId)return {error:'Apply MIGRATION_ministry_insights.sql before importing.'}
    if(!rows.length||rows.length>52)return {error:'Import 1–52 events at a time.'}
    if(rows.some(row=>services.some(service=>service.date===row.date&&service.time===row.time&&service.title.trim().toLowerCase()===row.title.trim().toLowerCase())))return {error:'An event already exists. Refresh and review the preview.'}
    if(isDemoMode){
      setServices(previous=>[...previous,...rows.map(row=>({...normalizePlanningFields(row),id:row.id,title:row.title,type:row.event_kind,date:row.date,time:row.time,notes:row.notes,practice:null,status:'draft',setlist:[],subcategory:row.subcategory||'',team:row.team.map(member=>({personId:member.person_id,roleId:member.worship_role_id,role:member.role,status:'pending',person:people.find(person=>person.id===member.person_id)}))}))]);return {success:true,count:rows.length}
    }
    const {error}=await supabase.rpc('ministry_bulk_schedule',{p_events:rows})
    if(error)return {error:error.message}
    const refreshed=await loadAll();return refreshed?.error?{error:`Imported, but reload failed. Refresh before retrying. ${refreshed.error}`}:{success:true,count:rows.length}
  }
  const saveSubcategory=async(serviceId,subcategory)=>{
    const result=await mutate('ministry_save_subcategory',{p_service:serviceId,p_subcategory:subcategory},'services.edit',old=>old)
    if(!result.error){if(isDemoMode)setServices(previous=>previous.map(row=>row.id===serviceId?{...row,subcategory:subcategory.trim()}:row));else{const refreshed=await loadAll();if(refreshed?.error)return refreshed}}
    return result
  }
  const enrichedPeople=people.map(person=>{
    const metadata=visibleState.members.find(row=>row.personId===person.id)
    return {...person,category:metadata?.category||'member',servingStatus:metadata?.servingStatus||({ 'on-leave':'leave' }[person.status]||person.status),leaderQuote:metadata?.leaderQuote||'',ministryRoles:visibleState.access.filter(row=>row.personId===person.id).map(row=>row.role)}
  })
  const guests=visibleState.guests.map(guest=>({...guest,category:'outsider',servingStatus:guest.status==='on-leave'?'leave':guest.status,joinDate:guest.joinDate,guest:true}))
  const enrichedServices=services.map(service=>({...service,setlistFinalized:service.setlistFinalized??service.setlist_finalized??false,team:[...(service.team||[]),...visibleState.guestAssignments.filter(row=>row.serviceId===service.id).map(row=>({personId:row.personId,role:row.role,status:row.status,guest:true}))]}))
  // Demo data remains local. Live private evaluations are fetched only for authorized roles.
  void songs
  return {...visibleState,evaluations:canEvaluate(currentUser)?visibleState.evaluations:[],revisions:canEvaluate(currentUser)?visibleState.revisions:[],ratings:hasPermission(currentUser,'ratings.view')?visibleState.ratings:[],ready:ready&&state._owner===userId,error,loading,refresh,saveMember,setRoles,saveCriterion,saveRating,saveGuest,assignGuest,recordStage,finalizeSetlist,completeService,registerDemoTags,manageTag,bulkSchedule,saveSubcategory,people:enrichedPeople,guests,services:enrichedServices}
}
